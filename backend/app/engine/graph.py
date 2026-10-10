from typing import Optional, List, Dict, Any
import networkx as nx
from sqlalchemy.orm import Session

from backend.app.models.models import Submission, Link, Membership, User
from backend.app.engine.stage2_linking import mask_hint

def build_networkx_graph(
    community_id: Optional[int],
    db: Session
) -> nx.Graph:
    G = nx.Graph()

    query = db.query(Link)
    if community_id is not None:
        query = query.filter(Link.community_id == community_id)
    links = query.all()

    if not links:
        return G

    # Collect unique submission IDs
    sub_ids = set()
    for l in links:
        sub_ids.add(l.submission_a)
        sub_ids.add(l.submission_b)

    # Fetch submission details in bulk
    submissions = db.query(Submission).filter(Submission.id.in_(sub_ids)).all()
    sub_map = {s.id: s for s in submissions}

    # Add nodes with metadata
    for sid in sub_ids:
        s = sub_map.get(sid)
        if s:
            user_name = "Household Applicant"
            if s.membership and s.membership.user:
                user_name = s.membership.user.name

            G.add_node(
                sid,
                id=sid,
                label=f"Claim #{sid} ({mask_hint(user_name)})",
                applicant_name=mask_hint(user_name),
                risk_score=s.risk_score,
                status=s.status,
                review_status=s.review_status,
                community_id=s.community_id,
                created_at=s.created_at.isoformat() if s.created_at else None
            )

    # Add edges with attributes
    for l in links:
        G.add_edge(
            l.submission_a,
            l.submission_b,
            id=l.id,
            link_type=l.link_type,
            strength=l.strength,
            matched_value_hint=l.matched_value_hint,
            explanation=l.explanation,
            community_id=l.community_id
        )

    return G

def get_ranked_clusters(
    community_id: Optional[int],
    db: Session
) -> List[Dict[str, Any]]:
    """
    Finds all connected components (claim networks),
    calculates cluster strength and sizes, and ranks them.
    """
    G = build_networkx_graph(community_id, db)
    if G.number_of_nodes() == 0:
        return []

    comps = list(nx.connected_components(G))
    # Filter to clusters with at least 2 nodes
    multi_node_comps = [c for c in comps if len(c) >= 2]

    cluster_summaries = []
    for c in multi_node_comps:
        nodes = list(c)
        subgraph = G.subgraph(nodes)
        edge_data = list(subgraph.edges(data=True))

        total_strength = sum(d.get("strength", 1.0) for _, _, d in edge_data)
        link_types = list(set(d.get("link_type", "") for _, _, d in edge_data))
        risk_scores = [G.nodes[n].get("risk_score", 0.0) for n in nodes]
        max_risk = max(risk_scores) if risk_scores else 0.0
        avg_risk = round(sum(risk_scores) / len(nodes), 1) if nodes else 0.0

        # Review statuses in this cluster
        review_statuses = [G.nodes[n].get("review_status") for n in nodes if G.nodes[n].get("review_status")]

        cluster_summaries.append({
            "nodes_count": len(nodes),
            "submission_ids": sorted(nodes),
            "total_strength": round(total_strength, 2),
            "max_risk_score": max_risk,
            "avg_risk_score": avg_risk,
            "link_types": link_types,
            "review_statuses": review_statuses
        })

    # Rank by total_strength, then nodes_count descending
    cluster_summaries.sort(
        key=lambda x: (x["total_strength"], x["nodes_count"], x["max_risk_score"]),
        reverse=True
    )

    # Assign 0-indexed cluster_id
    for idx, cluster in enumerate(cluster_summaries):
        cluster["cluster_id"] = idx

    return cluster_summaries

def get_graph_export(
    community_id: Optional[int],
    db: Session,
    component_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Exports nodes and links formatted for react-force-graph-2d / vis-network.
    If component_id is provided, extracts only that cluster.
    """
    clusters = get_ranked_clusters(community_id, db)
    G = build_networkx_graph(community_id, db)

    target_nodes = set()
    if component_id is not None and 0 <= component_id < len(clusters):
        target_nodes = set(clusters[component_id]["submission_ids"])
    elif clusters:
        # Default to first (highest-ranked) cluster if components exist
        target_nodes = set(clusters[0]["submission_ids"])
        component_id = 0
    else:
        target_nodes = set(G.nodes())
        component_id = None

    subgraph = G.subgraph(target_nodes)

    nodes = [
        {
            "id": n,
            "label": G.nodes[n].get("label", f"Claim #{n}"),
            "applicant_name": G.nodes[n].get("applicant_name", ""),
            "risk_score": G.nodes[n].get("risk_score", 0.0),
            "status": G.nodes[n].get("status", "pending"),
            "review_status": G.nodes[n].get("review_status"),
            "community_id": G.nodes[n].get("community_id")
        }
        for n in subgraph.nodes()
    ]

    links = [
        {
            "id": d.get("id"),
            "source": u,
            "target": v,
            "link_type": d.get("link_type", ""),
            "strength": d.get("strength", 1.0),
            "explanation": d.get("explanation", ""),
            "matched_value_hint": d.get("matched_value_hint", "")
        }
        for u, v, d in subgraph.edges(data=True)
    ]

    return {
        "nodes": nodes,
        "links": links,
        "clusters_count": len(clusters),
        "selected_cluster_id": component_id,
        "clusters_summary": clusters
    }
