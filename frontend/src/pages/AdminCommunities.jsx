import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, QrCode, Sliders, KeyRound, Layers, FileText, CheckCircle, CheckCircle2 } from 'lucide-react';
import { getMyCommunities, createCommunity, updateCommunity, uploadCommunityQr } from '../api/admin';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';
import { formatApiError } from '../utils/formatError';

export default function AdminCommunities() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit / QR Upload State
  const [uploadingQrCommId, setUploadingQrCommId] = useState(null);
  const [qrFile, setQrFile] = useState(null);
  const [qrUploadSuccess, setQrUploadSuccess] = useState(null);

  const loadCommunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyCommunities(1, 100);
      setCommunities(res?.items || []);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load communities.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  // Escape key for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showCreateModal) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal]);

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreating(true);
      setError(null);
      await createCommunity({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      loadCommunities();
    } catch (err) {
      setError(formatApiError(err, 'Failed to create relief program.'));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (comm) => {
    try {
      const nextStatus = comm.status === 'open' ? 'closed' : 'open';
      await updateCommunity(comm.id, { status: nextStatus });
      loadCommunities();
    } catch (err) {
      setError(formatApiError(err, 'Failed to update program status.'));
    }
  };

  const handleUploadQr = async (commId) => {
    if (!qrFile) return;
    try {
      setUploadingQrCommId(commId);
      setError(null);
      await uploadCommunityQr(commId, qrFile);
      setQrUploadSuccess(commId);
      setQrFile(null);
      setTimeout(() => setQrUploadSuccess(null), 3000);
      loadCommunities();
    } catch (err) {
      setError(formatApiError(err, 'Failed to upload QR code.'));
    } finally {
      setUploadingQrCommId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading relief programs..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">Programs & Schemes</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Relief Communities
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create and manage specific relief distributions, define collection fields, and configure public donation info.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Relief Program
        </button>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Communities Grid */}
      {communities.length === 0 ? (
        <EmptyState
          title="No Relief Programs"
          description="You haven't set up any relief programs yet. Click below to initialize your first relief effort."
          actionText="Create Relief Program"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {communities.map((comm) => (
            <div
              key={comm.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                {/* Title & Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-white">{comm.title}</h2>
                      {comm.is_verified_admin && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          Verified Coordinator
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {comm.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleStatus(comm)}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition ${
                      comm.status === 'open'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50'
                        : 'bg-rose-950/60 text-rose-300 border-rose-800 hover:bg-rose-900/50'
                    }`}
                    title="Click to toggle Open / Closed"
                  >
                    {comm.status === 'open' ? '● Open for Claims' : '○ Closed'}
                  </button>
                </div>

                {/* QR Code Section */}
                <div className="mt-5 p-4 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      Public Donation QR Code
                    </span>
                    {comm.qr_image_path ? (
                      <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Active QR
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Not configured</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {comm.qr_image_path ? (
                      <img
                        src={comm.qr_image_path}
                        alt="Donation QR"
                        className="w-14 h-14 rounded-lg bg-white p-1 object-contain border border-slate-700"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                        <QrCode className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        id={`qr-upload-${comm.id}`}
                        onChange={(e) => setQrFile(e.target.files[0])}
                        className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                      />
                      {qrFile && (
                        <button
                          onClick={() => handleUploadQr(comm.id)}
                          disabled={uploadingQrCommId === comm.id}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md transition"
                        >
                          {uploadingQrCommId === comm.id ? 'Uploading...' : 'Save QR'}
                        </button>
                      )}
                      {qrUploadSuccess === comm.id && (
                        <span className="text-xs text-emerald-400 block font-medium">QR updated!</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Hub */}
              <div className="mt-6 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link
                  to={`/admin/fields?comm=${comm.id}`}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center group transition"
                >
                  <Sliders className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-semibold text-slate-300 mt-1.5">Form Fields</span>
                </Link>

                <Link
                  to={`/admin/codes?comm=${comm.id}`}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center group transition"
                >
                  <KeyRound className="w-4 h-4 text-blue-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-semibold text-slate-300 mt-1.5">Access Codes</span>
                </Link>

                <Link
                  to={`/admin/network?comm=${comm.id}`}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center group transition"
                >
                  <Layers className="w-4 h-4 text-purple-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-semibold text-slate-300 mt-1.5">Network View</span>
                </Link>

                <Link
                  to={`/admin/audit?comm=${comm.id}`}
                  className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center group transition"
                >
                  <FileText className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
                  <span className="text-[11px] font-semibold text-slate-300 mt-1.5">Audit Trail</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Program Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-program-title"
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-program-title" className="text-xl font-bold text-white">Create Relief Program</h2>
            <p className="text-xs text-slate-400">
              Set up a relief initiative (e.g. Floods Relief Camp, Drought Ration Distribution).
            </p>

            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Program Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assam Flood Relief 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Public Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Details about eligible recipients, relief materials provided, and collection dates..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg transition"
                >
                  {creating ? 'Creating...' : 'Initialize Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
