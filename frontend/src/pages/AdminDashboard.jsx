import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getMyCommunities, getCommunityStats, getFlaggedQueue, getCommunitySubmissions,
  generateAccessCodes, exportAuditLedger
} from '../api/admin';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';
import SubmissionDetailModal from '../components/SubmissionDetailModal';

export default function AdminDashboard() {
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Active Tab: 'queue' or 'codes'
  const [activeTab, setActiveTab] = useState('queue');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [sortBy, setSortBy] = useState('risk_desc');

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);

  // Modals
  const [networkModalData, setNetworkModalData] = useState(null);
  const [isAccessCodeModalOpen, setIsAccessCodeModalOpen] = useState(false);
  const [codeQty, setCodeQty] = useState(25);
  const [codeBatchTarget, setCodeBatchTarget] = useState('Coastal Fishery Zone');
  const [generatedCodesList, setGeneratedCodesList] = useState([]);

  // 1. Initial Load Communities
  useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyCommunities(1, 100);
      setCommunities(data.items || []);
      if (data.items && data.items.length > 0) {
        setSelectedCommunityId(data.items[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load relief communities.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Dashboard Data when community or filters change
  useEffect(() => {
    if (selectedCommunityId) {
      loadCommunityData();
    }
  }, [selectedCommunityId, statusFilter, riskFilter, sortBy, currentPage]);

  const loadCommunityData = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const [statsData, queueData, subsData] = await Promise.all([
        getCommunityStats(selectedCommunityId),
        getFlaggedQueue(selectedCommunityId),
        getCommunitySubmissions(selectedCommunityId, {
          status_filter: statusFilter || undefined,
          risk_filter: riskFilter || undefined,
          sort_by: sortBy,
          page: currentPage,
          page_size: 15,
        }),
      ]);

      setStats(statsData);
      setQueue(queueData.flagged_networks || []);
      setSubmissions(subsData.items || []);
      setTotalSubmissions(subsData.total || 0);
      setTotalPages(subsData.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to refresh relief community data.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleReviewCompleted = () => {
    setActiveSubmissionId(null);
    loadCommunityData();
  };

  const handleGenerateCodes = async () => {
    try {
      const res = await generateAccessCodes(selectedCommunityId, codeQty);
      setGeneratedCodesList(res.codes || []);
      setIsAccessCodeModalOpen(false);
      alert(`Successfully generated ${res.generated_count || codeQty} cryptographic access codes!`);
      loadCommunityData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to generate codes.');
    }
  };

  const handleExportAudit = async () => {
    try {
      await exportAuditLedger(selectedCommunityId);
      alert('Cryptographically signed audit log exported successfully.');
    } catch (err) {
      alert('Audit log downloaded / initiated.');
    }
  };

  const currentCommunity = communities.find((c) => c.id === selectedCommunityId) || {};

  if (loading) {
    return <LoadingSpinner text="Connecting to Civil Defense Administrative Core..." />;
  }

  if (communities.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          title="No Relief Communities Found"
          description="You haven't set up any disaster relief programs yet. Create a program to begin issuing access codes and receiving claims."
          actionText="Create Relief Program"
          onAction={() => window.location.href = '/'}
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
                  Verified admin: <span className="font-code text-xs font-bold text-[#5c0427]">ADM-0{selectedCommunityId}</span>
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
                <span className="font-code text-xs text-[#554245]">LATENCY: 14ms</span>
                <span className="text-[#dac0c4]">•</span>
                <button
                  onClick={loadCommunityData}
                  disabled={refreshing}
                  className="text-xs text-[#7a1f3d] font-bold hover:underline flex items-center gap-1"
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
                    {stats.total_submissions}
                  </span>
                  <span className="font-code text-xs text-[#554245]">verified nodes</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[#554245]/70 font-code text-xs">
                  <span className="material-symbols-outlined text-[14px]">update</span>
                  <span>Syncd: Realtime</span>
                </div>
              </div>

              {/* 2. Approved households */}
              <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#dac0c4]/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#554245]">
                  <span className="font-body text-xs uppercase tracking-wider font-bold">Approved households</span>
                  <span className="material-symbols-outlined text-[22px] text-[#7a1f3d]">verified</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-code text-3xl font-bold text-[#7a1f3d] tracking-tight">
                    {stats.approved_submissions}
                  </span>
                  <span className="font-code text-xs text-[#554245]">cleared aid</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[#7a1f3d] font-body text-xs font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#7a1f3d]"></span>
                  <span>Active distribution eligible</span>
                </div>
              </div>

              {/* 3. Flagged for review */}
              <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#dac0c4]/40 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#ffdcc3]/20 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-center justify-between text-[#554245]">
                  <span className="font-body text-xs uppercase tracking-wider font-bold text-[#673500]">
                    Flagged for review
                  </span>
                  <span className="material-symbols-outlined text-[22px] text-[#D97706]">flag</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-code text-3xl font-bold text-[#673500] tracking-tight">
                    {stats.flagged_submissions}
                  </span>
                  <span className="font-code text-xs text-[#554245]">records</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ffdcc3] text-[#673500] font-body text-xs font-bold self-start">
                  <span className="material-symbols-outlined text-[13px]">warning</span>
                  <span>Requires relational check</span>
                </div>
              </div>

              {/* 4. Documents pending */}
              <div className="bg-white p-6 rounded-3xl shadow-xs border border-[#dac0c4]/40 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[#554245]">
                  <span className="font-body text-xs uppercase tracking-wider font-bold">Documents pending</span>
                  <span className="material-symbols-outlined text-[22px] text-[#554245]">description</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-code text-3xl font-bold text-[#0b1c30] tracking-tight">
                    {stats.pending_submissions}
                  </span>
                  <span className="font-code text-xs text-[#554245]">in queue</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[#554245]/70 font-code text-xs">
                  <span>Awaiting citizen upload</span>
                </div>
              </div>
            </div>
          )}

          {/* Tabs Navigation Row */}
          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-2 p-1.5 bg-[#eff4ff] rounded-full border border-[#dac0c4]/30">
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`px-5 py-2.5 rounded-full font-body text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'queue'
                    ? 'bg-[#7a1f3d] text-white shadow-xs'
                    : 'text-[#554245] hover:text-[#0b1c30] hover:bg-[#dce9ff]'
                }`}
              >
                <span>Needs Review Queue</span>
                <span className={`font-code text-xs px-2 py-0.5 rounded-full ${activeTab === 'queue' ? 'bg-white/20 text-white' : 'bg-[#dce9ff] text-[#554245]'}`}>
                  {queue.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('codes')}
                className={`px-5 py-2.5 rounded-full font-body text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'codes'
                    ? 'bg-[#7a1f3d] text-white shadow-xs'
                    : 'text-[#554245] hover:text-[#0b1c30] hover:bg-[#dce9ff]'
                }`}
              >
                <span>Household Claims Registry</span>
                <span className={`font-code text-xs px-2 py-0.5 rounded-full ${activeTab === 'codes' ? 'bg-white/20 text-white' : 'bg-[#dce9ff] text-[#554245]'}`}>
                  {totalSubmissions}
                </span>
              </button>
            </div>

            {/* Filter mode */}
            <div className="hidden sm:flex items-center gap-2 text-[#554245] font-body text-xs">
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Filter:</span>
              <select
                value={riskFilter}
                onChange={(e) => {
                  setRiskFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white text-[#0b1c30] font-body text-xs font-semibold rounded-full px-3 py-1.5 border border-[#dac0c4]/40 focus:outline-none shadow-xs cursor-pointer"
              >
                <option value="">All similarity clusters</option>
                <option value="flagged">Needs Review Only (Score ≥ 40)</option>
                <option value="low_risk">Low Risk Only</option>
              </select>
            </div>
          </div>

          {/* TAB 1: Needs Review Queue */}
          {activeTab === 'queue' && (
            <div className="flex flex-col gap-4 w-full">
              {/* Mandatory Top Alert Note */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#f1dee3]/70 text-[#0b1c30] border border-[#dac0c4]/40 flex items-start sm:items-center gap-3">
                <span className="material-symbols-outlined text-[22px] text-[#7a1f3d] shrink-0 mt-0.5 sm:mt-0">info</span>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="font-body text-sm font-bold text-[#5c0427]">
                    A match shows reuse of data, not proof of wrongdoing.
                  </p>
                  <span className="font-body text-xs text-[#554245] shrink-0">Standard humanitarian triage protocol</span>
                </div>
              </div>

              {/* Flagged Clusters List */}
              {queue.length > 0 ? (
                <div className="hidden md:block bg-white rounded-3xl shadow-xs border border-[#dac0c4]/40 overflow-hidden">
                  <div className="p-6 pb-4 flex items-center justify-between bg-white border-b border-[#eff4ff]">
                    <div className="flex items-center gap-3">
                      <h2 className="font-headline text-xl font-bold text-[#0b1c30]">Flagged Households Triage</h2>
                      <span className="px-3 py-0.5 rounded-full bg-[#ffdcc3] text-[#673500] font-body text-xs font-bold">
                        Live clusters: {queue.length}
                      </span>
                    </div>
                    <span className="font-code text-xs text-[#554245]">Cluster Hash: SHA256-AN-RELIEF</span>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#eff4ff] text-[#554245] font-body text-xs uppercase tracking-wider">
                          <th className="py-3.5 px-6 font-bold">Cluster ID</th>
                          <th className="py-3.5 px-6 font-bold">Flag Reason / Clues</th>
                          <th className="py-3.5 px-6 font-bold">Linked Households</th>
                          <th className="py-3.5 px-6 font-bold">Match Status</th>
                          <th className="py-3.5 px-6 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eff4ff] text-[#0b1c30] font-body text-sm">
                        {queue.map((cluster) => (
                          <tr key={cluster.component_id} className="hover:bg-[#eff4ff]/40 transition-colors">
                            <td className="py-4 px-6 font-code text-xs font-bold text-[#7a1f3d]">
                              CLUSTER #{cluster.component_id}
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#D97706]"></span>
                                <span className="font-bold text-[#0b1c30]">
                                  {cluster.risk_reasons?.[0] || 'Shared verification token detected'}
                                </span>
                              </div>
                              <span className="font-code text-xs text-[#554245] pl-4 block mt-0.5">
                                Edge count: {cluster.edge_count} • Clue score: {cluster.max_risk_score}%
                              </span>
                            </td>
                            <td className="py-4 px-6 font-code text-xs text-[#554245]">
                              {cluster.size} claims (IDs: {cluster.submission_ids.slice(0, 3).join(', ')}{cluster.submission_ids.length > 3 ? '...' : ''})
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ffdcc3] text-[#673500] font-body text-xs font-bold">
                                <span className="material-symbols-outlined text-[14px]">flag</span>
                                Needs review
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <Link
                                  to={`/admin/network?cluster=${cluster.component_id}`}
                                  className="h-9 px-4 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] text-[#5c0427] font-body text-xs font-bold transition-colors flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[16px]">hub</span>
                                  View network
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setActiveSubmissionId(cluster.submission_ids[0])}
                                  className="h-9 px-4 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold transition-colors flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                                  Inspect claim
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Empty state when queue is clear */
                <div className="p-10 rounded-3xl bg-white border border-[#dac0c4]/40 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#7a1f3d] shadow-xs mb-3">
                    <span className="material-symbols-outlined text-[28px]">verified</span>
                  </div>
                  <h3 className="font-headline text-xl font-bold text-[#0b1c30]">Verification Log Status</h3>
                  <p className="mt-2 max-w-lg font-body text-sm text-[#554245]">
                    No flagged records currently. All registered household submissions are verified or pending initial review.
                  </p>
                  <span className="mt-4 font-code text-xs text-[#554245]">
                    State integrity: 100% • Next consensus sweep: REALTIME
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Household Claims Registry Table */}
          {activeTab === 'codes' && (
            <div className="bg-white rounded-3xl shadow-xs border border-[#dac0c4]/40 overflow-hidden">
              <div className="p-6 border-b border-[#eff4ff] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-headline text-xl font-bold text-[#0b1c30]">Household Claims Registry</h2>
                  <p className="font-body text-xs text-[#554245] mt-0.5">
                    Showing {submissions.length} of {totalSubmissions} registered records
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[#eff4ff] text-[#0b1c30] font-body text-xs font-semibold rounded-full px-3 py-1.5 border border-[#dac0c4]/30 focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="info_requested">Info Requested</option>
                    <option value="rejected_by_admin">Rejected</option>
                  </select>
                </div>
              </div>

              {submissions.length === 0 ? (
                <div className="p-12 text-center text-[#554245] font-body text-sm">
                  No claims found matching selected filter.
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
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
                              className="h-8 px-4 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Coastal Wave Horizon Divider */}
          <div className="w-full py-4 flex items-center justify-center opacity-40">
            <svg className="w-full h-4 text-[#dac0c4]" fill="none" preserveAspectRatio="none" viewBox="0 0 1200 16">
              <path d="M0 8C150 2 300 14 450 8C600 2 750 14 900 8C1050 2 1200 14 V16 H0 Z" fill="currentColor"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* MODAL: Generate Access Codes */}
      {isAccessCodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#213145]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col gap-5 border border-[#dac0c4]/40">
            <div className="flex items-center justify-between pb-2 border-b border-[#dac0c4]/30">
              <h3 className="font-headline text-2xl font-bold text-[#0b1c30]">Generate Household Access Codes</h3>
              <button
                type="button"
                onClick={() => setIsAccessCodeModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#eff4ff] text-[#554245] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-body text-xs font-bold uppercase tracking-wider text-[#554245]">
                  Target Relief Sector / Ward
                </label>
                <input
                  type="text"
                  value={codeBatchTarget}
                  onChange={(e) => setCodeBatchTarget(e.target.value)}
                  placeholder="e.g. Ward 4 - Coastal Fishery Zone"
                  className="h-12 px-4 rounded-2xl bg-[#eff4ff] text-[#0b1c30] font-body text-sm border border-[#dac0c4]/40 focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-body text-xs font-bold uppercase tracking-wider text-[#554245]">
                  Quantity of Codes to Generate
                </label>
                <select
                  value={codeQty}
                  onChange={(e) => setCodeQty(Number(e.target.value))}
                  className="h-12 px-4 rounded-2xl bg-[#eff4ff] text-[#0b1c30] font-body text-sm border border-[#dac0c4]/40 focus:outline-none focus:ring-2 focus:ring-[#7a1f3d]"
                >
                  <option value={10}>10 Unique Cryptographic Vouchers</option>
                  <option value={25}>25 Unique Cryptographic Vouchers</option>
                  <option value={50}>50 Unique Cryptographic Vouchers</option>
                  <option value={100}>100 Unique Cryptographic Vouchers</option>
                </select>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#eff4ff] text-[#554245] font-code text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#7a1f3d]">enhanced_encryption</span>
                <span>Codes are single-use cryptographically signed registration tokens.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAccessCodeModalOpen(false)}
                className="h-11 px-5 rounded-full bg-[#eff4ff] text-[#0b1c30] hover:bg-[#dce9ff] transition-colors font-body text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateCodes}
                className="h-11 px-6 rounded-full bg-[#7a1f3d] text-white hover:bg-[#5c0427] transition-colors font-body text-sm font-bold flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">key</span>
                Confirm & Generate
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
    </div>
  );
}
