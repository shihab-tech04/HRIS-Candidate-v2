import React, { useState, useEffect } from 'react';
import { PublishedJob } from '../types';
import { getPublishedJobs, toggleVerifiedSavedJob, listVerifiedSavedJobIds } from '../lib/api';
import { useAuth } from '../context/AuthContext';
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
  const [jobs, setJobs] = useState<PublishedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [workplaceType, setWorkplaceType] = useState('All');
  const [employmentType, setEmploymentType] = useState('All');
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadJobs();
    if (user && !publicOnly) {
      void listVerifiedSavedJobIds(user.id)
        .then(ids => setSavedJobIds(new Set(ids)))
        .catch(e => setLoadError(e instanceof Error ? e.message : 'Unable to load saved jobs.'));
    } else {
      setSavedJobIds(new Set());
    }
  }, [user, department, workplaceType, employmentType]);

  const loadJobs = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getPublishedJobs({
        search,
        department,
        workplace_type: workplaceType,
        employment_type: employmentType
      });
      setJobs(data);
    } catch (error) {
      setJobs([]);
      setLoadError(error instanceof Error ? error.message : 'Unable to verify available jobs.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadJobs();
  };

  const handleToggleSave = async (job: PublishedJob, e: React.MouseEvent) => {
    e.stopPropagation();
    if (publicOnly || !user) { onOpenAuth(); return; }
    try {
      const saved=await toggleVerifiedSavedJob(user.id,job.id,job);
      setSavedJobIds(prev => {
        const next=new Set(prev);
        if (saved) next.add(job.id); else next.delete(job.id);
        return next;
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Unable to update saved job.');
    }
  };

  const departments = ['All', 'Engineering', 'Product & Design', 'Data & AI', 'HR & People Ops'];
  const workplaceTypes = ['All', 'Hybrid', 'Remote', 'On-site'];
  const employmentTypes = ['All', 'Full-time', 'Contract', 'Part-time'];

  // Format currency
  const formatSalary = (min?: number, max?: number, currency = 'BDT') => {
    if (!min && !max) return null;
    const formatNum = (num: number) =>
      new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(num);

    if (min && max) {
      return `${currency} ${formatNum(min)} – ${formatNum(max)} / mo`;
    }
    if (min) return `From ${currency} ${formatNum(min)} / mo`;
    if (max) return `Up to ${currency} ${formatNum(max)} / mo`;
    return null;
  };

  const formatDeadline = (isoString: string) => {
    const d = new Date(isoString);
    const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Closes today';
    if (diffDays === 1) return 'Closes tomorrow';
    return `${diffDays} days left`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {loadError && (
        <div role="alert" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="border border-rose-200 bg-rose-50 text-rose-800 rounded-lg p-3 text-sm">{loadError}</p>
        </div>
      )}
      {/* Hero Section */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        {/* Background Image with Scrim */}
        <div className="absolute inset-0">
          <img
            src={careersHero}
            alt="Synesis Careers Workplace"
            className="w-full h-full object-cover opacity-25"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-widest font-semibold text-sky-400 mb-3 block">
              Official Synesis IT Careers
            </span>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
              Build Mission-Critical Platforms That Move Nations Forward
            </h1>
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed mb-8">
              Explore roles at Synesis IT. Candidate registration and applications are temporarily unavailable while privacy and access checks are completed.
            </p>

            {/* Quick Hero Highlights */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>View verified published vacancies</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Search roles by department and work type</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Applications will open after security testing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-7 relative z-10">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-4 sm:p-5 mb-8">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  aria-label="Search vacancies"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by job title, skill (TypeScript, Docker), or keyword..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#085587] focus:bg-white transition-all"
                />
              </div>
              <button
                type="submit"
                className="py-2.5 px-6 bg-[#085587] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#074771] transition-colors whitespace-nowrap shadow-sm flex items-center justify-center gap-2"
              >
                Find Vacancies
              </button>
            </div>

            {/* Segmented Filter Controls */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Department:
                </span>
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-full min-w-0">
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setDepartment(dept)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        department === dept
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-500">Workplace:</span>
                  <select
                    value={workplaceType}
                    aria-label="Workplace type"
                    onChange={(e) => setWorkplaceType(e.target.value)}
                    className="bg-slate-100 border-none text-xs rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:ring-2 focus:ring-[#085587]"
                  >
                    {workplaceTypes.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-500">Type:</span>
                  <select
                    value={employmentType}
                    aria-label="Employment type"
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="bg-slate-100 border-none text-xs rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:ring-2 focus:ring-[#085587]"
                  >
                    {employmentTypes.map((eType) => (
                      <option key={eType} value={eType}>
                        {eType}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Results Count & Subtitle */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Published Career Opportunities
            </h2>
            <p className="text-xs text-slate-500">
              {loading ? 'Fetching active vacancies...' : `${jobs.length} active positions available`}
            </p>
          </div>
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
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 my-6">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 mb-1">No vacancies found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              We couldn't find any published roles matching your current filter criteria. Try adjusting your keywords or clearing filters.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setDepartment('All');
                setWorkplaceType('All');
                setEmploymentType('All');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-16">
            {jobs.map((job) => {
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
                        <span className="text-[#085587] font-semibold">{job.department}</span>
                        <span aria-hidden="true">·</span>
                        <span>{job.location}</span>
                        <span aria-hidden="true">·</span>
                        <span>{job.workplace_type}</span>
                        <span aria-hidden="true">·</span>
                        <span>{job.employment_type}</span>
                      </div>

                      {/* Job Title */}
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#085587] transition-colors leading-snug">
                        {job.title}
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
                            {job.vacancy_count} {job.vacancy_count === 1 ? 'vacancy' : 'vacancies'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span
                            className={
                              deadlineText.includes('today') || deadlineText.includes('tomorrow')
                                ? 'text-amber-600 font-medium'
                                : ''
                            }
                          >
                            Deadline: {new Date(job.application_deadline).toLocaleDateString()} ({deadlineText})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions on right */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => handleToggleSave(job, e)}
                        title={isSaved ? 'Remove from Saved Jobs' : 'Save Job for Later'}
                        className={`p-2 rounded-lg border transition-colors ${
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyJob(job.id);
                        }}
                        className="py-2 px-4 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors whitespace-nowrap shadow-sm flex items-center gap-1.5"
                      >
                        Apply Now
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
                Workplace & Engineering Culture
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-snug">
                Engineering at Scale with Purpose
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Explore career opportunities at Synesis IT and learn how our teams collaborate on digital products and services.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <p className="font-bold text-slate-900 text-base">Collaborative teams</p>
                  <p className="text-slate-500">Across technical disciplines</p>
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-base">Engineering practices</p>
                  <p className="text-slate-500">Focused on reliable delivery</p>
                </div>
              </div>
            </div>
            <div className="h-64 sm:h-80 lg:h-full">
              <img
                src={cultureImage}
                alt="Synesis team collaboration"
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
