/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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

function MainAppContent() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('jobs');
  const [selectedJobId, setSelectedJobId] = useState<string>('job-synesis-001');
  const [selectedAppId, setSelectedAppId] = useState<string | undefined>(undefined);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [authReturnNotice, setAuthReturnNotice] = useState<string | undefined>(undefined);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // Pending navigation after auth
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentTab('job-details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyJob = (jobId: string) => {
    setSelectedJobId(jobId);
    if (!user) {
      setAuthReturnNotice('Sign in or register to begin your job application.');
      setPendingAction(() => () => {
        setSelectedJobId(jobId);
        setCurrentTab('apply');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      setAuthModalOpen(true);
      return;
    }
    setCurrentTab('apply');
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
    setSelectedAppId(applicationId);
    setCurrentTab('applications');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
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
            onBack={() => setCurrentTab('jobs')}
            onApply={handleApplyJob}
            onOpenAuth={(notice) => handleOpenAuth(notice)}
          /> : <VerifiedJobDetails jobId={selectedJobId} onBack={() => setCurrentTab('jobs')} onApply={handleApplyJob} onOpenAuth={(notice) => handleOpenAuth(notice)} />
        )}

        {currentTab === 'apply' && (DEMO_MODE ?
          <ApplyPage jobId={selectedJobId}
            onBack={() => setCurrentTab('job-details')}
            onApplicationSuccess={handleApplicationSuccess} /> :
          <VerifiedApplyPage jobId={selectedJobId}
            onBack={() => setCurrentTab('job-details')}
            onApplicationSuccess={handleApplicationSuccess} />
        )}

        {currentTab === 'dashboard' && (
          <DashboardPage
            onNavigate={(tab) => setCurrentTab(tab)}
            onSelectApplication={(appId) => {
              setSelectedAppId(appId);
              setCurrentTab('applications');
            }}
          />
        )}

        {currentTab === 'applications' && (
          <ApplicationsPage
            onNavigate={(tab) => setCurrentTab(tab)}
            selectedAppId={selectedAppId}
          />
        )}

        {currentTab === 'cv-builder' && (
          <CVBuilderPage onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'interviews' && (
          <InterviewsPage onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'tasks' && (
          <TasksPage onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'offers' && (
          <OffersPage onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'preboarding' && (
          <PreboardingPage onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'profile' && (
          <ProfilePage onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'saved-jobs' && (DEMO_MODE ?
          <SavedJobsPage
            onSelectJob={handleSelectJob}
            onApplyJob={handleApplyJob}
            onOpenAuth={() => handleOpenAuth('Sign in to access saved jobs & alerts.')}
          /> : <VerifiedSavedJobsPage onSelectJob={handleSelectJob} onApplyJob={handleApplyJob} onOpenAuth={() => handleOpenAuth()} />
        )}

        {currentTab === 'about' && (
          <AboutPage onNavigate={(tab) => setCurrentTab(tab)} />
        )}
      </main>

      <Footer
        onNavigate={(tab) => setCurrentTab(tab)}
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
