/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AuthProvider, PublicOnlyAuthProvider, useAuth } from './context/AuthContext';
import { CandidateLocaleProvider } from './context/CandidateLocaleContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { AuthModal } from './components/auth/AuthModal';
import { ConfigModal } from './components/common/ConfigModal';

// Pages
import { PublicJobsPage } from './pages/PublicJobsPage';
import { JobDetailsPage } from './pages/JobDetailsPage';
import VerifiedJobDetails from './pages/VerifiedJobDetails';
import { ApplyPage } from './pages/ApplyPage';
import VerifiedApplyPage from './pages/VerifiedApplyPage';
import { DEMO_MODE } from './lib/api';
import { PublicOnlyCareers } from './pages/PublicOnlyCareers';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { CVBuilderPage } from './pages/CVBuilderPage';
import { InterviewsPage } from './pages/InterviewsPage';
import { TasksPage } from './pages/TasksPage';
import { OffersPage } from './pages/OffersPage';
import { PreboardingPage } from './pages/PreboardingPage';
import { ProfilePage } from './pages/ProfilePage';
import { SavedJobsPage } from './pages/SavedJobsPage';
import VerifiedSavedJobsPage from './pages/VerifiedSavedJobsPage';
import { AboutPage } from './pages/AboutPage';
import { candidateRouteHref, CandidateRoute, CandidateTab, parseCandidateRoute } from './lib/candidateRoutes';

const DEFAULT_JOB_ID = 'job-synesis-001';

function isCandidateTab(tab: string): tab is CandidateTab {
  return ['jobs', 'job-details', 'apply', 'dashboard', 'applications', 'cv-builder',
    'interviews', 'tasks', 'offers', 'preboarding', 'profile', 'saved-jobs', 'about'].includes(tab);
}

function MainAppContent() {
  const { user, loading: authLoading, passwordRecoveryRequired, passwordRecoveryError, cancelPasswordRecovery } = useAuth();
  const [initialRoute] = useState(() => parseCandidateRoute(window.location.search));
  const [currentTab, setCurrentTabState] = useState<CandidateTab>(initialRoute.tab);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialRoute.jobId || DEFAULT_JOB_ID);
  const [selectedAppId, setSelectedAppId] = useState<string | undefined>(initialRoute.applicationId);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'forgot' | 'recovery'>('signin');
  const [authReturnNotice, setAuthReturnNotice] = useState<string | undefined>(undefined);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // Pending navigation after auth
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const restoreFromLocation = () => {
      const route = parseCandidateRoute(window.location.search);
      setCurrentTabState(route.tab);
      setSelectedJobId(route.jobId || DEFAULT_JOB_ID);
      setSelectedAppId(route.applicationId);
    };
    window.addEventListener('popstate', restoreFromLocation);
    return () => window.removeEventListener('popstate', restoreFromLocation);
  }, []);

  useEffect(() => {
    if (authLoading || currentTab !== 'apply' || user) return;
    setAuthReturnNotice('Sign in or register to continue your application.');
    setAuthModalMode('signin');
    setAuthModalOpen(true);
  }, [authLoading, currentTab, user]);

  useEffect(() => {
    if (!passwordRecoveryRequired) return;
    setAuthModalMode('recovery');
    setAuthReturnNotice(undefined);
    setAuthModalOpen(true);
  }, [passwordRecoveryRequired]);

  useEffect(() => {
    if (!passwordRecoveryError) return;
    setAuthModalMode('forgot');
    setAuthReturnNotice(passwordRecoveryError);
    setAuthModalOpen(true);
  }, [passwordRecoveryError]);

  const closeAuthModal = async () => {
    if (passwordRecoveryRequired) await cancelPasswordRecovery();
    setAuthModalOpen(false);
  };

  const navigateToTab = (tab: string, options: { jobId?: string; applicationId?: string } = {}) => {
    const nextTab: CandidateTab = isCandidateTab(tab) ? tab : 'jobs';
    const nextRoute: CandidateRoute = {
      tab: nextTab,
      ...((nextTab === 'job-details' || nextTab === 'apply')
        ? { jobId: options.jobId || selectedJobId || DEFAULT_JOB_ID }
        : {}),
      ...(nextTab === 'applications' && options.applicationId
        ? { applicationId: options.applicationId }
        : {}),
    };
    const href = candidateRouteHref(window.location, nextRoute);
    window.history.pushState(null, '', href);
    setCurrentTabState(nextRoute.tab);
    setSelectedJobId(nextRoute.jobId || DEFAULT_JOB_ID);
    setSelectedAppId(nextRoute.applicationId);
  };

  const handleSelectJob = (jobId: string) => {
    navigateToTab('job-details', { jobId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyJob = (jobId: string) => {
    if (!user) {
      if (currentTab !== 'job-details' || selectedJobId !== jobId) {
        navigateToTab('job-details', { jobId });
      }
      setAuthReturnNotice('Sign in or register to begin your job application.');
      setPendingAction(() => () => {
        navigateToTab('apply', { jobId });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      setAuthModalOpen(true);
      return;
    }
    navigateToTab('apply', { jobId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = (notice?: string, mode: 'signin' | 'signup' = 'signin') => {
    setAuthReturnNotice(notice);
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleAuthSuccess = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleApplicationSuccess = (applicationId: string) => {
    navigateToTab('applications', { applicationId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={navigateToTab}
        openAuthModal={() => handleOpenAuth()}
        openConfigModal={() => setConfigModalOpen(true)}
      />

      <main className="flex-1">
        {currentTab === 'jobs' && (
          <PublicJobsPage
            onSelectJob={handleSelectJob}
            onApplyJob={handleApplyJob}
            onOpenAuth={() => handleOpenAuth('Sign in to save jobs to your profile.')}
          />
        )}

        {currentTab === 'job-details' && (DEMO_MODE ?
          <JobDetailsPage
            jobId={selectedJobId}
            onBack={() => navigateToTab('jobs')}
            onApply={handleApplyJob}
            onOpenAuth={(notice) => handleOpenAuth(notice)}
          /> : <VerifiedJobDetails jobId={selectedJobId} onBack={() => navigateToTab('jobs')} onApply={handleApplyJob} onOpenAuth={(notice) => handleOpenAuth(notice)} />
        )}

        {currentTab === 'apply' && (DEMO_MODE ?
          <ApplyPage jobId={selectedJobId}
            onBack={() => navigateToTab('job-details')}
            onApplicationSuccess={handleApplicationSuccess} /> :
          <VerifiedApplyPage jobId={selectedJobId}
            onBack={() => navigateToTab('job-details')}
            onApplicationSuccess={handleApplicationSuccess} />
        )}

        {currentTab === 'dashboard' && (
          <DashboardPage
            onNavigate={(tab) => navigateToTab(tab)}
            onSelectApplication={(appId) => {
              setSelectedAppId(appId);
              navigateToTab('applications', { applicationId: appId });
            }}
          />
        )}

        {currentTab === 'applications' && (
          <ApplicationsPage
            onNavigate={(tab) => navigateToTab(tab)}
            selectedAppId={selectedAppId}
          />
        )}

        {currentTab === 'cv-builder' && (
          <CVBuilderPage onNavigate={(tab) => navigateToTab(tab)} />
        )}

        {currentTab === 'interviews' && (
          <InterviewsPage onNavigate={(tab) => navigateToTab(tab)} />
        )}

        {currentTab === 'tasks' && (
          <TasksPage onNavigate={(tab) => navigateToTab(tab)} />
        )}

        {currentTab === 'offers' && (
          <OffersPage onNavigate={(tab) => navigateToTab(tab)} />
        )}

        {currentTab === 'preboarding' && (
          <PreboardingPage onNavigate={(tab) => navigateToTab(tab)} />
        )}

        {currentTab === 'profile' && (
          <ProfilePage onNavigate={(tab) => navigateToTab(tab)} />
        )}

        {currentTab === 'saved-jobs' && (DEMO_MODE ?
          <SavedJobsPage
            onSelectJob={handleSelectJob}
            onApplyJob={handleApplyJob}
            onOpenAuth={() => handleOpenAuth('Sign in to access saved jobs & alerts.')}
          /> : <VerifiedSavedJobsPage onSelectJob={handleSelectJob} onApplyJob={handleApplyJob} onOpenAuth={() => handleOpenAuth()} />
        )}

        {currentTab === 'about' && (
          <AboutPage onNavigate={(tab) => navigateToTab(tab)} />
        )}
      </main>

      <Footer
        onNavigate={(tab) => navigateToTab(tab)}
        onOpenConfig={() => setConfigModalOpen(true)}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => { void closeAuthModal(); }}
        initialMode={authModalMode}
        returnNotice={authReturnNotice}
        onSuccess={handleAuthSuccess}
      />

      <ConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  // The public-only deployment must not initialize candidate Auth or private profile reads.
  if (import.meta.env.PROD && import.meta.env.VITE_CANDIDATE_PUBLIC_ONLY === 'true') {
    return (
      <CandidateLocaleProvider>
        <PublicOnlyAuthProvider>
          <PublicOnlyCareers />
        </PublicOnlyAuthProvider>
      </CandidateLocaleProvider>
    );
  }

  return (
    <CandidateLocaleProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </CandidateLocaleProvider>
  );
}
