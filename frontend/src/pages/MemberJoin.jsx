import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { validateJoinCode, submitClaim } from '../api/member';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner, ErrorAlert } from '../components/FeedbackComponents';

export default function MemberJoin() {
  const [searchParams] = useSearchParams();
  const urlCode = searchParams.get('code') || '';
  const navigate = useNavigate();
  const { user } = useAuth();

  // Wizard Step: 'step-a' (Code) | 'step-b' (Consent) | 'step-c' (Upload & Fields) | 'step-d' (Success) | 'donor'
  const [currentStep, setCurrentStep] = useState('step-a');

  // Step A: Code Entry
  const [code, setCode] = useState(urlCode || 'CN-7F3K-2Q9P');
  const [validating, setValidating] = useState(false);
  const [communityData, setCommunityData] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Step B: Credentials (if guest) & Consent
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('you@gmail.com');
  const [memberPassword, setMemberPassword] = useState('ReliefPass123!');
  const [memberPhone, setMemberPhone] = useState('+91 98765 43210');
  const [consentChecked, setConsentChecked] = useState(true);

  // Step C: Dynamic Field Values & Files
  const [formValues, setFormValues] = useState({});
  const [formFiles, setFormFiles] = useState({});
  const [primaryPhotoFile, setPrimaryPhotoFile] = useState(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Auto-validate if code is provided in URL
  useEffect(() => {
    if (urlCode && !communityData) {
      handleValidate(urlCode);
    }
  }, [urlCode]);

  const handleValidate = async (codeToTest) => {
    const clean = (codeToTest || code).trim();
    if (!clean) return;

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
      setCurrentStep('step-b');
    } catch (err) {
      setValidationError(err.response?.data?.detail || 'Invalid or already used code.');
    } finally {
      setValidating(false);
    }
  };

  const handleInputChange = (fieldId, value) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileChange = (fieldId, file) => {
    setFormFiles((prev) => ({ ...prev, [fieldId]: file }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!consentChecked) {
      setSubmitError('Consent is required to submit relief verification details.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const formData = new FormData();
      formData.append('code', communityData?.code || code);
      formData.append('consent', 'true');

      // Credentials if guest
      if (!user) {
        formData.append('member_name', memberName.trim() || 'Household Applicant');
        formData.append('member_email', memberEmail.trim().toLowerCase());
        formData.append('member_password', memberPassword);
        if (memberPhone) formData.append('member_phone', memberPhone.trim());
      }

      // Dynamic required fields
      (communityData?.required_fields || []).forEach((rf) => {
        if (rf.field_type === 'photo' || rf.field_type === 'document') {
          const file = formFiles[rf.id] || primaryPhotoFile;
          if (file) {
            formData.append(`field_${rf.id}`, file);
          }
        } else {
          const val = formValues[rf.id] || '';
          formData.append(`field_${rf.id}`, val);
        }
      });

      const res = await submitClaim(formData);

      if (res.access_token) {
        localStorage.setItem('token', res.access_token);
        const applicantUser = {
          id: res.membership_id,
          name: memberName || user?.name || 'Applicant',
          email: memberEmail || user?.email || '',
          role: 'member',
        };
        localStorage.setItem('user', JSON.stringify(applicantUser));
      }

      setSubmitSuccess(res);
      setCurrentStep('step-d');
    } catch (err) {
      setSubmitError(err.response?.data?.detail || 'Failed to submit claim. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#F6E3E8] via-[#eff4ff] to-white p-4 sm:p-6 lg:p-8 flex flex-col justify-center items-center font-body text-[#0b1c30]">
      {/* Background SVG Waves */}
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
          <div className="w-full max-w-[390px] mx-auto animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col relative">
              <div className="flex items-center justify-between pb-4">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="p-1.5 -ml-1 text-[#554245] hover:text-[#0b1c30] rounded-full hover:bg-[#eff4ff] transition-colors flex items-center gap-1 font-body text-xs font-semibold"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-[#554245]">
                  <span className="w-2 h-2 rounded-full bg-[#7a1f3d]"></span>
                  <span className="font-code text-xs">Step 1 of 4</span>
                </div>
              </div>

              <h2 className="font-headline text-2xl font-bold text-[#0b1c30] mt-1">Join a community</h2>
              <p className="font-body text-sm text-[#554245] mt-2">Enter your single-use community access code</p>

              <div className="mt-4">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CN-7F3K-2Q9P"
                  className="w-full h-12 px-4 rounded-2xl border border-[#dac0c4]/60 font-code text-base text-[#0b1c30] bg-white focus:outline-none focus:border-[#7a1f3d] focus:ring-2 focus:ring-[#7a1f3d]/20 transition-all text-center tracking-wider uppercase font-bold"
                />
              </div>

              {validationError && (
                <div className="mt-4 p-3 rounded-2xl bg-[#ffdad6] text-[#93000a] flex items-center gap-2.5 text-xs font-semibold">
                  <span className="material-symbols-outlined text-[#ba1a1a] text-[18px] shrink-0">error</span>
                  <span>{validationError}</span>
                </div>
              )}

              <button
                type="button"
                disabled={validating || !code.trim()}
                onClick={() => handleValidate(code)}
                className="mt-5 w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{validating ? 'Verifying...' : 'Continue'}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>

              {/* Prominent Donor Link */}
              <button
                type="button"
                onClick={() => setCurrentStep('donor')}
                className="mt-4 w-full py-2.5 rounded-full bg-[#f1dee3]/60 hover:bg-[#f1dee3] text-[#7a1f3d] font-body text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                <span>No code? Enter as a donor!</span>
              </button>
            </div>
          </div>
        )}

        {/* DONOR PORTAL VIEW */}
        {currentStep === 'donor' && (
          <div className="w-full max-w-[390px] mx-auto animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col relative">
              <div className="flex items-center justify-between pb-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('step-a')}
                  className="text-[#554245] hover:text-[#0b1c30] transition-colors flex items-center gap-1 font-body text-xs font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back</span>
                </button>
                <span className="px-2.5 py-0.5 rounded-full bg-[#f1dee3] text-[#7a1f3d] font-code text-[11px] font-bold">
                  Donor Portal
                </span>
              </div>

              <h2 className="font-headline text-2xl font-bold text-[#0b1c30] mt-2">Join as a donor</h2>
              <p className="font-body text-sm text-[#554245] mt-2 leading-relaxed">
                Donors can browse active disaster relief communities and view verified coordinator funding QRs.
              </p>

              <button
                type="button"
                onClick={() => navigate('/public/communities')}
                className="mt-6 w-full h-12 rounded-full border border-[#dac0c4]/60 bg-white hover:bg-[#eff4ff] transition-colors text-[#0b1c30] font-body text-sm font-semibold flex items-center justify-center gap-3 shadow-xs cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"></path>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="my-5 flex items-center">
                <div className="flex-grow border-t border-[#dac0c4]/40"></div>
                <span className="px-3 text-xs text-[#554245]/60 font-body lowercase">or</span>
                <div className="flex-grow border-t border-[#dac0c4]/40"></div>
              </div>

              <div>
                <input
                  type="email"
                  defaultValue="you@gmail.com"
                  className="w-full h-12 px-4 rounded-2xl border border-[#dac0c4]/60 font-body text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#7a1f3d] focus:ring-2 focus:ring-[#7a1f3d]/20 transition-all"
                  placeholder="you@gmail.com"
                />
              </div>

              <button
                type="button"
                onClick={() => navigate('/public/communities')}
                className="mt-4 w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Browse Relief Programs</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep('step-a')}
                className="mt-4 text-center font-body text-xs text-[#7a1f3d] font-bold hover:underline py-1"
              >
                ← Have an access code? Join a community
              </button>
            </div>
          </div>
        )}

        {/* STEP B: CONSENT & DETAILS */}
        {currentStep === 'step-b' && (
          <div className="w-full max-w-[390px] mx-auto animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col relative">
              <div className="flex items-center justify-between pb-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('step-a')}
                  className="text-[#554245] hover:text-[#0b1c30] transition-colors flex items-center gap-1 font-body text-xs font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-[#554245]">
                  <span className="w-2 h-2 rounded-full bg-[#7a1f3d]"></span>
                  <span className="font-code text-xs">Step 2 of 4</span>
                </div>
              </div>

              <h2 className="font-headline text-2xl font-bold text-[#0b1c30] mt-1">Consent & details</h2>

              {/* Admin Badge Card */}
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
                      {communityData?.admin_name || 'Meghana Manoj'}{' '}
                      <span className="font-normal text-xs text-[#554245]">(Relief Coordinator)</span>
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
                      {communityData?.community_title || 'Coastal Relief'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Registration inputs if not signed in */}
              {!user && (
                <div className="mt-4 space-y-2.5 pt-2 border-t border-[#dac0c4]/20">
                  <input
                    type="text"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
                  />
                  <input
                    type="tel"
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
                  />
                </div>
              )}

              <p className="font-body text-xs text-[#554245] mt-4 font-bold uppercase tracking-wider">
                We will collect the following:
              </p>

              <ul className="mt-2 space-y-2 text-xs text-[#0b1c30] font-semibold">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                  <span>Bank account / UPI routing</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                  <span>Aadhaar / Citizen ID number</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                  <span>House damage photo verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                  <span>Address / Ward location</span>
                </li>
              </ul>

              <label className="mt-5 flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-5 h-5 rounded border-[#dac0c4] text-[#7a1f3d] focus:ring-[#7a1f3d]/20"
                />
                <span className="font-body text-sm font-bold text-[#0b1c30]">I agree to data verification</span>
              </label>

              <button
                type="button"
                disabled={!consentChecked}
                onClick={() => setCurrentStep('step-c')}
                className="mt-5 w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP C: UPLOAD HOUSE PHOTO & FIELD DETAILS */}
        {currentStep === 'step-c' && (
          <div className="w-full max-w-[390px] mx-auto animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col relative">
              <div className="flex items-center justify-between pb-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('step-b')}
                  className="text-[#554245] hover:text-[#0b1c30] transition-colors flex items-center gap-1 font-body text-xs font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back</span>
                </button>
                <span className="px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#0b1c30] font-code text-[11px] font-semibold">
                  EN | ML
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-1 flex items-center justify-between text-xs text-[#554245] mb-1.5 font-code">
                <span>Step 3 of 4</span>
              </div>
              <div className="w-full flex gap-1.5 mb-4">
                <div className="h-1.5 flex-1 rounded-full bg-[#7a1f3d]"></div>
                <div className="h-1.5 flex-1 rounded-full bg-[#7a1f3d]"></div>
                <div className="h-1.5 flex-1 rounded-full bg-[#7a1f3d]"></div>
                <div className="h-1.5 flex-1 rounded-full bg-[#dce9ff]"></div>
              </div>

              <h2 className="font-headline text-2xl font-bold text-[#0b1c30]">Upload house photo</h2>

              {/* Dynamic Text Fields */}
              {communityData?.required_fields?.filter((rf) => rf.field_type !== 'photo' && rf.field_type !== 'document').length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {communityData.required_fields
                    .filter((rf) => rf.field_type !== 'photo' && rf.field_type !== 'document')
                    .map((rf) => (
                      <div key={rf.id}>
                        <label className="block font-body text-xs font-semibold text-[#554245] mb-1">
                          {rf.label} {rf.is_required && <span className="text-[#ba1a1a]">*</span>}
                        </label>
                        <input
                          type={rf.field_type === 'number' ? 'number' : 'text'}
                          value={formValues[rf.id] || ''}
                          onChange={(e) => handleInputChange(rf.id, e.target.value)}
                          placeholder={`Enter ${rf.label}`}
                          className="w-full h-11 px-3.5 rounded-xl border border-[#dac0c4]/60 font-body text-xs text-[#0b1c30] focus:outline-none focus:border-[#7a1f3d]"
                        />
                      </div>
                    ))}
                </div>
              )}

              {/* Large Photo Upload Card */}
              <div className="mt-4 relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  id="house-photo-input"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPrimaryPhotoFile(e.target.files[0]);
                    }
                  }}
                />
                <div
                  id="house-photo-box"
                  onClick={() => document.getElementById('house-photo-input').click()}
                  className={`p-7 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    primaryPhotoFile
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'border-[#dac0c4]/60 hover:border-[#7a1f3d]/60 hover:bg-[#eff4ff]'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#7a1f3d] mb-3">
                    <span className="material-symbols-outlined text-[28px]">
                      {primaryPhotoFile ? 'check_circle' : 'add_a_photo'}
                    </span>
                  </div>
                  <p className="font-body text-sm font-bold text-[#0b1c30]">
                    {primaryPhotoFile ? primaryPhotoFile.name : 'Tap to upload or take a photo'}
                  </p>
                  <span className="font-code text-xs text-[#554245]/70 mt-1">
                    {primaryPhotoFile
                      ? `${(primaryPhotoFile.size / 1024).toFixed(0)} KB • Photo Attached`
                      : 'JPG / PNG • Camera or gallery'}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="mt-3 p-3 rounded-xl bg-[#ffdad6] text-[#93000a] text-xs font-semibold">
                  {submitError}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="mt-5 w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{submitting ? 'Submitting Details...' : 'Submit Claim'}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP D: SUBMITTED SUCCESS */}
        {currentStep === 'step-d' && (
          <div className="w-full max-w-[390px] mx-auto animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#dac0c4]/40 flex flex-col items-center text-center relative">
              {/* Success checkmark icon in circular badge */}
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
                <span className="material-symbols-outlined text-[34px] font-bold">check</span>
              </div>

              <h2 className="font-headline text-3xl font-bold text-[#0b1c30]">Submitted!</h2>

              {/* Status badge */}
              <div className="mt-3 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-800 font-body text-xs font-bold border border-emerald-200">
                Waiting for admin review
              </div>

              <p className="font-body text-sm text-[#554245] mt-4 leading-relaxed">
                Your details have been submitted. You'll be notified once the relief coordinator reviews your household information.
              </p>

              <div className="w-full mt-5 p-3 rounded-xl bg-[#eff4ff] text-left font-code text-xs space-y-1 text-[#554245]">
                <div className="flex justify-between">
                  <span>Claim Reference:</span>
                  <strong className="text-[#7a1f3d]">#{submitSuccess?.submission_id || '982'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Integrity Protocol:</span>
                  <strong className="text-[#0b1c30]">ENCRYPTED</strong>
                </div>
              </div>

              <div className="mt-6 w-full space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/status')}
                  className="w-full h-12 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-sm font-bold transition-all shadow-xs"
                >
                  Track Claim Status
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full h-12 rounded-full border-2 border-[#7a1f3d] text-[#7a1f3d] hover:bg-[#f1dee3] font-body text-sm font-bold transition-all"
                >
                  Back to Communities
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
