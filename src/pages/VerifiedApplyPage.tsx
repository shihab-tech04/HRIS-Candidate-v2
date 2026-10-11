import React, { useEffect, useState } from 'react';
import { CandidateCV, PublishedJob } from '../types';
import { useAuth } from '../context/AuthContext';
import { applyToJob, getPublishedJobById, listCandidateCVs, persistCandidateCV, uploadCandidateCV, loadVerifiedApplicationDraft, saveVerifiedApplicationDraft, clearVerifiedApplicationDraft } from '../lib/api';

type Props = {
  jobId: string;
  onBack: () => void;
  onApplicationSuccess: (id: string) => void;
};

/** Production-only application journey. The original form remains available in
 * explicit local demo; only this path may submit live candidate records.
 * Backend owns eligibility, duplicate prevention and submission validation.
 */
export default function VerifiedApplyPage({ jobId, onBack, onApplicationSuccess }: Props) {
  const { user, profile } = useAuth();
  const [job, setJob] = useState<PublishedJob | null>(null);
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [cvId, setCvId] = useState('');
  const [newCvTitle, setNewCvTitle] = useState('');
  const [upload, setUpload] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [coverLetter, setCoverLetter] = useState('');
  const [consent, setConsent] = useState(false);
  const [certified, setCertified] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const field = 'w-full border rounded-lg p-2.5 text-sm border-slate-300 focus:outline-[#085587]';
  const button = 'rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
  const stages = ['Vacancy', 'Your CV', 'Screening', 'Review & submit'];

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const j = await getPublishedJobById(jobId);
        if (!live) return;
        setJob(j);
        if (!user) { setError('Sign in before applying.'); return; }
        const list = await listCandidateCVs(user.id);
        if (!live) return;
        setCvs(list);
        setCvId(list.find(c => c.is_default)?.id || list[0]?.id || '');
        const draft = await loadVerifiedApplicationDraft(user.id,jobId);
        if (!live) return;
        if (draft) {
          if (draft.cvId && list.some(cv => cv.id === draft.cvId)) setCvId(draft.cvId);
          setAnswers(draft.answers);
          setCoverLetter(draft.coverLetter);
          setStep(Math.max(1,Math.min(4,draft.step)));
        }
        setError('');
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Unable to load this application.');
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [jobId, user?.id]);

  async function createCV(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newCvTitle.trim()) return;
    setBusy(true); setError('');
    try {
      const cv = await persistCandidateCV(user.id, {
        title: newCvTitle.trim(), is_default: cvs.length === 0,
        structured_content: { summary: profile?.summary || '' }
      });
      setCvId(cv.id);
      setCvs(await listCandidateCVs(user.id));
      setNewCvTitle('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save CV.'); }
    finally { setBusy(false); }
  }

  async function uploadCV() {
    if (!user || !upload || !cvId) return;
    const cv = cvs.find(x => x.id === cvId);
    if (!cv) return;
    setBusy(true); setError('');
    try {
      await uploadCandidateCV(user.id, cv, upload);
      setCvs(await listCandidateCVs(user.id));
      setUpload(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'CV upload failed.'); }
    finally { setBusy(false); }
  }

  const questions = job?.screening_questions || [];
  function validateQuestions() {
    for (const q of questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
        setError('Answer the required question: ' + q.question);
        return false;
      }
    }
    return true;
  }
  function next() {
    if (step === 2 && !cvId) { setError('Create or select a saved CV.'); return; }
    if (step === 3 && !validateQuestions()) return;
    setError('');
    setStep(s => Math.min(4,s + 1));
  }

  async function saveDraft() {
    if (!user || !job) return;
    setBusy(true); setError(''); setDraftStatus('');
    try {
      await saveVerifiedApplicationDraft(user.id, job.id, { step, cvId, answers, coverLetter });
      setDraftStatus('Your application draft was saved securely.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Draft could not be saved.'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!user || !job) { setError('Verified sign-in and an open vacancy are required.'); return; }
    if (!cvId || !validateQuestions() || !consent || !certified) {
      setError('Select a CV and complete all required questions and declarations.');
      return;
    }
    setBusy(true); setError('');
    try {
      const res = await applyToJob(job.id, {
        user_id: user.id, cv_id: cvId,
        cv_title: cvs.find(x => x.id === cvId)?.title || '',
        screening_answers: answers, cover_letter: coverLetter,
        consent_given: consent, accuracy_certified: certified
      });
      if (!res.success || !res.application?.id) {
        setError(res.error || 'Submission could not be verified by HRIS.'); return;
      }
      try { await clearVerifiedApplicationDraft(user.id,job.id); } catch { /* Submission remains authoritative. */ }
      onApplicationSuccess(res.application.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Application failed. Please retry.');
    } finally { setBusy(false); }
  }

  if (loading) return <main className="max-w-3xl mx-auto p-8" role="status">Verifying application and account…</main>;
  if (!user) return <main className="max-w-3xl mx-auto p-8"><h1 className="text-lg font-semibold">Authentication required</h1>
    <p className="text-sm text-rose-700">{error}</p><button className={button+' border mt-4'} onClick={onBack}>Back to vacancy</button></main>;
  if (!job) return <main className="max-w-3xl mx-auto p-8"><h1 className="text-lg font-semibold">Vacancy unavailable</h1>
    <p role="alert" className="text-sm text-rose-700">{error || 'This vacancy is not open for application.'}</p>
    <button className={button+' border mt-4'} onClick={onBack}>Back to careers</button></main>;

  return <main className="min-h-screen bg-slate-50 py-8 px-4">
    <div className="max-w-3xl mx-auto bg-white border border-slate-200 shadow-sm rounded-xl p-5 md:p-8 space-y-6">
      <button className="text-sm text-[#085587] underline" onClick={onBack}>Back to job</button>
      <div><h1 className="text-xl md:text-2xl font-bold">Apply for {job.title}</h1>
        <p className="text-sm text-slate-600 mt-1">{job.department} · {job.location} · Deadline {job.application_deadline}</p></div>
      <ol className="grid grid-cols-4 gap-1 text-xs" aria-label="Application progress">
        {stages.map((x,i)=><li className={'p-2 rounded text-center ' + (step >= i+1 ? 'bg-[#085587] text-white' : 'bg-slate-100 text-slate-600')} key={x}>{x}</li>)}
      </ol>
      {error && <p role="alert" className="border border-rose-200 bg-rose-50 text-rose-700 text-sm rounded-lg p-3">{error}</p>}
      {draftStatus && <p role="status" className="border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm rounded-lg p-3">{draftStatus}</p>}
      {step === 1 && <section className="space-y-4">
        <h2 className="font-semibold">Your account and vacancy</h2>
        <p className="text-sm">Signed in as <strong>{user.email}</strong>. Your candidate profile is used for this application.</p>
        <p className="text-sm">Requirements: {job.requirements.length ? job.requirements.join('; ') : 'Refer to the job circular.'}</p>
        <p className="text-sm">Responsibilities: {job.responsibilities.length ? job.responsibilities.join('; ') : 'Refer to the job circular.'}</p>
      </section>}
      {step === 2 && <section className="space-y-4">
        <h2 className="font-semibold">CV selection</h2>
        <label className="block text-sm">Verified saved CV
          <select className={field+' mt-1'} required value={cvId} onChange={e=>setCvId(e.target.value)}>
            <option value="">Select a CV</option>
            {cvs.map(cv=><option value={cv.id} key={cv.id}>{cv.title}{cv.file_url ? ' (uploaded)' : ' (structured record)'}</option>)}
          </select>
        </label>
        <form onSubmit={createCV} className="flex flex-wrap gap-2 items-end">
          <label className="text-sm flex-1">Create CV record
            <input className={field+' mt-1'} placeholder="CV title" value={newCvTitle} onChange={e=>setNewCvTitle(e.target.value)} /></label>
          <button className={button+' bg-[#085587] text-white'} disabled={busy}>Create</button></form>
        {cvId && <div className="border-t pt-4 space-y-2">
          <label className="block text-sm">Upload PDF or Word CV to private storage
            <input type="file" accept=".pdf,.doc,.docx" className={field+' mt-1'} onChange={e=>setUpload(e.target.files?.[0] || null)}/></label>
          <button className={button+' border border-[#085587] text-[#085587]'} disabled={!upload || busy} onClick={() => void uploadCV()}>Upload selected CV</button>
          <p className="text-xs text-slate-500">The uploaded document stays private. We do not pretend to parse resumes automatically.</p>
        </div>}
      </section>}
      {step === 3 && <section className="space-y-4">
        <h2 className="font-semibold">Screening questions and introduction</h2>
        {questions.map(q=><label className="block text-sm" key={q.id}>{q.question} {q.required && <span className="text-rose-600">*</span>}
          {q.type === 'select' || q.type === 'yes_no' ?
          <select className={field+' mt-1'} value={String(answers[q.id] || '')} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))}>
            <option value="">Select an answer</option>
            {(q.type === 'yes_no'?['Yes','No'] : q.options || []).map(x=><option key={x} value={x}>{x}</option>)}</select> :
          <input className={field+' mt-1'} type={q.type==='number'?'number':'text'} value={answers[q.id] || ''}
            onChange={e=>setAnswers(a=>({...a,[q.id]:q.type==='number'?Number(e.target.value):e.target.value}))} />}</label>)}
        <label className="block text-sm">Cover letter (optional)
          <textarea rows={5} value={coverLetter} onChange={e=>setCoverLetter(e.target.value)} className={field+' mt-1'} /></label>
        <p className="text-xs text-slate-500">Any additional required documents or screening constraints are validated by HRMIS during submission.</p>
      </section>}
      {step === 4 && <section className="space-y-4">
        <h2 className="font-semibold">Review and declarations</h2>
        <p className="text-sm">Position: {job.title}</p>
        <p className="text-sm">Applicant: {user.email}</p>
        <p className="text-sm">CV: {cvs.find(c=>c.id===cvId)?.title || 'Not selected'}</p>
        <p className="text-sm">Screening responses: {Object.keys(answers).length}</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={certified} onChange={e=>setCertified(e.target.checked)}/>
          I certify that the information supplied is complete and accurate.</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
          I consent to processing this information for recruitment.</label>
      </section>}
      <div className="border-t pt-4 flex flex-wrap gap-3 justify-between">
        <button type="button" disabled={busy} onClick={() => void saveDraft()} className={button + ' border border-[#085587] text-[#085587]'}>Save draft</button>
        <button className={button+' border border-slate-300'} onClick={()=>{ setStep(x=>Math.max(1,x-1));setError(''); }} disabled={step===1||busy}>Previous</button>
        {step===4 ? <button disabled={busy || !consent || !certified} className={button+' bg-[#085587] text-white'} onClick={()=>void submit()}>
          {busy?'Submitting…':'Submit application'}</button> :
          <button className={button+' bg-[#085587] text-white'} onClick={next} disabled={busy}>Continue</button>}
      </div>
    </div>
  </main>;
}
