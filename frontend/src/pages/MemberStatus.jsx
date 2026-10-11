import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMySubmission, markNotificationRead, fulfillDocumentRequest } from '../api/member';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';
import { formatApiError } from '../utils/formatError';

export default function MemberStatus() {
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Document fulfillment state
  const [uploadFiles, setUploadFiles] = useState({});
  const [uploadKeys, setUploadKeys] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [fulfillSuccess, setFulfillSuccess] = useState(null);

  const loadSubmission = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      setError(null);
      const data = await getMySubmission();
      if (!data || typeof data !== 'object' || !data.status) {
        throw new Error('Invalid claim status response received from server.');
      }
      setSubmission(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setSubmission(null);
      } else if (err.response?.status === 401) {
        navigate('/login', { replace: true, state: { from: '/status' } });
      } else {
        setError(formatApiError(err, 'Failed to load your claim status.'));
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadSubmission(true);
  }, [loadSubmission]);

  const handleMarkNotificationRead = async (id) => {
    try {
      setActionError(null);
      await markNotificationRead(id);
      // Silent refresh without full-page spinner
      await loadSubmission(false);
    } catch (err) {
      setActionError(formatApiError(err, 'Failed to mark notification as read.'));
    }
  };

  const handleFulfillDoc = async (drId) => {
    const file = uploadFiles[drId];
    if (!file) {
      setActionError('Please select a file to upload.');
      return;
    }

    // Validate size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setActionError(`File exceeds maximum size of 10MB.`);
      return;
    }

    try {
      setUploadingId(drId);
      setActionError(null);
      await fulfillDocumentRequest(drId, file);
      setFulfillSuccess(drId);
      // Clear file and increment key to reset file input
      setUploadFiles((prev) => ({ ...prev, [drId]: null }));
      setUploadKeys((prev) => ({ ...prev, [drId]: (prev[drId] || 0) + 1 }));
      setTimeout(() => setFulfillSuccess(null), 4000);
      // Silent refresh
      await loadSubmission(false);
    } catch (err) {
      setActionError(formatApiError(err, 'Failed to upload supplementary document.'));
    } finally {
      setUploadingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date unavailable';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleDateString();
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Date unavailable';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleString();
  };

  if (loading) {
    return <LoadingSpinner label="Retrieving your relief claim status..." />;
  }

  // Render error before empty state to avoid false "no claim" screen on network/server errors
  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 font-body text-center">
        <div className="bg-white rounded-3xl p-8 border border-[#ffdad6] shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#93000a] flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-[24px]">error</span>
          </div>
          <h2 className="font-headline text-2xl font-bold text-[#93000a] mb-2">Error Loading Claim</h2>
          <p className="text-xs text-[#554245] mb-6">{error}</p>
          <button
            type="button"
            onClick={() => loadSubmission(true)}
            className="px-6 py-2.5 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show empty state only on confirmed 404 (no active claim registered)
  if (!submission) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 font-body">
        <EmptyState
          title="No Active Relief Claim"
          description="We couldn't find a relief application registered under your account. If you received an access code from your coordinator, join the relief program now."
          actionText="Join Relief Program"
          onAction={() => navigate('/join')}
        />
      </div>
    );
  }

  const safeStatus = typeof submission.status === 'string' ? submission.status : 'pending';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 font-body text-[#0b1c30]">
      {/* Top Claim Overview Card */}
      <div className="bg-white border border-[#dac0c4]/40 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dac0c4]/30 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-code text-xs font-bold text-[#7a1f3d]">
                #{submission.submission_id}
              </span>
              <span className="font-body text-xs font-bold uppercase tracking-wider text-[#554245]">
                Relief Scheme Claim
              </span>
            </div>
            <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#5c0427]">
              {submission.community_title || 'Relief Jurisdiction'}
            </h1>
            <p className="font-body text-xs text-[#554245] mt-1">
              Submitted on {formatDate(submission.created_at)} &bull; Applicant:{' '}
              <strong className="text-[#0b1c30]">{submission.applicant_name}</strong>
            </p>
          </div>

          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                safeStatus === 'approved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : safeStatus === 'info_requested'
                  ? 'bg-[#ffdcc3] text-[#673500]'
                  : safeStatus === 'rejected'
                  ? 'bg-[#ffdad6] text-[#93000a]'
                  : 'bg-[#eff4ff] text-[#554245]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {safeStatus === 'approved'
                  ? 'check_circle'
                  : safeStatus === 'rejected'
                  ? 'cancel'
                  : 'pending'}
              </span>
              <span className="capitalize">{safeStatus.replace(/_/g, ' ')}</span>
            </span>
          </div>
        </div>

        {/* Status Explanation Banners for All Statuses */}
        {safeStatus === 'pending' && (
          <div className="p-4 bg-[#eff4ff] border border-[#dac0c4]/30 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-[#7a1f3d] text-[22px] shrink-0 mt-0.5">
              schedule
            </span>
            <div className="text-xs text-[#554245] leading-relaxed">
              <strong className="text-[#0b1c30] block mb-0.5 font-bold">Under Manual Verification</strong>
              Your household claim is currently in queue for inspection by relief coordinators. AidNexus never auto-rejects submissions; all determinations are conducted by authorized coordinators.
            </div>
          </div>
        )}

        {safeStatus === 'info_requested' && (
          <div className="p-4 bg-[#ffdcc3]/50 border border-[#673500]/30 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-[#673500] text-[22px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="text-xs text-[#673500] leading-relaxed">
              <strong className="block mb-0.5 font-bold">Supplementary Documents Requested</strong>
              Relief coordinators have requested additional documents to complete your eligibility verification. Please review the request below and upload the requested file.
            </div>
          </div>
        )}

        {safeStatus === 'approved' && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-emerald-700 text-[22px] shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong className="block mb-0.5 font-bold">Claim Verified & Approved</strong>
              Your household assistance claim has been approved. Distribution schedule and instructions will be coordinated by the relief team.
            </div>
          </div>
        )}

        {safeStatus === 'rejected' && (
          <div className="p-4 bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-[#ba1a1a] text-[22px] shrink-0 mt-0.5">
              cancel
            </span>
            <div className="text-xs text-[#93000a] leading-relaxed">
              <strong className="block mb-0.5 font-bold">Claim Not Approved</strong>
              Your claim was reviewed by the relief coordinator and could not be approved at this time. If you believe this is in error or your situation has changed, please contact your scheme coordinator or call our civil support hotline at 1070 to request an appeal review.
            </div>
          </div>
        )}

        {safeStatus !== 'pending' &&
          safeStatus !== 'info_requested' &&
          safeStatus !== 'approved' &&
          safeStatus !== 'rejected' && (
            <div className="p-4 bg-[#eff4ff] border border-[#dac0c4]/30 rounded-2xl flex items-start gap-3">
              <span className="material-symbols-outlined text-[#7a1f3d] text-[22px] shrink-0 mt-0.5">
                info
              </span>
              <div className="text-xs text-[#554245] leading-relaxed">
                <strong className="text-[#0b1c30] block mb-0.5 font-bold">
                  Status: {safeStatus.replace(/_/g, ' ')}
                </strong>
                Your claim is being processed. For any questions, please reach out to your designated coordinator.
              </div>
            </div>
          )}
      </div>

      {actionError && (
        <div role="alert" aria-live="assertive">
          <ErrorAlert message={actionError} />
        </div>
      )}

      {/* Notifications Panel */}
      {submission.notifications && submission.notifications.length > 0 && (
        <div className="bg-white border border-[#dac0c4]/40 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#5c0427] text-[20px]">notifications</span>
            <h2 className="font-headline text-xl font-bold text-[#0b1c30]">Notifications & Alerts</h2>
          </div>

          <div className="space-y-2">
            {submission.notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 text-xs transition ${
                  notif.is_read
                    ? 'bg-[#eff4ff]/40 border-[#dac0c4]/20 text-[#554245]'
                    : 'bg-[#f1dee3]/40 border-[#dac0c4]/60 text-[#5c0427] font-semibold'
                }`}
              >
                <div>
                  <p>{notif.message}</p>
                  <span className="font-code text-[10px] text-[#554245]/70 mt-1 block">
                    {formatDateTime(notif.created_at)}
                  </span>
                </div>

                {!notif.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkNotificationRead(notif.id)}
                    className="px-3 py-1 bg-[#7a1f3d] hover:bg-[#5c0427] text-white text-[11px] font-bold rounded-full transition shrink-0 cursor-pointer"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplementary Document Requests Panel */}
      {submission.document_requests && submission.document_requests.length > 0 && (
        <div className="bg-white border border-[#dac0c4]/40 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#673500] text-[20px]">upload_file</span>
            <h2 className="font-headline text-xl font-bold text-[#0b1c30]">
              Document Requests from Coordinator
            </h2>
          </div>

          <div className="space-y-4">
            {submission.document_requests.map((dr) => (
              <div
                key={dr.id}
                className="bg-[#eff4ff] border border-[#dac0c4]/40 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-[#554245] uppercase tracking-wider">Request:</span>
                    <p className="text-sm font-semibold text-[#0b1c30] mt-0.5">{dr.message}</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-code text-[11px] font-bold ${
                      dr.status === 'fulfilled'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#ffdcc3] text-[#673500]'
                    }`}
                  >
                    {dr.status === 'fulfilled' ? 'Fulfilled' : 'Pending Upload'}
                  </span>
                </div>

                {dr.status === 'pending' && (
                  <div className="pt-2 border-t border-[#dac0c4]/30 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1 w-full">
                      <label htmlFor={`file-dr-${dr.id}`} className="sr-only">
                        Upload requested document
                      </label>
                      <input
                        key={uploadKeys[dr.id] || 0}
                        id={`file-dr-${dr.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setUploadFiles((prev) => ({ ...prev, [dr.id]: e.target.files[0] }));
                          }
                        }}
                        className="text-xs font-body text-[#554245] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#dce9ff] file:text-[#0b1c30] hover:file:bg-[#cbdbf5] cursor-pointer"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={uploadingId === dr.id || !uploadFiles[dr.id]}
                      onClick={() => handleFulfillDoc(dr.id)}
                      className="h-9 px-5 bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-xs font-bold rounded-full transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">upload</span>
                      {uploadingId === dr.id ? 'Uploading...' : 'Submit Document'}
                    </button>
                  </div>
                )}

                {fulfillSuccess === dr.id && (
                  <p role="status" aria-live="polite" className="text-xs text-emerald-800 font-bold">
                    ✓ Document submitted successfully. Coordinator will review shortly.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submitted Field Values Overview */}
      {submission.values && submission.values.length > 0 && (
        <div className="bg-white border border-[#dac0c4]/40 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="font-headline text-xl font-bold text-[#0b1c30]">Your Submitted Information</h2>
          <div className="divide-y divide-[#eff4ff]">
            {submission.values.map((v) => (
              <div key={v.id} className="py-2.5 flex items-center justify-between text-xs font-body">
                <span className="text-[#554245] font-semibold">{v.field_name}:</span>
                <span className="font-code text-xs font-bold text-[#0b1c30]">
                  {v.field_type === 'photo'
                    ? 'Photo uploaded'
                    : v.field_type === 'document'
                    ? 'Document uploaded'
                    : (v.masked_value ?? '-')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
