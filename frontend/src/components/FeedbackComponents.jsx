import React from 'react';

export const LoadingSpinner = ({ label, message = 'Loading live data...' }) => {
  const displayText = label || message;
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-3" role="status" aria-live="polite">
      <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      <span className="text-sm font-medium text-slate-500">{displayText}</span>
    </div>
  );
};

export const EmptyState = ({
  title = 'No records found',
  message,
  description = 'There is currently no data to display.',
  action = null,
  actionText,
  onAction,
}) => {
  const desc = message || description;
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
      <div className="w-12 h-12 mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mt-1 mb-4">{desc}</p>
      {action}
      {!action && actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-10 px-6 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export const ErrorAlert = ({ message, onRetry = null }) => (
  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between">
    <div className="flex space-x-3">
      <svg className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <h4 className="text-sm font-semibold">Error Loading Data</h4>
        <p className="text-xs text-rose-700 mt-0.5">{message || 'An unexpected error occurred.'}</p>
      </div>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-rose-800 hover:text-rose-900 underline px-2 py-1"
      >
        Retry
      </button>
    )}
  </div>
);
