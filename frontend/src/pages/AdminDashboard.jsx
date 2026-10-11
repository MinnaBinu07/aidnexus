import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getMyCommunities, getCommunityStats, getFlaggedQueue, getCommunitySubmissions,
  generateAccessCodes, exportAuditLedger
} from '../api/admin';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';
import SubmissionDetailModal from '../components/SubmissionDetailModal';
import { formatApiError } from '../utils/formatError';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Active Tab: 'queue' or 'submissions'
  const [activeTab, setActiveTab] = useState('queue');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState('');
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);

  // Modals
  const [isAccessCodeModalOpen, setIsAccessCodeModalOpen] = useState(false);
  const [codeQty, setCodeQty] = useState(25);
  const [codeBatchTarget, setCodeBatchTarget] = useState('');
  const [generatingCodes, setGeneratingCodes] = useState(false);

  const codeModalRef = useRef(null);

  const showToast = (msg) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(''), 3000);
  };

  // 1. Initial Load Communities
  const loadCommunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyCommunities(1, 100);
      const list = data?.items || [];
      setCommunities(list);
      if (list.length > 0) {
        setSelectedCommunityId(list[0].id);
      }
    } catch (err) {
      setError(formatApiError(err, 'Failed to load relief communities.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  // 2. Fetch Dashboard Data when community or filters change
  const loadCommunityData = useCallback(async () => {
    if (!selectedCommunityId) return;

    try {
      setRefreshing(true);
      setError(null);

      const [statsData, queueData, subsData] = await Promise.all([
        getCommunityStats(selectedCommunityId),
        getFlaggedQueue(selectedCommunityId),
        getCommunitySubmissions(selectedCommunityId, {
          status_filter: statusFilter || undefined,
          risk_filter: riskFilter || undefined,
          sort_by: 'risk_desc',
          page: currentPage,
          page_size: 15,
        }),
      ]);

      setStats(statsData);
      setQueue(queueData?.flagged_networks || []);
      setSubmissions(subsData?.items || []);
      setTotalSubmissions(subsData?.total || 0);
      setTotalPages(subsData?.total_pages || 1);
    } catch (err) {
      setError(formatApiError(err, 'Failed to refresh relief community data.'));
    } finally {
      setRefreshing(false);
    }
  }, [selectedCommunityId, statusFilter, riskFilter, currentPage]);

  useEffect(() => {
    if (selectedCommunityId) {
      loadCommunityData();
    }
  }, [selectedCommunityId, loadCommunityData]);

  // Escape key for code modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isAccessCodeModalOpen) {
        setIsAccessCodeModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccessCodeModalOpen]);

  const handleReviewCompleted = () => {
    setActiveSubmissionId(null);
    loadCommunityData();
  };

  const handleGenerateCodes = async () => {
    if (!selectedCommunityId) return;
    try {
      setGeneratingCodes(true);
      const res = await generateAccessCodes(selectedCommunityId, codeQty);
      setIsAccessCodeModalOpen(false);
      showToast(`Generated ${res?.length || codeQty} access codes successfully!`);
      loadCommunityData();
    } catch (err) {
      showToast(formatApiError(err, 'Failed to generate access codes.'));
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleExportAudit = async () => {
    if (!selectedCommunityId) return;
    try {
      await exportAuditLedger(selectedCommunityId);
      showToast('Audit log export initiated successfully.');
    } catch (err) {
      showToast(formatApiError(err, 'Audit log export downloaded / completed.'));
    }
  };

  const currentCommunity = communities.find((c) => c.id === selectedCommunityId) || {};

  if (loading) {
    return <LoadingSpinner label="Connecting to Relief Administration Core..." />;
  }

  if (communities.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          title="No Relief Communities Found"
          description="You haven't set up any disaster relief programs yet. Create a program to begin issuing access codes and receiving claims."
          actionText="Create Relief Program"
          onAction={() => navigate('/admin/communities')}
        />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#f8f9ff] text-[#0b1c30] font-body relative overflow-x-hidden">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-6 w-full">
          {/* Header Block */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {/* Role access indicator */}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1dee3] text-[#6f6165] font-body text-xs font-semibold">
                  <span className="material-symbols-outlined text-[16px] text-[#7a1f3d]">shield_person</span>
                  Verified coordinator: <span className="font-code text-xs font-bold text-[#5c0427]">{currentCommunity.admin_name || 'Coordinator'}</span>
                </span>
                {/* Community Selector Pill */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0b1c30] font-body text-xs font-semibold border border-[#dac0c4]/40">
                  <span className="material-symbols-outlined text-[16px] text-[#554245]">location_city</span>
                  <span>Community:</span>
                  <select
                    value={selectedCommunityId || ''}
                    onChange={(e) => {
                      setSelectedCommunityId(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-transparent font-bold text-[#5c0427] cursor-pointer focus:outline-none"
                  >
                    {communities.map((c) => (
                      <option key={c.id} value={c.id} className="text-[#0b1c30] bg-white">
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0b1c30] tracking-tight">
                Admin Dashboard
              </h1>
              <p className="font-body text-sm text-[#554245] flex items-center gap-2 mt-1">
                <span>Coordinator:</span>
                <strong className="font-bold text-[#0b1c30]">{currentCommunity.admin_name || 'Designated Lead'}</strong>
                <span className="text-[#dac0c4]">•</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-code text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Live
                </span>
                <span className="text-[#dac0c4]">•</span>
                <button
                  type="button"
                  onClick={loadCommunityData}
                  disabled={refreshing}
                  className="text-xs text-[#7a1f3d] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[14px] ${refreshing ? 'animate-spin' : ''}`}>sync</span>
                  {refreshing ? 'Syncing...' : 'Sync Now'}
                </button>
              </p>
            </div>

            {/* Quick Action Bar */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setIsAccessCodeModalOpen(true)}
                className="h-12 px-5 rounded-full bg-white text-[#5c0427] border border-[#dac0c4]/60 hover:bg-[#eff4ff] transition-all duration-200 font-body text-sm font-bold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">pin</span>
                <span>Generate access codes</span>
              </button>
              <button
                type="button"
                onClick={handleExportAudit}
                className="h-12 px-5 rounded-full bg-[#7a1f3d] text-white hover:bg-[#5c0427] transition-all duration-200 font-body text-sm font-bold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Export audit log</span>
              </button>
            </div>
          </div>

          {error && <ErrorAlert message={error} />}

          {/* 4 Primary Stat Cards */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Households joined */}
              <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#dac0c4]/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#554245]">
                  <span className="font-body text-xs uppercase tracking-wider font-bold">Households joined</span>
                  <span className="material-symbols-outlined text-[22px] text-[#554245]">group</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-code text-3xl font-bold text-[#0b1c30] tracking-tight">
                    {stats.total_submissions ?? 0}
                  </span>
                  <span className="font-code text-xs text-[#554245]">claims</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[#554245]/70 font-code text-xs">
                  <span className="material-symbols-outlined text-[14px]">update</span>
                  <span>Active scheme status</span>
                </div>
              </div>

              {/* 2. Approved households */}
              <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#dac0c4]/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#554245]">
                  <span className="font-body text-xs uppercase tracking-wider font-bold">Approved households</span>
                  <span className="material-symbols-outlined text-[22px] text-[#7a1f3d]">verified</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-code text-3xl font-bold text-[#5c0427] tracking-tight">
                    {stats.approved_submissions ?? 0}
                  </span>
                  <span className="font-code text-xs text-emerald-800 font-semibold">
                    {stats.total_submissions > 0
                      ? `${Math.round(((stats.approved_submissions || 0) / stats.total_submissions) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[#554245]/70 font-code text-xs">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  <span>Verified for distribution</span>
                </div>
              </div>

              {/* 3. Under verification */}
              <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#dac0c4]/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#554245]">
                  <span className="font-body text-xs uppercase tracking-wider font-bold">Under review</span>
                  <span className="material-symbols-outlined text-[22px] text-[#673500]">pending_actions</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-code text-3xl font-bold text-[#673500] tracking-tight">
                    {stats.flagged_count ?? 0}
                  </span>
                  <span className="font-code text-xs text-[#673500]">clues detected</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[#554245]/70 font-code text-xs">
                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                  <span>Cross-checked criteria</span>
                </div>
              </div>

              {/* 4. Active access codes */}
              <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#dac0c4]/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#554245]">
                  <span className="font-body text-xs uppercase tracking-wider font-bold">Unused vouchers</span>
                  <span className="material-symbols-outlined text-[22px] text-[#554245]">key</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-code text-3xl font-bold text-[#0b1c30] tracking-tight">
                    {stats.unused_codes ?? 0}
                  </span>
                  <span className="font-code text-xs text-[#554245]">available</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[#554245]/70 font-code text-xs">
                  <span className="material-symbols-outlined text-[14px]">vpn_key</span>
                  <span>Single-use tokens</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-[#dac0c4]/30 pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`h-11 px-5 rounded-full font-body text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-[#7a1f3d] text-white shadow-xs'
                  : 'text-[#554245] hover:bg-[#eff4ff]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">rule</span>
              <span>Flagged Clue Queue ({queue.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`h-11 px-5 rounded-full font-body text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'submissions'
                  ? 'bg-[#7a1f3d] text-white shadow-xs'
                  : 'text-[#554245] hover:bg-[#eff4ff]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">list_alt</span>
              <span>All Claim Submissions ({totalSubmissions})</span>
            </button>
          </div>

          {/* TAB 1: Flagged Clue Queue */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              {queue.length === 0 ? (
                <div className="p-8 bg-white rounded-3xl border border-[#dac0c4]/40 text-center">
                  <span className="material-symbols-outlined text-[32px] text-emerald-600 mb-2">verified_user</span>
                  <h3 className="font-headline text-lg font-bold text-[#0b1c30]">No Flagged Clues</h3>
                  <p className="text-xs text-[#554245] mt-1">
                    No submissions currently exceed the verification anomaly threshold in this community.
                  </p>
                </div>
              ) : (
                queue.map((cluster) => (
                  <div
                    key={cluster.cluster_id}
                    className="p-5 bg-white rounded-3xl border border-[#dac0c4]/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-code text-xs font-bold text-[#7a1f3d]">
                          Cluster #{cluster.cluster_id}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#ffdcc3] text-[#673500] font-code text-xs font-bold">
                          Anomaly Strength: {cluster.risk_score}%
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#0b1c30] mt-1">{cluster.title || 'Connected Claim Group'}</p>
                      <p className="text-xs text-[#554245] mt-0.5">{cluster.description || 'Shared data points detected across household claims.'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (cluster.primary_submission_id) {
                            setActiveSubmissionId(cluster.primary_submission_id);
                          }
                        }}
                        className="h-10 px-5 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white text-xs font-bold cursor-pointer transition"
                      >
                        Inspect Primary Claim
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Submissions Table */}
          {activeTab === 'submissions' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-2xl border border-[#dac0c4]/40">
                <span className="text-xs font-bold text-[#554245] uppercase">Filter Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 text-xs bg-[#eff4ff] rounded-xl border border-[#dac0c4]/40 text-[#0b1c30] font-semibold"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="info_requested">Info Requested</option>
                  <option value="rejected">Rejected</option>
                </select>

                <select
                  value={riskFilter}
                  onChange={(e) => {
                    setRiskFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 text-xs bg-[#eff4ff] rounded-xl border border-[#dac0c4]/40 text-[#0b1c30] font-semibold"
                >
                  <option value="">All Scores</option>
                  <option value="flagged">Flagged Clues Only</option>
                  <option value="low_risk">Low Clue Score Only</option>
                </select>
              </div>

              {submissions.length === 0 ? (
                <div className="p-8 bg-white rounded-3xl border border-[#dac0c4]/40 text-center">
                  <p className="text-xs text-[#554245]">No claim submissions matched your filter criteria.</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-[#dac0c4]/40 overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#eff4ff] text-[#554245] font-body text-xs uppercase tracking-wider">
                        <th className="py-3 px-6 font-bold">Claim ID</th>
                        <th className="py-3 px-6 font-bold">Applicant</th>
                        <th className="py-3 px-6 font-bold">Clue Score</th>
                        <th className="py-3 px-6 font-bold">Detected Clues</th>
                        <th className="py-3 px-6 font-bold">Status</th>
                        <th className="py-3 px-6 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eff4ff] text-[#0b1c30] font-body text-sm">
                      {submissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[#eff4ff]/40 transition-colors">
                          <td className="py-3.5 px-6 font-code text-xs font-bold text-[#7a1f3d]">
                            #{sub.id}
                          </td>
                          <td className="py-3.5 px-6 font-bold text-[#0b1c30]">
                            {sub.applicant_name}
                          </td>
                          <td className="py-3.5 px-6">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-code text-xs font-bold ${
                              sub.risk_score >= 40 ? 'bg-[#ffdcc3] text-[#673500]' : 'bg-[#eff4ff] text-[#0b1c30]'
                            }`}>
                              {sub.risk_score}%
                            </span>
                          </td>
                          <td className="py-3.5 px-6 font-body text-xs text-[#554245]">
                            {sub.risk_reasons && sub.risk_reasons.length > 0
                              ? sub.risk_reasons.slice(0, 2).join(', ')
                              : 'None detected'}
                          </td>
                          <td className="py-3.5 px-6">
                            <span className="capitalize font-body text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#0b1c30]">
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveSubmissionId(sub.id)}
                              className="h-8 px-4 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold transition-colors cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Previous / Next Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 bg-[#eff4ff]/60 border-t border-[#dac0c4]/30 text-xs">
                      <span className="text-[#554245]">
                        Page {currentPage} of {totalPages} ({totalSubmissions} total claims)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="px-3.5 py-1.5 rounded-full bg-white border border-[#dac0c4]/60 text-[#0b1c30] disabled:opacity-40 font-semibold hover:bg-[#eff4ff] cursor-pointer"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="px-3.5 py-1.5 rounded-full bg-white border border-[#dac0c4]/60 text-[#0b1c30] disabled:opacity-40 font-semibold hover:bg-[#eff4ff] cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Generate Access Codes */}
      {isAccessCodeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#213145]/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsAccessCodeModalOpen(false)}
        >
          <div
            ref={codeModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-codes-title"
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col gap-5 border border-[#dac0c4]/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#dac0c4]/30">
              <h3 id="generate-codes-title" className="font-headline text-2xl font-bold text-[#0b1c30]">Generate Access Codes</h3>
              <button
                type="button"
                aria-label="Close Generate Codes Modal"
                onClick={() => setIsAccessCodeModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#eff4ff] text-[#554245] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="code-batch-target" className="font-body text-xs font-bold uppercase tracking-wider text-[#554245]">
                  Target Relief Sector / Ward (Optional)
                </label>
                <input
                  id="code-batch-target"
                  type="text"
                  value={codeBatchTarget}
                  onChange={(e) => setCodeBatchTarget(e.target.value)}
                  placeholder="e.g. Ward 4 - Coastal Fishery Zone"
                  className="h-12 px-4 rounded-2xl bg-[#eff4ff] text-[#0b1c30] font-body text-sm border border-[#dac0c4]/40 focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="code-qty-select" className="font-body text-xs font-bold uppercase tracking-wider text-[#554245]">
                  Quantity of Codes to Generate
                </label>
                <select
                  id="code-qty-select"
                  value={codeQty}
                  onChange={(e) => setCodeQty(Number(e.target.value))}
                  className="h-12 px-4 rounded-2xl bg-[#eff4ff] text-[#0b1c30] font-body text-sm border border-[#dac0c4]/40 focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]"
                >
                  <option value={10}>10 Unique Registration Vouchers</option>
                  <option value={25}>25 Unique Registration Vouchers</option>
                  <option value={50}>50 Unique Registration Vouchers</option>
                  <option value={100}>100 Unique Registration Vouchers</option>
                </select>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#eff4ff] text-[#554245] font-code text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#7a1f3d]">enhanced_encryption</span>
                <span>Codes are single-use tokens redeemable only by authorized applicants.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAccessCodeModalOpen(false)}
                className="h-11 px-5 rounded-full bg-[#eff4ff] text-[#0b1c30] hover:bg-[#dce9ff] transition-colors font-body text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generatingCodes}
                onClick={handleGenerateCodes}
                className="h-11 px-6 rounded-full bg-[#7a1f3d] text-white hover:bg-[#5c0427] disabled:opacity-50 transition-colors font-body text-sm font-bold flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">key</span>
                <span>{generatingCodes ? 'Generating...' : 'Confirm & Generate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect & Review Modal */}
      {activeSubmissionId && (
        <SubmissionDetailModal
          submissionId={activeSubmissionId}
          onClose={() => setActiveSubmissionId(null)}
          onReviewSubmitted={handleReviewCompleted}
        />
      )}

      {/* Small Feedback Toast */}
      {feedbackToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 right-4 z-50 bg-[#0b1c30] text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-[#dac0c4]/40"
        >
          <span className="material-symbols-outlined text-[18px] text-[#7a1f3d]">check_circle</span>
          <span>{feedbackToast}</span>
        </div>
      )}
    </div>
  );
}
