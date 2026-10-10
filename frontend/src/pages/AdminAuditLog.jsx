import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  FileText, ArrowLeft, RefreshCw, Filter, Search, 
  ShieldCheck, Eye, KeyRound, AlertTriangle
} from 'lucide-react';
import { getMyCommunities, getCommunityAuditLogs } from '../api/admin';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';

export default function AdminAuditLog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const commParam = searchParams.get('comm');

  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
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
      loadLogs();
    }
  }, [selectedCommunityId, currentPage]);

  const loadLogs = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await getCommunityAuditLogs(selectedCommunityId, currentPage, 30);
      setLogs(data.items || []);
      setTotalLogs(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load audit trail logs.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      (log.detail && log.detail.toLowerCase().includes(term)) ||
      (log.target_type && log.target_type.toLowerCase().includes(term))
    );
  });

  const getActionBadge = (action) => {
    if (action.includes('reveal')) {
      return (
        <span className="text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <Eye className="w-3 h-3" /> Unmask Value
        </span>
      );
    }
    if (action.includes('review')) {
      return (
        <span className="text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full">
          Review Recorded
        </span>
      );
    }
    if (action.includes('code')) {
      return (
        <span className="text-[11px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <KeyRound className="w-3 h-3" /> Access Code
        </span>
      );
    }
    if (action.includes('view')) {
      return (
        <span className="text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">
          Inspection
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">
        {action.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return <LoadingSpinner text="Loading audit trail records..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">Accountability & Privacy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Immutable Audit Trail
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every unmasking event, submission view, review decision, and code revocation is permanently logged.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCommunityId || ''}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setSelectedCommunityId(newId);
              setSearchParams({ comm: newId });
              setCurrentPage(1);
            }}
            className="bg-slate-800 text-white text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={loadLogs}
            disabled={refreshing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Audit Log Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">System Events Registry</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing {filteredLogs.length} events (Page {currentPage} of {totalPages})
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search actions or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Audit Records"
              description="No audit trail events found matching the selected criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-3.5 px-4 font-semibold">Actor</th>
                  <th className="py-3.5 px-4 font-semibold">Action</th>
                  <th className="py-3.5 px-4 font-semibold">Target</th>
                  <th className="py-3.5 px-4 font-semibold">Activity Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-300">
                      User #{log.actor_id}
                    </td>
                    <td className="py-3 px-4">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">
                      {log.target_type ? `${log.target_type} #${log.target_id || ''}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-200">
                      {log.detail || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-slate-800 rounded border border-slate-700 disabled:opacity-50 hover:bg-slate-700 text-white font-medium"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-slate-800 rounded border border-slate-700 disabled:opacity-50 hover:bg-slate-700 text-white font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
