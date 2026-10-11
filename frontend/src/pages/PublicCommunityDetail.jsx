import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPublicCommunity } from '../api/public';
import { LoadingSpinner, EmptyState } from '../components/FeedbackComponents';
import { formatApiError } from '../utils/formatError';

export default function PublicCommunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCommunity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPublicCommunity(id);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid community data received from server.');
      }
      setCommunity(data);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load relief scheme details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadCommunity();
    }
  }, [id, loadCommunity]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date unavailable';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleDateString();
  };

  const getQrImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  if (loading) {
    return <LoadingSpinner label="Loading relief scheme details..." />;
  }

  if (error || !community) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          title="Scheme Not Found"
          description={error || "We couldn't locate this relief program."}
          actionText="Browse Open Schemes"
          onAction={() => navigate('/public/communities')}
        />
      </div>
    );
  }

  const qrUrl = getQrImageUrl(community.qr_image_path);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 font-body text-[#0b1c30]">
      {/* Back button */}
      <div>
        <Link
          to="/public/communities"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#554245] hover:text-[#5c0427] transition"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to All Schemes</span>
        </Link>
      </div>

      {/* Main Info Card */}
      <div className="bg-white border border-[#dac0c4]/40 rounded-3xl p-8 sm:p-10 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dac0c4]/30 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-code text-xs font-bold text-[#7a1f3d]">
                #{community.code || `REF-${community.id}`}
              </span>
              <span className="font-body text-xs font-bold uppercase tracking-wider text-[#554245]">
                Verified Relief Program
              </span>
            </div>
            <h1 className="font-headline text-3xl sm:text-4xl font-bold text-[#5c0427] tracking-tight">
              {community.title}
            </h1>
            <p className="font-body text-xs text-[#554245] mt-1">
              Created on {formatDate(community.created_at)} &bull; Status:{' '}
              <span className="text-[#5c0427] font-bold uppercase">{community.status}</span>
            </p>
          </div>

          <div>
            {community.is_verified_admin ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#F6E3E8] text-[#5c0427] px-3.5 py-1.5 rounded-full shadow-xs">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Verified Relief Coordinator
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#eff4ff] text-[#554245] px-3.5 py-1.5 rounded-full">
                Relief Coordinator
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="text-sm text-[#0b1c30] leading-relaxed space-y-2">
          <strong className="block text-xs uppercase tracking-wider text-[#554245] font-bold">
            Program Overview
          </strong>
          <p className="whitespace-pre-line text-base text-[#554245]">
            {community.description || 'No detailed operational mandate specified.'}
          </p>
        </div>

        {/* Stats & Coordinator Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#dac0c4]/30">
          <div className="p-4 bg-[#eff4ff] border border-[#dac0c4]/30 rounded-2xl space-y-1">
            <span className="text-xs text-[#554245] font-semibold">Relief Coordinator</span>
            <div className="text-base font-bold text-[#0b1c30]">{community.admin_name || 'Designated Coordinator'}</div>
          </div>

          <div className="p-4 bg-[#eff4ff] border border-[#dac0c4]/30 rounded-2xl space-y-1">
            <span className="text-xs text-[#554245] font-semibold">Verified Households Assisted</span>
            <div className="text-base font-bold text-[#7a1f3d] flex items-center gap-1.5 font-code">
              <span className="material-symbols-outlined text-[18px]">groups</span>
              <span>{community.approved_members_count || 0} Approved Households</span>
            </div>
          </div>
        </div>

        {/* Donation QR Section */}
        {qrUrl && (
          <div className="p-6 bg-[#f1dee3]/30 border border-[#dac0c4]/50 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-[#5c0427] font-bold text-base font-headline">
              <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
              <span>Direct Coordinator Donation Channel</span>
            </div>
            <p className="text-xs text-[#554245]">
              Contributions sent to this QR support field relief distribution organized by {community.admin_name || 'the coordinator'}. Money moves directly between donor and coordinator.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              <div className="p-3 bg-white rounded-2xl w-48 h-48 flex items-center justify-center border border-[#dac0c4]/60 shadow-md">
                <img
                  src={qrUrl}
                  alt={`Official Donation QR Code for ${community.title}`}
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>

              <div className="space-y-3 text-center sm:text-left">
                <p className="text-xs text-[#554245] leading-relaxed max-w-sm">
                  Scan this QR code with any UPI / payment app to route aid funds directly to this relief initiative.
                </p>

                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">warning</span>
                  <span>Verify the payee before sending money. AidNexus does not process or guarantee payments.</span>
                </div>

                <a
                  href={qrUrl}
                  download={`donation-qr-${community.id}.png`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7a1f3d] hover:bg-[#5c0427] text-white text-xs font-bold rounded-full transition shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download QR Code</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Assurance Notice */}
        <div className="p-4 bg-[#eff4ff] border border-[#dac0c4]/30 rounded-2xl flex items-start gap-3 text-xs text-[#554245]">
          <span className="material-symbols-outlined text-[20px] text-[#5c0427] shrink-0 mt-0.5">lock</span>
          <div className="leading-relaxed">
            <strong className="text-[#0b1c30] block mb-0.5 font-bold">Privacy Protection</strong>
            AidNexus strictly protects individual household privacy. Beneficiary names, contact numbers, and damage photographs are never shared publicly. Only aggregate verified numbers and authorized donation channels are displayed.
          </div>
        </div>
      </div>
    </div>
  );
}
