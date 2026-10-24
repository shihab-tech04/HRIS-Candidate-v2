import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import { PublishedJob } from '../types';
import {
  createVerifiedCandidateJobAlert,
  deleteVerifiedCandidateJobAlert,
  getPublishedJobs,
  listVerifiedCandidateJobAlerts,
  listVerifiedJobAlertNotifications,
  listVerifiedSavedJobIds,
  markVerifiedJobAlertNotificationRead,
  toggleVerifiedSavedJob,
  VerifiedCandidateJobAlert,
  VerifiedCandidateJobAlertInput,
  VerifiedCandidateNotification,
  setVerifiedCandidateJobAlertActive,
  updateVerifiedCandidateJobAlert,
} from '../lib/api';

interface Props {
  onSelectJob: (id: string) => void;
  onApplyJob: (id: string) => void;
  onOpenAuth: () => void;
}

const emptyAlert: VerifiedCandidateJobAlertInput = {
  title: '', keywords: '', department: '', location: '', workplace_type: '', employment_type: '',
};

export default function VerifiedSavedJobsPage({ onSelectJob, onApplyJob, onOpenAuth }: Props) {
  const { user } = useAuth();
  const { locale, t } = useCandidateLocale();
  const userId = user?.id;
  const [jobs, setJobs] = useState<PublishedJob[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<VerifiedCandidateJobAlert[]>([]);
  const [notifications, setNotifications] = useState<VerifiedCandidateNotification[]>([]);
  const [alertInput, setAlertInput] = useState<VerifiedCandidateJobAlertInput>(emptyAlert);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingAlert, setSubmittingAlert] = useState(false);
  const [pendingAlertIds, setPendingAlertIds] = useState<Set<string>>(new Set());
  const [pendingNotificationIds, setPendingNotificationIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const requestSequence = useRef(0);
  const activeUserId = useRef(userId);
  const translateRef = useRef(t);
  activeUserId.current = userId;
  translateRef.current = t;

  function localizedError(cause: unknown, fallback: string) {
    const message = cause instanceof Error ? cause.message : fallback;
    const translated = translateRef.current(message);
    return translated === message ? translateRef.current(fallback) : translated;
  }

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!userId) {
      setJobs([]);
      setUnavailable([]);
      setAlerts([]);
      setNotifications([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [ids, published, candidateAlerts, candidateNotifications] = await Promise.all([
        listVerifiedSavedJobIds(userId), getPublishedJobs(),
        listVerifiedCandidateJobAlerts(userId), listVerifiedJobAlertNotifications(userId),
      ]);
      if (requestId !== requestSequence.current) return;
      setJobs(published.filter(job => ids.includes(job.id)));
      setUnavailable(ids.filter(id => !published.some(job => job.id === id)));
      setAlerts(candidateAlerts);
      setNotifications(candidateNotifications);
    } catch (cause) {
      if (requestId !== requestSequence.current) return;
      setJobs([]);
      setUnavailable([]);
      setAlerts([]);
      setNotifications([]);
      setError(localizedError(cause, 'Saved jobs and alerts unavailable.'));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setJobs([]);
    setUnavailable([]);
    setAlerts([]);
    setNotifications([]);
    setRemovingIds(new Set());
    setPendingAlertIds(new Set());
    setPendingNotificationIds(new Set());
    setAlertInput(emptyAlert);
    setEditingAlertId(null);
    setNotice('');
    void refresh();
    return () => { requestSequence.current += 1; };
  }, [refresh]);

  async function removeSavedJob(id: string) {
    if (!userId || removingIds.has(id)) return;
    const actorId = userId;
    setRemovingIds(prev => new Set(prev).add(id));
    setError('');
    try {
      await toggleVerifiedSavedJob(actorId, id);
      if (activeUserId.current === actorId) await refresh();
    } catch (cause) {
      if (activeUserId.current === actorId) setError(localizedError(cause, 'Unable to remove saved job.'));
    } finally {
      if (activeUserId.current === actorId) {
        setRemovingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      }
    }
  }

  async function submitAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || submittingAlert) return;
    const actorId = userId;
    const alertIdBeingEdited = editingAlertId;
    setSubmittingAlert(true);
    setError('');
    setNotice('');
    try {
      const saved = alertIdBeingEdited
        ? await updateVerifiedCandidateJobAlert(actorId, alertIdBeingEdited, alertInput)
        : await createVerifiedCandidateJobAlert(actorId, alertInput);
      if (activeUserId.current !== actorId) return;
      setAlertInput(emptyAlert);
      setEditingAlertId(null);
      if (alertIdBeingEdited) {
        setAlerts(current => current.map(alert => alert.id === alertIdBeingEdited ? saved : alert));
        setNotice(t('“{title}” was updated.', { title: saved.title }));
      } else {
        setAlerts(current => [saved, ...current]);
        setNotice(t('“{title}” is active. Matching newly published roles will appear here as in-app notifications.', { title: saved.title }));
      }
    } catch (cause) {
      if (activeUserId.current === actorId) setError(localizedError(cause, 'Unable to save this job alert.'));
    } finally {
      if (activeUserId.current === actorId) setSubmittingAlert(false);
    }
  }

  async function removeAlert(alert: VerifiedCandidateJobAlert) {
    if (!userId || pendingAlertIds.has(alert.id)) return;
    const actorId = userId;
    setPendingAlertIds(prev => new Set(prev).add(alert.id));
    setError('');
    try {
      await deleteVerifiedCandidateJobAlert(actorId, alert.id);
      if (activeUserId.current === actorId) {
        setAlerts(current => current.filter(item => item.id !== alert.id));
        if (editingAlertId === alert.id) {
          setEditingAlertId(null);
          setAlertInput(emptyAlert);
        }
        setNotice(t('“{title}” was removed.', { title: alert.title }));
      }
    } catch (cause) {
      if (activeUserId.current === actorId) setError(localizedError(cause, 'Unable to remove this job alert.'));
    } finally {
      if (activeUserId.current === actorId) {
        setPendingAlertIds(prev => { const next = new Set(prev); next.delete(alert.id); return next; });
      }
    }
  }

  async function setAlertActive(alert: VerifiedCandidateJobAlert, isActive: boolean) {
    if (!userId || pendingAlertIds.has(alert.id)) return;
    const actorId = userId;
    setPendingAlertIds(prev => new Set(prev).add(alert.id));
    setError('');
    setNotice('');
    try {
      const updated = await setVerifiedCandidateJobAlertActive(actorId, alert.id, isActive);
      if (activeUserId.current === actorId) {
        setAlerts(current => current.map(item => item.id === alert.id ? updated : item));
        setNotice(t(isActive ? '“{title}” is active.' : '“{title}” is paused.', { title: updated.title }));
      }
    } catch (cause) {
      if (activeUserId.current === actorId) setError(localizedError(cause, 'Unable to update this job alert.'));
    } finally {
      if (activeUserId.current === actorId) {
        setPendingAlertIds(prev => { const next = new Set(prev); next.delete(alert.id); return next; });
      }
    }
  }

  function editAlert(alert: VerifiedCandidateJobAlert) {
    setEditingAlertId(alert.id);
    setAlertInput({
      title: alert.title,
      keywords: alert.keywords || '',
      department: alert.department || '',
      location: alert.location || '',
      workplace_type: alert.workplace_type || '',
      employment_type: alert.employment_type || '',
    });
    setError('');
    setNotice('');
    document.getElementById('job-alert-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function markNotificationRead(notification: VerifiedCandidateNotification) {
    if (!userId || notification.is_read || pendingNotificationIds.has(notification.id)) return;
    const actorId = userId;
    setPendingNotificationIds(prev => new Set(prev).add(notification.id));
    setError('');
    try {
      await markVerifiedJobAlertNotificationRead(actorId, notification.id);
      if (activeUserId.current === actorId) {
        setNotifications(current => current.map(item => item.id === notification.id ? { ...item, is_read: true } : item));
      }
    } catch (cause) {
      if (activeUserId.current === actorId) setError(localizedError(cause, 'Unable to update this notification.'));
    } finally {
      if (activeUserId.current === actorId) {
        setPendingNotificationIds(prev => { const next = new Set(prev); next.delete(notification.id); return next; });
      }
    }
  }

  const action = 'border rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-[#085587] disabled:opacity-50';
  const field = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#085587]';
  if (!userId) return <main className="max-w-4xl mx-auto p-8 space-y-3">
    <h1 className="text-2xl font-bold">{t('Saved jobs and alerts')}</h1>
    <p className="text-sm">{t('Please sign in to manage saved jobs and job alerts.')}</p>
    <button className={action} onClick={onOpenAuth}>{t('Sign in')}</button>
  </main>;

  return <main className="min-h-screen bg-slate-50 p-5 md:p-8">
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t('Saved jobs and alerts')}</h1>
        <p className="text-sm text-slate-600">{t('Your saved vacancies, matching-role alerts and updates.')}</p>
      </header>

      {error && <div role="alert" className="bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 rounded-lg">
        <p>{error}</p>
        <button className={action + ' mt-2'} disabled={loading || submittingAlert} onClick={() => void refresh()}>{t('Retry')}</button>
      </div>}
      {notice && <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{notice}</p>}
      {loading && <p role="status">{t('Loading saved jobs and alerts…')}</p>}

      <section aria-labelledby="saved-jobs-heading" className="space-y-3">
        <h2 id="saved-jobs-heading" className="text-lg font-semibold">{t('My saved jobs')}</h2>
        {!loading && !error && jobs.length === 0 && unavailable.length === 0 && <p className="text-sm text-slate-500">{t('No saved jobs yet.')}</p>}
        {jobs.map(job => <article className="bg-white rounded-xl border p-5 space-y-3" key={job.id}>
          <h3 className="font-semibold text-lg">{job.title}</h3>
          <p className="text-sm text-slate-600">{job.department} · {job.location} · {t('Apply by {date}', { date: job.application_deadline })}</p>
          <div className="flex flex-wrap gap-2">
            <button className={action + ' bg-[#085587] text-white'} onClick={() => onApplyJob(job.id)}>{t('Apply')}</button>
            <button className={action} onClick={() => onSelectJob(job.id)}>{t('Details')}</button>
            <button className={action} disabled={removingIds.has(job.id)} onClick={() => void removeSavedJob(job.id)}>
              {removingIds.has(job.id) ? t('Removing…') : t('Remove')}
            </button>
          </div>
        </article>)}
        {unavailable.map(id => <article className="bg-white rounded-xl border p-5 flex flex-wrap items-center justify-between gap-3" key={id}>
          <p className="text-sm">{t('This saved vacancy is no longer published.')}</p>
          <button className={action} disabled={removingIds.has(id)} onClick={() => void removeSavedJob(id)}>
            {removingIds.has(id) ? t('Removing…') : t('Remove from saved jobs')}
          </button>
        </article>)}
      </section>

      <section aria-labelledby="job-alerts-heading" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div>
            <h2 id="job-alerts-heading" className="text-lg font-semibold">{t(editingAlertId ? 'Edit job alert' : 'Create a job alert')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('Get an in-app notification when a newly published vacancy matches these filters.')}</p>
          </div>
          <form id="job-alert-form" className="space-y-3" onSubmit={event => void submitAlert(event)}>
            <label className="block space-y-1 text-sm font-medium">
              <span>{t('Alert name')}</span>
              <input className={field} required maxLength={120} value={alertInput.title}
                onChange={event => setAlertInput(current => ({ ...current, title: event.target.value }))}
                placeholder={t('Engineering roles in Dhaka')} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>{t('Keywords')}</span>
              <input className={field} value={alertInput.keywords || ''}
                onChange={event => setAlertInput(current => ({ ...current, keywords: event.target.value }))}
                placeholder={t('PostgreSQL, platform engineering')} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>{t('Department')}</span>
              <input className={field} value={alertInput.department || ''}
                onChange={event => setAlertInput(current => ({ ...current, department: event.target.value }))} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>{t('Location')}</span>
              <input className={field} value={alertInput.location || ''}
                onChange={event => setAlertInput(current => ({ ...current, location: event.target.value }))} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                <span>{t('Workplace type')}</span>
                <select className={field} value={alertInput.workplace_type || ''}
                  onChange={event => setAlertInput(current => ({ ...current, workplace_type: event.target.value }))}>
                  <option value="">{t('Any workplace')}</option><option>On-site</option><option>Hybrid</option><option>Remote</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                <span>{t('Employment type')}</span>
                <select className={field} value={alertInput.employment_type || ''}
                  onChange={event => setAlertInput(current => ({ ...current, employment_type: event.target.value }))}>
                  <option value="">{t('Any employment type')}</option><option>Full-time</option><option>Part-time</option>
                  <option>Contract</option><option>Internship</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-500">{t('Alerts run instantly for new matching vacancies. Notifications appear in this page; email delivery is not configured by this workflow.')}</p>
            <div className="flex flex-wrap gap-2">
              <button className={action + ' bg-[#085587] text-white'} disabled={loading || submittingAlert}>
                {submittingAlert ? t(editingAlertId ? 'Updating alert…' : 'Saving alert…') : t(editingAlertId ? 'Update job alert' : 'Save job alert')}
              </button>
              {editingAlertId && <button type="button" className={action} disabled={submittingAlert}
                onClick={() => { setEditingAlertId(null); setAlertInput(emptyAlert); }}>
                {t('Cancel edit')}
              </button>}
            </div>
          </form>
        </div>

        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t('My job alerts')}</h2>
            <p className="mt-1 text-sm text-slate-600">{t('Active matching rules saved to your account.')}</p>
          </div>
          {!loading && !error && alerts.length === 0 && <p className="text-sm text-slate-500">{t('You have no job alerts yet.')}</p>}
          <ul className="space-y-3">
            {alerts.map(alert => <li className="rounded-lg border p-4" key={alert.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h3 className="font-medium">{alert.title}</h3>
                  <p className="text-xs text-slate-600">{t('Instant')} · {alert.is_active ? t('Active') : t('Paused')}</p>
                  <p className="text-xs text-slate-500">{[alert.keywords, alert.department, alert.location, t(alert.workplace_type || ''), t(alert.employment_type || '')].filter(Boolean).join(' · ') || t('Matches any new vacancy')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={action} disabled={pendingAlertIds.has(alert.id)}
                    aria-label={t(alert.is_active ? 'Pause {title} alert' : 'Resume {title} alert', { title: alert.title })}
                    onClick={() => void setAlertActive(alert, !alert.is_active)}>
                    {t(alert.is_active ? 'Pause' : 'Resume')}
                  </button>
                  <button className={action} disabled={pendingAlertIds.has(alert.id)}
                    aria-label={t('Edit {title} alert', { title: alert.title })} onClick={() => editAlert(alert)}>
                    {t('Edit')}
                  </button>
                  <button className={action} disabled={pendingAlertIds.has(alert.id)}
                    aria-label={t('Remove {title} alert', { title: alert.title })} onClick={() => void removeAlert(alert)}>
                    {pendingAlertIds.has(alert.id) ? t('Removing…') : t('Remove')}
                  </button>
                </div>
              </div>
            </li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="job-alert-notifications-heading" className="rounded-xl border bg-white p-5 space-y-4">
        <div>
          <h2 id="job-alert-notifications-heading" className="text-lg font-semibold">{t('Matching job notifications')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('Newly published vacancies that matched your alerts.')}</p>
        </div>
        {!loading && !error && notifications.length === 0 && <p className="text-sm text-slate-500">{t('No matching job notifications yet.')}</p>}
        <ul className="space-y-3">
          {notifications.map(notification => <li key={notification.id} className={`rounded-lg border p-4 ${notification.is_read ? 'bg-white' : 'bg-sky-50 border-sky-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h3 className="font-medium">{t(notification.title)}</h3>
                <p className="text-sm text-slate-600">{t(notification.message)}</p>
                <p className="text-xs text-slate-500">{new Date(notification.created_at).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-US')} · {notification.is_read ? t('Read') : t('Unread')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {notification.related_job_id && <button className={action} onClick={() => onSelectJob(notification.related_job_id!)}>{t('View job')}</button>}
                {!notification.is_read && <button className={action} disabled={pendingNotificationIds.has(notification.id)}
                  onClick={() => void markNotificationRead(notification)}>
                  {pendingNotificationIds.has(notification.id) ? t('Updating…') : t('Mark read')}
                </button>}
              </div>
            </div>
          </li>)}
        </ul>
      </section>
    </div>
  </main>;
}
