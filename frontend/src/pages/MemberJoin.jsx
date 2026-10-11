import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { validateJoinCode, submitClaim } from '../api/member';
import { getPublicCommunity } from '../api/public';
import { useAuth } from '../context/AuthContext';
import { formatApiError } from '../utils/formatError';

export default function MemberJoin() {
  const [searchParams] = useSearchParams();
  const urlCode = searchParams.get('code') || '';
  const urlCommunityId = searchParams.get('community') || '';
  const navigate = useNavigate();
  const { user, setManualAuth, logout } = useAuth();

  // Wizard Step: 'step-a' (Code) | 'step-b' (Consent & Credentials) | 'step-c' (Fields & Files) | 'step-d' (Success)
  const [currentStep, setCurrentStep] = useState('step-a');

  // Community preview from URL ?community=ID
  const [presetCommunity, setPresetCommunity] = useState(null);

  // Step A: Code Entry
  const [code, setCode] = useState(urlCode || '');
  const [validating, setValidating] = useState(false);
  const [communityData, setCommunityData] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // StrictMode guard for auto-validating code once only
  const hasAutoValidatedCode = useRef(false);

  // Step B: Credentials (if guest) & Consent
  const [memberName, setMemberName] = useState(user?.name || '');
  const [memberEmail, setMemberEmail] = useState(user?.email || '');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberPhone, setMemberPhone] = useState(user?.phone || '');
  const [consentChecked, setConsentChecked] = useState(false);
  const [stepBError, setStepBError] = useState(null);

  // Step C: Dynamic Field Values & Files (separate file per photo/document field)
  const [formValues, setFormValues] = useState({});
  const [formFiles, setFormFiles] = useState({});

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Fetch target community information if ?community=ID is passed
  useEffect(() => {
    if (urlCommunityId && !communityData) {
      getPublicCommunity(urlCommunityId)
        .then((comm) => setPresetCommunity(comm))
        .catch(() => setPresetCommunity(null));
    }
  }, [urlCommunityId, communityData]);

  const handleValidate = useCallback(async (codeToTest) => {
    const clean = (codeToTest || code).trim();
    if (!clean) {
      setValidationError('Please enter a valid access code.');
      return;
    }

    try {
      setValidating(true);
      setValidationError(null);
      const res = await validateJoinCode(clean);
      setCommunityData(res);

      // Initialize dynamic form values
      const initialVals = {};
      (res.required_fields || []).forEach((rf) => {
        initialVals[rf.id] = '';
      });
      setFormValues(initialVals);
      setFormFiles({});
      setCurrentStep('step-b');
    } catch (err) {
      setValidationError(formatApiError(err, 'Invalid or already used access code. Please check with your coordinator.'));
    } finally {
      setValidating(false);
    }
  }, [code]);

  // Auto-validate if code is provided in URL with StrictMode ref guard
  useEffect(() => {
    if (urlCode && !communityData && !hasAutoValidatedCode.current) {
      hasAutoValidatedCode.current = true;
      handleValidate(urlCode);
    }
  }, [urlCode, communityData, handleValidate]);

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    handleValidate(code);
  };

  const handleConsentSubmit = (e) => {
    e.preventDefault();
    setStepBError(null);

    // Non-member logged in check
    if (user && user.role !== 'member') {
      setStepBError(`You are currently logged in with a ${user.role} role. Relief household claims must be submitted by household applicants. Please sign out first.`);
      return;
    }

    // Guest credentials check
    if (!user) {
      if (!memberName.trim()) {
        setStepBError('Please enter your full name.');
        return;
      }
      if (!memberEmail.trim() && !memberPhone.trim()) {
        setStepBError('Please enter an email or phone number to recover your claim.');
        return;
      }
      if (!memberPassword || memberPassword.length < 6) {
        setStepBError('Please provide a password of at least 6 characters.');
        return;
      }
    }

    if (!consentChecked) {
      setStepBError('Consent is required to submit relief verification details.');
      return;
    }

    setCurrentStep('step-c');
  };

  const handleInputChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileChange = (fieldId, file) => {
    if (!file) return;

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setSubmitError(`File "${file.name}" exceeds the maximum allowed size of 10MB.`);
      return;
    }

    setSubmitError(null);
    setFormFiles((prev) => ({ ...prev, [fieldId]: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent non-member logged in submission
    if (user && user.role !== 'member') {
      setSubmitError(`You are logged in as ${user.role}. Please sign out before submitting a household claim.`);
      return;
    }

    // Real validation of required fields
    const missingLabels = [];
    const fields = communityData?.required_fields || [];

    for (const rf of fields) {
      if (rf.is_required) {
        if (rf.field_type === 'photo' || rf.field_type === 'document') {
          const file = formFiles[rf.id];
          if (!file) {
            missingLabels.push(rf.label);
          }
        } else {
          const val = formValues[rf.id];
          if (!val || !val.trim()) {
            missingLabels.push(rf.label);
          }
        }
      }
    }

    if (missingLabels.length > 0) {
      setSubmitError(`Please provide the following required items: ${missingLabels.join(', ')}.`);
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const formData = new FormData();
      formData.append('code', communityData?.code || code.trim());
      formData.append('consent', 'true');

      // Credentials for guest registration
      if (!user) {
        formData.append('member_name', memberName.trim() || 'Household Applicant');
        // If email provided, use it; otherwise provide phone-based identity so backend can create user
        const finalEmail = memberEmail.trim().toLowerCase() || `${memberPhone.trim()}@beneficiary.aidnexus.org`;
        formData.append('member_email', finalEmail);
        formData.append('member_password', memberPassword); // Do NOT trim password
        if (memberPhone.trim()) {
          formData.append('member_phone', memberPhone.trim());
        }
      }

      // Dynamic required fields
      fields.forEach((rf) => {
        if (rf.field_type === 'photo' || rf.field_type === 'document') {
          const file = formFiles[rf.id];
          if (file) {
            formData.append(`field_${rf.id}`, file);
          }
        } else {
          const val = formValues[rf.id] || '';
          formData.append(`field_${rf.id}`, val.trim());
        }
      });

      const res = await submitClaim(formData);

      // Validate server returned a real submission
      if (!res || !res.submission_id) {
        throw new Error('Server did not return a valid submission confirmation.');
      }

      // If user was a guest and server returned a token, log them in via AuthContext
      if (!user && res.access_token) {
        const applicantUser = {
          id: res.membership_id || res.submission_id,
          name: memberName.trim() || 'Household Applicant',
          email: memberEmail.trim().toLowerCase() || `${memberPhone.trim()}@beneficiary.aidnexus.org`,
          role: 'member',
        };
        setManualAuth(res.access_token, applicantUser);
      }

      setSubmitSuccess(res);
      setCurrentStep('step-d');
    } catch (err) {
      setSubmitError(formatApiError(err, 'Failed to submit claim. Please check your inputs and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#F6E3E8] via-[#eff4ff] to-white p-4 sm:p-6 lg:p-8 flex flex-col justify-center items-center font-body text-[#0b1c30] overflow-hidden">
      {/* Background SVG Waves - Contained inside relative parent */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden z-0">
        <svg className="w-full h-full text-[#dac0c4]/30" fill="none" preserveAspectRatio="none" viewBox="0 0 1440 800">
          <path d="M0,220 C320,180 480,260 760,210 C1040,160 1200,240 1440,190 L1440,800 L0,800 Z" fill="currentColor" fillOpacity="0.12"></path>
          <path d="M0,380 C360,430 640,320 920,390 C1200,460 1340,360 1440,400 L1440,800 L0,800 Z" fill="currentColor" fillOpacity="0.18"></path>
          <path d="M0,520 C280,480 620,560 980,510 C1260,470 1380,530 1440,515 L1440,800 L0,800 Z" fill="currentColor" fillOpacity="0.25"></path>
        </svg>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center justify-center my-auto">
        {/* STEP A: ENTER COMMUNITY ACCESS CODE */}
        {currentStep === 'step-a' && (
          <div className="w-full max-w-[420px] mx-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col relative">
              <div className="flex items-center justify-between pb-4">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="p-1.5 -ml-1 text-[#554245] hover:text-[#0b1c30] rounded-full hover:bg-[#eff4ff] transition-colors flex items-center gap-1 font-body text-xs font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-[#554245]">
                  <span className="w-2 h-2 rounded-full bg-[#7a1f3d]"></span>
                  <span className="font-code text-xs">Step 1 of 3</span>
                </div>
              </div>

              {/* Show Community Context if linked via /join?community=ID */}
              {presetCommunity && (
                <div className="mb-4 p-3.5 rounded-2xl bg-[#eff4ff] border border-[#dac0c4]/40 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[18px] text-[#7a1f3d]">location_city</span>
                    <span className="font-body text-xs uppercase tracking-wide font-bold text-[#7a1f3d]">
                      Target Relief Scheme
                    </span>
                  </div>
                  <h3 className="font-headline text-lg font-bold text-[#0b1c30] leading-snug">
                    {presetCommunity.title}
                  </h3>
                  <p className="font-body text-xs text-[#554245] mt-1">
                    Enter the access code from your coordinator.
                  </p>
                </div>
              )}

              <h2 className="font-headline text-2xl font-bold text-[#0b1c30] mt-1">Join a community</h2>
              <p className="font-body text-xs text-[#554245] mt-1">
                Enter your single-use community access code issued by your relief coordinator.
              </p>

              <form onSubmit={handleCodeSubmit} className="mt-4">
                <div>
                  <label htmlFor="join-code-input" className="block text-xs font-bold text-[#554245] uppercase tracking-wider mb-1">
                    Access Code
                  </label>
                  <input
                    id="join-code-input"
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. AID-7F3K-2Q9P"
                    className="w-full h-12 px-4 rounded-2xl border border-[#dac0c4]/60 font-code text-base text-[#0b1c30] bg-white focus:outline-none focus:border-[#7a1f3d] focus:ring-2 focus:ring-[#7a1f3d]/20 transition-all text-center tracking-wider uppercase font-bold"
                  />
                </div>

                {validationError && (
                  <div role="alert" className="mt-4 p-3 rounded-2xl bg-[#ffdad6] text-[#93000a] flex items-center gap-2.5 text-xs font-semibold">
                    <span className="material-symbols-outlined text-[#ba1a1a] text-[18px] shrink-0">error</span>
                    <span>{validationError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={validating || !code.trim()}
                  className="mt-5 w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{validating ? 'Verifying Code...' : 'Verify Access Code'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </form>

              {/* Public Donor Redirect Option */}
              <button
                type="button"
                onClick={() => navigate('/public/communities')}
                className="mt-4 w-full py-2.5 rounded-full bg-[#f1dee3]/60 hover:bg-[#f1dee3] text-[#7a1f3d] font-body text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                <span>Want to support relief efforts? Explore Donor Schemes</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP B: CONSENT & DETAILS */}
        {currentStep === 'step-b' && (
          <div className="w-full max-w-[420px] mx-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col relative">
              <div className="flex items-center justify-between pb-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('step-a')}
                  className="text-[#554245] hover:text-[#0b1c30] transition-colors flex items-center gap-1 font-body text-xs font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-[#554245]">
                  <span className="w-2 h-2 rounded-full bg-[#7a1f3d]"></span>
                  <span className="font-code text-xs">Step 2 of 3</span>
                </div>
              </div>

              <h2 className="font-headline text-2xl font-bold text-[#0b1c30] mt-1">Consent & Credentials</h2>

              {/* Scheme Coordinator Info Card */}
              <div className="mt-4 p-3.5 rounded-2xl bg-[#eff4ff] border border-[#dac0c4]/40 flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#cbdbf5] text-[#5c0427] flex items-center justify-center font-bold text-xs font-code">
                    AD
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#554245] font-semibold uppercase tracking-wide">
                      Coordinator
                    </span>
                    <span className="text-sm font-bold text-[#0b1c30]">
                      {communityData?.admin_name || 'Designated Relief Coordinator'}
                    </span>
                  </div>
                </div>

                <div className="h-[1px] bg-[#dac0c4]/30"></div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#f1dee3] text-[#7a1f3d] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">nature_people</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#554245] font-semibold uppercase tracking-wide">
                      Community
                    </span>
                    <span className="text-sm font-bold text-[#0b1c30]">
                      {communityData?.community_title || 'Disaster Relief Initiative'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logged in role notice if non-member */}
              {user && user.role !== 'member' && (
                <div className="mt-4 p-3.5 rounded-2xl bg-[#ffdad6] border border-[#ffdad6] text-[#93000a] text-xs space-y-2">
                  <p className="font-bold">
                    Logged in as {user.role}: {user.email}
                  </p>
                  <p>
                    Relief claims must be submitted by household applicants. Please log out first.
                  </p>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="px-4 py-1.5 rounded-full bg-[#93000a] text-white font-bold text-xs cursor-pointer hover:bg-[#ba1a1a]"
                  >
                    Log Out of {user.role} Session
                  </button>
                </div>
              )}

              <form onSubmit={handleConsentSubmit} className="mt-4 space-y-4">
                {/* Guest Household Credentials */}
                {!user && (
                  <div className="space-y-3 pt-1 border-t border-[#dac0c4]/30">
                    <p className="font-body text-xs text-[#554245] font-semibold">
                      Create your household claimant credentials to check claim status:
                    </p>

                    <div>
                      <label htmlFor="applicant-name" className="block text-xs font-bold text-[#554245] mb-1">
                        Full Name <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <input
                        id="applicant-name"
                        type="text"
                        required
                        value={memberName}
                        onChange={(e) => setMemberName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] bg-[#eff4ff] focus:outline-none focus:border-[#7a1f3d]"
                      />
                    </div>

                    <div>
                      <label htmlFor="applicant-email" className="block text-xs font-bold text-[#554245] mb-1">
                        Email Address <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <input
                        id="applicant-email"
                        type="email"
                        required
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] bg-[#eff4ff] focus:outline-none focus:border-[#7a1f3d]"
                      />
                    </div>

                    <div>
                      <label htmlFor="applicant-phone" className="block text-xs font-bold text-[#554245] mb-1">
                        Phone Number (Optional)
                      </label>
                      <input
                        id="applicant-phone"
                        type="tel"
                        value={memberPhone}
                        onChange={(e) => setMemberPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] bg-[#eff4ff] focus:outline-none focus:border-[#7a1f3d]"
                      />
                    </div>

                    <div>
                      <label htmlFor="applicant-password" className="block text-xs font-bold text-[#554245] mb-1">
                        Password (min 6 characters) <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <input
                        id="applicant-password"
                        type="password"
                        required
                        minLength={6}
                        value={memberPassword}
                        onChange={(e) => setMemberPassword(e.target.value)}
                        placeholder="Set account password"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] bg-[#eff4ff] focus:outline-none focus:border-[#7a1f3d]"
                      />
                    </div>
                  </div>
                )}

                {/* Dynamically Rendered Required Fields Criteria */}
                <div className="pt-2 border-t border-[#dac0c4]/30">
                  <p className="font-body text-xs text-[#554245] font-bold uppercase tracking-wider mb-2">
                    Required Verification Criteria:
                  </p>
                  <ul className="space-y-1.5 text-xs text-[#0b1c30]">
                    {(communityData?.required_fields || []).map((rf) => (
                      <li key={rf.id} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                        <span>
                          {rf.label} {rf.is_required && <strong className="text-[#7a1f3d] font-semibold">(Mandatory)</strong>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Consent Checkbox */}
                <div className="pt-2">
                  <label htmlFor="consent-checkbox" className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      id="consent-checkbox"
                      type="checkbox"
                      required
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded border-[#dac0c4] text-[#7a1f3d] focus:ring-[#7a1f3d]/20 cursor-pointer"
                    />
                    <span className="font-body text-xs font-bold text-[#0b1c30] leading-snug">
                      I agree to submit my household information for relief verification arranged for this community.
                    </span>
                  </label>
                </div>

                {stepBError && (
                  <div role="alert" className="p-3 rounded-xl bg-[#ffdad6] text-[#93000a] text-xs font-semibold">
                    {stepBError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!consentChecked || (user && user.role !== 'member')}
                  className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Verification Form</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* STEP C: DYNAMIC FIELDS & INDIVIDUAL FILE UPLOADS */}
        {currentStep === 'step-c' && (
          <div className="w-full max-w-[480px] mx-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col relative">
              <div className="flex items-center justify-between pb-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('step-b')}
                  className="text-[#554245] hover:text-[#0b1c30] transition-colors flex items-center gap-1 font-body text-xs font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-[#554245]">
                  <span className="w-2 h-2 rounded-full bg-[#7a1f3d]"></span>
                  <span className="font-code text-xs">Step 3 of 3</span>
                </div>
              </div>

              <h2 className="font-headline text-2xl font-bold text-[#0b1c30]">Verification Details</h2>
              <p className="font-body text-xs text-[#554245] mt-1 mb-4">
                Please complete each required field. Evidence files are strictly protected.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {(communityData?.required_fields || []).map((rf) => {
                  const isFileField = rf.field_type === 'photo' || rf.field_type === 'document';
                  const currentFile = formFiles[rf.id];

                  if (isFileField) {
                    return (
                      <div key={rf.id} className="p-3.5 bg-[#eff4ff]/60 rounded-2xl border border-[#dac0c4]/40">
                        <label htmlFor={`file-${rf.id}`} className="block font-body text-xs font-bold text-[#554245] mb-1">
                          {rf.label} {rf.is_required && <span className="text-[#ba1a1a]">*</span>}
                        </label>
                        <p className="text-[11px] text-[#554245]/80 mb-2">
                          {rf.field_type === 'photo'
                            ? 'Attach clear household damage photograph (JPG, PNG, WebP — max 10MB)'
                            : 'Attach verification document (PDF, JPG, PNG — max 10MB)'}
                        </p>

                        <input
                          id={`file-${rf.id}`}
                          type="file"
                          accept={rf.field_type === 'photo' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,application/pdf'}
                          className="w-full text-xs text-[#0b1c30] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#7a1f3d] file:text-white hover:file:bg-[#5c0427] cursor-pointer"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileChange(rf.id, e.target.files[0]);
                            }
                          }}
                        />

                        {currentFile && (
                          <div className="mt-2 text-xs font-code text-emerald-800 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>{currentFile.name} ({(currentFile.size / 1024).toFixed(0)} KB)</span>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (rf.field_type === 'address') {
                    return (
                      <div key={rf.id}>
                        <label htmlFor={`field-${rf.id}`} className="block font-body text-xs font-bold text-[#554245] mb-1">
                          {rf.label} {rf.is_required && <span className="text-[#ba1a1a]">*</span>}
                        </label>
                        <textarea
                          id={`field-${rf.id}`}
                          rows={3}
                          required={rf.is_required}
                          value={formValues[rf.id] || ''}
                          onChange={(e) => handleInputChange(rf.id, e.target.value)}
                          placeholder={`Enter ${rf.label}`}
                          className="w-full p-3 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] bg-[#eff4ff] focus:outline-none focus:border-[#7a1f3d]"
                        />
                      </div>
                    );
                  }

                  let inputType = 'text';
                  if (rf.field_type === 'number') inputType = 'number';
                  else if (rf.field_type === 'email') inputType = 'email';
                  else if (rf.field_type === 'phone') inputType = 'tel';

                  return (
                    <div key={rf.id}>
                      <label htmlFor={`field-${rf.id}`} className="block font-body text-xs font-bold text-[#554245] mb-1">
                        {rf.label} {rf.is_required && <span className="text-[#ba1a1a]">*</span>}
                      </label>
                      <input
                        id={`field-${rf.id}`}
                        type={inputType}
                        required={rf.is_required}
                        value={formValues[rf.id] || ''}
                        onChange={(e) => handleInputChange(rf.id, e.target.value)}
                        placeholder={`Enter ${rf.label}`}
                        className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] bg-[#eff4ff] focus:outline-none focus:border-[#7a1f3d]"
                      />
                    </div>
                  );
                })}

                {submitError && (
                  <div role="alert" className="p-3.5 rounded-xl bg-[#ffdad6] text-[#93000a] text-xs font-semibold leading-relaxed">
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <span>{submitting ? 'Submitting Claim Details...' : 'Submit Claim'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* STEP D: SUBMITTED SUCCESS */}
        {currentStep === 'step-d' && (
          <div className="w-full max-w-[420px] mx-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col items-center text-center relative">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
                <span className="material-symbols-outlined text-[34px] font-bold">check</span>
              </div>

              <h2 className="font-headline text-3xl font-bold text-[#0b1c30]">Claim Submitted!</h2>

              <div className="mt-3 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-800 font-body text-xs font-bold border border-emerald-200">
                Waiting for coordinator review
              </div>

              <p className="font-body text-xs text-[#554245] mt-4 leading-relaxed">
                Your relief claim has been submitted to the scheme coordinator. You can track updates and respond to document inquiries on your claim status page.
              </p>

              <div className="w-full mt-5 p-3 rounded-xl bg-[#eff4ff] text-left font-code text-xs space-y-1.5 text-[#554245] border border-[#dac0c4]/30">
                <div className="flex justify-between">
                  <span>Claim Reference:</span>
                  <strong className="text-[#7a1f3d]">
                    {submitSuccess?.submission_id ? `#${submitSuccess.submission_id}` : 'Pending Confirmation'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Community:</span>
                  <strong className="text-[#0b1c30] truncate max-w-[200px]">
                    {submitSuccess?.community_title || communityData?.community_title || 'Relief Scheme'}
                  </strong>
                </div>
              </div>

              <div className="mt-6 w-full space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/status')}
                  className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-sm font-bold transition-all shadow-xs cursor-pointer"
                >
                  Track Claim Status
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full h-12 rounded-full border border-[#dac0c4]/60 text-[#554245] hover:bg-[#eff4ff] font-body text-sm font-semibold transition-all cursor-pointer"
                >
                  Return to Home
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
