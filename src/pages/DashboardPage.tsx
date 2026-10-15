import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import { getRecruitmentContext, getSavedJobs, getCandidateCVs, markVerifiedCandidateNotificationRead } from '../lib/api';
import { candidateNotificationRoute } from '../lib/candidateNotificationRoutes';
import {
  Briefcase,
  Calendar,
  CheckSquare,
  Gift,
  FileText,
  Bookmark,
  Bell,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  UserCheck,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
  onSelectApplication?: (appId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onSelectApplication
}) => {
  const { user, profile } = useAuth();
  const { locale, t } = useCandidateLocale();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [pendingNotificationIds, setPendingNotificationIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadContext();
    }
  }, [user]);

  const loadContext = async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const ctx = await getRecruitmentContext(user.id);
      const saved = getSavedJobs(user.id);
      const cvs = getCandidateCVs(user.id);
      setData({
        ...ctx,
        saved_jobs: saved,
        cvs
      });
    } catch (cause) {
      setData(null);
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load records. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const markNotificationRead = async (notification: any) => {
    if (!user || !notification?.notification_type || notification.is_read === true
      || pendingNotificationIds.has(notification.id)) return;
    const actorId = user.id;
    setNotificationError(null);
    setPendingNotificationIds(current => new Set(current).add(notification.id));
    try {
      await markVerifiedCandidateNotificationRead(actorId, notification.id);
      if (user.id === actorId) {
        setData((current: any) => current ? ({
          ...current,
          notifications: current.notifications.map((item: any) =>
            item.id === notification.id ? { ...item, is_read: true } : item),
        }) : current);
      }
    } catch {
      setNotificationError(t('Unable to update this notification.'));
    } finally {
      setPendingNotificationIds(current => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
    }
  };

  // Profile completion calculation
  const calculateProfileScore = () => {
    if (!profile) return 30;
    let score = 20; // base account
    if (profile.full_name && profile.phone) score += 20;
    if (profile.headline && profile.summary) score += 20;
    if (profile.experiences && profile.experiences.length > 0) score += 15;
    if (profile.educations && profile.educations.length > 0) score += 15;
    if (profile.skills && profile.skills.length > 0) score += 10;
    return Math.min(100, score);
  };

  const profileScore = calculateProfileScore();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200"></div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">Unable to load your workspace</h1>
          <p role="alert" className="mt-3 text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            className="min-h-11 mt-4 rounded-lg border border-slate-300 px-4 font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => void loadContext()}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const applications = data?.applications || [];
  const interviews = data?.interviews || [];
  const assessments = data?.assessments || [];
  const docRequests = data?.document_requests || [];
  const offers = data?.offers || [];
  const savedJobs = data?.saved_jobs || [];
  const notifications = data?.notifications || [];

  const pendingInterviews = interviews.filter((i: any) => i.status === 'pending');
  const pendingAssessments = assessments.filter((a: any) => a.status === 'pending');
  const pendingDocs = docRequests.filter((d: any) => d.status === 'pending');
  const activeOffers = offers.filter((o: any) => o.status === 'extended');

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
              Candidate Workspace
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Welcome back, {profile?.full_name || user?.user_metadata?.full_name || 'Candidate'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Track your recruitment milestones, interview invitations, assessments, and job offers.
            </p>
          </div>

          {/* Profile completion card */}
          <div className="w-full md:w-64 bg-slate-50 border border-slate-200 rounded-xl p-4 shrink-0">
            <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
              <span className="text-slate-700">Profile Readiness</span>
              <span className="text-[#085587] font-mono">{profileScore}%</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#085587] h-full rounded-full transition-all duration-500"
                style={{ width: `${profileScore}%` }}
              ></div>
            </div>
            <button
              onClick={() => onNavigate('profile')}
              className="text-[11px] text-[#085587] font-semibold hover:underline mt-2 inline-flex items-center gap-1"
            >
              Update Candidate Profile <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Priority Action Alerts (if any) */}
        {(pendingInterviews.length > 0 ||
          pendingAssessments.length > 0 ||
          pendingDocs.length > 0 ||
          activeOffers.length > 0) && (
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#085587]">
              <Bell className="w-4 h-4" />
              <span>Items Requiring Your Attention</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {activeOffers.length > 0 && (
                <div
                  onClick={() => onNavigate('offers')}
                  className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs hover:border-emerald-400 cursor-pointer transition-all"
                >
                  <span className="text-[11px] font-bold text-emerald-700 uppercase block">
                    Job Offer Extended
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                    {activeOffers[0].job_title}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Review & respond before expiry</p>
                </div>
              )}

              {pendingInterviews.length > 0 && (
                <div
                  onClick={() => onNavigate('interviews')}
                  className="bg-white p-3 rounded-xl border border-sky-200 shadow-xs hover:border-sky-400 cursor-pointer transition-all"
                >
                  <span className="text-[11px] font-bold text-[#085587] uppercase block">
                    Interview Invitation
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                    {pendingInterviews[0].round_name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Accept or request reschedule</p>
                </div>
              )}

              {pendingAssessments.length > 0 && (
                <div
                  onClick={() => onNavigate('tasks')}
                  className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs hover:border-amber-400 cursor-pointer transition-all"
                >
                  <span className="text-[11px] font-bold text-amber-700 uppercase block">
                    Pending Assessment
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                    {pendingAssessments[0].title}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Due soon · Click to view</p>
                </div>
              )}

              {pendingDocs.length > 0 && (
                <div
                  onClick={() => onNavigate('tasks')}
                  className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:border-slate-400 cursor-pointer transition-all"
                >
                  <span className="text-[11px] font-bold text-slate-700 uppercase block">
                    Document Request
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                    {pendingDocs[0].title}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Upload required certificate</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigate('applications')}
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#085587] cursor-pointer transition-all shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Applications</span>
              <Briefcase className="w-4 h-4 text-[#085587]" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
              {applications.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">In recruitment pipeline</p>
          </div>

          <div
            onClick={() => onNavigate('interviews')}
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#085587] cursor-pointer transition-all shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Interviews</span>
              <Calendar className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
              {interviews.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {pendingInterviews.length} awaiting response
            </p>
          </div>

          <div
            onClick={() => onNavigate('tasks')}
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#085587] cursor-pointer transition-all shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tasks & Evidence</span>
              <CheckSquare className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-2">
              {assessments.length + docRequests.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {pendingAssessments.length + pendingDocs.length} pending
            </p>
          </div>

          <div
            onClick={() => onNavigate('offers')}
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#085587] cursor-pointer transition-all shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Job Offers</span>
              <Gift className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-2">{offers.length}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {activeOffers.length > 0 ? 'Active offer available' : 'Official contracts'}
            </p>
          </div>
        </div>

        {/* Two-Column Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main 2-span: Applications Summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">
                  Recent Applications & Status
                </h2>
                <button
                  onClick={() => onNavigate('applications')}
                  className="text-xs font-semibold text-[#085587] hover:underline"
                >
                  View All ({applications.length})
                </button>
              </div>

              {applications.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No applications submitted yet</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                    Explore active career opportunities and apply with your structured CV.
                  </p>
                  <button
                    onClick={() => onNavigate('jobs')}
                    className="py-1.5 px-4 bg-[#085587] text-white text-xs font-semibold rounded-lg"
                  >
                    Browse Open Roles
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {applications.slice(0, 3).map((app: any) => (
                    <div
                      key={app.id}
                      onClick={() => onNavigate('applications')}
                      className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono text-[11px]">{app.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>Submitted {new Date(app.submitted_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{app.job?.title || 'Open Position'}</h3>
                        <p className="text-xs text-slate-600">
                          Current Stage: <span className="font-semibold text-slate-800">{app.stage_label}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className="text-xs font-semibold text-[#085587] bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">
                          {app.candidate_visible_status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => onNavigate('cv-builder')}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs transition-all space-y-2"
              >
                <FileText className="w-6 h-6 text-[#085587]" />
                <h3 className="text-sm font-bold text-slate-900">Manage Structured CVs</h3>
                <p className="text-xs text-slate-500">
                  Update your education, experience, and export printable PDF CVs.
                </p>
              </div>

              <div
                onClick={() => onNavigate('saved-jobs')}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer shadow-xs transition-all space-y-2"
              >
                <Bookmark className="w-6 h-6 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Saved Jobs & Alerts</h3>
                <p className="text-xs text-slate-500">
                  {savedJobs.length} bookmarked opportunities and candidate search alerts.
                </p>
              </div>
            </div>
          </div>

          {/* Right Col: Notifications & Recruitment Timeline Guide */}
          <div className="space-y-6">
            {/* Notifications */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center justify-between">
                <span>{t('Recent Notifications')}</span>
                <Bell className="w-4 h-4 text-slate-400" />
              </h2>

              {data?.notification_load_error && <div role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
                <p>{t('Unable to load notifications. Please retry.')}</p>
                <button type="button" onClick={() => void loadContext()} className="mt-2 min-h-9 rounded-lg border border-rose-300 bg-white px-3 font-medium">
                  {t('Retry')}
                </button>
              </div>}
              {notificationError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{notificationError}</p>}
              {notifications.length === 0 && !data?.notification_load_error ? (
                <p className="text-xs text-slate-500 py-4 text-center">{t('No unread notifications.')}</p>
              ) : notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.slice(0, 4).map((n: any) => (
                    (() => {
                      const route = candidateNotificationRoute(n);
                      const isApplicationUpdate = n.notification_type === 'application_update';
                      const isRead = n.is_read === true || n.read === true;
                      const title = isApplicationUpdate ? t('Application update') : n.title;
                      const message = isApplicationUpdate
                        ? t('Your application has a new update. Open the application timeline to review it.')
                        : n.message;
                      const openNotification = () => {
                        if (route?.tab === 'applications' && route.applicationId) {
                          if (onSelectApplication) onSelectApplication(route.applicationId);
                          else onNavigate('applications');
                        } else if (route) onNavigate(route.tab);
                        else if (n.link) onNavigate(n.link.replace('/', ''));
                      };
                      const canOpen = Boolean(route || n.link);
                      return <article key={n.id} className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs space-y-2">
                        <div className="flex items-start justify-between gap-3 font-semibold text-slate-900">
                          <span className="min-w-0 break-words">{title}</span>
                          <time dateTime={n.created_at} className="shrink-0 text-[10px] font-normal text-slate-400">
                            {new Date(n.created_at).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-BD')}
                          </time>
                        </div>
                        <p className="break-words text-slate-600 text-[11px] leading-relaxed">{message}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {canOpen && <button type="button" onClick={openNotification}
                            className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 font-medium text-[#085587] hover:bg-sky-50">
                            {route?.tab === 'applications' ? t('Open application')
                              : route?.tab === 'saved-jobs' ? t('Open job alerts') : t('Open update')}
                          </button>}
                          {n.notification_type && <span className="text-[10px] text-slate-500">{isRead ? t('Read') : t('Unread')}</span>}
                          {n.notification_type && !isRead && <button type="button"
                            disabled={pendingNotificationIds.has(n.id)}
                            onClick={() => void markNotificationRead(n)}
                            className="min-h-9 rounded-lg px-2 font-medium text-slate-600 underline disabled:opacity-50">
                            {pendingNotificationIds.has(n.id) ? t('Updating…') : t('Mark read')}
                          </button>}
                        </div>
                      </article>;
                    })()
                  ))}
                </div>
              ) : null}
            </div>

            {/* Integration Transparency Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-3 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-sky-400">
                Integration Assurance
              </span>
              <h3 className="text-sm font-bold">Synesis HRMIS Connection</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your actions here persist directly into the shared Synesis HR database. Recruiters and hiring managers review submissions inside Main HRIS with strict privacy enforcement.
              </p>
              <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800 space-y-1">
                <p>• Internal recruiter evaluations remain confidential</p>
                <p>• You see real authorized stage progressions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
