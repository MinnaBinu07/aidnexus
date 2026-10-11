import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { NotFound, AboutPage, HelpPage, PrivacyPage, TermsPage } from './pages/InstitutionalPages';

function ProtectedRoute({ roles, children }) {
  const { user, loading, isInvestigator } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#7a1f3d] border-r-transparent align-[-0.125em]" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0) {
    if (roles.includes('investigator')) {
      if (!isInvestigator) {
        return <Navigate to="/" replace />;
      }
    } else if (!roles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

function AppContent() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-body selection:bg-[#7a1f3d] selection:text-white">
      <Navbar contactOpen={contactOpen} setContactOpen={setContactOpen} />
      <main className="flex-1 pb-24 pt-16">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/join" element={<MemberJoin />} />
          <Route path="/public/communities" element={<PublicCommunities />} />
          <Route path="/public/communities/:id" element={<PublicCommunityDetail />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* Member Routes */}
          <Route
            path="/status"
            element={
              <ProtectedRoute roles={['member']}>
                <MemberStatus />
              </ProtectedRoute>
            }
          />
          {/* Merged Route: redirect /member/status to /status */}
          <Route path="/member/status" element={<Navigate to="/status" replace />} />

          {/* Admin Coordinator Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/communities"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminCommunities />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/fields"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminFieldBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/codes"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminCodeGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/network"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminNetworkView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminAuditLog />
              </ProtectedRoute>
            }
          />

          {/* Investigator Portal Route */}
          <Route
            path="/investigate"
            element={
              <ProtectedRoute roles={['investigator']}>
                <InvestigatorPortal />
              </ProtectedRoute>
            }
          />

          {/* 404 Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Institutional Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md shadow-[0_-1px_8px_rgba(0,0,0,0.04)] border-t border-[#dac0c4]/40">
        <div className="h-14 w-full max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center justify-between text-[#554245] font-body text-xs">
          <nav className="flex items-center gap-3 sm:gap-6 flex-wrap">
            <Link className="hover:text-[#0b1c30] transition-colors" to="/about">About</Link>
            <Link className="hover:text-[#0b1c30] transition-colors" to="/help">Help / FAQ</Link>
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="hover:text-[#0b1c30] transition-colors cursor-pointer"
            >
              Contact
            </button>
            <Link className="hover:text-[#0b1c30] transition-colors" to="/privacy">Privacy Policy</Link>
            <Link className="hover:text-[#0b1c30] transition-colors" to="/terms">Terms of Use</Link>
          </nav>
          <div className="flex items-center gap-2 text-[#3d2f32] font-code text-[11px] shrink-0 font-medium">
            <span>© 2026 AidNexus. Verified Relief & Coordination Infrastructure.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
