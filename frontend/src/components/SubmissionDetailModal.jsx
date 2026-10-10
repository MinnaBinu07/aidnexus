import React, { useState, useEffect } from 'react';
import { getSubmissionDetail, revealValue, reviewSubmission, createDocumentRequest } from '../api/admin';
import { LoadingSpinner, ErrorAlert } from './FeedbackComponents';
import { RiskBadge, StatusBadge } from './BadgesAndCards';
import { Eye, ShieldAlert, FileText, CheckCircle, AlertTriangle, Send, X } from 'lucide-react';

export const SubmissionDetailModal = ({ submissionId, onClose, onRefresh, onReviewSubmitted }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealedMap, setRevealedMap] = useState({});
  const [revealingId, setRevealingId] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [docMsg, setDocMsg] = useState('');
  const [sendingDocReq, setSendingDocReq] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getSubmissionDetail(submissionId);
      setData(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load submission details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (submissionId) {
      fetchDetail();
    }
  }, [submissionId]);

  const handleReveal = async (valId) => {
    try {
      setRevealingId(valId);
      const res = await revealValue(submissionId, valId);
      setRevealedMap((prev) => ({ ...prev, [valId]: res.raw_value }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not reveal value.');
    } finally {
      setRevealingId(null);
    }
  };

  const handleReviewAction = async (action, statusChange = null) => {
    try {
      setReviewing(true);
      await reviewSubmission(submissionId, { action, status_change: statusChange });
      await fetchDetail();
      if (onRefresh) onRefresh();
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit review.');
    } finally {
      setReviewing(false);
    }
  };

  const handleCreateDocRequest = async (e) => {
    e.preventDefault();
    if (!docMsg.trim()) return;
    try {
      setSendingDocReq(true);
      await createDocumentRequest(data.community_id, {
        submission_id: submissionId,
        message: docMsg.trim(),
        requested_labels: ['Supplementary Verification Proof'],
      });
      setDocMsg('');
      alert('Verification document request sent to claimant!');
      await fetchDetail();
      if (onRefresh) onRefresh();
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send request.');
    } finally {
      setSendingDocReq(false);
    }
  };

  if (!submissionId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-slate-900">
              Claim Verification #{submissionId}
            </h2>
            {data && <RiskBadge score={data.risk_score} isFlagged={data.is_flagged} />}
            {data && <StatusBadge status={data.status} />}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading && <LoadingSpinner message="Fetching claim details and links..." />}
          {error && <ErrorAlert message={error} onRetry={fetchDetail} />}

          {data && (
            <>
              {/* Review Guidance Alert */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs flex items-start space-x-2.5">
                <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Human Verification Required: </span>
                  Flags represent statistical clues and shared data points (e.g. shared address or similar photos) that need manual verification by the relief worker. The system never declares fraud or auto-rejects records.
                </div>
              </div>

              {/* Clue Reasons */}
              {data.risk_reasons && data.risk_reasons.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Discovered Clues for Review ({data.risk_reasons.length})</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {data.risk_reasons.map((reason, idx) => (
                      <li key={idx} className="text-sm text-amber-800 flex items-start space-x-2">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Household Values (Masked by default with Audited Reveal) */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Household Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.values.map((v) => {
                    const isRevealed = Boolean(revealedMap[v.id]);
                    const displayValue = isRevealed ? revealedMap[v.id] : v.value;

                    return (
                      <div key={v.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-500">{v.label}</p>
                          <p className="text-sm font-semibold text-slate-900 mt-0.5 font-mono">
                            {displayValue || '—'}
                          </p>
                        </div>
                        {!isRevealed && v.value && (
                          <button
                            onClick={() => handleReveal(v.id)}
                            disabled={revealingId === v.id}
                            className="text-xs px-2.5 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded-lg flex items-center space-x-1"
                            title="Unmask value (logged in Audit Trail)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{revealingId === v.id ? '...' : 'Reveal'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Evidence Photos / Documents */}
              {data.evidence && data.evidence.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Uploaded Evidence</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.evidence.map((ev) => (
                      <div key={ev.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-indigo-500" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{ev.label}</p>
                            <p className="text-[11px] text-slate-400 font-mono">SHA: {ev.sha256.slice(0, 12)}...</p>
                          </div>
                        </div>
                        <a
                          href={`/evidence/${ev.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline px-2 py-1"
                        >
                          View File
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Submissions (Side by side comparison) */}
              {data.connected_submissions && data.connected_submissions.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3">
                    Connected Claims ({data.connected_submissions.length})
                  </h4>
                  <div className="space-y-2">
                    {data.connected_submissions.map((conn) => (
                      <div key={conn.link_id} className="p-3.5 bg-amber-50/40 border border-amber-200/80 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-800">
                              Claim #{conn.connected_submission_id}
                            </span>
                            <span className="text-[10px] uppercase font-semibold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {conn.link_type}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              Hint: {conn.matched_value_hint}
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 mt-1">{conn.explanation}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-slate-700">
                            Strength: {conn.strength}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Actions Form */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">Relief Officer Verification Action</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleReviewAction('confirmed', 'approved')}
                    disabled={reviewing}
                    className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve Relief Claim</span>
                  </button>
                  <button
                    onClick={() => handleReviewAction('false_alarm', 'pending')}
                    disabled={reviewing}
                    className="px-3.5 py-2 text-xs font-semibold bg-slate-700 text-white rounded-lg hover:bg-slate-800"
                  >
                    Mark Clue as False Alarm
                  </button>
                  <button
                    onClick={() => handleReviewAction('needs_field_visit', 'info_requested')}
                    disabled={reviewing}
                    className="px-3.5 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                  >
                    Mark for Field Visit
                  </button>
                </div>

                {/* Request More Documents */}
                <form onSubmit={handleCreateDocRequest} className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-700 mb-1.5">Request Additional Proof / Documents:</p>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={docMsg}
                      onChange={(e) => setDocMsg(e.target.value)}
                      placeholder="e.g. Please provide ration card or ward member certificate"
                      className="flex-1 text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={sendingDocReq || !docMsg.trim()}
                      className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Request</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmissionDetailModal;
