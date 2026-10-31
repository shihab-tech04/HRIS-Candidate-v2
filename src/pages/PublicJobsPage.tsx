import React, { useState, useEffect, useRef } from 'react';
import { sortPublishedJobs } from '../lib/jobSort.mjs';
import { PublishedJob } from '../types';
import { getPublishedJobs, toggleVerifiedSavedJob, listVerifiedSavedJobIds } from '../lib/api';
import { formatRecruitmentDeadlineDate } from '../lib/recruitmentDeadline';
import { createLatestRequestGate } from '../lib/latestRequest.mjs';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import careersHero from '../assets/images/hero_synesis_careers_1791597880870.jpg';
import cultureImage from '../assets/images/synesis_culture_workspace_1791597892615.jpg';
import {
  Search,
  MapPin,
  Clock,
  Briefcase,
  Users,
  Bookmark,
  BookmarkCheck,
  ArrowRight,
  Filter,
  Calendar,
  DollarSign,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

interface PublicJobsPageProps {
  onSelectJob: (jobId: string) => void;
  onApplyJob: (jobId: string) => void;
  onOpenAuth: () => void;
  publicOnly?: boolean;
}

export const PublicJobsPage: React.FC<PublicJobsPageProps> = ({
  onSelectJob,
  onApplyJob,
  onOpenAuth,
  publicOnly = false
}) => {
  const { user } = useAuth();
  const { locale, t } = useCandidateLocale();
  const [jobs, setJobs] = useState<PublishedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedJobsError, setSavedJobsError] = useState<string | null>(null);
  const [savedJobsStatus, setSavedJobsStatus] = useState<{ key: string; title: string } | null>(null);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'default' | 'newest' | 'deadline' | 'title'>('default');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [searchVersion, setSearchVersion] = useState(0);
  const [department, setDepartment] = useState('All');
  const [workplaceType, setWorkplaceType] = useState('All');
  const [employmentType, setEmploymentType] = useState('All');
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [savingJobIds, setSavingJobIds] = useState<Set<string>>(new Set());
  const requestGate = useRef(createLatestRequestGate()).current;
  const activeUserId = useRef(user?.id);
  activeUserId.current = user?.id;

  useEffect(() => {
    const request = requestGate.open();
    setLoading(true);
    setLoadError(null);
    void getPublishedJobs({
      search: submittedSearch,
      department,
      workplace_type: workplaceType,
      employment_type: employmentType,
    }).then(data => {
      if (request.isCurrent()) setJobs(data);
    }).catch(error => {
      if (!request.isCurrent()) return;
      setJobs([]);
      setLoadError(error instanceof Error ? error.message : 'Unable to verify available jobs.');
    }).finally(() => {
      if (request.isCurrent()) setLoading(false);
    });
    return request.cancel;
  }, [submittedSearch, department, workplaceType, employmentType, searchVersion, requestGate]);

  useEffect(() => {
    let active = true;
    setSavedJobIds(new Set());
    setSavingJobIds(new Set());
    setSavedJobsError(null);
    setSavedJobsStatus(null);
    if (user && !publicOnly) {
      void listVerifiedSavedJobIds(user.id)
        .then(ids => { if (active) setSavedJobIds(new Set(ids)); })
        .catch(e => {
          if (active) setSavedJobsError(e instanceof Error ? e.message : 'Unable to load saved jobs.');
        });
    }
    return () => { active = false; };
  }, [user?.id, publicOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedSearch(search.trim());
    setSearchVersion(version => version + 1);
  };

  const handleToggleSave = async (job: PublishedJob, e: React.MouseEvent) => {
    e.stopPropagation();
    if (publicOnly || !user) { onOpenAuth(); return; }
    const userId = user.id;
    if (savingJobIds.has(job.id)) return;
    setSavingJobIds(prev => new Set(prev).add(job.id));
    setSavedJobsError(null);
    setSavedJobsStatus(null);
    try {
      const saved=await toggleVerifiedSavedJob(userId,job.id,job);
      if (activeUserId.current === userId) {
        setSavedJobIds(prev => {
          const next=new Set(prev);
          if (saved) next.add(job.id); else next.delete(job.id);
          return next;
        });
        setSavedJobsStatus({
          key: saved ? '{title} was saved to your account.' : '{title} was removed from saved jobs.',
          title: job.title,
        });
      }
    } catch (e) {
      if (activeUserId.current === userId) setSavedJobsError(e instanceof Error ? e.message : 'Unable to update saved job.');
    } finally {
      if (activeUserId.current === userId) {
        setSavingJobIds(prev => {
          const next=new Set(prev);
          next.delete(job.id);
          return next;
        });
      }
    }
  };

  const departments = ['All', 'Engineering', 'Product & Design', 'Data & AI', 'HR & People Ops'];
  const workplaceTypes = ['All', 'Hybrid', 'Remote', 'On-site'];
  const employmentTypes = ['All', 'Full-time', 'Contract', 'Part-time', 'Internship'];

  const sortedJobs = sortPublishedJobs(jobs, sortOrder) as PublishedJob[];

  // Format currency
  const formatSalary = (min?: number, max?: number, currency = 'BDT') => {
    if (!min && !max) return null;
    const formatNum = (num: number) =>
      new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { maximumFractionDigits: 0 }).format(num);

    if (min && max) {
      return `${currency} ${formatNum(min)} – ${formatNum(max)}`;
    }
    if (min) return t('From {currency} {amount}', { currency, amount: formatNum(min) });
    if (max) return t('Up to {currency} {amount}', { currency, amount: formatNum(max) });
    return null;
  };

  const formatDeadline = (isoString: string) => {
    const d = new Date(isoString);
    const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return t('Expired');
    if (diffDays === 0) return t('Closes today');
    if (diffDays === 1) return t('Closes tomorrow');
    return t('{count} days left', {
      count: new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD').format(diffDays),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {(loadError || savedJobsError) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="border border-rose-200 bg-rose-50 text-rose-800 rounded-lg p-3 text-sm flex flex-wrap items-center justify-between gap-3">
            <p role="alert">{t(loadError || savedJobsError || '')}</p>
            {loadError && (
              <button
                type="button"
                disabled={loading}
                onClick={() => setSearchVersion(version => version + 1)}
                className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-semibold text-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#085587] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('Retry')}
              </button>
            )}
          </div>
        </div>
      )}
      {savedJobsStatus && <p role="status" aria-live="polite" className="sr-only">{t(savedJobsStatus.key, { title: savedJobsStatus.title })}</p>}
      {/* Hero Section */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        {/* Background Image with Scrim */}
        <div className="absolute inset-0">
          <img
            src={careersHero}
            alt={t('Synesis Careers Workplace')}
            className="w-full h-full object-cover opacity-25"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-widest font-semibold text-sky-400 mb-3 block">
              {t('Official Synesis IT Careers')}
            </span>
            <h1
              id="candidate-careers-heading"
              tabIndex={-1}
              className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-6 leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {t('Build Mission-Critical Platforms That Move Nations Forward')}
            </h1>
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed mb-8">
              {t('Explore roles at Synesis IT. Candidate registration and applications are temporarily unavailable while privacy and access checks are completed.')}
            </p>

            {/* Quick Hero Highlights */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t('View verified published vacancies')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t('Search roles by department and work type')}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t('Applications will open after security testing')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-7 relative z-10">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-4 sm:p-5 mb-8">
          <form role="search" aria-label={t('Search vacancies')} onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  aria-label={t('Search vacancies')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('Search by job title, skill (TypeScript, Docker), or keyword...')}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#085587] focus:bg-white transition-all"
                />
              </div>
              <button
                type="submit"
                className="py-2.5 px-6 bg-[#085587] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#074771] transition-colors whitespace-nowrap shadow-sm flex items-center justify-center gap-2"
              >
                {t('Find Vacancies')}
              </button>
            </div>

            {/* Segmented Filter Controls */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> {t('Department:')}
                </span>
                <div role="group" aria-label={t('Department:')} className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-full min-w-0">
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      aria-pressed={department === dept}
                      onClick={() => setDepartment(dept)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        department === dept
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t(dept)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-500">{t('Workplace:')}</span>
                  <select
                    value={workplaceType}
                    aria-label={t('Workplace type')}
                    onChange={(e) => setWorkplaceType(e.target.value)}
                    className="bg-slate-100 border-none text-xs rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:ring-2 focus:ring-[#085587]"
                  >
                    {workplaceTypes.map((w) => (
                      <option key={w} value={w}>
                        {t(w)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-500">{t('Type:')}</span>
                  <select
                    value={employmentType}
                    aria-label={t('Employment type')}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="bg-slate-100 border-none text-xs rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:ring-2 focus:ring-[#085587]"
                  >
                    {employmentTypes.map((eType) => (
                      <option key={eType} value={eType}>
                        {t(eType)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Results Count & Subtitle */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4 px-1">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {t('Published Career Opportunities')}
            </h2>
            <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-slate-500">
              {loading ? t('Fetching active vacancies...') : loadError ? null : t('{count} active positions available', {
                count: new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD').format(jobs.length),
              })}
            </p>
          </div>
          <label htmlFor="candidate-vacancy-sort" className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            {t('Sort by:')}
            <select
              id="candidate-vacancy-sort"
              aria-label={t('Sort vacancies')}
              value={sortOrder}
              onChange={event => setSortOrder(event.target.value as typeof sortOrder)}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#085587]"
            >
              <option value="default">{t('Default order')}</option>
              <option value="newest">{t('Newest first')}</option>
              <option value="deadline">{t('Deadline soonest')}</option>
              <option value="title">{t('Title A–Z')}</option>
            </select>
          </label>
        </div>

        {/* Jobs List */}
        {loading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse space-y-3"
              >
                <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                <div className="h-4 bg-slate-100 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : loadError ? null : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 my-6">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-1">{t('No vacancies found')}</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              {t("We couldn't find any published roles matching your current filter criteria. Try adjusting your keywords or clearing filters.")}
            </p>
            <button
              onClick={() => {
                setSearch('');
                setSubmittedSearch('');
                setSearchVersion(version => version + 1);
                setDepartment('All');
                setWorkplaceType('All');
                setEmploymentType('All');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              {t('Reset All Filters')}
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-16">
            {sortedJobs.map((job) => {
              const salaryFormatted = formatSalary(
                job.published_salary_min,
                job.published_salary_max,
                job.salary_currency
              );
              const isSaved = savedJobIds.has(job.id);
              const deadlineText = formatDeadline(job.application_deadline);

              return (
                <div
                  key={job.id}
                  onClick={() => onSelectJob(job.id)}
                  className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200/90 hover:border-[#085587]/40 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      {/* Zero-Pill Metadata Line */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                        <span className="text-[#085587] font-semibold">{t(job.department)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{job.location}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t(job.workplace_type)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t(job.employment_type)}</span>
                      </div>

                      {/* Job Title */}
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#085587] transition-colors leading-snug">
                        <button
                          type="button"
                          className="text-left focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#085587]"
                          onClick={event => { event.stopPropagation(); onSelectJob(job.id); }}
                          aria-label={t('View vacancy: {title}', { title: job.title })}
                        >
                          {job.title}
                        </button>
                      </h3>

                      {/* Summary */}
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {job.summary}
                      </p>

                      {/* Bottom Details Row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2">
                        {salaryFormatted && (
                          <div className="flex items-center gap-1 font-semibold text-slate-800">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{salaryFormatted}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD').format(job.vacancy_count)} {t(job.vacancy_count === 1 ? 'vacancy' : 'vacancies')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span
                            className={
                              deadlineText === t('Closes today') || deadlineText === t('Closes tomorrow')
                                ? 'text-amber-600 font-medium'
                                : ''
                            }
                          >
                            {t('Deadline: {date} ({relative})', {
                              date: formatRecruitmentDeadlineDate(job.application_deadline, locale === 'bn' ? 'bn-BD' : 'en-BD'),
                              relative: deadlineText,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions on right */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => handleToggleSave(job, e)}
                        title={isSaved ? t('Remove from Saved Jobs') : t('Save Job for Later')}
                        aria-label={isSaved ? t('Remove {title} from saved jobs', { title: job.title }) : t('Save {title} for later', { title: job.title })}
                        aria-pressed={isSaved}
                        aria-busy={savingJobIds.has(job.id)}
                        disabled={publicOnly || savingJobIds.has(job.id)}
                        className={`p-2 rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSaved
                            ? 'bg-amber-50 border-amber-200 text-amber-600'
                            : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-4 h-4 fill-amber-500 text-amber-500" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={publicOnly}
                        title={publicOnly ? t('Applications will open after security testing') : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyJob(job.id);
                        }}
                        className="py-2 px-4 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors whitespace-nowrap shadow-sm flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('Apply Now')}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Culture / Value Section */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center">
            <div className="p-8 sm:p-12 space-y-4">
              <span className="text-xs uppercase font-semibold tracking-wider text-[#085587]">
                {t('Workplace & Engineering Culture')}
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-snug">
                {t('Engineering at Scale with Purpose')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {t('Explore career opportunities at Synesis IT and learn how our teams collaborate on digital products and services.')}
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <p className="font-bold text-slate-900 text-base">{t('Collaborative teams')}</p>
                  <p className="text-slate-500">{t('Across technical disciplines')}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-base">{t('Engineering practices')}</p>
                  <p className="text-slate-500">{t('Focused on reliable delivery')}</p>
                </div>
              </div>
            </div>
            <div className="h-64 sm:h-80 lg:h-full">
              <img
                src={cultureImage}
                alt={t('Synesis team collaboration')}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
