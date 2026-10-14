import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
  const userId = user?.id;
  const [jobs, setJobs] = useState<PublishedJob[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<VerifiedCandidateJobAlert[]>([]);
  const [notifications, setNotifications] = useState<VerifiedCandidateNotification[]>([]);
  const [alertInput, setAlertInput] = useState<VerifiedCandidateJobAlertInput>(emptyAlert);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingAlert, setSubmittingAlert] = useState(false);
  const [pendingAlertIds, setPendingAlertIds] = useState<Set<string>>(new Set());
  const [pendingNotificationIds, setPendingNotificationIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const requestSequence = useRef(0);
  const activeUserId = useRef(userId);
  activeUserId.current = userId;

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
      setError(cause instanceof Error ? cause.message : 'Saved jobs and alerts unavailable.');
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
      if (activeUserId.current === actorId) setError(cause instanceof Error ? cause.message : 'Unable to remove saved job.');
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
    setSubmittingAlert(true);
    setError('');
    setNotice('');
    try {
      const created = await createVerifiedCandidateJobAlert(actorId, alertInput);
      if (activeUserId.current !== actorId) return;
      setAlertInput(emptyAlert);
      setAlerts(current => [created, ...current]);
      setNotice(`“${created.title}” is active. Matching newly published roles will appear here as in-app notifications.`);
    } catch (cause) {
      if (activeUserId.current === actorId) setError(cause instanceof Error ? cause.message : 'Unable to save this job alert.');
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
        setNotice(`“${alert.title}” was removed.`);
      }
    } catch (cause) {
      if (activeUserId.current === actorId) setError(cause instanceof Error ? cause.message : 'Unable to remove this job alert.');
    } finally {
      if (activeUserId.current === actorId) {
        setPendingAlertIds(prev => { const next = new Set(prev); next.delete(alert.id); return next; });
      }
    }
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
      if (activeUserId.current === actorId) setError(cause instanceof Error ? cause.message : 'Unable to update this notification.');
    } finally {
      if (activeUserId.current === actorId) {
        setPendingNotificationIds(prev => { const next = new Set(prev); next.delete(notification.id); return next; });
      }
    }
  }

  const action = 'border rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-[#085587] disabled:opacity-50';
  const field = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#085587]';
  if (!userId) return <main className="max-w-4xl mx-auto p-8 space-y-3">
    <h1 className="text-2xl font-bold">Saved jobs and alerts</h1>
    <p className="text-sm">Please sign in to manage saved jobs and job alerts.</p>
    <button className={action} onClick={onOpenAuth}>Sign in</button>
  </main>;

  return <main className="min-h-screen bg-slate-50 p-5 md:p-8">
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Saved jobs and alerts</h1>
        <p className="text-sm text-slate-600">Your saved vacancies, matching-role alerts and updates.</p>
      </header>

      {error && <div role="alert" className="bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 rounded-lg">
        <p>{error}</p>
        <button className={action + ' mt-2'} disabled={loading || submittingAlert} onClick={() => void refresh()}>Retry</button>
      </div>}
      {notice && <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{notice}</p>}
      {loading && <p role="status">Loading saved jobs and alerts…</p>}

      <section aria-labelledby="saved-jobs-heading" className="space-y-3">
        <h2 id="saved-jobs-heading" className="text-lg font-semibold">My saved jobs</h2>
        {!loading && !error && jobs.length === 0 && unavailable.length === 0 && <p className="text-sm text-slate-500">No saved jobs yet.</p>}
        {jobs.map(job => <article className="bg-white rounded-xl border p-5 space-y-3" key={job.id}>
          <h3 className="font-semibold text-lg">{job.title}</h3>
          <p className="text-sm text-slate-600">{job.department} · {job.location} · Apply by {job.application_deadline}</p>
          <div className="flex flex-wrap gap-2">
            <button className={action + ' bg-[#085587] text-white'} onClick={() => onApplyJob(job.id)}>Apply</button>
            <button className={action} onClick={() => onSelectJob(job.id)}>Details</button>
            <button className={action} disabled={removingIds.has(job.id)} onClick={() => void removeSavedJob(job.id)}>
              {removingIds.has(job.id) ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </article>)}
        {unavailable.map(id => <article className="bg-white rounded-xl border p-5 flex flex-wrap items-center justify-between gap-3" key={id}>
          <p className="text-sm">This saved vacancy is no longer published.</p>
          <button className={action} disabled={removingIds.has(id)} onClick={() => void removeSavedJob(id)}>
            {removingIds.has(id) ? 'Removing…' : 'Remove from saved jobs'}
          </button>
        </article>)}
      </section>

      <section aria-labelledby="job-alerts-heading" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div>
            <h2 id="job-alerts-heading" className="text-lg font-semibold">Create a job alert</h2>
            <p className="mt-1 text-sm text-slate-600">Get an in-app notification when a newly published vacancy matches these filters.</p>
          </div>
          <form className="space-y-3" onSubmit={event => void submitAlert(event)}>
            <label className="block space-y-1 text-sm font-medium">
              <span>Alert name</span>
              <input className={field} required maxLength={120} value={alertInput.title}
                onChange={event => setAlertInput(current => ({ ...current, title: event.target.value }))}
                placeholder="Engineering roles in Dhaka" />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>Keywords</span>
              <input className={field} value={alertInput.keywords || ''}
                onChange={event => setAlertInput(current => ({ ...current, keywords: event.target.value }))}
                placeholder="PostgreSQL, platform engineering" />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>Department</span>
              <input className={field} value={alertInput.department || ''}
                onChange={event => setAlertInput(current => ({ ...current, department: event.target.value }))} />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>Location</span>
              <input className={field} value={alertInput.location || ''}
                onChange={event => setAlertInput(current => ({ ...current, location: event.target.value }))} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                <span>Workplace type</span>
                <select className={field} value={alertInput.workplace_type || ''}
                  onChange={event => setAlertInput(current => ({ ...current, workplace_type: event.target.value }))}>
                  <option value="">Any workplace</option><option>On-site</option><option>Hybrid</option><option>Remote</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                <span>Employment type</span>
                <select className={field} value={alertInput.employment_type || ''}
                  onChange={event => setAlertInput(current => ({ ...current, employment_type: event.target.value }))}>
                  <option value="">Any employment type</option><option>Full-time</option><option>Part-time</option>
                  <option>Contract</option><option>Internship</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-500">Alerts run instantly for new matching vacancies. Notifications appear in this page; email delivery is not configured by this workflow.</p>
            <button className={action + ' bg-[#085587] text-white'} disabled={loading || submittingAlert}>
              {submittingAlert ? 'Saving alert…' : 'Save job alert'}
            </button>
          </form>
        </div>

        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">My job alerts</h2>
            <p className="mt-1 text-sm text-slate-600">Active matching rules saved to your account.</p>
          </div>
          {!loading && !error && alerts.length === 0 && <p className="text-sm text-slate-500">You have no job alerts yet.</p>}
          <ul className="space-y-3">
            {alerts.map(alert => <li className="rounded-lg border p-4" key={alert.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h3 className="font-medium">{alert.title}</h3>
                  <p className="text-xs text-slate-600">Instant · {alert.is_active ? 'Active' : 'Paused'}</p>
                  <p className="text-xs text-slate-500">{[alert.keywords, alert.department, alert.location, alert.workplace_type, alert.employment_type].filter(Boolean).join(' · ') || 'Matches any new vacancy'}</p>
                </div>
                <button className={action} disabled={pendingAlertIds.has(alert.id)}
                  aria-label={`Remove ${alert.title} alert`} onClick={() => void removeAlert(alert)}>
                  {pendingAlertIds.has(alert.id) ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="job-alert-notifications-heading" className="rounded-xl border bg-white p-5 space-y-4">
        <div>
          <h2 id="job-alert-notifications-heading" className="text-lg font-semibold">Matching job notifications</h2>
          <p className="mt-1 text-sm text-slate-600">Newly published vacancies that matched your alerts.</p>
        </div>
        {!loading && !error && notifications.length === 0 && <p className="text-sm text-slate-500">No matching job notifications yet.</p>}
        <ul className="space-y-3">
          {notifications.map(notification => <li key={notification.id} className={`rounded-lg border p-4 ${notification.is_read ? 'bg-white' : 'bg-sky-50 border-sky-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h3 className="font-medium">{notification.title}</h3>
                <p className="text-sm text-slate-600">{notification.message}</p>
                <p className="text-xs text-slate-500">{new Date(notification.created_at).toLocaleString()} · {notification.is_read ? 'Read' : 'Unread'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {notification.related_job_id && <button className={action} onClick={() => onSelectJob(notification.related_job_id!)}>View job</button>}
                {!notification.is_read && <button className={action} disabled={pendingNotificationIds.has(notification.id)}
                  onClick={() => void markNotificationRead(notification)}>
                  {pendingNotificationIds.has(notification.id) ? 'Updating…' : 'Mark read'}
                </button>}
              </div>
            </div>
          </li>)}
        </ul>
      </section>
    </div>
  </main>;
}
