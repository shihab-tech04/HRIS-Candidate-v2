import { parseScreeningNumberInput } from '../lib/screeningQuestionTypes';
import React, { useEffect, useState } from 'react';
import { CandidateCV, CandidateStoredDocument, PublishedJob } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import { applyToJob, getPublishedJobById, listCandidateCVs, persistCandidateCV, uploadCandidateCV, uploadCandidateApplicationDocument, loadVerifiedApplicationDraft, saveVerifiedApplicationDraft, clearVerifiedApplicationDraft } from '../lib/api';

type Props = {
  jobId: string;
  onBack: () => void;
  onApplicationSuccess: (id: string) => void;
};

function readCandidateDocuments(value: unknown, userId: string): CandidateStoredDocument[] {
  if (!Array.isArray(value) || !userId) return [];
  return value.flatMap((item): CandidateStoredDocument[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    const fileUrl = typeof row.fileUrl === 'string' ? row.fileUrl : '';
    if (!id || !fileUrl.startsWith(`${userId}/`)) return [];
    return [{
      id,
      title: String(row.title || row.name || 'Supporting document'),
      fileName: String(row.fileName || row.file_name || row.name || 'Document'),
      fileUrl,
      contentType: String(row.contentType || row.content_type || 'application/octet-stream'),
      uploadedAt: String(row.uploadedAt || row.uploaded_at || '')
    }];
  });
}

/** Production-only application journey. The original form remains available in
 * explicit local demo; only this path may submit live candidate records.
 * Backend owns eligibility, duplicate prevention and submission validation.
 */
export default function VerifiedApplyPage({ jobId, onBack, onApplicationSuccess }: Props) {
  const { user, profile } = useAuth();
  const { locale, t } = useCandidateLocale();
  const [job, setJob] = useState<PublishedJob | null>(null);
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [cvId, setCvId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEdited, setContactEdited] = useState(false);
  const [newCvTitle, setNewCvTitle] = useState('');
  const [upload, setUpload] = useState<File | null>(null);
  const [documents, setDocuments] = useState<CandidateStoredDocument[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [requiredDocumentMap, setRequiredDocumentMap] = useState<Record<string, string>>({});
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentUpload, setDocumentUpload] = useState<File | null>(null);
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
    if (!profile || contactEdited) return;
    setFullName(profile.full_name || '');
    setPhone(profile.phone || '');
  }, [profile, user?.id, contactEdited]);

  useEffect(() => {
    if (profile && user?.id) {
      setDocuments(readCandidateDocuments(profile.profile_data?.documents, user.id));
    }
  }, [profile?.user_id, profile?.profile_data, user?.id]);

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
          setDocumentIds(draft.documentIds || []);
          setRequiredDocumentMap(draft.requiredDocumentMap || {});
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

  async function uploadApplicationDocument() {
    if (!user || !documentUpload || !documentTitle.trim()) return;
    setBusy(true); setError(''); setDraftStatus('');
    try {
      const document = await uploadCandidateApplicationDocument(user.id, documentTitle, documentUpload);
      setDocuments(current => [document, ...current.filter(item => item.id !== document.id)]);
      setDocumentIds(current => [...new Set([...current, document.id])]);
      setDocumentTitle('');
      setDocumentUpload(null);
      setDraftStatus('Supporting document uploaded to your private candidate storage.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Supporting document upload failed.');
    } finally { setBusy(false); }
  }

  const questions = job?.screening_questions || [];
  function validateQuestions() {
    for (const q of questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
        setError(`Answer the required question: ${q.question}`);
        return false;
      }
    }
    return true;
  }
  function validateRequiredDocuments() {
    for (const required of job?.required_documents || []) {
      const documentId = requiredDocumentMap[required];
      if (!documentId || !documents.some(document => document.id === documentId)) {
        setError(`Choose a verified document for: ${required}`);
        return false;
      }
    }
    return true;
  }
  function next() {
    if (step === 1 && !fullName.trim()) { setError('Enter your full legal name to continue.'); return; }
    if (step === 2 && !cvId) { setError('Create or select a saved CV.'); return; }
    if (step === 3 && !validateQuestions()) return;
    if (step === 3 && !validateRequiredDocuments()) return;
    setError('');
    setStep(s => Math.min(4,s + 1));
  }

  async function saveDraft() {
    if (!user || !job) return;
    setBusy(true); setError(''); setDraftStatus('');
    try {
      const selectedDocumentIds = [...new Set([
        ...documentIds,
        ...Object.values(requiredDocumentMap).filter(Boolean)
      ])];
      await saveVerifiedApplicationDraft(user.id, job.id, {
        step, cvId, answers, coverLetter,
        documentIds: selectedDocumentIds, requiredDocumentMap
      });
      setDraftStatus('Your application draft was saved securely.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Draft could not be saved.'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!user || !job) { setError('Verified sign-in and an open vacancy are required.'); return; }
    if (!fullName.trim() || !cvId || !validateQuestions() || !validateRequiredDocuments() || !consent || !certified) {
      if (!fullName.trim()) setError('Enter your full legal name before submitting.');
      else if (!cvId) setError('Select a saved CV before submitting.');
      else if (!consent || !certified) setError('Complete both declarations before submitting.');
      return;
    }
    setBusy(true); setError('');
    try {
      const res = await applyToJob(job.id, {
        user_id: user.id, cv_id: cvId,
        cv_title: cvs.find(x => x.id === cvId)?.title || '',
        full_name: fullName.trim(), phone: phone.trim(),
        years_experience: Number((profile as (typeof profile & { years_experience?: number | null }))?.years_experience) || undefined,
        skills: profile?.skills || [],
        screening_answers: answers, cover_letter: coverLetter,
        document_ids: [...new Set([...documentIds, ...Object.values(requiredDocumentMap).filter(Boolean)])],
        required_document_map: requiredDocumentMap,
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

  if (loading) return <main className="max-w-3xl mx-auto p-8" role="status">{t('Verifying application and account…')}</main>;
  if (!user) return <main className="max-w-3xl mx-auto p-8"><h1 className="text-lg font-semibold">{t('Authentication required')}</h1>
    <p className="text-sm text-rose-700">{t(error)}</p><button className={button+' border mt-4'} onClick={onBack}>{t('Back to vacancy')}</button></main>;
  if (!job) return <main className="max-w-3xl mx-auto p-8"><h1 className="text-lg font-semibold">{t('Vacancy unavailable')}</h1>
    <p role="alert" className="text-sm text-rose-700">{t(error || 'This vacancy is not open for application.')}</p>
    <button className={button+' border mt-4'} onClick={onBack}>{t('Back to careers')}</button></main>;

  return <main className="min-h-screen bg-slate-50 py-8 px-4">
    <div className="max-w-3xl mx-auto bg-white border border-slate-200 shadow-sm rounded-xl p-5 md:p-8 space-y-6">
      <button className="text-sm text-[#085587] underline" onClick={onBack}>{t('Back to job')}</button>
      <div><h1 className="text-xl md:text-2xl font-bold">{t('Apply for {title}', { title: job.title })}</h1>
        <p className="text-sm text-slate-600 mt-1">{t(job.department)} · {job.location} · {t('Deadline {date}', { date: new Date(job.application_deadline).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-BD') })}</p></div>
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs" aria-label={t('Application progress')}>
        {stages.map((x,i)=><li className={'p-2 rounded text-center ' + (step >= i+1 ? 'bg-[#085587] text-white' : 'bg-slate-100 text-slate-600')} key={x}>{t(x)}</li>)}
      </ol>
      {error && <p role="alert" className="border border-rose-200 bg-rose-50 text-rose-700 text-sm rounded-lg p-3">{t(error)}</p>}
      {draftStatus && <p role="status" className="border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm rounded-lg p-3">{t(draftStatus)}</p>}
      {step === 1 && <section className="space-y-4">
        <h2 className="font-semibold">{t('Your contact information')}</h2>
        <p className="text-sm text-slate-600">{t('Signed in as {email}. This verified account email will be used for recruitment updates.', { email: user.email })}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">{t('Full legal name')} <span className="text-rose-600">*</span>
            <input className={field+' mt-1'} autoComplete="name" required value={fullName}
              onChange={e=>{setContactEdited(true);setFullName(e.target.value);}} /></label>
          <label className="block text-sm">{t('Contact phone')}
            <input className={field+' mt-1'} autoComplete="tel" type="tel" value={phone}
              onChange={e=>{setContactEdited(true);setPhone(e.target.value);}} /></label>
        </div>
        <p className="text-xs text-slate-500">{t('You can update these details for this application without changing your reusable profile.')}</p>
        <p className="text-sm">{t('Requirements:')} {job.requirements.length ? job.requirements.join('; ') : t('Refer to the job circular.')}</p>
        <p className="text-sm">{t('Responsibilities:')} {job.responsibilities.length ? job.responsibilities.join('; ') : t('Refer to the job circular.')}</p>
      </section>}
      {step === 2 && <section className="space-y-4">
        <h2 className="font-semibold">{t('CV selection')}</h2>
        <label className="block text-sm">{t('Verified saved CV')} <span aria-hidden="true" className="text-rose-600">*</span>
          <select className={field+' mt-1'} required value={cvId} onChange={e=>setCvId(e.target.value)}>
            <option value="">{t('Select a CV')}</option>
            {cvs.map(cv=><option value={cv.id} key={cv.id}>{cv.title}{cv.file_url ? ` (${t('uploaded')})` : ` (${t('structured record')})`}</option>)}
          </select>
        </label>
        <form onSubmit={createCV} className="flex flex-wrap gap-2 items-end">
          <label className="text-sm flex-1">{t('Create CV record')}
            <input className={field+' mt-1'} placeholder={t('CV title')} value={newCvTitle} onChange={e=>setNewCvTitle(e.target.value)} /></label>
          <button className={button+' bg-[#085587] text-white'} disabled={busy}>{t('Create')}</button></form>
        {cvId && <div className="border-t pt-4 space-y-2">
          <label className="block text-sm">{t('Upload PDF or Word CV to private storage')}
            <input type="file" accept=".pdf,.doc,.docx" className={field+' mt-1'} onChange={e=>setUpload(e.target.files?.[0] || null)}/></label>
          <button className={button+' border border-[#085587] text-[#085587]'} disabled={!upload || busy} onClick={() => void uploadCV()}>{t('Upload selected CV')}</button>
          <p className="text-xs text-slate-500">{t('The uploaded document stays private. We do not pretend to parse resumes automatically.')}</p>
        </div>}
      </section>}
      {step === 3 && <section className="space-y-4">
        <h2 className="font-semibold">{t('Screening questions and introduction')}</h2>
        {questions.map(q=><label className="block text-sm" key={q.id}>{q.question} {q.required && <span className="text-rose-600">*</span>}
          {q.type === 'multiselect' ? <span className="mt-1 grid gap-2 sm:grid-cols-2">{(q.options || []).map(option=><span key={option} className="flex items-center gap-2">
            <input type="checkbox" checked={Array.isArray(answers[q.id]) && answers[q.id].includes(option)}
              onChange={e=>setAnswers(current=>({...current,[q.id]:e.target.checked
                ? [...new Set([...(Array.isArray(current[q.id]) ? current[q.id] : []),option])]
                : (Array.isArray(current[q.id]) ? current[q.id] : []).filter((value:string)=>value!==option)}))}/>
            <span>{option}</span></span>)}</span> : q.type === 'select' || q.type === 'yes_no' ?
          <select className={field+' mt-1'} value={String(answers[q.id] || '')} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))}>
            <option value="">{t('Select an answer')}</option>
            {(q.type === 'yes_no'?['Yes','No'] : q.options || []).map(x=><option key={x} value={x}>{q.type === 'yes_no' ? t(x) : x}</option>)}</select> : q.type === 'long_text' ?
          <textarea rows={4} className={field+' mt-1'} value={String(answers[q.id] ?? '')}
            onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))} /> :
          <input className={field+' mt-1'} type={q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'}
            value={answers[q.id] ?? ''}
            onChange={e=>setAnswers(a=>({...a,[q.id]:q.type === 'number'
              ? parseScreeningNumberInput(e.target.value) : e.target.value}))} />}</label>)}
        <label className="block text-sm">{t('Cover letter (optional)')}
          <textarea rows={5} value={coverLetter} onChange={e=>setCoverLetter(e.target.value)} className={field+' mt-1'} /></label>
        <div className="border-t pt-4 space-y-3">
          <div><h3 className="text-sm font-semibold">{t('Supporting documents')}</h3>
            <p className="text-xs text-slate-500">{t('Uploaded files stay private in your candidate account. HRMIS verifies each selected file before accepting the application.')}</p></div>
          {(job.required_documents || []).length > 0 && <div className="space-y-3">
            {(job.required_documents || []).map(required=><label key={required} className="block text-sm">{required} <span className="text-rose-600">*</span>
              <select className={field+' mt-1'} value={requiredDocumentMap[required] || ''}
                onChange={e=>{
                  const value=e.target.value;
                  setRequiredDocumentMap(current=>({...current,[required]:value}));
                  if (value) setDocumentIds(current=>[...new Set([...current,value])]);
                }}>
                <option value="">{t('Choose a verified document')}</option>
                {documents.map(document=><option key={document.id} value={document.id}>{document.title} · {document.fileName}</option>)}
              </select></label>)}
          </div>}
          {documents.length > 0 && <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('Attach other documents (optional)')}</legend>
            {documents.map(document=><label key={document.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={documentIds.includes(document.id)}
                onChange={e=>setDocumentIds(current=>e.target.checked
                  ? [...new Set([...current,document.id])]
                  : current.filter(id=>id!==document.id))}/>
              <span>{document.title} <span className="text-xs text-slate-500">· {document.fileName}</span></span>
            </label>)}
          </fieldset>}
          {documents.length === 0 && <p className="text-xs text-slate-600">{t('No supporting documents are saved yet. Upload any documents required by this vacancy below.')}</p>}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-sm">{t('Document title')}
              <input className={field+' mt-1'} maxLength={120} value={documentTitle} onChange={e=>setDocumentTitle(e.target.value)} placeholder={t('e.g. Degree certificate')} /></label>
            <label className="block text-sm">{t('PDF or Word file')}
              <input className={field+' mt-1'} type="file" accept=".pdf,.doc,.docx" onChange={e=>setDocumentUpload(e.target.files?.[0] || null)} /></label>
            <button type="button" className={button+' bg-slate-800 text-white'} disabled={busy || !documentTitle.trim() || !documentUpload}
              onClick={()=>void uploadApplicationDocument()}>{busy?t('Working…'):t('Upload document')}</button>
          </div>
        </div>
      </section>}
      {step === 4 && <section className="space-y-4">
        <h2 className="font-semibold">{t('Review and declarations')}</h2>
        <p className="text-sm">{t('Position: {title}', { title: job.title })}</p>
        <p className="text-sm">{t('Applicant: {name}', { name: fullName || profile?.full_name || user.email })}</p>
        {phone && <p className="text-sm">{t('Contact phone: {phone}', { phone })}</p>}
        <p className="text-sm">{t('CV: {title}', { title: cvs.find(c=>c.id===cvId)?.title || t('Not selected') })}</p>
        <p className="text-sm">{t('Screening responses: {count}', { count: new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD').format(Object.keys(answers).length) })}</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" required checked={certified} onChange={e=>setCertified(e.target.checked)}/>
          <span>{t('I certify that the information supplied is complete and accurate.')} <span aria-hidden="true" className="text-rose-600">*</span></span></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>
          <span>{t('I consent to processing this information for recruitment.')} <span aria-hidden="true" className="text-rose-600">*</span></span></label>
      </section>}
      <div className="border-t pt-4 flex flex-wrap gap-3 justify-between">
        <button type="button" disabled={busy} onClick={() => void saveDraft()} className={button + ' border border-[#085587] text-[#085587]'}>{t('Save draft')}</button>
        <button className={button+' border border-slate-300'} onClick={()=>{ setStep(x=>Math.max(1,x-1));setError(''); }} disabled={step===1||busy}>{t('Previous')}</button>
        {step===4 ? <button disabled={busy || !consent || !certified} className={button+' bg-[#085587] text-white'} onClick={()=>void submit()}>
          {busy?t('Submitting…'):t('Submit application')}</button> :
          <button className={button+' bg-[#085587] text-white'} onClick={next} disabled={busy}>{t('Continue')}</button>}
      </div>
    </div>
  </main>;
}
