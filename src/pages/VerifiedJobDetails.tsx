import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import { PublishedJob } from '../types';
import { getPublishedJobById, listVerifiedSavedJobIds, toggleVerifiedSavedJob } from '../lib/api';
import { formatRecruitmentDeadlineDate } from '../lib/recruitmentDeadline';

type Props = {
  jobId: string;
  onBack: () => void;
  onApply: (id: string) => void;
  onOpenAuth: (reason?: string) => void;
  publicOnly?: boolean;
};

export default function VerifiedJobDetails({ jobId, onBack, onApply, onOpenAuth, publicOnly = false }: Props) {
  const { user } = useAuth();
  const { locale, t } = useCandidateLocale();
  const userId = user?.id;
  const [job, setJob] = useState<PublishedJob | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ key: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retrySequence, setRetrySequence] = useState(0);
  const detailsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const unavailableRef = useRef<HTMLParagraphElement | null>(null);
  const requestSequence = useRef(0);
  const toggleInFlight = useRef(false);
  const activeUserId = useRef(userId);
  activeUserId.current = userId;

  useEffect(() => {
    let active = true;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setJob(null);
    setSaved(false);
    setBusy(false);
    setError('');
    setStatus(null);

    void (async () => {
      try {
        const currentJob = await getPublishedJobById(jobId);
        if (!active || requestId !== requestSequence.current) return;
        setJob(currentJob);
        if (userId && !publicOnly && currentJob) {
          const savedJobIds = await listVerifiedSavedJobIds(userId);
          if (active && requestId === requestSequence.current && activeUserId.current === userId) {
            setSaved(savedJobIds.includes(currentJob.id));
          }
        }
      } catch (cause) {
        if (active && requestId === requestSequence.current && activeUserId.current === userId) {
          setError(cause instanceof Error ? cause.message : 'Could not load job.');
        }
      } finally {
        if (active && requestId === requestSequence.current) setLoading(false);
      }
    })();

    return () => {
      active = false;
      requestSequence.current += 1;
    };
  }, [jobId, publicOnly, retrySequence, userId]);

  useEffect(() => {
    if (!publicOnly || loading) return;
    if (job) detailsHeadingRef.current?.focus();
    else if (!error) unavailableRef.current?.focus();
  }, [error, job, loading, publicOnly]);

  async function toggle() {
    if (!job) return;
    if (publicOnly || !userId) {
      onOpenAuth('Saved jobs are not available during the public preview.');
      return;
    }
    if (toggleInFlight.current) return;

    const actorId = userId;
    toggleInFlight.current = true;
    setBusy(true);
    setError('');
    setStatus(null);
    try {
      const isSaved = await toggleVerifiedSavedJob(actorId, job.id, job);
      if (activeUserId.current === actorId) {
        setSaved(isSaved);
        setStatus({
          key: isSaved ? '{title} was saved to your account.' : '{title} was removed from saved jobs.',
          title: job.title,
        });
      }
    } catch (cause) {
      if (activeUserId.current === actorId) setError(cause instanceof Error ? cause.message : 'Could not update saved jobs.');
    } finally {
      toggleInFlight.current = false;
      if (activeUserId.current === actorId) setBusy(false);
    }
  }

  const button = 'rounded-lg px-4 py-2.5 text-sm font-semibold border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#085587] disabled:cursor-not-allowed disabled:opacity-50';
  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <article className="max-w-4xl mx-auto bg-white border rounded-xl p-6 space-y-5">
      <button type="button" onClick={onBack} className={button}>{t('Back to jobs')}</button>
      {error && <div role="alert" className="p-3 bg-rose-50 text-rose-700 text-sm space-y-2">
        <p>{t(error)}</p>
        <button type="button" className={button} disabled={loading} onClick={() => setRetrySequence(value => value + 1)}>{t('Retry')}</button>
      </div>}
      {status && <p role="status" aria-live="polite" className="sr-only">{t(status.key, { title: status.title })}</p>}
      {loading ? <p role="status" aria-live="polite" className="text-sm text-slate-500">{t('Loading vacancy…')}</p>
        : !job ? <p ref={unavailableRef} tabIndex={publicOnly ? -1 : undefined} className="text-sm text-slate-500">{t('Vacancy not available or cannot be verified.')}</p> : <>
          <h1
            ref={detailsHeadingRef}
            tabIndex={publicOnly ? -1 : undefined}
            className="text-2xl font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#085587]"
          >
            {job.title}
          </h1>
          <p className="text-sm">{t(job.department)} · {job.location} · {t(job.employment_type)}</p>
          <p className="text-sm">{t('Application deadline: {date}', { date: formatRecruitmentDeadlineDate(job.application_deadline, locale === 'bn' ? 'bn-BD' : 'en-BD') })}</p>
          {job.salary_is_public && job.published_salary_min != null && <p className="text-sm">
            {t('Published salary:')} {job.salary_currency || 'BDT'} {new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD').format(job.published_salary_min)}
            {job.published_salary_max != null ? ` – ${new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD').format(job.published_salary_max)}` : ''}
          </p>}
          <p className="text-sm whitespace-pre-line">{job.summary}</p>
          {([['Responsibilities', job.responsibilities], ['Requirements', job.requirements],
            ['Benefits', job.benefits || []]] as [string, string[]][]).map(([label, rows]) =>
              <section key={label}>
                <h2 className="font-semibold">{t(label)}</h2>
                {rows.length ? <ul className="list-disc ml-6 text-sm space-y-1">
                  {rows.map((value, index) => <li key={index}>{value}</li>)}
                </ul> : <p className="text-sm text-slate-500">{t('Refer to circular.')}</p>}
              </section>)}
          <div className="flex gap-3 flex-wrap border-t pt-4">
            <button
              type="button"
              onClick={() => onApply(job.id)}
              disabled={publicOnly}
              title={publicOnly ? t('Applications will open after security testing') : undefined}
              aria-describedby={publicOnly ? 'candidate-public-safety-notice' : undefined}
              className={button + ' bg-[#085587] text-white'}
            >{t('Apply')}</button>
            <button
              type="button"
              disabled={publicOnly || busy || loading}
              title={publicOnly ? t('Saved jobs are unavailable during the public preview.') : undefined}
              aria-describedby={publicOnly ? 'candidate-public-safety-notice' : undefined}
              onClick={() => void toggle()}
              aria-label={saved ? t('Remove {title} from saved jobs', { title: job.title }) : t('Save {title} for later', { title: job.title })}
              aria-pressed={saved}
              aria-busy={busy}
              className={button}
            >
              {busy ? (saved ? t('Removing…') : t('Saving…')) : saved ? t('Remove saved job') : t('Save job')}
            </button>
          </div>
        </>}
    </article>
  </main>;
}
