import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import { JobApplication, InterviewInvitation } from '../types';
import { getRecruitmentContext, withdrawApplication } from '../lib/api';
import {
  FileText,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Building,
  Shield,
  Send,
  Eye,
  CornerDownRight
} from 'lucide-react';

interface ApplicationsPageProps {
  onNavigate: (tab: string) => void;
  selectedAppId?: string;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  onNavigate,
  selectedAppId
}) => {
  const { user } = useAuth();
  const { locale, t } = useCandidateLocale();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(selectedAppId || null);

  // Withdrawal modal state
  const [withdrawModalApp, setWithdrawModalApp] = useState<JobApplication | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const withdrawalDialogRef = useRef<HTMLDivElement | null>(null);
  const withdrawingRef = useRef(false);

  const stageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      draft: 'Draft',
      applied: 'Application Submitted',
      submitted: 'Application Submitted',
      under_review: 'Under Review',
      screening: 'Screening in Progress',
      interview_scheduled: 'Interview Scheduled',
      interview_completed: 'Interview Under Evaluation',
      assessment_pending: 'Assessment Pending',
      offer_extended: 'Offer Extended',
      offer_accepted: 'Offer Accepted',
      offer_declined: 'Offer Declined',
      withdrawn: 'Application Withdrawn',
      rejected: 'Not Selected',
      hired: 'Hired',
    };
    const key = stage.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
    return t(labels[key] || stage.trim().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()));
  };

  const timelineDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('Date unavailable') : date.toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-US');
  };

  const submittedDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('Date unavailable') : date.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US');
  };

  const openWithdrawalDialog = (application: JobApplication) => {
    setWithdrawReason('');
    setActionError(null);
    setWithdrawModalApp(application);
  };

  const closeWithdrawalDialog = () => {
    if (withdrawingRef.current) return;
    setWithdrawModalApp(null);
    setWithdrawReason('');
    setActionError(null);
  };

  useEffect(() => {
    if (!withdrawModalApp) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !withdrawingRef.current) {
        event.preventDefault();
        closeWithdrawalDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = withdrawalDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled])'
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === withdrawalDialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.requestAnimationFrame(() => withdrawalDialogRef.current?.focus());
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [withdrawModalApp]);

  useEffect(() => {
    loadApplications();
  }, [user]);

  const loadApplications = async () => {
    if (!user) { setApplications([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const ctx = await getRecruitmentContext(user.id);
      setApplications(ctx.applications || []); if (!expandedAppId && ctx.applications?.length > 0) setExpandedAppId(ctx.applications[0].id);
    } catch (cause) {
      setApplications([]);
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load records. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawModalApp || !withdrawReason.trim()) return;

    withdrawingRef.current = true;
    setWithdrawing(true);
    setActionError(null);

    try {
      const res = await withdrawApplication(withdrawModalApp.id, withdrawReason.trim());
      if (!res.success) {
        setActionError(t('We could not withdraw your application. Please try again.'));
      } else {
        setWithdrawModalApp(null);
        setWithdrawReason('');
        await loadApplications();
      }
    } catch {
      setActionError(t('We could not withdraw your application. Please try again.'));
    } finally {
      withdrawingRef.current = false;
      setWithdrawing(false);
    }
  };

  if (loadError) return <main className="max-w-4xl mx-auto px-4 py-16">
    <h1 className="text-xl font-semibold">{t('Unable to load applications')}</h1>
    <p role="alert" className="mt-3 text-sm text-red-700">{t('Your applications could not be loaded. Please try again.')}</p>
    <button type="button" className="min-h-11 mt-4 px-4 rounded-lg border" onClick={() => void loadApplications()}>{t('Retry')}</button>
  </main>;
  if (loading) {
    return (
      <div role="status" aria-label={t('Loading applications')} className="max-w-5xl mx-auto px-4 py-16">
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-white rounded-2xl border border-slate-200"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
              {t('Application Lifecycle Tracking')}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{t('My Applications')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('Authorized real-time stage progression across Synesis HRIS recruitment pipelines.')}
            </p>
          </div>
          <button
            onClick={() => onNavigate('jobs')}
            className="min-h-11 px-4 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors self-start sm:self-auto shadow-xs"
          >
            {t('Browse Open Roles')}
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center my-8">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800 mb-1">{t('No Applications Yet')}</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
              {t("You haven't submitted any job applications yet. Review our active vacancies and start your journey.")}
            </p>
            <button
              onClick={() => onNavigate('jobs')}
              className="min-h-11 px-6 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors"
            >
              {t('Explore Published Vacancies')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const isExpanded = expandedAppId === app.id;
              const isWithdrawn = app.status === 'withdrawn';
              const isRejected = app.status === 'rejected';

              return (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                >
                  {/* Card Header Summary */}
                  <div
                    onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setExpandedAppId(isExpanded ? null : app.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={t('Application history for {title}', { title: app.job?.title || app.job_title || t('Applied Position') })}
                    aria-expanded={isExpanded}
                    aria-controls={`application-history-${app.id}`}
                    className="p-5 sm:p-6 cursor-pointer hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#085587]"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono text-slate-600 font-semibold">{app.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t(app.job?.department || app.department || 'Department')}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t('Submitted {date}', { date: submittedDate(app.submitted_at) })}</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        {app.job?.title || app.job_title || t('Applied Position')}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-center">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-lg border ${
                          isWithdrawn
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : isRejected
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-sky-50 text-[#085587] border-sky-100'
                        }`}
                      >
                        {stageLabel(app.status || app.candidate_visible_status)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Body */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-5 sm:p-6 bg-slate-50/50 space-y-6">
                      <section id={`application-history-${app.id}`} aria-label={t('Application history')}>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                          {t('Application History')}
                        </h3>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                          {(app.stage_history || []).length === 0 ? (
                            <p role="status" className="text-xs text-slate-500">{t('No application history updates are available yet.')}</p>
                          ) : app.stage_history?.map((entry, index) => {
                            const current = index === (app.stage_history?.length || 0) - 1;
                            const withdrawn = entry.stage.toLowerCase() === 'withdrawn';
                            return <div key={entry.id} className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                withdrawn ? 'bg-slate-100 text-slate-500' : current ? 'bg-sky-100 text-[#085587] ring-4 ring-sky-50' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {current ? <Clock className="w-4 h-4" /> : withdrawn ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0 text-xs">
                                <p className="font-bold text-slate-900">{stageLabel(entry.stage)}</p>
                                <p className="text-slate-500">{timelineDate(entry.created_at)}</p>
                                {entry.note && <p className="mt-1 break-words text-slate-600">{t(entry.note)}</p>}
                              </div>
                            </div>;
                          })}
                        </div>
                      </section>

                      {/* Application Snapshot & Answers */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                            {t('Submission Details')}
                          </h4>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('Attached CV:')}</span>
                            <span className="font-semibold text-slate-800">{app.cv_title}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('Workplace:')}</span>
                            <span className="text-slate-800">{t(app.job?.workplace_type || '')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('Legal Consent:')}</span>
                            <span className="text-emerald-700 font-semibold">{t('Granted')}</span>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                          <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                            {t('Screening Responses')}
                          </h4>
                          {Object.keys(app.screening_answers || {}).length === 0 ? (
                            <p className="text-slate-400">{t('No custom screening fields required.')}</p>
                          ) : (
                            <div className="space-y-1.5">
                              {Object.entries(app.screening_answers).map(([key, val]) => (
                                <div key={key} className="text-xs">
                                  <span className="text-slate-500 font-mono text-[10px] uppercase">
                                    {key}:
                                  </span>{' '}
                                  <span className="font-semibold text-slate-800">{String(val)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cover letter if provided */}
                      {app.cover_letter && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1 text-xs">
                          <h4 className="font-bold text-slate-800">{t('Submitted Cover Note:')}</h4>
                          <p className="text-slate-600 leading-relaxed italic">
                            "{app.cover_letter}"
                          </p>
                        </div>
                      )}

                      {/* Action buttons (Withdraw, Interiews, Offers) */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onNavigate('interviews')}
                            className="min-h-11 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {t('Check Interviews')}
                          </button>
                          <button
                            onClick={() => onNavigate('tasks')}
                            className="min-h-11 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {t('Assessments & Documents')}
                          </button>
                        </div>

                        {!isWithdrawn && !isRejected && (
                          <button
                            type="button"
                            onClick={() => openWithdrawalDialog(app)}
                            className="min-h-11 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {t('Withdraw Application')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Withdrawal Confirmation Modal */}
        {withdrawModalApp && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div ref={withdrawalDialogRef} role="dialog" aria-modal="true" aria-labelledby="withdraw-application-title" aria-describedby="withdraw-application-description" tabIndex={-1} className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 focus:outline-none">
              <div className="flex items-center gap-2.5 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 id="withdraw-application-title" className="text-base font-bold text-slate-900">{t('Withdraw Application')}</h3>
              </div>
              <p id="withdraw-application-description" className="text-xs text-slate-600 leading-relaxed">
                {t('Are you sure you want to withdraw your application for {title}? Once withdrawn, this position will no longer progress in Main HRIS.', { title: withdrawModalApp.job?.title || withdrawModalApp.job_title || t('Applied Position') })}
              </p>

              {actionError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                <div>
                  <label htmlFor="withdraw-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('Reason for Withdrawal *')}
                  </label>
                  <select
                    id="withdraw-reason"
                    required
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                    className="min-h-11 w-full px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  >
                    <option value="">{t('Select a reason...')}</option>
                    <option value="Accepted another job offer">{t('Accepted another job offer')}</option>
                    <option value="Location / Commute constraints">{t('Location / Commute constraints')}</option>
                    <option value="Compensation expectations mismatch">{t('Compensation expectations mismatch')}</option>
                    <option value="Personal / Family circumstances">{t('Personal / Family circumstances')}</option>
                    <option value="Other">{t('Other')}</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeWithdrawalDialog}
                    disabled={withdrawing}
                    className="min-h-11 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={withdrawing || !withdrawReason}
                    className="min-h-11 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {withdrawing ? t('Processing...') : t('Confirm Withdrawal')}
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
