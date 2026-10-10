import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublicCommunities } from '../api/public';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';

export default function PublicCommunities() {
  const [communities, setCommunities] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, verified, needs-funding
  const [currentNavScope, setCurrentNavScope] = useState('all'); // all, my
  const [isPreviewEmpty, setIsPreviewEmpty] = useState(false);

  // Slide-over detail drawer state
  const [drawerCommunity, setDrawerCommunity] = useState(null);

  // QR Modal state
  const [qrCommunity, setQrCommunity] = useState(null);

  useEffect(() => {
    loadCommunities();
  }, [currentPage]);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPublicCommunities(currentPage, 12);
      setCommunities(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load relief communities.');
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredCommunities = communities.filter((comm) => {
    if (isPreviewEmpty) return false;
    
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = comm.title?.toLowerCase().includes(q);
      const matchAdmin = comm.admin_name?.toLowerCase().includes(q);
      const matchDesc = comm.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchAdmin && !matchDesc) return false;
    }

    // Filter pill
    if (activeFilter === 'verified' && !comm.is_verified_admin) return false;
    if (activeFilter === 'needs-funding' && !comm.qr_image_path) return false;

    return true;
  });

  if (loading) {
    return <LoadingSpinner text="Retrieving verified civil registries..." />;
  }

  return (
    <div className="w-full min-h-screen bg-[#f8f9ff] text-[#0b1c30] font-body relative overflow-x-hidden">
      {/* Coastal Ambient Atmosphere Layer */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <div className="relative w-full overflow-hidden mb-8">
          <div className="absolute -top-24 -right-12 w-96 h-96 rounded-full bg-[#f1dee3]/40 blur-3xl pointer-events-none"></div>
          <div className="absolute top-12 left-1/3 w-80 h-80 rounded-full bg-[#dce9ff]/60 blur-3xl pointer-events-none"></div>

          {/* Header Section */}
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6">
            <div className="flex flex-col max-w-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7a1f3d] animate-pulse"></span>
                <span className="font-code text-xs uppercase tracking-widest text-[#554245] font-semibold">
                  {currentNavScope === 'my' ? 'Active Enrolments · Verified Beneficiary / Member' : 'Verified Civil Registry · Sector Core'}
                </span>
              </div>
              <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-[#5c0427] tracking-tight">
                {currentNavScope === 'my' ? 'My Communities' : 'Communities'}
              </h1>
              <p className="font-body text-base sm:text-lg text-[#554245] mt-2">
                {currentNavScope === 'my'
                  ? 'Disaster relief jurisdictions and local support grids you are actively registered with.'
                  : 'Browse verified disaster relief communities or coordinate support across autonomous regional grids.'}
              </p>
            </div>

            {/* Live Registry Metric Badge */}
            <div className="flex items-center gap-3 bg-[#eff4ff] px-5 py-3 rounded-full shadow-sm border border-[#dac0c4]/30 shrink-0 self-start md:self-auto">
              <span className="material-symbols-outlined text-[#7a1f3d] text-[22px]">
                {currentNavScope === 'my' ? 'how_to_reg' : 'shield'}
              </span>
              <div className="flex flex-col">
                <span className="font-body text-[11px] uppercase tracking-wider text-[#554245] font-semibold">
                  {currentNavScope === 'my' ? 'My Membership Status' : 'Public Verification Status'}
                </span>
                <span className="font-code text-xs text-[#5c0427] font-bold">
                  {currentNavScope === 'my' ? '1 Active Affiliation' : 'Decentralized Direct Triage'}
                </span>
              </div>
            </div>
          </div>

          {/* Decorative Horizon Wave Vector */}
          <svg className="w-full h-4 text-[#dac0c4]/40 mt-1" fill="none" preserveAspectRatio="none" viewBox="0 0 1200 16">
            <path d="M0 8C150 14 300 2 450 8C600 14 750 2 900 8C1050 14 1125 4 1200 8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"></path>
          </svg>
        </div>

        {error && <ErrorAlert message={error} />}

        {/* Action & Filter Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-[#dac0c4]/30 mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Pill Search Input */}
          <div className="relative flex-1 max-w-xl">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#554245] text-[20px]">
              travel_explore
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by community name, coordinator, or description..."
              className="w-full h-12 pl-12 pr-4 bg-[#eff4ff] rounded-full font-body text-sm text-[#0b1c30] placeholder:text-[#554245]/60 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#7a1f3d]/20 border border-transparent focus:border-[#7a1f3d] transition-all"
            />
          </div>

          {/* Filter Pills Group & View State Switch */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-4 h-10 rounded-full font-body text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm ${
                activeFilter === 'all'
                  ? 'bg-[#7a1f3d] text-white'
                  : 'bg-[#eff4ff] text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
              }`}
            >
              All Regions
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('verified')}
              className={`px-4 h-10 rounded-full font-body text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm ${
                activeFilter === 'verified'
                  ? 'bg-[#7a1f3d] text-white'
                  : 'bg-[#eff4ff] text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              Verified Only
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('needs-funding')}
              className={`px-4 h-10 rounded-full font-body text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm ${
                activeFilter === 'needs-funding'
                  ? 'bg-[#7a1f3d] text-white'
                  : 'bg-[#eff4ff] text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">emergency</span>
              Needs Funding
            </button>

            <div className="h-6 w-px bg-[#dce9ff] mx-1 hidden sm:block"></div>

            {/* Toggle Empty Preview State */}
            <button
              type="button"
              onClick={() => setIsPreviewEmpty(!isPreviewEmpty)}
              className="px-4 h-10 rounded-full font-body text-xs font-semibold bg-[#f1dee3] text-[#5c0427] hover:bg-[#d4c2c7] transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
              {isPreviewEmpty ? 'Show Active Grid' : 'Preview Empty State'}
            </button>
          </div>
        </div>

        {/* Active Results Status Bar */}
        <div className="flex items-center justify-between px-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="font-body text-xs uppercase tracking-wider text-[#554245] font-semibold">Active Query</span>
            <span className="font-code text-xs px-2.5 py-0.5 rounded-full bg-[#dce9ff] text-[#5c0427] font-semibold">
              {searchQuery ? `"${searchQuery}"` : activeFilter === 'verified' ? 'Verified Initiatives' : 'All Regional Jurisdictions'}
            </span>
            <span className="font-body text-xs text-[#554245] hidden sm:inline">
              Showing active relief jurisdictions ({filteredCommunities.length} results)
            </span>
          </div>
          <span className="font-code text-xs text-[#554245]/80">
            Registry sync: <span className="font-mono text-[#5c0427]">REALTIME</span>
          </span>
        </div>

        {/* POPULATED STATE CONTAINER */}
        {filteredCommunities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCommunities.map((comm) => (
              <div
                key={comm.id}
                className="group bg-white rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md border border-[#dac0c4]/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Card Row: Title & Verification Badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-code text-xs text-[#7a1f3d] font-semibold tracking-tight">
                          #{comm.code || `REF-${comm.id}`}
                        </span>
                        {comm.is_verified_admin && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#7a1f3d] text-white font-code text-[11px] flex items-center gap-1 font-semibold shadow-xs">
                            <span className="material-symbols-outlined text-[13px]">how_to_reg</span> Enrolled Member
                          </span>
                        )}
                      </div>
                      <h2 className="font-headline text-2xl font-bold text-[#0b1c30] tracking-tight group-hover:text-[#5c0427] transition-colors">
                        {comm.title}
                      </h2>
                    </div>

                    {/* Verified Admin Badge */}
                    <div className="shrink-0 px-3.5 py-1.5 rounded-full bg-[#F6E3E8] text-[#5c0427] flex items-center gap-1.5 shadow-xs">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span className="font-body text-xs font-bold">
                        {comm.is_verified_admin ? `Verified Coordinator` : 'Civil Registry'}
                      </span>
                    </div>
                  </div>

                  {/* Geographic & Timing Visual Chip */}
                  <div className="flex items-center gap-4 mt-4 pt-1 bg-[#eff4ff]/60 rounded-xl p-3 border border-[#dac0c4]/20">
                    <div className="flex items-center gap-1 text-[#554245]">
                      <span className="material-symbols-outlined text-[18px]">location_on</span>
                      <span className="font-body text-xs font-medium">{comm.title}</span>
                    </div>
                    <span className="text-[#554245]/40">•</span>
                    <div className="flex items-center gap-1 text-[#554245]">
                      <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                      <span className="font-body text-xs font-medium">
                        {new Date(comm.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Block */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-body text-[#554245] py-1 border-b border-[#eff4ff]">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px]">badge</span> Coordinator
                      </span>
                      <span className="font-semibold text-[#0b1c30]">{comm.admin_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-body text-[#554245] py-1 border-b border-[#eff4ff]">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px]">groups</span> Registered households
                      </span>
                      <span className="font-code text-xs font-bold text-[#7a1f3d] px-2.5 py-0.5 rounded-full bg-[#f1dee3]">
                        {comm.approved_members_count} approved
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-body text-[#554245] py-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px]">crisis_alert</span> Primary Need
                      </span>
                      <span className="font-body text-xs font-semibold text-[#0b1c30] truncate max-w-[220px]">
                        {comm.description ? (comm.description.length > 50 ? comm.description.slice(0, 48) + '...' : comm.description) : 'Active Field Triage'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Footer with Coastal Wave Motif */}
                <div className="mt-6 pt-2">
                  <svg className="w-full h-2 text-[#dac0c4]/30 mb-4" fill="none" viewBox="0 0 400 8">
                    <path d="M0 4C50 7 100 1 150 4C200 7 250 1 300 4C350 7 375 2 400 4" stroke="currentColor" strokeWidth="1"></path>
                  </svg>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDrawerCommunity(comm)}
                      className="h-11 px-4 rounded-full bg-[#dce9ff] hover:bg-[#cbdbf5] text-[#0b1c30] font-body text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[18px]">info</span>
                      View Details
                    </button>
                    {comm.qr_image_path ? (
                      <button
                        type="button"
                        onClick={() => setQrCommunity(comm)}
                        className="h-11 px-4 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-sm font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                        Show QR (Fund)
                      </button>
                    ) : (
                      <Link
                        to={`/public/communities/${comm.id}`}
                        className="h-11 px-4 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] text-[#5c0427] font-body text-sm font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs text-center"
                      >
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        Explore Hub
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* EMPTY STATE CONTAINER */
          <div className="w-full">
            <div className="bg-white rounded-3xl p-10 md:p-16 shadow-sm border border-[#dac0c4]/30 flex flex-col items-center justify-center text-center max-w-3xl mx-auto my-6 relative overflow-hidden">
              <div className="w-20 h-20 rounded-full bg-[#eff4ff] flex items-center justify-center mb-6 text-[#685b5f] shadow-inner">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M2 12c1.5-1.5 3.5-2 5.5-1.5 2 .5 3.5 2 5.5 1.5 2-.5 3.5-2 5.5-1.5 2 .5 3.5 2 5.5 1.5"></path>
                  <path d="M2 17c1.5-1.5 3.5-2 5.5-1.5 2 .5 3.5 2 5.5 1.5 2-.5 3.5-2 5.5-1.5 2 .5 3.5 2 5.5 1.5"></path>
                  <path d="M2 7c1.5-1.5 3.5-2 5.5-1.5 2 .5 3.5 2 5.5 1.5 2-.5 3.5-2 5.5-1.5 2 .5 3.5 2 5.5 1.5"></path>
                </svg>
              </div>

              <h2 className="font-headline text-2xl sm:text-3xl font-bold text-[#5c0427] tracking-tight mb-2">
                No communities found
              </h2>

              <p className="font-body text-base text-[#554245] max-w-xl leading-relaxed mb-8">
                No active relief jurisdictions matched your filter criteria. New relief initiatives appear here once registered by verified coordinators.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                    setIsPreviewEmpty(false);
                  }}
                  className="h-12 px-8 rounded-full bg-[#dce9ff] hover:bg-[#cbdbf5] text-[#5c0427] font-body text-sm font-bold shadow-xs transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  Reset filters
                </button>
                <Link
                  to="/"
                  className="h-12 px-8 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-sm font-bold shadow-xs transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  Create a Community
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* PRIVACY PROTECTION SHIELD BANNER */}
        <div className="mt-12 bg-white rounded-2xl p-6 shadow-sm border border-[#dac0c4]/30 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#f1dee3] text-[#5c0427] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">lock</span>
          </div>
          <div className="flex-1">
            <h3 className="font-headline text-base font-bold text-[#5c0427] uppercase tracking-wider">
              AidNexus Privacy Shield Guarantee
            </h3>
            <p className="font-body text-xs sm:text-sm text-[#554245] mt-1 leading-relaxed">
              Phone numbers, street addresses, and individual household records are strictly confidential and protected from public view. Direct funding routes bypass intermediary ledgers.
            </p>
          </div>
          <div className="font-code text-xs px-4 py-1.5 rounded-full bg-[#eff4ff] text-[#554245] font-bold shrink-0">
            ENCRYPTED REPOSITORY
          </div>
        </div>
      </div>

      {/* SLIDE-OVER DETAIL DRAWER / DOSSIER */}
      {drawerCommunity && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-[#213145]/40 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerCommunity(null)}
          ></div>
          <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white z-50 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex flex-col">
              {/* Drawer Header Bar */}
              <div className="flex items-center justify-between pb-4">
                <span className="font-body text-xs uppercase tracking-wider text-[#554245] font-bold">
                  Relief Unit Dossier
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerCommunity(null)}
                  className="p-1.5 rounded-full text-[#554245] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>

              {/* Horizon Wave Accent */}
              <svg className="w-full h-2 text-[#dac0c4]/40 mb-6" fill="none" viewBox="0 0 400 8">
                <path d="M0 4C50 7 100 1 150 4C200 7 250 1 300 4C350 7 375 2 400 4" stroke="currentColor" strokeWidth="1.2"></path>
              </svg>

              {/* Community Title & Meta */}
              <div className="space-y-1 mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-code text-xs text-[#7a1f3d] font-bold">
                    #{drawerCommunity.code || `REF-${drawerCommunity.id}`}
                  </span>
                  {drawerCommunity.is_verified_admin && (
                    <span className="px-2 py-0.5 rounded-full bg-[#7a1f3d] text-white font-code text-[11px] font-bold">
                      Enrolled
                    </span>
                  )}
                </div>
                <h2 className="font-headline text-2xl sm:text-3xl font-bold text-[#5c0427] tracking-tight">
                  {drawerCommunity.title}
                </h2>
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <span className="px-3 py-1 rounded-full bg-[#F6E3E8] text-[#5c0427] font-body font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">verified</span> Verified Community
                  </span>
                  <span className="font-body text-[#554245]">• Civil Defense Tier A</span>
                </div>
              </div>

              {/* Coordinator & Metrics Data Cards */}
              <div className="bg-[#eff4ff] rounded-2xl p-4 space-y-3 mb-6 border border-[#dac0c4]/30">
                <div className="flex items-center justify-between text-xs font-body">
                  <span className="text-[#554245]">Lead Coordinator:</span>
                  <span className="font-bold text-[#0b1c30]">{drawerCommunity.admin_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-body">
                  <span className="text-[#554245]">Approved households:</span>
                  <span className="font-code text-xs font-bold text-[#5c0427] px-2.5 py-0.5 rounded-full bg-[#f1dee3]">
                    {drawerCommunity.approved_members_count} verified
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-body">
                  <span className="text-[#554245]">Audit Validation:</span>
                  <span className="font-code text-xs text-[#0b1c30] font-bold">100% Conformance</span>
                </div>
              </div>

              {/* Description Section */}
              <div className="mb-6">
                <h3 className="font-body text-xs uppercase tracking-wider text-[#554245] font-bold mb-2">
                  Operational Mandate
                </h3>
                <div className="bg-[#eff4ff]/60 rounded-2xl p-4 border border-[#dac0c4]/30">
                  <p className="font-body text-sm text-[#0b1c30] leading-relaxed italic">
                    "{drawerCommunity.description || 'No operational description provided.'}"
                  </p>
                </div>
              </div>

              {/* Strict Privacy Rule Shield */}
              <div className="bg-[#dce9ff]/40 rounded-2xl p-4 flex items-start gap-3 mb-6 border border-[#dac0c4]/30">
                <span className="material-symbols-outlined text-[#5c0427] text-[20px] shrink-0 mt-0.5">
                  verified_user
                </span>
                <p className="font-body text-xs text-[#554245] leading-relaxed">
                  AidNexus Privacy Shield: Phone numbers, street addresses, and individual household records are strictly confidential and protected from public view.
                </p>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="pt-4 space-y-2 border-t border-[#dac0c4]/30">
              {drawerCommunity.qr_image_path ? (
                <button
                  type="button"
                  onClick={() => {
                    const c = drawerCommunity;
                    setDrawerCommunity(null);
                    setQrCommunity(c);
                  }}
                  className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                  Fund this community
                </button>
              ) : (
                <Link
                  to={`/public/communities/${drawerCommunity.id}`}
                  className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-sm text-center"
                >
                  <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                  Open Full Scheme Page
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* DIRECT QR PAYMENT MODAL */}
      {qrCommunity && (
        <div className="fixed inset-0 z-50 bg-[#213145]/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-[#dac0c4]/40 text-center animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#dac0c4]/30">
              <div className="flex items-center gap-2 text-left">
                <span className="material-symbols-outlined text-[#5c0427] text-[22px]">account_balance_wallet</span>
                <span className="font-headline text-lg font-bold text-[#5c0427]">Direct Aid Routing</span>
              </div>
              <button
                type="button"
                onClick={() => setQrCommunity(null)}
                className="p-1 rounded-full text-[#554245] hover:bg-[#eff4ff] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="my-5">
              <span className="font-body text-xs uppercase tracking-wider text-[#554245] font-semibold block">
                Authorized Payee
              </span>
              <h3 className="font-headline text-xl font-bold text-[#0b1c30] mt-0.5">
                {qrCommunity.admin_name}
              </h3>
              <p className="font-code text-xs text-[#5c0427] mt-1 font-semibold">
                Community: <span>{qrCommunity.title}</span>
              </p>

              {/* QR Display */}
              <div className="my-6 mx-auto w-52 h-52 bg-white rounded-2xl p-3 shadow-md border border-[#dac0c4]/50 flex items-center justify-center relative">
                <img
                  src={qrCommunity.qr_image_path}
                  alt="Relief QR"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>

              {/* Strict Institutional Disclaimers */}
              <div className="bg-[#f1dee3]/60 rounded-xl p-3 text-left border border-[#dac0c4]/30">
                <p className="font-body text-xs text-[#5c0427] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#7a1f3d] shrink-0 mt-0.5">info</span>
                  <span>
                    Money moves outside AidNexus. We only display this QR to preserve total autonomy and direct-to-field delivery.
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setQrCommunity(null)}
              className="w-full h-11 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0b1c30] font-body text-sm font-semibold transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
