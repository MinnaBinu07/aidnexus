import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  KeyRound, Plus, Copy, Check, Ban, Filter, 
  ArrowLeft, RefreshCw, Users, ShieldCheck, Share2
} from 'lucide-react';
import { getMyCommunities, generateCodes, getCommunityCodes, revokeCode } from '../api/admin';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';

export default function AdminCodeGenerator() {
  const [searchParams, setSearchParams] = useSearchParams();
  const commParam = searchParams.get('comm');

  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [codes, setCodes] = useState([]);
  const [totalCodes, setTotalCodes] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Generation Modal / Controls
  const [showGenModal, setShowGenModal] = useState(false);
  const [genCount, setGenCount] = useState(5);
  const [labelPrefix, setLabelPrefix] = useState('Household');
  const [generating, setGenerating] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

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
      loadCodes();
    }
  }, [selectedCommunityId, statusFilter, currentPage]);

  const loadCodes = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await getCommunityCodes(
        selectedCommunityId,
        statusFilter || null,
        currentPage,
        25
      );
      setCodes(data.items || []);
      setTotalCodes(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load access codes.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBulkGenerate = async (e) => {
    e.preventDefault();
    if (!selectedCommunityId || genCount < 1) return;

    try {
      setGenerating(true);
      setError(null);
      const codeItems = Array.from({ length: genCount }, (_, i) => ({
        label: `${labelPrefix.trim() || 'Household'} #${totalCodes + i + 1}`,
        phone: null,
      }));

      await generateCodes(selectedCommunityId, codeItems);
      setShowGenModal(false);
      setCurrentPage(1);
      loadCodes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate codes.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (codeId) => {
    if (!window.confirm('Are you sure you want to revoke this access code? It will no longer be redeemable.')) {
      return;
    }
    try {
      await revokeCode(codeId);
      loadCodes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to revoke code.');
    }
  };

  const handleCopyLink = (codeStr, id) => {
    const url = `${window.location.origin}/join?code=${codeStr}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'unused':
        return (
          <span className="text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full">
            ● Unused
          </span>
        );
      case 'redeemed':
        return (
          <span className="text-[11px] font-semibold bg-blue-950/70 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-full">
            ✓ Redeemed
          </span>
        );
      case 'revoked':
        return (
          <span className="text-[11px] font-semibold bg-rose-950/70 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded-full">
            ✕ Revoked
          </span>
        );
      case 'expired':
        return (
          <span className="text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">
            Expired
          </span>
        );
      default:
        return <span className="text-[11px] text-slate-400">{status}</span>;
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading access codes registry..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/admin/communities" className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">Access Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Single-Use Access Codes
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Issue cryptographically unguessable single-use codes to eligible households. Once redeemed, the code is permanently burned.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
            onClick={() => setShowGenModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950 transition"
          >
            <Plus className="w-4 h-4" />
            Generate Codes
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Codes Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Issued Code Directory</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing {codes.length} of {totalCodes} access tokens
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="unused">Unused Only</option>
              <option value="redeemed">Redeemed Only</option>
              <option value="revoked">Revoked Only</option>
              <option value="expired">Expired Only</option>
            </select>

            <button
              onClick={loadCodes}
              disabled={refreshing}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
              title="Refresh Codes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {codes.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No Access Codes Found"
              description="No access codes match the current filter. Generate codes to distribute to households."
              actionText="Generate Access Codes"
              onAction={() => setShowGenModal(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Access Code</th>
                  <th className="py-3.5 px-4 font-semibold">Issued Household</th>
                  <th className="py-3.5 px-4 font-semibold">Phone (Optional)</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Created</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {codes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/60">
                          {c.code}
                        </span>
                        <button
                          onClick={() => handleCopyLink(c.code, c.id)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                          title="Copy Direct Join Link"
                        >
                          {copiedId === c.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white">
                      {c.issued_to_label || 'Unlabeled'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs font-mono">
                      {c.issued_to_phone || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(c.status)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {c.status === 'unused' ? (
                        <button
                          onClick={() => handleRevoke(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 transition"
                        >
                          <Ban className="w-3 h-3" />
                          Revoke
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Locked</span>
                      )}
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

      {/* Bulk Generate Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <h2 className="text-xl font-bold text-white">Generate Single-Use Codes</h2>
            <p className="text-xs text-slate-400">
              Each generated token can only be redeemed once during claim submission and binds the applicant to this relief program.
            </p>

            <form onSubmit={handleBulkGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Number of Codes to Generate (1 - 50)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Label Prefix
                </label>
                <input
                  type="text"
                  placeholder="Household, Ward 4 Family, Camp Bed"
                  value={labelPrefix}
                  onChange={(e) => setLabelPrefix(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Codes will be labeled: "{labelPrefix} #1", "{labelPrefix} #2", etc.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg transition"
                >
                  {generating ? 'Generating...' : `Generate ${genCount} Codes`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
