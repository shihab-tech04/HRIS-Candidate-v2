import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CandidateLocaleSwitch, useCandidateLocale } from '../../context/CandidateLocaleContext';
import {
  Briefcase,
  User as UserIcon,
  FileText,
  Calendar,
  CheckSquare,
  Gift,
  Bell,
  LogOut,
  Menu,
  X,
  Database,
  ArrowRight
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openAuthModal: () => void;
  openConfigModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  openAuthModal,
  openConfigModal
}) => {
  const { user, signOut } = useAuth();
  const { t } = useCandidateLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleNavClick = (tab: string) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-8">
          {/* Zone 1: Brand wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => handleNavClick('jobs')}
              className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#085587]"
            >
              <div className="w-9 h-9 rounded-lg bg-[#085587] text-white flex items-center justify-center font-bold text-lg shadow-sm transition-transform group-hover:scale-105">
                S
              </div>
              <div className="leading-tight">
                <span className="text-base sm:text-xl font-bold tracking-tight text-slate-900 group-hover:text-[#085587] transition-colors whitespace-nowrap">
                  Synesis <span className="text-[#085587]">Careers</span>
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: 4-5 Clean Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <button
              onClick={() => handleNavClick('jobs')}
              className={`hover:text-[#085587] transition-colors whitespace-nowrap py-1 ${
                currentTab === 'jobs' || currentTab === 'job-details'
                  ? 'text-[#085587] font-semibold border-b-2 border-[#085587]'
                  : ''
              }`}
            >
              {t('Open Roles')}
            </button>

            {user ? (
              <>
                <button
                  onClick={() => handleNavClick('dashboard')}
                  className={`hover:text-[#085587] transition-colors whitespace-nowrap py-1 ${
                    currentTab === 'dashboard'
                      ? 'text-[#085587] font-semibold border-b-2 border-[#085587]'
                      : ''
                  }`}
                >
                  {t('Dashboard')}
                </button>
                <button
                  onClick={() => handleNavClick('applications')}
                  className={`hover:text-[#085587] transition-colors whitespace-nowrap py-1 ${
                    currentTab === 'applications'
                      ? 'text-[#085587] font-semibold border-b-2 border-[#085587]'
                      : ''
                  }`}
                >
                  {t('My Applications')}
                </button>
                <button
                  onClick={() => handleNavClick('cv-builder')}
                  className={`hover:text-[#085587] transition-colors whitespace-nowrap py-1 ${
                    currentTab === 'cv-builder'
                      ? 'text-[#085587] font-semibold border-b-2 border-[#085587]'
                      : ''
                  }`}
                >
                  {t('CV & Documents')}
                </button>
                <button
                  onClick={() => handleNavClick('offers')}
                  className={`hover:text-[#085587] transition-colors whitespace-nowrap py-1 ${
                    currentTab === 'offers' || currentTab === 'preboarding'
                      ? 'text-[#085587] font-semibold border-b-2 border-[#085587]'
                      : ''
                  }`}
                >
                  {t('Offers & Preboarding')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleNavClick('saved-jobs')}
                  className={`hover:text-[#085587] transition-colors whitespace-nowrap py-1 ${
                    currentTab === 'saved-jobs'
                      ? 'text-[#085587] font-semibold border-b-2 border-[#085587]'
                      : ''
                  }`}
                >
                  {t('Saved Jobs & Alerts')}
                </button>
                <button
                  onClick={() => handleNavClick('about')}
                  className={`hover:text-[#085587] transition-colors whitespace-nowrap py-1 ${
                    currentTab === 'about'
                      ? 'text-[#085587] font-semibold border-b-2 border-[#085587]'
                      : ''
                  }`}
                >
                  {t('Why Synesis')}
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action / Auth */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <CandidateLocaleSwitch className="px-2 sm:px-3" />
            {import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === 'true' && <button
              onClick={openConfigModal}
              title={t('Backend & Supabase Connection Info')}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label={t('Database Connection')}
            >
              <Database className="w-4 h-4 text-[#085587]" />
            </button>}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-label={t('Open account menu for {name}', { name: user.user_metadata?.full_name || user.email })}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none"
                >
                  <div className="w-7 h-7 rounded-full bg-[#085587] text-white flex items-center justify-center font-medium text-xs">
                    {user.user_metadata?.full_name
                      ? user.user_metadata.full_name.charAt(0).toUpperCase()
                      : user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-xs font-medium text-slate-700 max-w-[120px] truncate">
                    {user.user_metadata?.full_name || user.email.split('@')[0]}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {user.user_metadata?.full_name || t('Candidate')}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    </div>

                    <button
                      onClick={() => {
                        handleNavClick('dashboard');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      {t('Candidate Dashboard')}
                    </button>

                    <button
                      onClick={() => {
                        handleNavClick('profile');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                      {t('My Profile')}
                    </button>

                    <button
                      onClick={() => {
                        handleNavClick('applications');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      {t('Application Tracking')}
                    </button>

                    <button
                      onClick={() => {
                        handleNavClick('interviews');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {t('Interviews')}
                    </button>

                    <button
                      onClick={() => {
                        handleNavClick('tasks');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                      {t('Tasks & Documents')}
                    </button>

                    <button
                      onClick={() => {
                        handleNavClick('offers');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <Gift className="w-3.5 h-3.5 text-slate-500" />
                      {t('Job Offers')}
                    </button>

                    <div className="border-t border-slate-100 my-1"></div>

                    <button
                      onClick={() => {
                        signOut();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      {t('Sign Out')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#085587] rounded-lg hover:bg-[#074771] transition-colors whitespace-nowrap shadow-sm flex items-center gap-1.5"
              >
                {t('Sign In')}
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {/* Mobile hamburger toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label={t('Toggle Navigation Menu')}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          <button
            onClick={() => handleNavClick('jobs')}
            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
          >
            {t('Open Roles')}
          </button>
          {user ? (
            <>
              <button
                onClick={() => handleNavClick('dashboard')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {t('Dashboard')}
              </button>
              <button
                onClick={() => handleNavClick('applications')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {t('My Applications')}
              </button>
              <button
                onClick={() => handleNavClick('profile')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {t('My Profile')}
              </button>
              <button
                onClick={() => handleNavClick('cv-builder')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {t('CV & Documents')}
              </button>
              <button
                onClick={() => handleNavClick('interviews')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {t('Interviews')}
              </button>
              <button
                onClick={() => handleNavClick('offers')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {t('Offers & Preboarding')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNavClick('saved-jobs')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {t('Saved Jobs & Alerts')}
              </button>
              <button
                onClick={() => handleNavClick('about')}
                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {t('Why Synesis')}
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
};
