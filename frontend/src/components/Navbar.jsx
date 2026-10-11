import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ contactOpen, setContactOpen }) {
  const { user, logout, isAdmin, isMember, isInvestigator } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const drawerRef = useRef(null);
  const contactModalRef = useRef(null);
  const lastActiveElementRef = useRef(null);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || '');
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl K';

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const copyToClipboard = async (text, label) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(`${label} copied to clipboard!`);
      } else {
        showToast(`${label}: ${text}`);
      }
    } catch {
      showToast(`Unable to copy ${label}`);
    }
  };

  // Keyboard shortcut for search (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setShowMobileSearch(true);
          setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Escape key and focus trap management
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (drawerOpen) {
          setDrawerOpen(false);
          lastActiveElementRef.current?.focus?.();
        }
        if (contactOpen) {
          setContactOpen(false);
          lastActiveElementRef.current?.focus?.();
        }
      }

      // Focus trap for active dialog
      const activeContainer = drawerOpen
        ? drawerRef.current
        : contactOpen
        ? contactModalRef.current
        : null;

      if (activeContainer && e.key === 'Tab') {
        const focusables = activeContainer.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    if (drawerOpen || contactOpen) {
      lastActiveElementRef.current = document.activeElement;
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen, contactOpen, setContactOpen]);

  // Focus first element when drawer or contact opens
  useEffect(() => {
    if (drawerOpen && drawerRef.current) {
      const closeBtn = drawerRef.current.querySelector('button');
      closeBtn?.focus();
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (contactOpen && contactModalRef.current) {
      const closeBtn = contactModalRef.current.querySelector('button');
      closeBtn?.focus();
    }
  }, [contactOpen]);

  const handleLogout = () => {
    logout();
    setDrawerOpen(false);
    navigate('/login');
  };

  // Prefix match for nested routes, exact match for root
  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <>
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#ffffff]/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-[#dac0c4]/40 h-16">
        <div className="h-16 w-full max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">
          {/* Left: Drawer Toggle & Brand */}
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation drawer"
              className="p-2 rounded-full text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors flex items-center justify-center cursor-pointer"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>

            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#7a1f3d] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                AN
              </div>
              <span className="font-headline text-2xl text-[#5c0427] tracking-tight">AidNexus</span>
            </Link>
          </div>

          {/* Middle: Desktop Search bar */}
          <div className="flex-1 max-w-[480px] hidden md:flex items-center relative">
            <span className="material-symbols-outlined absolute left-3 text-[#554245] text-[18px]">search</span>
            <input
              ref={searchInputRef}
              aria-label="Search relief schemes or records"
              className="w-full h-11 pl-10 pr-16 bg-[#ffffff] rounded-full font-body text-sm text-[#0b1c30] placeholder:text-[#554245]/70 border border-[#dac0c4]/50 focus:outline-none focus:border-[#7a1f3d] focus:ring-2 focus:ring-[#7a1f3d]/20 transition-all"
              placeholder="Search relief schemes or records..."
              type="search"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(`/public/communities?q=${encodeURIComponent(e.target.value)}`);
                }
              }}
            />
            <kbd className="absolute right-3 px-2 py-0.5 rounded font-code text-xs text-[#554245] bg-[#dce9ff] select-none pointer-events-none">
              {shortcutLabel}
            </kbd>
          </div>

          {/* Right: Mobile Search, Contact Desk, User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Search Toggle */}
            <button
              aria-label="Open search"
              onClick={() => setShowMobileSearch((prev) => !prev)}
              className="md:hidden p-2 rounded-full text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors flex items-center justify-center cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>

            <button
              aria-label="Contact Desk"
              onClick={() => setContactOpen(true)}
              className="p-2 rounded-full text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors flex items-center justify-center cursor-pointer"
              title="Help & Contact Desk"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">support_agent</span>
            </button>

            {user ? (
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => setDrawerOpen(true)}
                className="relative flex items-center gap-2 pl-1 py-1 pr-3 rounded-full bg-[#ffffff] hover:bg-[#dce9ff] transition-colors cursor-pointer border border-[#dac0c4]/40"
              >
                <div className="w-8 h-8 rounded-full bg-[#5c0427] text-white flex items-center justify-center font-bold text-xs uppercase">
                  {user.name ? user.name[0] : 'U'}
                </div>
                <span className="font-body text-xs font-semibold text-[#0b1c30] hidden sm:inline max-w-[120px] truncate">
                  {user.name}
                </span>
                <span className="material-symbols-outlined text-[#554245] text-[18px]">expand_more</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 rounded-full font-body text-xs font-semibold text-[#5c0427] hover:bg-[#f1dee3] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/join"
                  className="px-4 py-1.5 rounded-full font-body text-xs font-bold bg-[#7a1f3d] text-white hover:bg-[#5c0427] shadow-sm transition-all"
                >
                  Join
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Search Dropdown */}
        {showMobileSearch && (
          <div className="md:hidden px-4 py-2 bg-white border-b border-[#dac0c4]/40 flex items-center gap-2 shadow-md">
            <div className="flex-1 relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[#554245] text-[18px]">search</span>
              <input
                ref={mobileSearchInputRef}
                aria-label="Search relief schemes or records (mobile)"
                className="w-full h-10 pl-10 pr-4 bg-[#eff4ff] rounded-full font-body text-sm text-[#0b1c30] placeholder:text-[#554245]/70 border border-[#dac0c4]/50 focus:outline-none focus:border-[#7a1f3d]"
                placeholder="Search schemes..."
                type="search"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate(`/public/communities?q=${encodeURIComponent(e.target.value)}`);
                    setShowMobileSearch(false);
                  }
                }}
              />
            </div>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setShowMobileSearch(false)}
              className="p-1 rounded-full text-[#554245] hover:bg-[#dce9ff]"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}
      </header>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-[#213145]/40 backdrop-blur-sm z-50 transition-opacity duration-300"
          onClick={() => {
            setDrawerOpen(false);
            lastActiveElementRef.current?.focus?.();
          }}
        />
      )}

      {/* Slide-out Navigation Drawer */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Drawer"
        inert={!drawerOpen ? '' : undefined}
        className={`fixed left-0 top-0 bottom-0 w-80 bg-[#ffffff] z-50 shadow-2xl p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out border-r border-[#dac0c4]/40 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-4">
          {/* Top Logo & Close */}
          <div className="flex items-center justify-between pb-2 border-b border-[#dac0c4]/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#7a1f3d] text-white flex items-center justify-center font-bold text-xs">
                AN
              </div>
              <span className="font-headline text-xl text-[#5c0427]">AidNexus</span>
            </div>
            <button
              aria-label="Close navigation drawer"
              className="p-1 rounded-full text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors cursor-pointer"
              onClick={() => {
                setDrawerOpen(false);
                lastActiveElementRef.current?.focus?.();
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Active Role Pill */}
          <div className="px-3.5 py-2 rounded-full bg-[#f1dee3] text-[#6f6165] font-body text-xs flex items-center justify-between font-medium">
            <span>
              Active Role:{' '}
              <strong className="text-[#7a1f3d] font-bold uppercase">
                {user ? user.role : 'Visitor'}
              </strong>
            </span>
            <span className="material-symbols-outlined text-[16px] text-[#7a1f3d]">verified_user</span>
          </div>

          {/* Navigation Links List */}
          <nav className="flex flex-col gap-2 mt-1 overflow-y-auto max-h-[calc(100vh-250px)] pr-1 text-sm font-body">
            {/* Public / Visitor */}
            <div className="flex flex-col gap-1 pt-1">
              <span className="px-3 font-body text-[11px] text-[#554245]/70 uppercase tracking-wider font-semibold">
                Public / Visitor
              </span>
              <Link
                to="/"
                onClick={() => setDrawerOpen(false)}
                className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                  isActive('/') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">home</span>
                <span>Cover Page</span>
              </Link>
              <Link
                to="/join"
                onClick={() => setDrawerOpen(false)}
                className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                  isActive('/join') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">group_add</span>
                <span>Join Us (Household)</span>
              </Link>
              {/* Single Relief Schemes & Communities Link (removed duplicate) */}
              <Link
                to="/public/communities"
                onClick={() => setDrawerOpen(false)}
                className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                  isActive('/public/communities') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">public</span>
                <span>Relief Schemes & Communities</span>
              </Link>
            </div>

            {/* Core Member Area */}
            {isMember && (
              <div className="flex flex-col gap-1 pt-2">
                <span className="px-3 font-body text-[11px] text-[#554245]/70 uppercase tracking-wider font-semibold">
                  Member Portal
                </span>
                <Link
                  to="/status"
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/status') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                  <span>My Claim Status</span>
                </Link>
              </div>
            )}

            {/* Administrative (Only for isAdmin) */}
            {isAdmin && (
              <div className="flex flex-col gap-1 pt-2">
                <span className="px-3 font-body text-[11px] text-[#554245]/70 uppercase tracking-wider font-semibold">
                  Administrative
                </span>
                <Link
                  to="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/admin') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">dashboard</span>
                  <span>Admin Dashboard</span>
                </Link>
                {/* My Communities - shown only for isAdmin */}
                <Link
                  to="/admin/communities"
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/admin/communities') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">folder_managed</span>
                  <span>My Communities</span>
                </Link>
                {/* Added missing Field Builder link */}
                <Link
                  to="/admin/fields"
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/admin/fields') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  <span>Field Builder</span>
                </Link>
                <Link
                  to="/admin/codes"
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/admin/codes') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">pin</span>
                  <span>Access Codes</span>
                </Link>
                <Link
                  to="/admin/network"
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/admin/network') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">hub</span>
                  <span>Network Topology</span>
                </Link>
                <Link
                  to="/admin/audit"
                  onClick={() => setDrawerOpen(false)}
                  className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                    isActive('/admin/audit') ? 'bg-[#7a1f3d] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  <span>Audit Trail</span>
                </Link>
              </div>
            )}

            {/* High Security / Inspector Mode */}
            <div className="flex flex-col gap-1 pt-2">
              <span className="px-3 font-body text-[11px] text-[#554245]/70 uppercase tracking-wider font-semibold">
                Cross-Scheme Discovery
              </span>
              <Link
                to="/investigate"
                onClick={() => setDrawerOpen(false)}
                className={`px-3.5 py-2 rounded-full transition-colors flex items-center gap-2 ${
                  isActive('/investigate') ? 'bg-[#B02A52] text-white font-bold' : 'text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">manage_search</span>
                <span>Inspector / Investigator Mode</span>
              </Link>
            </div>

            {/* System */}
            <div className="flex flex-col gap-1 pt-2">
              <span className="px-3 font-body text-[11px] text-[#554245]/70 uppercase tracking-wider font-semibold">
                System
              </span>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  setContactOpen(true);
                }}
                className="px-3.5 py-2 rounded-full text-[#554245] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors flex items-center gap-2 text-left cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">contact_support</span>
                <span>Contact Desk</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Bottom Drawer Action */}
        <div className="pt-4 border-t border-[#dac0c4]/40 flex flex-col gap-2">
          {user ? (
            <button
              onClick={handleLogout}
              className="w-full h-11 px-4 rounded-full bg-[#dce9ff] text-[#0b1c30] hover:bg-[#d3e4fe] transition-colors font-body text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Log Out ({user.name})</span>
            </button>
          ) : (
            <Link
              to="/login"
              onClick={() => setDrawerOpen(false)}
              className="w-full h-11 px-4 rounded-full bg-[#7a1f3d] text-white hover:bg-[#5c0427] transition-colors font-body text-xs font-bold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Contact Popup Modal */}
      {contactOpen && (
        <div
          className="fixed inset-0 bg-[#213145]/50 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity duration-300"
          onClick={() => {
            setContactOpen(false);
            lastActiveElementRef.current?.focus?.();
          }}
        >
          <div
            ref={contactModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
            className="bg-[#ffffff] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-[#dac0c4]/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#dac0c4]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#7a1f3d] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">support_agent</span>
                </div>
                <div>
                  <span className="font-code text-xs text-[#7a1f3d] uppercase tracking-wider font-semibold block">
                    CIVIL SUPPORT DESK
                  </span>
                  <h3 id="contact-modal-title" className="font-headline text-lg text-[#5c0427]">Contact AidNexus Support</h3>
                </div>
              </div>
              <button
                aria-label="Close Contact Modal"
                className="p-1 rounded-full text-[#554245] hover:bg-[#dce9ff] transition-colors flex items-center justify-center cursor-pointer"
                onClick={() => {
                  setContactOpen(false);
                  lastActiveElementRef.current?.focus?.();
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="my-5 space-y-4">
              {/* Phone Hotline */}
              {/* TODO(verify): Confirm fallback values (support@aidnexus.org and 1070 hotline) with relief operations administrators */}
              <div className="bg-[#eff4ff] rounded-2xl p-4 border border-[#dac0c4]/30 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-body text-xs uppercase tracking-wider text-[#554245] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#5c0427]">call</span> Relief Operations Hotline
                  </span>
                  <span className="font-code text-[11px] px-2 py-0.5 rounded-full bg-[#f1dee3] text-[#5c0427] font-semibold">
                    24/7 Priority
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <a
                    className="font-headline text-2xl text-[#5c0427] tracking-tight font-bold hover:underline"
                    href={`tel:${import.meta.env.VITE_HOTLINE_PHONE || '1070'}`}
                  >
                    {import.meta.env.VITE_HOTLINE_PHONE || '1070 (Toll-Free)'}
                  </a>
                  <div className="flex items-center gap-2">
                    <a
                      className="h-8 px-3 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                      href={`tel:${import.meta.env.VITE_HOTLINE_PHONE || '1070'}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      <span>Call</span>
                    </a>
                    <button
                      aria-label="Copy hotline number"
                      className="h-8 px-2.5 rounded-full bg-[#dce9ff] hover:bg-[#d3e4fe] text-[#0b1c30] font-body text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      onClick={() => {
                        copyToClipboard(import.meta.env.VITE_HOTLINE_PHONE || '1070', 'Hotline');
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Email Desk */}
              <div className="bg-[#eff4ff] rounded-2xl p-4 border border-[#dac0c4]/30 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-body text-xs uppercase tracking-wider text-[#554245] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#5c0427]">mail</span> Direct Email Inquiries
                  </span>
                  <span className="font-code text-[11px] px-2 py-0.5 rounded-full bg-[#dce9ff] text-[#554245] font-medium">
                    Direct Contact
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <a
                    className="font-body text-sm text-[#5c0427] font-bold hover:underline break-all"
                    href={`mailto:${import.meta.env.VITE_CONTACT_EMAIL || 'support@aidnexus.org'}`}
                  >
                    {import.meta.env.VITE_CONTACT_EMAIL || 'support@aidnexus.org'}
                  </a>
                  <div className="flex items-center gap-2">
                    <a
                      className="h-8 px-3 rounded-full bg-[#7a1f3d] hover:bg-[#5c0427] text-white font-body text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
                      href={`mailto:${import.meta.env.VITE_CONTACT_EMAIL || 'support@aidnexus.org'}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">mail</span>
                      <span>Email</span>
                    </a>
                    <button
                      aria-label="Copy support email"
                      className="h-8 px-2.5 rounded-full bg-[#dce9ff] hover:bg-[#d3e4fe] text-[#0b1c30] font-body text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      onClick={() => {
                        copyToClipboard(import.meta.env.VITE_CONTACT_EMAIL || 'support@aidnexus.org', 'Support email');
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Privacy and handling note - honest wording */}
              <div className="p-3 bg-[#f1dee3]/60 rounded-xl flex items-start gap-2 text-xs text-[#554245]">
                <span className="material-symbols-outlined text-[18px] text-[#5c0427] shrink-0 mt-0.5">verified_user</span>
                <p>
                  Direct inquiries are handled confidentially by verified relief coordination personnel for humanitarian disaster relief inquiries.
                </p>
              </div>
            </div>

            <button
              className="w-full h-11 rounded-full bg-[#dce9ff] hover:bg-[#d3e4fe] text-[#0b1c30] font-body text-xs font-bold transition-colors cursor-pointer"
              onClick={() => {
                setContactOpen(false);
                lastActiveElementRef.current?.focus?.();
              }}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Small Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 right-4 z-50 bg-[#0b1c30] text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-[#dac0c4]/40 animate-fade-in"
        >
          <span className="material-symbols-outlined text-[18px] text-[#7a1f3d]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
