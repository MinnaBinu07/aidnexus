import React from 'react';
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 font-body">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#dac0c4]/40 shadow-lg text-center">
        <div className="inline-flex p-3 rounded-full bg-[#f1dee3] text-[#7a1f3d] mb-4">
          <span className="material-symbols-outlined text-[36px]">error_outline</span>
        </div>
        <h1 className="font-headline text-3xl font-bold text-[#0b1c30]">404 - Page Not Found</h1>
        <p className="font-body text-xs text-[#554245] mt-2 mb-6">
          The page you requested does not exist or may have been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white text-xs font-bold transition shadow-sm"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-body">
      <div className="bg-white p-8 rounded-3xl border border-[#dac0c4]/40 shadow-sm space-y-6">
        <div className="border-b border-[#dac0c4]/30 pb-4">
          <span className="font-code text-xs text-[#7a1f3d] uppercase tracking-wider font-semibold">Institutional Overview</span>
          <h1 className="font-headline text-3xl font-bold text-[#0b1c30] mt-1">About AidNexus</h1>
        </div>
        <div className="prose text-sm text-[#554245] space-y-4">
          <p>
            AidNexus is an open, transparent disaster relief clue discovery and household coordination infrastructure.
            Our platform assists civil authorities and relief coordinators in matching household needs with authentic relief initiatives.
          </p>
          <h2 className="font-headline text-lg font-bold text-[#0b1c30]">Core Principles</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Dignity First:</strong> Automated systems must never summarily reject or accuse applicants. All discrepancies are flagged as clues for human review.</li>
            <li><strong>Decentralized & Transparent:</strong> Schemes are maintained by verified coordinators with tamper-evident audit logs.</li>
            <li><strong>Privacy-Preserving:</strong> Sensitive identity markers are masked by default and access is strictly role-restricted.</li>
          </ul>
        </div>
        <div className="pt-4 border-t border-[#dac0c4]/30">
          <Link to="/" className="text-xs text-[#7a1f3d] font-bold hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-body">
      <div className="bg-white p-8 rounded-3xl border border-[#dac0c4]/40 shadow-sm space-y-6">
        <div className="border-b border-[#dac0c4]/30 pb-4">
          <span className="font-code text-xs text-[#7a1f3d] uppercase tracking-wider font-semibold">User Assistance</span>
          <h1 className="font-headline text-3xl font-bold text-[#0b1c30] mt-1">Help & FAQ</h1>
        </div>
        <div className="space-y-4 text-sm text-[#554245]">
          <div className="p-4 bg-[#eff4ff] rounded-2xl border border-[#dac0c4]/30">
            <h2 className="font-bold text-[#0b1c30]">How do I submit a relief claim?</h2>
            <p className="mt-1 text-xs">
              Obtain an access code from your local disaster relief coordinator, then visit the Join page to enter your code and complete the verification fields.
            </p>
          </div>
          <div className="p-4 bg-[#eff4ff] rounded-2xl border border-[#dac0c4]/30">
            <h2 className="font-bold text-[#0b1c30]">How can I check the status of my claim?</h2>
            <p className="mt-1 text-xs">
              Log in with your household credentials and navigate to the Status page to review real-time coordination updates and submit additional documents if requested.
            </p>
          </div>
          <div className="p-4 bg-[#eff4ff] rounded-2xl border border-[#dac0c4]/30">
            <h2 className="font-bold text-[#0b1c30]">What should I do if my access code does not work?</h2>
            <p className="mt-1 text-xs">
              Access codes are single-use and community-specific. Please contact your scheme coordinator or call our civil support hotline at 1070.
            </p>
          </div>
        </div>
        <div className="pt-4 border-t border-[#dac0c4]/30">
          <Link to="/" className="text-xs text-[#7a1f3d] font-bold hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-body">
      <div className="bg-white p-8 rounded-3xl border border-[#dac0c4]/40 shadow-sm space-y-6">
        <div className="border-b border-[#dac0c4]/30 pb-4">
          <span className="font-code text-xs text-[#7a1f3d] uppercase tracking-wider font-semibold">Policy Statement</span>
          <h1 className="font-headline text-3xl font-bold text-[#0b1c30] mt-1">Privacy Policy</h1>
        </div>
        <div className="text-sm text-[#554245] space-y-4">
          <p>
            AidNexus collects applicant information solely for the purpose of validating disaster relief distribution and preventing duplicate disbursements.
          </p>
          <h2 className="font-headline text-lg font-bold text-[#0b1c30]">Data Protection & Masking</h2>
          <p>
            Personally identifiable information (such as Aadhaar numbers, phone numbers, and bank account identifiers) is masked by default. All access to unmasked identity data is recorded in an immutable audit log.
          </p>
          <h2 className="font-headline text-lg font-bold text-[#0b1c30]">Storage & Retention</h2>
          <p>
            Claim documents and evidence files are stored securely and accessible only by authorized relief coordinators and verified investigators.
          </p>
        </div>
        <div className="pt-4 border-t border-[#dac0c4]/30">
          <Link to="/" className="text-xs text-[#7a1f3d] font-bold hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-body">
      <div className="bg-white p-8 rounded-3xl border border-[#dac0c4]/40 shadow-sm space-y-6">
        <div className="border-b border-[#dac0c4]/30 pb-4">
          <span className="font-code text-xs text-[#7a1f3d] uppercase tracking-wider font-semibold">Legal Agreement</span>
          <h1 className="font-headline text-3xl font-bold text-[#0b1c30] mt-1">Terms of Use</h1>
        </div>
        <div className="text-sm text-[#554245] space-y-4">
          <p>
            By using the AidNexus platform, coordinators and household applicants agree to provide authentic and accurate information in support of civil disaster relief.
          </p>
          <h2 className="font-headline text-lg font-bold text-[#0b1c30]">Authorized Use</h2>
          <p>
            Access codes and coordinator credentials must not be shared or repurposed. Unauthorized attempts to scrape, bypass access barriers, or falsify relief claims are subject to civil reporting.
          </p>
          <h2 className="font-headline text-lg font-bold text-[#0b1c30]">Disclaimers</h2>
          <p>
            AidNexus provides coordination and clue verification software. AidNexus does not directly handle cash payments or guarantee financial disbursements.
          </p>
        </div>
        <div className="pt-4 border-t border-[#dac0c4]/30">
          <Link to="/" className="text-xs text-[#7a1f3d] font-bold hover:underline inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
