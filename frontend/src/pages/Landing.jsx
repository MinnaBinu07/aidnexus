import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCommunity, updateRequiredFields, generateCodes } from '../api/admin';

export default function Landing() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Create Community Wizard Modal State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [commTitle, setCommTitle] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [commRegion, setCommRegion] = useState('Alappuzha (Kuttanad / Coastal Flood Belt)');
  const [disasterDate, setDisasterDate] = useState('');
  const [adminName, setAdminName] = useState(user?.name || '');
  const [adminPos, setAdminPos] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [createdCodes, setCreatedCodes] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createdCommunityId, setCreatedCommunityId] = useState(null);

  const handleCreateCommunitySubmit = async () => {
    if (!user) {
      navigate('/login?redirect=create');
      return;
    }
    try {
      setCreating(true);
      const created = await createCommunity({
        title: commTitle.trim(),
        description: commDesc.trim(),
      });
      setCreatedCommunityId(created.id);

      // Define standard fields
      await updateRequiredFields(created.id, [
        { label: 'Head of Household Name', field_type: 'name', is_required: true, order: 0 },
        { label: 'Mobile Phone Number', field_type: 'phone', is_required: true, order: 1 },
        { label: 'Residential Address', field_type: 'address', is_required: true, order: 2 },
        { label: 'Aadhaar / Ration Card', field_type: 'id_number', is_required: true, order: 3 },
        { label: 'Bank Account Number', field_type: 'bank_account', is_required: true, order: 4 },
        { label: 'House Damage Photo', field_type: 'photo', is_required: true, order: 5 },
      ]);

      // Generate 5 initial codes
      const codes = await generateCodes(created.id, [
        { label: 'Primary Lead' },
        { label: 'Ward-4 Family' },
        { label: 'Ward-5 Family' },
        { label: 'Shelter-B Family' },
      ]);
      setCreatedCodes(codes);
      setWizardStep(6);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create community. Make sure description is at least 10 characters.');
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
            onClick={() => {
              if (user && isAdmin) {
                setWizardOpen(true);
                setWizardStep(3); // Start directly at admin step
              } else if (user) {
                setWizardOpen(true);
                setWizardStep(3);
              } else {
                setWizardOpen(true);
                setWizardStep(1);
              }
            }}
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

          <Link
            to="/investigate"
            className="px-4 py-2 rounded-full bg-[#ffffff] hover:bg-[#dce9ff] text-[#B02A52] font-body text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 border border-[#dac0c4]/40"
          >
            <span className="material-symbols-outlined text-[16px]">manage_search</span>
            <span>Investigator Portal</span>
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
        <div className="pt-4 flex items-center justify-center gap-2 font-code text-xs text-[#554245]/80">
          <span className="material-symbols-outlined text-[#7a1f3d] text-[16px]">verified</span>
          <span>Verified Registry Standard • Decentralized Direct Triage Protocol</span>
        </div>
      </div>

      {/* CREATE COMMUNITY MULTI-STEP WIZARD MODAL (Document 4 Specification) */}
      {wizardOpen && (
        <div
          className="fixed inset-0 bg-[#213145]/50 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setWizardOpen(false)}
        >
          <div
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
                    CIVIL DEFENSE INTAKE
                  </span>
                  <h3 className="font-headline text-lg text-[#5c0427]">Register Relief Community</h3>
                </div>
              </div>
              <button
                aria-label="Close"
                className="p-1 rounded-full text-[#554245] hover:bg-[#dce9ff] transition-colors"
                onClick={() => setWizardOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Stepper Dots */}
            <div className="py-2.5 px-3 bg-[#eff4ff] -mx-6 sm:-mx-8 mb-4 border-b border-[#dac0c4]/20 flex items-center justify-between">
              <span className="font-body text-xs font-semibold text-[#0b1c30]">
                Step {wizardStep} of 6
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((st) => (
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
              {/* Step 1: Sign in / Auth */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="font-headline text-xl text-[#0b1c30]">Coordinator Authentication</h4>
                  <p className="font-body text-xs text-[#554245] leading-relaxed">
                    To maintain civil registry integrity, relief community organizers must authenticate.
                  </p>
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="w-full h-12 rounded-full border border-[#dac0c4] bg-[#ffffff] hover:bg-[#eff4ff] text-[#0b1c30] font-body text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      type="button"
                    >
                      <span>Continue with Google / Relief SSO</span>
                    </button>
                    <div className="flex items-center my-2">
                      <div className="flex-grow border-t border-[#dac0c4]/40" />
                      <span className="px-3 text-xs text-[#554245]/60 font-body">or</span>
                      <div className="flex-grow border-t border-[#dac0c4]/40" />
                    </div>
                    <Link
                      to="/login"
                      className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      Sign In with Existing Account
                    </Link>
                  </div>
                </div>
              )}

              {/* Step 2: Confirmation / OTP */}
              {wizardStep === 2 && (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#f1dee3] text-[#7a1f3d] flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-[24px]">mark_email_read</span>
                  </div>
                  <h4 className="font-headline text-xl text-[#0b1c30]">Coordinator Authorization</h4>
                  <p className="font-body text-xs text-[#554245]">
                    Enter authorization verification to establish this relief jurisdiction.
                  </p>
                  <div className="flex justify-center gap-2 py-3">
                    {['7', '4', '2', '9', '1', '5'].map((ch, i) => (
                      <input
                        key={i}
                        readOnly
                        value={ch}
                        className="w-10 h-11 text-center font-code text-base font-bold bg-[#eff4ff] rounded-xl border border-[#dac0c4]"
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setWizardStep(3)}
                    className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                    type="button"
                  >
                    <span>Confirm & Proceed</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* Step 3: Admin Details */}
              {wizardStep === 3 && (
                <div className="space-y-3.5">
                  <h4 className="font-headline text-xl text-[#0b1c30]">1. Admin Details</h4>
                  <p className="font-body text-xs text-[#554245]">Provide verified relief worker credentials.</p>
                  <div>
                    <label className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">Full Name</label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Maya Varma"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                    />
                  </div>
                  <div>
                    <label className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">Official Position</label>
                    <input
                      type="text"
                      value={adminPos}
                      onChange={(e) => setAdminPos(e.target.value)}
                      placeholder="e.g. Lead District Officer / Relief Coordinator"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                    />
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => setWizardStep(4)}
                      className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                      type="button"
                    >
                      <span>Next: Community Purpose</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Community Purpose & Region */}
              {wizardStep === 4 && (
                <div className="space-y-3.5">
                  <h4 className="font-headline text-xl text-[#0b1c30]">2. Community Purpose</h4>
                  <p className="font-body text-xs text-[#554245]">Incident and relief objectives for this registry.</p>
                  <div>
                    <label className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">Community Title *</label>
                    <input
                      type="text"
                      value={commTitle}
                      onChange={(e) => setCommTitle(e.target.value)}
                      placeholder="e.g. Coastal Ward 12 Shelter Hub"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                    />
                  </div>
                  <div>
                    <label className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">Operational Mandate / Description *</label>
                    <textarea
                      rows={3}
                      value={commDesc}
                      onChange={(e) => setCommDesc(e.target.value)}
                      placeholder="State operational mandate, incident context, and target households..."
                      className="w-full p-3 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff] focus:outline-none focus:border-[#7a1f3d]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">Region / Zone</label>
                      <select
                        value={commRegion}
                        onChange={(e) => setCommRegion(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-[#dac0c4] font-body text-xs text-[#0b1c30] bg-[#ffffff]"
                      >
                        <option>Alappuzha (Kuttanad / Coastal Flood Belt)</option>
                        <option>Wayanad (Hilly / Landslide Prone)</option>
                        <option>Ernakulam / Kochi (Periyar Basin)</option>
                        <option>Idukki (High Ranges / Reservoir Belt)</option>
                        <option>Chennai (Coastal / Urban Flood Belt)</option>
                        <option>Assam (Brahmaputra Valley)</option>
                        <option>Puri (Coastal Cyclone Belt)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-body text-xs font-semibold text-[#0b1c30] mb-1">Disaster Date</label>
                      <input
                        type="text"
                        value={disasterDate}
                        onChange={(e) => setDisasterDate(e.target.value)}
                        placeholder="DD / MM / YYYY"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4] font-code text-xs text-[#0b1c30] bg-[#ffffff]"
                      />
                    </div>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => setWizardStep(3)}
                      className="h-12 px-5 rounded-full border border-[#dac0c4] text-[#0b1c30] font-body text-xs font-semibold"
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setWizardStep(5)}
                      className="flex-1 h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                      type="button"
                    >
                      <span>Next: Review & Deploy</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Review & Deploy */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <h4 className="font-headline text-xl text-[#0b1c30]">Review & Create Community</h4>
                  <div className="p-4 rounded-2xl bg-[#eff4ff] border border-[#dac0c4]/40 space-y-2 text-xs">
                    <div className="flex justify-between border-b border-[#dac0c4]/20 pb-1.5">
                      <span className="text-[#554245]">Community:</span>
                      <span className="font-bold text-[#0b1c30]">{commTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#554245]">Coordinator:</span>
                      <span className="font-semibold text-[#0b1c30]">{adminName} ({adminPos})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#554245]">Jurisdiction:</span>
                      <span className="text-[#0b1c30]">{commRegion}</span>
                    </div>
                    <div className="pt-2 border-t border-[#dac0c4]/20">
                      <span className="font-semibold text-[#5c0427] block mb-1">Standard Household Form Fields:</span>
                      <span className="text-[#554245]">Full Name, Phone Number, Address, Aadhaar/ID, Bank Account, Damage Photo</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#f1dee3]/60 rounded-xl flex items-start gap-2 text-xs text-[#554245]">
                    <span className="material-symbols-outlined text-[18px] text-[#7a1f3d] shrink-0 mt-0.5">verified_user</span>
                    <p>
                      AidNexus Privacy Shield guarantee active: individual household records are encrypted and never exposed publicly.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setWizardStep(4)}
                      className="h-12 px-5 rounded-full border border-[#dac0c4] text-[#0b1c30] font-body text-xs font-semibold"
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCreateCommunitySubmit}
                      disabled={creating}
                      className="flex-1 h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                      <span>{creating ? 'Deploying Community...' : 'Publish Relief Community'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 6: Generated Codes */}
              {wizardStep === 6 && (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-[26px]">check_circle</span>
                  </div>
                  <h4 className="font-headline text-2xl text-[#0b1c30]">Community Created!</h4>
                  <p className="font-body text-xs text-[#554245]">
                    Single-use access tokens have been minted for distribution to households.
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
                            onClick={() => {
                              navigator.clipboard.writeText(c.code);
                              alert(`Code ${c.code} copied!`);
                            }}
                            className="px-2 py-0.5 rounded bg-[#dce9ff] text-[#0b1c30] hover:bg-[#d3e4fe] font-body text-[11px]"
                          >
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setWizardOpen(false);
                        navigate('/admin');
                      }}
                      className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">dashboard</span>
                      <span>Go to Admin Dashboard</span>
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
