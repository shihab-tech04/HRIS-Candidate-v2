import React, { useState } from 'react';
import { PublicJobsPage } from './PublicJobsPage';
import VerifiedJobDetails from './VerifiedJobDetails';

/**
 * Public-only production release. Do not enable candidate authentication and
 * application writes until the audited RLS and cross-candidate tests pass.
 * Existing candidate journeys remain unchanged in the full application.
 */
export function PublicOnlyCareers() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const onUnavailable = () => setNotice('Applications, accounts and saved jobs are temporarily unavailable while candidate privacy and authorization are being verified.');
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap gap-3 items-center justify-between">
          <button type="button" onClick={() => {setJobId(null);setNotice('');}}
            className="text-xl font-bold text-[#085587] rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#085587]">
            Synesis Careers
          </button>
          <p className="text-sm text-slate-600">Public vacancy preview</p>
        </div>
      </header>
      <section aria-label="Candidate service status" className="bg-sky-50 border-b border-sky-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <p className="text-sm text-[#085587]">
            Browse verified vacancies. Candidate registration and applications will open after security testing.
          </p>
        </div>
      </section>
      {notice && <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>
      </div>}
      <div className="flex-1">
        {jobId ? <VerifiedJobDetails jobId={jobId} publicOnly onBack={() => {setJobId(null);setNotice('');}}
          onApply={onUnavailable} onOpenAuth={onUnavailable}/> :
        <PublicJobsPage publicOnly onSelectJob={(id) => {setJobId(id);setNotice('');}}
          onApplyJob={onUnavailable} onOpenAuth={onUnavailable}/>}
      </div>
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <p className="text-xs text-slate-600">Synesis Careers · Public vacancy information only. No application submissions are accepted in this preview.</p>
        </div>
      </footer>
    </div>
  );
}
