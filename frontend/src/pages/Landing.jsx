import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCommunity, updateRequiredFields, generateCodes } from '../api/admin';
import { formatApiError } from '../utils/formatError';

export default function Landing() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Create Community Wizard Modal State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [commTitle, setCommTitle] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [commRegion, setCommRegion] = useState('');
  const [disasterDate, setDisasterDate] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPos, setAdminPos] = useState('');
  const [createdCodes, setCreatedCodes] = useState([]);
  const [creating, setCreating] = useState(false);
  const [stepError, setStepError] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  const wizardModalRef = useRef(null);

  // Clean reset function
  const resetWizardFields = useCallback(() => {
    setAdminName(user?.name || '');
    setAdminPos('');
    setCommTitle('');
    setCommDesc('');
    setCommRegion('');
    setDisasterDate('');
    setStepError('');
  }, [user?.name]);

  const openCreateWizard = () => {
    resetWizardFields();
    if (isAdmin) {
      setWizardStep(2); // Direct to community details for logged-in admin
    } else {
      setWizardStep(1); // Sign-in / auth prompt for guest or non-admin
    }
    setWizardOpen(true);
  };

  // Check URL params for ?action=create
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'create') {
      resetWizardFields();
      if (isAdmin) {
        setWizardStep(2);
      } else {
        setWizardStep(1);
      }
      setWizardOpen(true);
    }
  }, [isAdmin, resetWizardFields]);

  // Modal accessibility: Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && wizardOpen) {
        setWizardOpen(false);
      }
    };
    if (wizardOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wizardOpen]);

  const handleCopyCode = async (codeStr, id) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeStr);
      }
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2500);
    } catch {
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2500);
    }
  };

  const handleCreateCommunitySubmit = async () => {
    if (!isAdmin) {
      navigate('/login', { state: { from: '/?action=create' } });
      return;
    }

    try {
      setCreating(true);
      setStepError('');

      const created = await createCommunity({
        title: commTitle.trim(),
        description: commDesc.trim(),
      });

      // Define standard required fields
      await updateRequiredFields(created.id, [
        { label: 'Head of Household Name', field_type: 'name', is_required: true, order: 0 },
        { label: 'Mobile Phone Number', field_type: 'phone', is_required: true, order: 1 },
        { label: 'Residential Address', field_type: 'address', is_required: true, order: 2 },
        { label: 'Aadhaar / Ration Card', field_type: 'id_number', is_required: true, order: 3 },
        { label: 'Bank Account Number', field_type: 'bank_account', is_required: false, order: 4 },
        { label: 'House Damage Photo', field_type: 'photo', is_required: true, order: 5 },
      ]);

      // Generate dynamic initial codes for households
      const initialLabels = Array.from({ length: 4 }, (_, i) => ({
        label: `${commTitle.trim()} - Household #${i + 1}`,
      }));
      const codes = await generateCodes(created.id, initialLabels);
      setCreatedCodes(codes);
      setWizardStep(4); // Success step
    } catch (err) {
      setStepError(formatApiError(err, 'Failed to create community. Ensure description is at least 10 characters.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative w-full flex-1 flex flex-col justify-center items-center overflow-hidden bg-gradient-to-b from-[#F6E3E8] via-[#eff4ff] to-[#ffffff] px-4 sm:px-8 py-16 min-h-[calc(100vh-4rem)]">
      {/* Decorative Wave Silhouettes */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden z-0">
        <svg className="w-full h-full text-[#dac0c4]/30" fill="none" preserveAspectRatio="none" viewBox="0 0 1440 800">
          <path
            d="M0,220 C320,180 480,260 760,210 C1040,160 1200,240 1440,190 L1440,800 L0,800 Z"
            fill="currentColor"
            fillOpacity="0.12"
          />
          <path
            d="M0,380 C360,430 640,320 920,390 C1200,460 1340,360 1440,400 L1440,800 L0,800 Z"
            fill="currentColor"
            fillOpacity="0.18"
          />
          <path
            d="M0,520 C280,480 620,560 980,510 C1260,470 1380,530 1440,515 L1440,800 L0,800 Z"
            fill="currentColor"
            fillOpacity="0.25"
          />
        </svg>
      </div>

      {/* Main Cover Section */}
      <div className="relative z-10 flex flex-col justify-center items-center text-center w-full max-w-[860px] mx-auto my-auto space-y-6">
        {/* Hero Title */}
        <div className="inline-block relative">
          <h1 className="font-headline text-6xl sm:text-8xl lg:text-9xl font-bold text-[#0b1c30] tracking-tight leading-none select-none">
            AidNexus
          </h1>
          <div className="h-[3px] bg-[#7a1f3d] mt-3 w-32 mx-auto rounded-full" />
        </div>

        {/* Lead Narrative */}
        <p className="font-body text-base sm:text-lg text-[#554245] max-w-[760px] leading-relaxed pt-3 text-center">
          Help works best when it reaches the right hands. AidNexus brings officials, families and donors together, and quietly connects the clues so that every genuine family is seen. Join us, and be part of the help.
        </p>

        {/* Main Action Pill Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 pt-4 pb-2 w-full max-w-md sm:max-w-none">
          <button
            onClick={openCreateWizard}
            className="h-14 px-10 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-base font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add_moderator</span>
            <span>Create a community</span>
          </button>

          <Link
            to="/join"
            className="h-14 px-10 rounded-full bg-[#ffffff] text-[#7a1f3d] font-body text-base font-bold shadow-sm hover:bg-[#eff4ff] transition-all flex items-center justify-center gap-2 border-2 border-[#7a1f3d] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">group_add</span>
            <span>Join a community</span>
          </Link>
        </div>

        {/* Secondary Navigation Quick-Links */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/public/communities"
            className="px-4 py-2 rounded-full bg-[#ffffff] hover:bg-[#dce9ff] text-[#5c0427] font-body text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 border border-[#dac0c4]/40"
          >
            <span className="material-symbols-outlined text-[16px]">public</span>
            <span>Browse Public Schemes</span>
          </Link>

          {user && (
            <Link
              to="/admin"
              className="px-4 py-2 rounded-full bg-[#ffffff] hover:bg-[#dce9ff] text-[#0b1c30] font-body text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 border border-[#dac0c4]/40"
            >
              <span className="material-symbols-outlined text-[16px]">dashboard</span>
              <span>Admin Dashboard</span>
            </Link>
          )}
        </div>

        {/* Protocol Standard Badge */}
        <div className="pt-4 flex items-center justify-center gap-2 font-code text-xs text-[#554245]">
          <span className="material-symbols-outlined text-[#7a1f3d] text-[16px]">verified</span>
          <span>Verified Registry Standard • Relief Verification Infrastructure</span>
        </div>
      </div>

      {/* CREATE COMMUNITY MULTI-STEP WIZARD MODAL */}
      {wizardOpen && (
        <div
          className="fixed inset-0 bg-[#213145]/50 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setWizardOpen(false)}
        >
          <div
            ref={wizardModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-modal-title"
            className="bg-[#ffffff] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative my-auto border border-[#dac0c4]/40 flex flex-col max-h-[92vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#dac0c4]/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#7a1f3d] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">add_moderator</span>
                </div>
                <div>
                  <span className="font-code text-[11px] text-[#7a1f3d] uppercase tracking-wider font-semibold block">
                    RELIEF PROGRAM INTAKE
                  </span>
                  <h3 id="wizard-modal-title" className="font-headline text-lg text-[#5c0427]">Register Relief Community</h3>
                </div>
              </div>
              <button
                aria-label="Close"
                className="p-1 rounded-full text-[#554245] hover:bg-[#dce9ff] transition-colors cursor-pointer"
                onClick={() => setWizardOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Stepper Dots */}
            <div className="py-2.5 px-3 bg-[#eff4ff] -mx-6 sm:-mx-8 mb-4 border-b border-[#dac0c4]/20 flex items-center justify-between">
              <span className="font-body text-xs font-semibold text-[#0b1c30]">
                {wizardStep === 1
                  ? 'Coordinator Authentication'
                  : wizardStep === 2
                  ? 'Community Details'
                  : wizardStep === 3
                  ? 'Review & Deploy'
                  : 'Complete'}
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((st) => (
                  <span
                    key={st}
                    className={`h-1.5 rounded-full transition-all ${
                      st <= wizardStep ? 'w-6 bg-[#7a1f3d]' : 'w-4 bg-[#dac0c4]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {/* Step 1: Coordinator Authentication Prompt (for visitors/non-admins) */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="font-headline text-xl text-[#0b1c30]">Coordinator Authentication</h4>

                  {user && !isAdmin ? (
                    <div className="p-4 bg-[#ffdad6] text-[#93000a] text-xs rounded-2xl space-y-2 border border-[#ffdad6]">
                      <p className="font-bold">
                        Logged in as {user.name} ({user.role})
                      </p>
                      <p>
                        Relief community creation is restricted to verified relief coordinators. Please sign out and sign in with an authorized coordinator account.
                      </p>
                      <div className="pt-2 flex gap-2">
                        <Link
                          to="/login"
                          onClick={() => setWizardOpen(false)}
                          className="px-4 py-2 rounded-full bg-[#7a1f3d] text-white font-bold text-xs hover:bg-[#5c0427]"
                        >
                          Switch Account
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-body text-xs text-[#554245] leading-relaxed">
                        To maintain relief integrity and ensure accountable distribution, only authorized relief coordinators can establish new relief programs and issue access tokens.
                      </p>
                      <div className="space-y-3 pt-2">
                        <Link
                          to="/login"
                          state={{ from: '/?action=create' }}
                          onClick={() => setWizardOpen(false)}
                          className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                        >
                          <span className="material-symbols-outlined text-[18px]">login</span>
                          <span>Sign In as Relief Coordinator</span>
                        </Link>
                        <Link
                          to="/register"
                          state={{ from: '/?action=create' }}
                          onClick={() => setWizardOpen(false)}
                          className="w-full h-12 rounded-full border border-[#dac0c4] bg-[#ffffff] hover:bg-[#eff4ff] text-[#0b1c30] font-body text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">person_add</span>
                          <span>Register New Coordinator Account</span>
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Community Purpose & Scope */}
              {wizardStep === 2 && (
                <div className="space-y-3.5">
                  <h4 className="font-headline text-xl text-[#0b1c30]">Community Details & Scope</h4>
                  <p className="font-body text-xs text-[#554245]">Specify incident relief mandate, location, and target households.</p>

                  {stepError && (
                    <div role="alert" className="p-3 bg-[#ffdad6] text-[#93000a] text-xs font-semibold rounded-xl flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                      <span>{stepError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="coordinator-name-input" className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">
                      Lead Coordinator Name <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <input
                      id="coordinator-name-input"
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. District Relief Officer"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                    />
                  </div>

                  <div>
                    <label htmlFor="coordinator-pos-input" className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">
                      Official Role / Department (Optional)
                    </label>
                    <input
                      id="coordinator-pos-input"
                      type="text"
                      value={adminPos}
                      onChange={(e) => setAdminPos(e.target.value)}
                      placeholder="e.g. Coastal Ward Operations Lead"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                    />
                  </div>

                  <div>
                    <label htmlFor="community-title-input" className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">
                      Community Title <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <input
                      id="community-title-input"
                      type="text"
                      required
                      value={commTitle}
                      onChange={(e) => {
                        setCommTitle(e.target.value);
                        setStepError('');
                      }}
                      placeholder="e.g. Coastal Ward Flood Relief Hub"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                    />
                  </div>

                  <div>
                    <label htmlFor="community-desc-input" className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">
                      Operational Mandate / Description <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <textarea
                      id="community-desc-input"
                      rows={3}
                      required
                      value={commDesc}
                      onChange={(e) => {
                        setCommDesc(e.target.value);
                        setStepError('');
                      }}
                      placeholder="State operational mandate, incident context, and eligible households (minimum 10 characters)..."
                      className="w-full p-3 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="region-select" className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">Region / Zone</label>
                      <select
                        id="region-select"
                        value={commRegion}
                        onChange={(e) => setCommRegion(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                      >
                        <option value="">Select Region / Zone...</option>
                        <option value="Alappuzha (Kuttanad / Coastal Flood Belt)">Alappuzha (Kuttanad / Coastal Flood Belt)</option>
                        <option value="Wayanad (Hilly / Landslide Prone)">Wayanad (Hilly / Landslide Prone)</option>
                        <option value="Ernakulam / Kochi (Periyar Basin)">Ernakulam / Kochi (Periyar Basin)</option>
                        <option value="Idukki (High Ranges / Reservoir Belt)">Idukki (High Ranges / Reservoir Belt)</option>
                        <option value="Chennai (Coastal / Urban Flood Belt)">Chennai (Coastal / Urban Flood Belt)</option>
                        <option value="Assam (Brahmaputra Valley)">Assam (Brahmaputra Valley)</option>
                        <option value="Puri (Coastal Cyclone Belt)">Puri (Coastal Cyclone Belt)</option>
                        <option value="Other Regional Jurisdiction">Other Regional Jurisdiction</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="disaster-date-input" className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">Incident Date</label>
                      <input
                        id="disaster-date-input"
                        type="date"
                        value={disasterDate}
                        onChange={(e) => setDisasterDate(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => setWizardOpen(false)}
                      className="h-12 px-5 rounded-full border border-[#dac0c4] text-[#0b1c30] font-body text-xs font-semibold hover:bg-[#eff4ff] cursor-pointer"
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!commTitle.trim()) {
                          setStepError('Community title is required.');
                          return;
                        }
                        if (commDesc.trim().length < 10) {
                          setStepError('Operational description must be at least 10 characters.');
                          return;
                        }
                        setStepError('');
                        setWizardStep(3);
                      }}
                      className="flex-1 h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      type="button"
                    >
                      <span>Review & Deploy</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Deploy */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h4 className="font-headline text-xl text-[#0b1c30]">Review & Deploy Program</h4>

                  {stepError && (
                    <div role="alert" className="p-3 bg-[#ffdad6] text-[#93000a] text-xs font-semibold rounded-xl flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                      <span>{stepError}</span>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-[#eff4ff] border border-[#dac0c4]/40 space-y-2 text-xs">
                    <div className="flex justify-between border-b border-[#dac0c4]/20 pb-1.5">
                      <span className="text-[#554245]">Community Title:</span>
                      <span className="font-bold text-[#0b1c30]">{commTitle || 'Untitled Community'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#dac0c4]/20 pb-1.5">
                      <span className="text-[#554245]">Coordinator:</span>
                      <span className="font-semibold text-[#0b1c30]">
                        {adminName || user?.name} {adminPos ? `(${adminPos})` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-[#dac0c4]/20 pb-1.5">
                      <span className="text-[#554245]">Jurisdiction:</span>
                      <span className="text-[#0b1c30]">{commRegion || 'Designated Regional Grid'}</span>
                    </div>
                    {disasterDate && (
                      <div className="flex justify-between border-b border-[#dac0c4]/20 pb-1.5">
                        <span className="text-[#554245]">Incident Date:</span>
                        <span className="text-[#0b1c30]">{disasterDate}</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <span className="font-semibold text-[#5c0427] block mb-1">Standard Intake Form Fields:</span>
                      <span className="text-[#554245]">Head of Household Name, Phone Number, Residential Address, Aadhaar / ID, Bank Account Number, House Damage Photo</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#eff4ff] rounded-xl flex items-start gap-2 text-xs text-[#554245] border border-[#dac0c4]/30">
                    <span className="material-symbols-outlined text-[18px] text-[#7a1f3d] shrink-0 mt-0.5">verified_user</span>
                    <p>
                      AidNexus maintains strict data confidentiality: individual claimant records and damage proof are accessible only to authorized relief coordinators.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="h-12 px-5 rounded-full border border-[#dac0c4] text-[#0b1c30] font-body text-xs font-semibold hover:bg-[#eff4ff] cursor-pointer"
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCreateCommunitySubmit}
                      disabled={creating}
                      className="flex-1 h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                      <span>{creating ? 'Publishing Relief Community...' : 'Publish Relief Community'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Generated Codes & Completion */}
              {wizardStep === 4 && (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-[26px]">check_circle</span>
                  </div>
                  <h4 className="font-headline text-2xl text-[#0b1c30]">Community Created!</h4>
                  <p className="font-body text-xs text-[#554245]">
                    Single-use access tokens have been minted for distribution to households in this jurisdiction.
                  </p>

                  <div className="rounded-2xl border border-[#dac0c4]/40 overflow-hidden text-left text-xs">
                    <div className="bg-[#eff4ff] p-3 font-semibold text-[#0b1c30] flex justify-between">
                      <span>Minted Access Tokens</span>
                      <span className="text-[#7a1f3d]">Single-Use Only</span>
                    </div>
                    <div className="divide-y divide-[#dac0c4]/20 max-h-40 overflow-y-auto font-code p-2">
                      {createdCodes.map((c) => (
                        <div key={c.id} className="py-2 px-2 flex justify-between items-center">
                          <span className="font-bold text-[#5c0427]">{c.code}</span>
                          <span className="text-[#554245]">{c.issued_to_label || 'Household'}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c.code, c.id)}
                            className="px-2.5 py-1 rounded-full bg-[#dce9ff] text-[#0b1c30] hover:bg-[#cbdbf5] font-body text-[11px] font-semibold cursor-pointer"
                          >
                            {copiedCodeId === c.id ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setWizardOpen(false);
                        navigate('/admin');
                      }}
                      className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">dashboard</span>
                      <span>Go to Admin Dashboard</span>
                    </button>
                    <button
                      onClick={() => setWizardOpen(false)}
                      className="w-full h-10 rounded-full border border-[#dac0c4]/60 text-[#554245] hover:bg-[#eff4ff] font-body text-xs font-semibold cursor-pointer"
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
