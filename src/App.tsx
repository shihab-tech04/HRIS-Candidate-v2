/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { candidateRouteUrl, parseCandidateRoute } from './lib/candidateRouting';

function MainAppContent() {
  const { user } = useAuth();
  const [route, setRoute] = useState(() => parseCandidateRoute(window.location.search));
  const currentTab = route.tab;
  const selectedJobId = route.jobId || 'job-synesis-001';
  const selectedAppId = route.applicationId;

  useEffect(() => {
    const restore = () => setRoute(parseCandidateRoute(window.location.search));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  const navigate = (tab: string, jobId?: string, applicationId?: string) => {
    const next = { tab, jobId, applicationId };
    const nextUrl = candidateRouteUrl(window.location.href, next);
    if (nextUrl !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.pushState(null, '', nextUrl);
    }
    setRoute(parseCandidateRoute(new URL(nextUrl, window.location.origin).search));
  };

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [authReturnNotice, setAuthReturnNotice] = useState<string | undefined>(undefined);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // Pending navigation after auth
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const handleSelectJob = (jobId: string) => {
    navigate('job-details', jobId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyJob = (jobId: string) => {
    if (!user) {
      setAuthReturnNotice('Sign in or register to begin your job application.');
      setPendingAction(() => () => {
        navigate('apply', jobId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      setAuthModalOpen(true);
      return;
    }
    navigate('apply', jobId);
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
    navigate('applications', undefined, applicationId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={navigate}
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
            onBack={() => navigate('jobs')}
            onApply={handleApplyJob}
            onOpenAuth={(notice) => handleOpenAuth(notice)}
          /> : <VerifiedJobDetails jobId={selectedJobId} onBack={() => navigate('jobs')} onApply={handleApplyJob} onOpenAuth={(notice) => handleOpenAuth(notice)} />
        )}

        {currentTab === 'apply' && (DEMO_MODE ?
          <ApplyPage jobId={selectedJobId}
            onBack={() => navigate('job-details', selectedJobId)}
            onApplicationSuccess={handleApplicationSuccess} /> :
          <VerifiedApplyPage jobId={selectedJobId}
            onBack={() => navigate('job-details', selectedJobId)}
            onApplicationSuccess={handleApplicationSuccess} />
        )}

        {currentTab === 'dashboard' && (
          <DashboardPage
            onNavigate={navigate}
            onSelectApplication={(appId) => {
              navigate('applications', undefined, appId);
            }}
          />
        )}

        {currentTab === 'applications' && (
          <ApplicationsPage
            onNavigate={navigate}
            selectedAppId={selectedAppId}
          />
        )}

        {currentTab === 'cv-builder' && (
          <CVBuilderPage onNavigate={navigate} />
        )}

        {currentTab === 'interviews' && (
          <InterviewsPage onNavigate={navigate} />
        )}

        {currentTab === 'tasks' && (
          <TasksPage onNavigate={navigate} />
        )}

        {currentTab === 'offers' && (
          <OffersPage onNavigate={navigate} />
        )}

        {currentTab === 'preboarding' && (
          <PreboardingPage onNavigate={navigate} />
        )}

        {currentTab === 'profile' && (
          <ProfilePage onNavigate={navigate} />
        )}

        {currentTab === 'saved-jobs' && (DEMO_MODE ?
          <SavedJobsPage
            onSelectJob={handleSelectJob}
            onApplyJob={handleApplyJob}
            onOpenAuth={() => handleOpenAuth('Sign in to access saved jobs & alerts.')}
          /> : <VerifiedSavedJobsPage onSelectJob={handleSelectJob} onApplyJob={handleApplyJob} onOpenAuth={() => handleOpenAuth()} />
        )}

        {currentTab === 'about' && (
          <AboutPage onNavigate={navigate} />
        )}
      </main>

      <Footer
        onNavigate={navigate}
        onOpenConfig={() => setConfigModalOpen(true)}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
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
  return (
    <AuthProvider>
      {import.meta.env.PROD && import.meta.env.VITE_CANDIDATE_PUBLIC_ONLY === 'true' ? <PublicOnlyCareers /> : <MainAppContent />}
    </AuthProvider>
  );
}
