import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { searchPhoto, searchQuery, getInvestigationLogs } from '../api/investigator';
import { LoadingSpinner, ErrorAlert } from '../components/FeedbackComponents';
import SubmissionDetailModal from '../components/SubmissionDetailModal';

export default function InvestigatorPortal() {
  const { user, isInvestigator } = useAuth();

  // Search Mode: 'photo' | 'name' | 'phone' | 'bank_account' | 'address' | 'logs'
  const [searchMode, setSearchMode] = useState('photo');

  // Photo Search State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [searchingPhoto, setSearchingPhoto] = useState(false);
  const [photoResults, setPhotoResults] = useState(null);

  // Text Search State
  const [queryTerm, setQueryTerm] = useState('');
  const [searchingText, setSearchingText] = useState(false);
  const [textResults, setTextResults] = useState(null);

  // Audit Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // UI / Modal
  const [error, setError] = useState(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);

  useEffect(() => {
    loadLogs();
  }, [isInvestigator]);

  const loadLogs = async () => {
    if (!isInvestigator) return;
    try {
      setLoadingLogs(true);
      const data = await getInvestigationLogs(50);
      setLogs(data || []);
    } catch (err) {
      // Non-blocking log load
    } finally {
      setLoadingLogs(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoResults(null);
  };

  const handlePhotoSearch = async (e) => {
    if (e) e.preventDefault();
    if (!photoFile) return;

    try {
      setSearchingPhoto(true);
      setError(null);
      const data = await searchPhoto(photoFile);
      setPhotoResults(data);
      loadLogs();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to execute cross-community photo analysis.');
    } finally {
      setSearchingPhoto(false);
    }
  };

  const handleTextSearch = async (e) => {
    if (e) e.preventDefault();
    if (!queryTerm.trim()) return;

    try {
      setSearchingText(true);
      setError(null);
      const typeParam = searchMode === 'photo' ? 'all' : searchMode;
      const data = await searchQuery(queryTerm.trim(), typeParam);
      setTextResults(data);
      loadLogs();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to execute cross-community analysis.');
    } finally {
      setSearchingText(false);
    }
  };

  if (!user || !isInvestigator) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 font-body">
        <div className="bg-[#000000] border border-[#B02A52]/40 rounded-3xl p-8 text-center shadow-2xl space-y-5 text-[#F5F5F5]">
          <div className="w-16 h-16 bg-[#B02A52]/20 text-[#B02A52] rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">shield</span>
          </div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-white">
            High Security Access Required
          </h1>
          <p className="text-sm text-[#9CA3AF] leading-relaxed max-w-md mx-auto">
            The platform search and cross-community clue engine is restricted to authorized and verified relief investigators under the AidNexus Security Enclave Protocol.
          </p>
          <div className="p-4 bg-[#0A0A0A] border border-[#1F1F23] rounded-2xl text-xs text-[#9CA3AF] text-left space-y-2 font-code">
            <p>• Investigator credential verification required (`role: investigator`).</p>
            <p>• Every query is cryptographically hashed (SHA-256) into the immutable InvestigationLog.</p>
            <p>• Query images are processed strictly in-memory and never stored on disk.</p>
          </div>
          <button
            onClick={() => window.location.href = '/login'}
            className="h-12 px-8 bg-[#B02A52] hover:bg-[#962345] text-white font-bold rounded-full text-xs shadow-lg shadow-[#B02A52]/20 transition cursor-pointer"
          >
            Authenticate Investigator Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0b1c30] text-[#F5F5F5] font-body selection:bg-[#B02A52] selection:text-white">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col w-full">
          {/* Scanline & Ambient Grid Backdrop Container */}
          <div className="relative w-full rounded-3xl bg-[#000000] p-4 sm:p-6 lg:p-8 overflow-hidden shadow-2xl border border-[#1F1F23]">
            {/* Subtle Tactical Grid Overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            ></div>
            {/* Ambient Red Glow in Top Right Corner */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-[#B02A52]/15 rounded-full blur-3xl"></div>

            {/* TABBED SEARCH CONSOLE */}
            <section className="relative z-10 w-full rounded-2xl bg-[#0A0A0A] p-5 sm:p-7 mb-10 shadow-lg border border-[#1F1F23]">
              <div className="flex items-center justify-between pb-4 border-b border-[#1F1F23] mb-5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#B02A52] text-[20px]">security</span>
                  <span className="font-code text-xs uppercase tracking-wider text-[#9CA3AF] font-bold">
                    INVESTIGATOR CONSOLE · CLOUD ENCLAVE PROTOCOL v4.11
                  </span>
                </div>
                <span className="font-code text-xs px-2.5 py-0.5 rounded-full bg-[#B02A52]/20 text-[#B02A52] font-bold">
                  ZERO DISK STORAGE
                </span>
              </div>

              {/* Tab Strip: Segmented Navigation */}
              <div className="w-full overflow-x-auto pb-2 scrollbar-none">
                <div className="inline-flex items-center p-1 rounded-full bg-[#000000] min-w-max gap-1 border border-[#1F1F23]">
                  {[
                    { id: 'photo', label: 'Photo Search', icon: 'photo_camera_front' },
                    { id: 'name', label: 'Name', icon: 'badge' },
                    { id: 'phone', label: 'Phone', icon: 'phone_in_talk' },
                    { id: 'bank_account', label: 'Bank Account', icon: 'account_balance' },
                    { id: 'address', label: 'Address', icon: 'pin_drop' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSearchMode(tab.id)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-body text-xs font-bold transition-all ${
                        searchMode === tab.id
                          ? 'bg-[#B02A52] text-white shadow-sm'
                          : 'text-[#9CA3AF] hover:text-[#F5F5F5] hover:bg-[#1F1F23]/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3.5 rounded-xl bg-[#B02A52]/20 text-[#F5F5F5] border border-[#B02A52]/40 text-xs font-body">
                  {error}
                </div>
              )}

              {/* PHOTO SEARCH TAB BODY */}
              {searchMode === 'photo' && (
                <div className="mt-6 flex flex-col gap-6">
                  {/* Drag & Drop Zone */}
                  <label className="group relative w-full rounded-2xl bg-[#000000] p-8 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-[#000000]/80 border border-[#1F1F23]">
                    {/* Tactical Corner Markers */}
                    <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#B02A52]/40"></div>
                    <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#B02A52]/40"></div>
                    <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#B02A52]/40"></div>
                    <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#B02A52]/40"></div>

                    {photoPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={photoPreview}
                          alt="Query Damage Photo"
                          className="max-h-52 rounded-xl object-contain border border-[#B02A52]/50 shadow-md"
                        />
                        <span className="font-code text-xs text-[#9CA3AF]">{photoFile?.name}</span>
                        <span className="text-xs text-[#B02A52] font-bold hover:underline">
                          Click to select a different photo
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Central Scanner Vector Icon */}
                        <div className="relative w-20 h-20 mb-4 rounded-2xl bg-[#0A0A0A] flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                          <span className="material-symbols-outlined text-[#B02A52] text-[40px]">
                            document_scanner
                          </span>
                          <div className="absolute inset-0 rounded-2xl border border-[#B02A52]/30"></div>
                        </div>

                        <h3 className="font-headline text-xl font-bold text-[#F5F5F5] max-w-lg mb-2">
                          Drag & drop household identification photo or click to browse
                        </h3>
                        <p className="font-body text-xs text-[#9CA3AF] max-w-md mb-4 leading-relaxed">
                          Supports official disaster tokens: National Voter ID, Ration Card, State Medical Registry Card, or Field Intake Camera Port. Formats: JPG, PNG, WEBP up to 25MB.
                        </p>
                      </>
                    )}

                    {/* Mandatory Note */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1F1F23]/80 text-[#9CA3AF] font-code text-xs mt-2">
                      <span className="material-symbols-outlined text-[16px] text-[#B02A52]">lock</span>
                      <span>Uploaded search files are never stored on disk.</span>
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>

                  {/* Parameters Strip & Action Button */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
                    <div className="flex flex-wrap items-center gap-4 text-xs font-code text-[#9CA3AF]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          defaultChecked
                          type="checkbox"
                          className="w-4 h-4 rounded accent-[#B02A52] bg-[#000000]"
                        />
                        <span>Include Archive Nodes (2018-2026)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          defaultChecked
                          type="checkbox"
                          className="w-4 h-4 rounded accent-[#B02A52] bg-[#000000]"
                        />
                        <span>Fuzzy Biometric Tolerance (Hamming &le; 10)</span>
                      </label>
                    </div>

                    {/* Search Trigger Button */}
                    <button
                      type="button"
                      disabled={searchingPhoto || !photoFile}
                      onClick={handlePhotoSearch}
                      className="h-[52px] px-8 rounded-full bg-[#B02A52] hover:bg-[#962345] disabled:opacity-50 text-white font-body text-sm font-bold transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-[#B02A52]/20 active:translate-y-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">manage_search</span>
                      <span>{searchingPhoto ? 'Computing pHash...' : 'Execute Cross-Community Analysis'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TEXT ENTITY SEARCH BODY */}
              {searchMode !== 'photo' && (
                <div className="mt-6 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={queryTerm}
                      onChange={(e) => setQueryTerm(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleTextSearch(e); }}
                      placeholder={`Enter ${searchMode.replace(/_/g, ' ')} value to cross-reference across all jurisdictions...`}
                      className="flex-1 h-12 px-4 rounded-full bg-[#000000] border border-[#1F1F23] text-sm text-[#F5F5F5] font-code focus:outline-none focus:border-[#B02A52]"
                    />
                    <button
                      type="button"
                      disabled={searchingText || !queryTerm.trim()}
                      onClick={handleTextSearch}
                      className="h-12 px-8 rounded-full bg-[#B02A52] hover:bg-[#962345] disabled:opacity-50 text-white font-body text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-[20px]">search</span>
                      <span>{searchingText ? 'Searching...' : 'Run Query'}</span>
                    </button>
                  </div>
                  <span className="font-code text-xs text-[#9CA3AF]">
                    Searches encrypted entity hashes across all decentralized relief databases.
                  </span>
                </div>
              )}
            </section>

            {/* INVESTIGATION RESULTS SECTION */}
            {(photoResults || textResults) && (
              <section className="relative z-10 w-full mb-12">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <h2 className="font-headline text-2xl font-bold text-[#F5F5F5] tracking-tight">
                      Active Investigation Results
                    </h2>
                    <span className="px-3 py-0.5 rounded-full bg-[#B02A52]/20 text-[#B02A52] font-code text-xs font-bold">
                      {photoResults ? `${photoResults.matches_count} DETECTIONS` : `${textResults?.matches_count || 0} DETECTIONS`}
                    </span>
                  </div>
                </div>

                {/* Photo Results Cards */}
                {photoResults && photoResults.matches?.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {photoResults.matches.map((m, idx) => (
                      <article
                        key={idx}
                        className="relative flex flex-col justify-between rounded-2xl bg-[#0A0A0A] p-6 sm:p-7 shadow-md overflow-hidden border border-[#1F1F23] hover:border-[#B02A52]/50 transition-all"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#B02A52]/5 rounded-bl-full pointer-events-none"></div>
                        <div>
                          {/* Header Row */}
                          <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                              <span className="font-code text-xs text-[#9CA3AF] uppercase tracking-wider block mb-1">
                                Target Jurisdiction
                              </span>
                              <h3 className="font-headline text-xl font-bold text-[#F5F5F5]">
                                Community: <span className="text-white">{m.community_title}</span>
                              </h3>
                              <p className="font-body text-xs text-[#9CA3AF] flex items-center gap-1 mt-1">
                                <span className="material-symbols-outlined text-[15px] text-[#B02A52]">person</span>
                                <span>Applicant: <strong className="text-[#F5F5F5]">{m.applicant_name}</strong></span>
                              </p>
                            </div>
                            <div className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D97706]/15 text-[#D97706] font-body text-xs font-bold">
                              <span className="material-symbols-outlined text-[14px]">flag</span>
                              <span>Needs review</span>
                            </div>
                          </div>

                          {/* Visual Biometric Match Panel */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#000000] mb-5 border border-[#1F1F23]">
                            {/* Similarity Metric */}
                            <div className="flex flex-col justify-center">
                              <span className="font-code text-[11px] text-[#9CA3AF] uppercase tracking-wider mb-0.5">
                                Similarity Metric
                              </span>
                              <div className="font-code text-2xl font-bold text-[#B02A52] tracking-tight">
                                {Math.max(0, 100 - m.hamming_distance * 7)}%
                              </div>
                              <span className="font-code text-[11px] text-[#9CA3AF]">
                                Hamming: {m.hamming_distance}
                              </span>
                            </div>

                            {/* Match Type */}
                            <div className="flex flex-col justify-center sm:pl-4 sm:border-l sm:border-[#1F1F23]">
                              <span className="font-code text-[11px] text-[#9CA3AF] uppercase tracking-wider mb-0.5">
                                Match Type
                              </span>
                              <span className="font-body text-sm font-semibold text-[#F5F5F5] leading-snug">
                                Perceptual Hash
                              </span>
                              <span className="font-code text-[11px] text-[#9CA3AF] truncate mt-0.5">
                                pHash • Hamming &le; 10
                              </span>
                            </div>

                            {/* Masked Preview */}
                            <div className="flex flex-col justify-center sm:pl-4 sm:border-l sm:border-[#1F1F23]">
                              <span className="font-code text-[11px] text-[#9CA3AF] uppercase tracking-wider mb-0.5">
                                Claim ID
                              </span>
                              <div className="font-code text-sm font-bold text-[#F5F5F5] tracking-widest bg-[#0A0A0A] py-1 px-2.5 rounded w-fit border border-[#1F1F23]">
                                #{m.submission_id}
                              </div>
                              <span className="font-code text-[11px] text-[#9CA3AF] mt-0.5">SHA-256 Salted</span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-[#000000] border border-[#1F1F23] mb-4 text-xs font-code text-[#9CA3AF]">
                            {m.explanation}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#1F1F23]">
                          <button
                            type="button"
                            onClick={() => setActiveSubmissionId(m.submission_id)}
                            className="h-10 px-5 rounded-full bg-[#000000] hover:bg-[#1F1F23] text-[#F5F5F5] font-body text-xs font-bold transition-colors flex items-center gap-2 border border-[#1F1F23]"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[#B02A52]">visibility</span>
                            <span>Inspect Dossier</span>
                          </button>
                          <a
                            href={`/admin/network?claim=${m.submission_id}`}
                            className="inline-flex items-center gap-1.5 font-body text-xs font-bold text-[#B02A52] hover:text-[#ff8ba8] transition-colors"
                          >
                            <span>View network</span>
                            <span className="material-symbols-outlined text-[16px]">account_tree</span>
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {/* Text Entity Results */}
                {textResults && textResults.matches?.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {textResults.matches.map((m, idx) => (
                      <article
                        key={idx}
                        className="relative flex flex-col justify-between rounded-2xl bg-[#0A0A0A] p-6 sm:p-7 shadow-md overflow-hidden border border-[#1F1F23] hover:border-[#B02A52]/50 transition-all"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <span className="font-code text-xs text-[#9CA3AF] uppercase tracking-wider block mb-1">
                                Collision Match
                              </span>
                              <h3 className="font-headline text-xl font-bold text-white">
                                Claim #{m.submission_id}
                              </h3>
                              <p className="font-body text-xs text-[#9CA3AF] mt-1">
                                Community ID: {m.community_id} • Field: {m.matched_field}
                              </p>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-[#D97706]/15 text-[#D97706] font-body text-xs font-bold">
                              Needs review
                            </span>
                          </div>

                          <div className="p-4 rounded-xl bg-[#000000] border border-[#1F1F23] mb-4 space-y-2 font-code text-xs">
                            <div className="flex justify-between text-[#9CA3AF]">
                              <span>Matched Field:</span>
                              <strong className="text-white">{m.matched_field}</strong>
                            </div>
                            <div className="flex justify-between text-[#9CA3AF]">
                              <span>Masked Value:</span>
                              <strong className="text-[#B02A52]">{m.masked_value}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-[#1F1F23]">
                          <button
                            type="button"
                            onClick={() => setActiveSubmissionId(m.submission_id)}
                            className="h-10 px-5 rounded-full bg-[#000000] hover:bg-[#1F1F23] text-[#F5F5F5] font-body text-xs font-bold transition-colors flex items-center gap-2 border border-[#1F1F23]"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[#B02A52]">visibility</span>
                            <span>Inspect Dossier</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* AUDIT TRAIL / SEARCH LOG SECTION */}
            <section className="relative z-10 w-full rounded-2xl bg-[#0A0A0A] p-5 sm:p-7 shadow-lg border border-[#1F1F23]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 gap-2 border-b border-[#1F1F23]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#000000] flex items-center justify-center border border-[#1F1F23]">
                    <span className="material-symbols-outlined text-[#B02A52] text-[18px]">receipt_long</span>
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-[#F5F5F5] tracking-tight">
                      Your search activity
                    </h3>
                    <p className="font-body text-xs text-[#9CA3AF]">
                      Immutable cryptographic ledger recording each query session for oversight integrity.
                    </p>
                  </div>
                </div>
              </div>

              {/* Audit Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left font-code text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#000000] text-[#9CA3AF] uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 rounded-l-lg font-bold">Timestamp</th>
                      <th className="py-3 px-4 font-bold">Query Type</th>
                      <th className="py-3 px-4 font-bold">Execution Hash</th>
                      <th className="py-3 px-4 font-bold">Matches Found</th>
                      <th className="py-3 px-4 rounded-r-lg font-bold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F23]/60">
                    {logs.length > 0 ? (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#1F1F23]/30 transition-colors">
                          <td className="py-3.5 px-4 text-[#F5F5F5] whitespace-nowrap">
                            {new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19)}Z
                          </td>
                          <td className="py-3.5 px-4 text-[#F5F5F5]">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B02A52]/15 text-[#B02A52] text-xs font-semibold">
                              {log.query_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[#9CA3AF] font-mono whitespace-nowrap">
                            <span className="text-[#F5F5F5]">0x{log.query_hash?.substring(0, 4)}</span>•••
                            {log.query_hash?.substring(log.query_hash.length - 4)}
                          </td>
                          <td className="py-3.5 px-4 text-[#F5F5F5] font-semibold">
                            {log.results_count} matches
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              log.results_count > 0 ? 'text-[#D97706]' : 'text-[#9CA3AF]'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${log.results_count > 0 ? 'bg-[#D97706]' : 'bg-[#9CA3AF]'}`}></span>
                              {log.results_count > 0 ? 'flagged_review' : 'cleared_clean'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#9CA3AF]">
                          No query sessions logged in this enclave instance yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* PROTOCOL FOOTNOTE */}
            <div className="relative z-10 w-full mt-8 pt-4 pb-2 border-t border-[#1F1F23]/60 flex items-center justify-between flex-wrap gap-3">
              <p className="font-code text-xs text-[#9CA3AF]/80 italic">
                Mobile Adaptation (390px): Dark theme persists, search tabs become horizontally scrollable segmented pill bar.
              </p>
              <div className="flex items-center gap-3 text-xs font-code text-[#9CA3AF]/60">
                <span>SECURITY ENCLAVE PROTOCOL v4.11</span>
                <span>•</span>
                <span>ZERO PER-QUERY PERSISTENCE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Detail Modal */}
      {activeSubmissionId && (
        <SubmissionDetailModal
          submissionId={activeSubmissionId}
          onClose={() => setActiveSubmissionId(null)}
        />
      )}
    </div>
  );
}
