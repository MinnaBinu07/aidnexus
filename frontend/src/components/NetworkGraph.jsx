import React, { useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const NetworkGraph = ({ data, onNodeClick, height = 450 }) => {
  const fgRef = useRef();

  useEffect(() => {
    if (fgRef.current && data?.nodes?.length > 0) {
      fgRef.current.d3Force('charge').strength(-150);
    }
  }, [data]);

  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
        No connected claim clusters in this view.
      </div>
    );
  }

  // Format nodes and links for react-force-graph-2d
  const graphData = {
    nodes: data.nodes.map((n) => ({
      ...n,
      val: Math.max(4, Math.min(16, (n.risk_score || 0) / 6)),
      color: (n.risk_score || 0) >= 30 ? '#f59e0b' : '#6366f1',
    })),
    links: data.links.map((l) => ({
      ...l,
      color: l.strength >= 0.8 ? '#dc2626' : '#94a3b8',
      width: Math.max(1, (l.strength || 1) * 2.5),
    })),
  };

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800 relative">
      <div className="absolute top-3 left-3 z-10 bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 flex items-center space-x-3">
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Flagged Review</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          <span>Standard</span>
        </span>
        <span className="text-slate-400 border-l border-slate-700 pl-3">
          Click any node to inspect claim details
        </span>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeLabel={(node) => `Claim #${node.id} (${node.applicant_name}) - Risk: ${node.risk_score} pts`}
        linkLabel={(link) => `${link.explanation || link.link_type} (Strength: ${link.strength})`}
        onNodeClick={(node) => onNodeClick && onNodeClick(node.id)}
        nodeRelSize={5}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        height={height}
        backgroundColor="#0f172a"
      />
    </div>
  );
};

export default NetworkGraph;
