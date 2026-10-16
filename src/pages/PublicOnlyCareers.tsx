import React, { useEffect, useState } from 'react';
import { CandidateLocaleSwitch, useCandidateLocale } from '../context/CandidateLocaleContext';
import { PublicJobsPage } from './PublicJobsPage';
import VerifiedJobDetails from './VerifiedJobDetails';

/**
 * Public-only production release. Do not enable candidate authentication and
 * application writes until the audited RLS and cross-candidate tests pass.
 * Existing candidate journeys remain unchanged in the full application.
 */
export function PublicOnlyCareers() {
  const { t } = useCandidateLocale();
  const [jobId, setJobId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('job'));
  useEffect(() => {
    const onHistory = () => setJobId(new URLSearchParams(window.location.search).get('job'));
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);
  const [notice, setNotice] = useState('');
  const openJob = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('job', id);
    window.history.pushState(null, '', url.pathname + url.search + url.hash);
    setJobId(id);
    setNotice('');
  };
  const backToJobs = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('job');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    setJobId(null);
    setNotice('');
  };
  const onUnavailable = () => setNotice('Applications, accounts and saved jobs are temporarily unavailable while candidate privacy and authorization are being verified.');
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap gap-3 items-center justify-between">
          <button type="button" onClick={backToJobs}
            className="text-xl font-bold text-[#085587] rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#085587]">
            Synesis Careers
          </button>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-600">{t('Public vacancy preview')}</p>
            <CandidateLocaleSwitch />
          </div>
        </div>
      </header>
      <section aria-label={t('Candidate service status')} className="bg-sky-50 border-b border-sky-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <p className="text-sm text-[#085587]">
            {t('Browse verified vacancies. Candidate registration and applications will open after security testing.')}
          </p>
        </div>
      </section>
      {notice && <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t(notice)}</p>
      </div>}
      <div className="flex-1">
        {jobId ? <VerifiedJobDetails jobId={jobId} publicOnly onBack={backToJobs}
          onApply={onUnavailable} onOpenAuth={onUnavailable}/> :
        <PublicJobsPage publicOnly onSelectJob={openJob}
          onApplyJob={onUnavailable} onOpenAuth={onUnavailable}/>}
      </div>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <p className="text-xs text-slate-600">{t('Synesis Careers · Public vacancy information only. No application submissions are accepted in this preview.')}</p>
        </div>
      </footer>
    </div>
  );
}
