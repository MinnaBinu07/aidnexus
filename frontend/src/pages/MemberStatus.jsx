import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMySubmission, markNotificationRead, fulfillDocumentRequest } from '../api/member';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';

export default function MemberStatus() {
  const { user } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Document fulfillment state
  const [uploadFiles, setUploadFiles] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [fulfillSuccess, setFulfillSuccess] = useState(null);

  useEffect(() => {
    loadSubmission();
  }, []);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMySubmission();
      setSubmission(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setSubmission(null);
      } else {
        setError(err.response?.data?.detail || 'Failed to load your claim status.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await markNotificationRead(id);
      loadSubmission();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFulfillDoc = async (drId) => {
    const file = uploadFiles[drId];
    if (!file) return;

    try {
      setUploadingId(drId);
      setError(null);
      await fulfillDocumentRequest(drId, file);
      setFulfillSuccess(drId);
      setUploadFiles((prev) => ({ ...prev, [drId]: null }));
      setTimeout(() => setFulfillSuccess(null), 4000);
      loadSubmission();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload supplementary document.');
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Retrieving your relief claim status..." />;
  }

  if (!submission) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 font-body">
        <EmptyState
          title="No Active Relief Claim"
          description="We couldn't find a relief application registered under your account. If you received a token code from relief coordinators, register it now."
          actionText="Join Relief Program"
          onAction={() => window.location.href = '/join'}
        />
      </div>
    );
  }

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
                Relief Program Claim
              </span>
            </div>
            <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#5c0427]">
              {submission.community_title}
            </h1>
            <p className="font-body text-xs text-[#554245] mt-1">
              Submitted on {new Date(submission.created_at).toLocaleDateString()} &bull; Applicant:{' '}
              <strong className="text-[#0b1c30]">{submission.applicant_name}</strong>
            </p>
          </div>

          <div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              submission.status === 'approved'
                ? 'bg-emerald-100 text-emerald-800'
                : submission.status === 'info_requested'
                ? 'bg-[#ffdcc3] text-[#673500]'
                : 'bg-[#eff4ff] text-[#554245]'
            }`}>
              <span className="material-symbols-outlined text-[16px]">
                {submission.status === 'approved' ? 'check_circle' : 'pending'}
              </span>
              <span className="capitalize">{submission.status.replace(/_/g, ' ')}</span>
            </span>
          </div>
        </div>

        {/* Friendly explanation banner */}
        {submission.status === 'pending' && (
          <div className="p-4 bg-[#eff4ff] border border-[#dac0c4]/30 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-[#7a1f3d] text-[22px] shrink-0 mt-0.5">
              schedule
            </span>
            <div className="text-xs text-[#554245] leading-relaxed">
              <strong className="text-[#0b1c30] block mb-0.5 font-bold">Under Manual Verification</strong>
              Your household claim is in the queue for manual inspection by relief coordinators. AidNexus never auto-rejects submissions; all determinations are conducted by authorized coordinators.
            </div>
          </div>
        )}

        {submission.status === 'info_requested' && (
          <div className="p-4 bg-[#ffdcc3]/50 border border-[#673500]/30 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-[#673500] text-[22px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="text-xs text-[#673500] leading-relaxed">
              <strong className="block mb-0.5 font-bold">Supplementary Documents Requested</strong>
              Relief coordinators have requested additional documents to complete your eligibility verification. Please review the request below and upload the necessary file.
            </div>
          </div>
        )}

        {submission.status === 'approved' && (
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
      </div>

      {error && <ErrorAlert message={error} />}

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
                    {new Date(notif.created_at).toLocaleString()}
                  </span>
                </div>

                {!notif.is_read && (
                  <button
                    onClick={() => handleMarkNotificationRead(notif.id)}
                    className="px-3 py-1 bg-[#7a1f3d] hover:bg-[#5c0427] text-white text-[11px] font-bold rounded-full transition shrink-0"
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
                  <span className={`px-2.5 py-0.5 rounded-full font-code text-[11px] font-bold ${
                    dr.status === 'fulfilled'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-[#ffdcc3] text-[#673500]'
                  }`}>
                    {dr.status === 'fulfilled' ? 'Fulfilled' : 'Pending Upload'}
                  </span>
                </div>

                {dr.status === 'pending' && (
                  <div className="pt-2 border-t border-[#dac0c4]/30 flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="file"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadFiles((prev) => ({ ...prev, [dr.id]: e.target.files[0] }));
                        }
                      }}
                      className="text-xs font-body text-[#554245] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#dce9ff] file:text-[#0b1c30] hover:file:bg-[#cbdbf5]"
                    />
                    <button
                      type="button"
                      disabled={uploadingId === dr.id || !uploadFiles[dr.id]}
                      onClick={() => handleFulfillDoc(dr.id)}
                      className="h-9 px-5 bg-[#7a1f3d] hover:bg-[#5c0427] disabled:opacity-50 text-white font-body text-xs font-bold rounded-full transition flex items-center gap-1.5 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">upload</span>
                      {uploadingId === dr.id ? 'Uploading...' : 'Submit Document'}
                    </button>
                  </div>
                )}

                {fulfillSuccess === dr.id && (
                  <p className="text-xs text-emerald-800 font-bold">
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
                  {v.field_type === 'photo' ? 'Damage Photo Uploaded' : v.masked_value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
