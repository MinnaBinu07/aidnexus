import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Network, ArrowLeft, RefreshCw, Filter, Layers, 
  Eye, AlertCircle, Info, ShieldAlert
} from 'lucide-react';
import { getMyCommunities, getCommunityNetwork, getFlaggedQueue } from '../api/admin';
import NetworkGraph from '../components/NetworkGraph';
import SubmissionDetailModal from '../components/SubmissionDetailModal';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';
import { RiskBadge, StatusBadge } from '../components/BadgesAndCards';

export default function AdminNetworkView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const commParam = searchParams.get('comm');
  const clusterParam = searchParams.get('cluster');

  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [selectedClusterId, setSelectedClusterId] = useState(
    clusterParam !== null ? Number(clusterParam) : null
  );

  const [clusters, setClusters] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyCommunities(1, 100);
      const list = res.items || [];
      setCommunities(list);

      if (list.length > 0) {
        const initialId = commParam ? Number(commParam) : list[0].id;
        setSelectedCommunityId(initialId);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load communities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCommunityId) {
      loadNetworkAndClusters();
    }
  }, [selectedCommunityId, selectedClusterId]);

  const loadNetworkAndClusters = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const [qData, netData] = await Promise.all([
        getFlaggedQueue(selectedCommunityId),
        getCommunityNetwork(selectedCommunityId, selectedClusterId !== null ? selectedClusterId : undefined),
      ]);

      setClusters(qData.flagged_networks || []);
      setGraphData({
        nodes: netData.nodes || [],
        links: netData.links || [],
      });
      setSelectedNode(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load network graph data.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const handleClusterSelect = (cId) => {
    const val = cId === '' ? null : Number(cId);
    setSelectedClusterId(val);
    if (val !== null) {
      setSearchParams({ comm: selectedCommunityId, cluster: val });
    } else {
      setSearchParams({ comm: selectedCommunityId });
    }
  };

  if (loading) {
    return <LoadingSpinner text="Rendering interactive network graph..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">Graph Exploration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Linked Claims Network View
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visual graph mapping shared contact details, duplicate damage photos, and common bank accounts across households.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Community Selector */}
          <select
            value={selectedCommunityId || ''}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setSelectedCommunityId(newId);
              setSelectedClusterId(null);
              setSearchParams({ comm: newId });
            }}
            className="bg-slate-800 text-white text-xs rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          {/* Cluster Selector */}
          <select
            value={selectedClusterId !== null ? selectedClusterId : ''}
            onChange={(e) => handleClusterSelect(e.target.value)}
            className="bg-slate-800 text-white text-xs rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            <option value="">All Networks & Clusters</option>
            {clusters.map((cl) => (
              <option key={cl.component_id} value={cl.component_id}>
                Cluster #{cl.component_id} ({cl.size} claims, Max Score: {cl.max_risk_score})
              </option>
            ))}
          </select>

          <button
            onClick={loadNetworkAndClusters}
            disabled={refreshing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Network"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Main Graph View & Drawer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Graph Area (3 Cols) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-emerald-400" />
              Graph Canvas: {graphData.nodes.length} Nodes &bull; {graphData.links.length} Edges
            </span>
            <span className="text-[11px] text-slate-500">
              Drag nodes to rearrange &bull; Scroll to zoom &bull; Click node to inspect
            </span>
          </div>

          <div className="py-2">
            <NetworkGraph
              nodes={graphData.nodes}
              links={graphData.links}
              onNodeClick={handleNodeClick}
            />
          </div>

          {/* Edge Color Legend */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">Link Types:</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Phone
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Address
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Photo / Visual
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Bank Account
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> ID Number
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Similar Name
            </span>
          </div>
        </div>

        {/* Selected Node Details Drawer (1 Col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Claim Inspector
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any node on the graph canvas to inspect claim details.
            </p>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-emerald-400 font-semibold">
                    Claim #{selectedNode.id}
                  </span>
                  <RiskBadge score={selectedNode.risk_score} />
                </div>
                <div className="text-sm font-bold text-white">
                  {selectedNode.label || 'Applicant'}
                </div>
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Status:</span>
                  <StatusBadge status={selectedNode.status} />
                </div>
              </div>

              {selectedNode.risk_reasons && selectedNode.risk_reasons.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Flagged Clues:
                  </span>
                  <div className="space-y-1">
                    {selectedNode.risk_reasons.map((r, i) => (
                      <div
                        key={i}
                        className="text-xs bg-slate-950 border border-amber-500/20 text-amber-300/90 p-2 rounded-lg"
                      >
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setActiveSubmissionId(selectedNode.id)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                Inspect Full Claim & Review
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Info className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              No claim selected yet. Click any node in the network to view details and manual verification options.
            </div>
          )}

          {/* Connected Clusters Quick Jump */}
          <div className="pt-4 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Clusters in this Program:
            </span>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {clusters.map((c) => (
                <button
                  key={c.component_id}
                  onClick={() => handleClusterSelect(c.component_id)}
                  className={`w-full text-left text-xs p-2 rounded-lg border transition flex items-center justify-between ${
                    selectedClusterId === c.component_id
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="font-semibold">Cluster #{c.component_id}</span>
                  <span className="text-[11px] text-slate-400">
                    {c.size} claims &bull; Max {c.max_risk_score}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Integration */}
      {activeSubmissionId && (
        <SubmissionDetailModal
          submissionId={activeSubmissionId}
          onClose={() => setActiveSubmissionId(null)}
          onReviewSubmitted={() => {
            setActiveSubmissionId(null);
            loadNetworkAndClusters();
          }}
        />
      )}
    </div>
  );
}
