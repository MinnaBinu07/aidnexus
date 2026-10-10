import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';

// Pages
import Landing from './pages/Landing';
import { Login, Register } from './pages/AuthPages';
import AdminDashboard from './pages/AdminDashboard';
import AdminCommunities from './pages/AdminCommunities';
import AdminFieldBuilder from './pages/AdminFieldBuilder';
import AdminCodeGenerator from './pages/AdminCodeGenerator';
import AdminNetworkView from './pages/AdminNetworkView';
import AdminAuditLog from './pages/AdminAuditLog';
import MemberJoin from './pages/MemberJoin';
import MemberStatus from './pages/MemberStatus';
import InvestigatorPortal from './pages/InvestigatorPortal';
import PublicCommunities from './pages/PublicCommunities';
import PublicCommunityDetail from './pages/PublicCommunityDetail';

function App() {
  const openContact = () => {
    const el = document.getElementById('contact-popup-modal');
    if (el) el.classList.remove('hidden');
  };

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-body selection:bg-[#7a1f3d] selection:text-white">
          <Navbar />
          <main className="flex-1 pb-16 pt-16">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/join" element={<MemberJoin />} />
              <Route path="/public/communities" element={<PublicCommunities />} />
              <Route path="/public/communities/:id" element={<PublicCommunityDetail />} />

              {/* Member Routes */}
              <Route path="/status" element={<MemberStatus />} />
              <Route path="/member/status" element={<MemberStatus />} />

              {/* Admin Coordinator Routes */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/communities" element={<AdminCommunities />} />
              <Route path="/admin/fields" element={<AdminFieldBuilder />} />
              <Route path="/admin/codes" element={<AdminCodeGenerator />} />
              <Route path="/admin/network" element={<AdminNetworkView />} />
              <Route path="/admin/audit" element={<AdminAuditLog />} />

              {/* Investigator Portal Route */}
              <Route path="/investigate" element={<InvestigatorPortal />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Institutional Sticky Footer */}
          <footer className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md shadow-[0_-1px_8px_rgba(0,0,0,0.04)] border-t border-[#dac0c4]/40">
            <div className="h-14 w-full max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center justify-between text-[#554245] font-body text-xs">
              <nav className="flex items-center gap-4 sm:gap-6">
                <a className="hover:text-[#0b1c30] transition-colors" href="#">About</a>
                <a className="hover:text-[#0b1c30] transition-colors" href="#">Help / FAQ</a>
                <button
                  type="button"
                  onClick={openContact}
                  className="hover:text-[#0b1c30] transition-colors cursor-pointer"
                >
                  Contact
                </button>
                <a className="hover:text-[#0b1c30] transition-colors hidden sm:inline" href="#">Privacy Policy</a>
                <a className="hover:text-[#0b1c30] transition-colors hidden sm:inline" href="#">Terms of Use</a>
              </nav>
              <div className="flex items-center gap-2 text-[#554245]/80 font-code text-[11px]">
                <span>2026 AidNexus. Verified Relief & Coordination Infrastructure.</span>
              </div>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
