import React from 'react';

export const RiskBadge = ({ score, isFlagged }) => {
  const numScore = Number(score || 0);
  const flagged = isFlagged !== undefined ? isFlagged : numScore >= 30;

  if (flagged) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffdcc3] text-[#673500] font-body text-xs font-semibold shadow-xs">
        <span className="material-symbols-outlined text-[14px]">flag</span>
        <span>Needs review ({numScore.toFixed(0)})</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#554245] font-body text-xs font-semibold">
      <span className="material-symbols-outlined text-[14px] text-emerald-600">verified</span>
      <span>Low clue score ({numScore.toFixed(0)})</span>
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-body text-xs font-semibold">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          <span>Approved</span>
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ffdcc3] text-[#673500] font-body text-xs font-semibold">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          <span>Under Manual Review</span>
        </span>
      );
    case 'info_requested':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-body text-xs font-semibold">
          <span className="material-symbols-outlined text-[14px]">contact_support</span>
          <span>Docs Requested</span>
        </span>
      );
    case 'rejected_by_admin':
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-body text-xs font-semibold">
          <span className="material-symbols-outlined text-[14px]">cancel</span>
          <span>Rejected by Admin</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#554245] font-body text-xs capitalize">
          {status || 'Unknown'}
        </span>
      );
  }
};

export const StatCard = ({ label, value, sub, color = 'default', icon: Icon, badgeText }) => {
  let valueColor = 'text-[#0b1c30]';
  let badgeClass = 'text-[#554245]';

  if (color === 'amber' || color === 'flagged') {
    valueColor = 'text-[#673500]';
    badgeClass = 'bg-[#ffdcc3] text-[#673500]';
  } else if (color === 'emerald' || color === 'approved') {
    valueColor = 'text-[#5c0427]';
    badgeClass = 'bg-[#f1dee3] text-[#7a1f3d]';
  }

  return (
    <div className="bg-[#ffffff] p-6 rounded-[24px] shadow-sm border border-[#dac0c4]/30 flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md">
      {color === 'amber' && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#ffdcc3]/20 rounded-bl-full pointer-events-none" />
      )}
      <div className="flex items-center justify-between text-[#554245]">
        <span className="font-body text-xs font-semibold uppercase tracking-wider">{label}</span>
        {Icon ? (
          <Icon className="w-5 h-5 text-[#554245]/80" />
        ) : (
          <span className="material-symbols-outlined text-[22px] text-[#554245]/80">analytics</span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className={`font-code text-3xl font-bold tracking-tight ${valueColor}`}>
          {value !== undefined ? value : '—'}
        </span>
        {sub && <span className="font-code text-xs text-[#554245]/80">{sub}</span>}
      </div>

      <div className="mt-3 flex items-center gap-1.5 font-code text-xs text-[#554245]/70">
        {badgeText ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-body text-[11px] font-semibold ${badgeClass}`}>
            {badgeText}
          </span>
        ) : (
          <span>Verified civil ledger sync</span>
        )}
      </div>
    </div>
  );
};
