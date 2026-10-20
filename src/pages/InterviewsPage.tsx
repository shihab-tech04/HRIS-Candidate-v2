import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import { InterviewInvitation } from '../types';
import { getRecruitmentContext, respondToInterview } from '../lib/api';
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  XCircle,
  RotateCcw,
  User,
  AlertCircle,
  ExternalLink,
  Users
} from 'lucide-react';

interface InterviewsPageProps {
  onNavigate: (tab: string) => void;
}

export const InterviewsPage: React.FC<InterviewsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { locale, t } = useCandidateLocale();
  const [interviews, setInterviews] = useState<InterviewInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Response modal state
  const [activeInterview, setActiveInterview] = useState<InterviewInvitation | null>(null);
  const [responseAction, setResponseAction] = useState<
    'accepted' | 'declined' | 'reschedule_requested' | null
  >(null);
  const [candidateNotes, setCandidateNotes] = useState('');
  const [proposedAvailability, setProposedAvailability] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const responseDialogRef = useRef<HTMLDivElement | null>(null);
  const submittingRef = useRef(false);

  const loadInterviews = useCallback(async () => {
    const requestId = ++requestSequence.current;
    const userId = user?.id;
    if (!userId) { setInterviews([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const ctx = await getRecruitmentContext(userId);
      if (requestId !== requestSequence.current) return;
      setInterviews(ctx.interviews || []);
    } catch (cause) {
      if (requestId !== requestSequence.current) return;
      setInterviews([]);
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load records. Please retry.');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadInterviews();
    return () => { requestSequence.current += 1; };
  }, [loadInterviews]);

  const openActionModal = (
    inv: InterviewInvitation,
    action: 'accepted' | 'declined' | 'reschedule_requested'
  ) => {
    setActiveInterview(inv);
    setResponseAction(action);
    setCandidateNotes('');
    setProposedAvailability('');
    setError(null);
  };

  const closeResponseDialog = () => {
    if (submittingRef.current) return;
    setActiveInterview(null);
    setResponseAction(null);
    setCandidateNotes('');
    setProposedAvailability('');
    setError(null);
  };

  useEffect(() => {
    if (!activeInterview || !responseAction) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        closeResponseDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = responseDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled])'
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === responseDialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const focusFrame = window.requestAnimationFrame(() => responseDialogRef.current?.focus());
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [activeInterview, responseAction]);

  const formatInterviewDate = (value: string, timezone?: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('Date unavailable');
    try {
      return new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        ...(timezone ? { timeZone: timezone } : {}),
      }).format(date);
    } catch {
      return t('Date unavailable');
    }
  };

  const formatInterviewTime = (value: string, timezone?: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('Time unavailable');
    try {
      return new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-US', {
        hour: '2-digit', minute: '2-digit', ...(timezone ? { timeZone: timezone } : {}),
      }).format(date);
    } catch {
      return t('Time unavailable');
    }
  };

  const handleResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInterview || !responseAction) return;

    if (responseAction === 'reschedule_requested' && (!candidateNotes.trim() || !proposedAvailability.trim())) {
      setError(t('Provide both a reason and your proposed availability.'));
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const res = await respondToInterview(activeInterview.id, responseAction, candidateNotes, proposedAvailability);
      if (!res.success) {
        setError(t('Failed to submit interview response. Please try again.'));
      } else {
        setActiveInterview(null);
        setResponseAction(null);
        setCandidateNotes('');
        setProposedAvailability('');
        await loadInterviews();
      }
    } catch {
      setError(t('Failed to submit interview response. Please try again.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loadError) return <main className="max-w-4xl mx-auto px-4 py-16">
    <h1 className="text-xl font-semibold">{t('Unable to load interviews')}</h1>
    <p role="alert" className="mt-3 text-sm text-red-700">{t('Your interviews could not be loaded. Please try again.')}</p>
    <button type="button" className="min-h-11 mt-4 px-4 rounded-lg border" onClick={() => void loadInterviews()}>{t('Retry')}</button>
  </main>;
  if (loading) {
    return (
      <div role="status" aria-label={t('Loading interviews')} className="max-w-4xl mx-auto px-4 py-16">
        <div className="space-y-4 animate-pulse">
          <div className="h-44 bg-white rounded-2xl border border-slate-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
            {t('Recruitment Stages')}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{t('Interview Invitations')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('Confirmed date/time slots, video links, panel members, and candidate response handling.')}
          </p>
        </div>

        {interviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800 mb-1">{t('No Interviews Scheduled')}</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {t('When our hiring committee invites you to an interview round, it will appear here with instructions and meeting coordinates.')}
            </p>
            <button
              onClick={() => onNavigate('applications')}
              className="min-h-11 px-4 bg-[#085587] text-white text-xs font-semibold rounded-lg"
            >
              {t('Check My Applications')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {interviews.map((inv) => {
              const isPending = inv.status === 'pending';
              const isAccepted = inv.status === 'accepted';
              const isDeclined = inv.status === 'declined';
              const isReschedule = inv.status === 'reschedule_requested';
              const isCompleted = inv.status === 'completed';
              const isCancelled = inv.status === 'cancelled';

              return (
                <article
                  key={inv.id}
                  aria-labelledby={`interview-round-${inv.id}`}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-[#085587]">{inv.department}</span>
                        <span aria-hidden="true">·</span>
                        <span>{inv.job_title}</span>
                      </div>
                      <h2 id={`interview-round-${inv.id}`} className="text-lg font-bold text-slate-900">{inv.round_name}</h2>
                    </div>

                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-lg border self-start ${
                        isAccepted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isDeclined
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : isReschedule
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : isCompleted
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : isCancelled
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : 'bg-sky-50 text-[#085587] border-sky-200'
                      }`}
                    >
                      {isAccepted
                        ? t('Confirmed / Accepted')
                        : isDeclined
                        ? t('Declined by Candidate')
                        : isReschedule
                        ? t('Reschedule Requested')
                        : isCompleted
                        ? t('Completed')
                        : isCancelled
                        ? t('Cancelled')
                        : t('Action Required (Pending Response)')}
                    </span>
                  </div>

                  {/* Schedule Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#085587]" />
                      <div>
                        <p className="text-slate-500 text-[11px]">{t('Scheduled Date')}</p>
                        <p className="font-semibold text-slate-800">
                          {formatInterviewDate(inv.scheduled_at, inv.timezone)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#085587]" />
                      <div>
                        <p className="text-slate-500 text-[11px]">{t('Time & Duration')}</p>
                        <p className="font-semibold text-slate-800">
                          {formatInterviewTime(inv.scheduled_at, inv.timezone)}{' '}
                          {t('({minutes} mins)', { minutes: new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-US').format(inv.duration_minutes) })}{inv.timezone ? ` · ${inv.timezone}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-[#085587]" />
                      <div>
                        <p className="text-slate-500 text-[11px]">{t('Format')}</p>
                        <p className="font-semibold text-slate-800">{t(inv.format)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Panel Members & Meeting URL */}
                  <div className="space-y-2 text-xs">
                    {inv.meeting_link && (
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="font-semibold text-slate-700">{t('Video Link:')}</span>
                        <a
                          href={inv.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 break-all text-[#085587] font-medium hover:underline inline-flex items-center gap-1"
                        >
                          {inv.meeting_link} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {inv.location && (
                      <div className="flex min-w-0 items-start gap-2">
                        <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-700">{t('Interview location:')}</span>
                          <p className="break-words text-slate-600">{inv.location}</p>
                        </div>
                      </div>
                    )}

                    {inv.interviewers && inv.interviewers.length > 0 && (
                      <div className="flex min-w-0 flex-wrap items-start gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">{t('Panel Interviewers:')}</span>
                        <span className="min-w-0 break-words font-medium text-slate-800">
                          {inv.interviewers.join(', ')}
                        </span>
                      </div>
                    )}

                    {inv.instructions && (
                      <div className="pt-2 text-slate-600 bg-sky-50/50 p-3 rounded-lg border border-sky-100">
                        <p className="font-semibold text-slate-800 mb-0.5">{t('Instructions for Candidate:')}</p>
                        <p className="leading-relaxed">{inv.instructions}</p>
                      </div>
                    )}

                    {inv.candidate_notes && (
                      <div className="pt-1 text-slate-600 text-[11px]">
                        <span className="font-semibold text-slate-800">{t('Your Note to HR:')}</span> "
                        {inv.candidate_notes}"
                      </div>
                    )}
                    {inv.candidate_proposed_times && (
                      <div className="pt-1 text-[11px] text-amber-800">
                        <span className="font-semibold">{t('Your proposed availability:')}</span> {inv.candidate_proposed_times}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  {isPending && (
                    <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => openActionModal(inv, 'reschedule_requested')}
                        className="min-h-11 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t('Request Reschedule')}
                      </button>

                      <button
                        type="button"
                        onClick={() => openActionModal(inv, 'declined')}
                        className="min-h-11 px-3 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t('Decline')}
                      </button>

                      <button
                        type="button"
                        onClick={() => openActionModal(inv, 'accepted')}
                        className="min-h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('Accept Invitation')}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Modal for response confirmation */}
        {activeInterview && responseAction && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div ref={responseDialogRef} role="dialog" aria-modal="true" aria-labelledby="interview-response-title" aria-describedby="interview-response-description" tabIndex={-1} className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 focus:outline-none">
              <h3 id="interview-response-title" className="text-base font-bold text-slate-900">
                {responseAction === 'accepted' && t('Accept Interview Invitation')}
                {responseAction === 'declined' && t('Decline Interview Invitation')}
                {responseAction === 'reschedule_requested' && t('Request Alternative Time Slot')}
              </h3>

              <p id="interview-response-description" className="text-xs text-slate-600">
                {t('Round:')} <strong>{activeInterview.round_name}</strong> ({activeInterview.job_title})
              </p>

              {error && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleResponseSubmit} className="space-y-4">
                <div>
                  <label htmlFor="candidate-interview-response-note" className="block text-xs font-semibold text-slate-700 mb-1">
                    {responseAction === 'reschedule_requested'
                      ? t('Reason for requesting another time *')
                      : t('Optional Note to Synesis Talent Committee')}
                  </label>
                  <textarea
                    id="candidate-interview-response-note"
                    rows={3}
                    required={responseAction === 'reschedule_requested'}
                    value={candidateNotes}
                    onChange={(e) => setCandidateNotes(e.target.value)}
                    placeholder={
                      responseAction === 'reschedule_requested'
                        ? t('e.g. I have a prior commitment during this slot. I am available anytime on Wednesday between 2 PM - 6 PM...')
                        : t('e.g. Looking forward to discussing the system architecture...')
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                {responseAction === 'reschedule_requested' && <div>
                  <label htmlFor="candidate-proposed-times" className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('Proposed alternative date and time *')}
                  </label>
                  <textarea id="candidate-proposed-times" rows={3} required
                    value={proposedAvailability}
                    onChange={event => setProposedAvailability(event.target.value)}
                    placeholder={t('e.g. Wednesday 14 October, between 2:00 PM and 5:00 PM (Asia/Dhaka)')}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]" />
                </div>}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeResponseDialog}
                    disabled={submitting}
                    className="min-h-11 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`min-h-11 px-4 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 ${
                      responseAction === 'accepted'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : responseAction === 'declined'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-[#085587] hover:bg-[#074771]'
                    }`}
                  >
                    {submitting ? t('Updating...') : t('Confirm Response')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
