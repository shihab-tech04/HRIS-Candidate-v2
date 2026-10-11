import React, { useState, useEffect } from 'react';
import { PublishedJob } from '../types';
import { getPublishedJobById, toggleSaveJob, getSavedJobs } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Calendar,
  Users,
  DollarSign,
  Share2,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Building,
  ShieldCheck
} from 'lucide-react';

interface JobDetailsPageProps {
  jobId: string;
  onBack: () => void;
  onApply: (jobId: string) => void;
  onOpenAuth: (returnNotice?: string) => void;
}

export const JobDetailsPage: React.FC<JobDetailsPageProps> = ({
  jobId,
  onBack,
  onApply,
  onOpenAuth
}) => {
  const { user } = useAuth();
  const [job, setJob] = useState<PublishedJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  useEffect(() => {
    if (user && job) {
      const saved = getSavedJobs(user.id);
      setIsSaved(saved.some((s) => s.job_id === job.id));
    }
  }, [user, job]);

  const loadJob = async () => {
    setLoading(true);
    const data = await getPublishedJobById(jobId);
    setJob(data);
    setLoading(false);
  };

  const handleToggleSave = () => {
    if (!job) return;
    if (!user) {
      onOpenAuth('Please sign in to save jobs to your candidate profile.');
      return;
    }
    const saved = toggleSaveJob(user.id, job);
    setIsSaved(saved);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleApplyClick = () => {
    if (!job) return;
    if (!user) {
      onOpenAuth(`Please sign in or register to submit your application for "${job.title}".`);
      return;
    }
    onApply(job.id);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          <div className="h-8 bg-slate-200 rounded w-3/4"></div>
          <div className="h-24 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Vacancy Not Found</h2>
        <p className="text-xs text-slate-500 mb-6">
          The requested position does not exist or may have been un-published by HR.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#085587] text-white text-xs font-semibold rounded-lg"
        >
          Back to Open Roles
        </button>
      </div>
    );
  }

  const isExpired = new Date(job.application_deadline).getTime() < Date.now();
  const formatSalary = (min?: number, max?: number, currency = 'BDT') => {
    if (!min && !max) return null;
    const formatNum = (num: number) =>
      new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(num);

    if (min && max) {
      return `${currency} ${formatNum(min)} – ${formatNum(max)} per month`;
    }
    if (min) return `From ${currency} ${formatNum(min)} per month`;
    if (max) return `Up to ${currency} ${formatNum(max)} per month`;
    return null;
  };

  const salaryDisplay = formatSalary(
    job.published_salary_min,
    job.published_salary_max,
    job.salary_currency
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#085587] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Vacancies
        </button>

        {/* Expired / Closed Notice */}
        {(isExpired || job.status !== 'published') && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Applications Closed</p>
              <p className="mt-0.5">
                The application window for this vacancy has expired or been closed by Synesis Recruitment. You may browse other active vacancies.
              </p>
            </div>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm mb-6">
          <div className="space-y-3">
            {/* Zero-Pill Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="text-[#085587] font-semibold">{job.department}</span>
              <span aria-hidden="true">·</span>
              <span>{job.location}</span>
              <span aria-hidden="true">·</span>
              <span>{job.workplace_type}</span>
              <span aria-hidden="true">·</span>
              <span>{job.employment_type}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {job.title}
            </h1>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-600 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                <span>
                  <strong>{job.vacancy_count}</strong> {job.vacancy_count === 1 ? 'position' : 'positions'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>
                  Deadline: <strong>{new Date(job.application_deadline).toLocaleDateString()}</strong>
                </span>
              </div>

              {salaryDisplay && (
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>{salaryDisplay}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 mt-6 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSave}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors ${
                  isSaved
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 text-amber-600" />
                    Saved to Profile
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4 text-slate-500" />
                    Save Vacancy
                  </>
                )}
              </button>

              <button
                onClick={handleShare}
                className="py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
                {copied ? 'Link Copied!' : 'Share Opportunity'}
              </button>
            </div>

            <button
              onClick={handleApplyClick}
              disabled={isExpired || job.status !== 'published'}
              className="py-2.5 px-6 bg-[#085587] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#074771] transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Apply for this Position
            </button>
          </div>
        </div>

        {/* Detailed Content */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-8">
          {/* Summary */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3">
              Role Summary & Mission
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {job.summary}
            </p>
          </div>

          {/* Key Responsibilities */}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3">
                Key Responsibilities
              </h2>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                {job.responsibilities.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#085587] mt-2 shrink-0"></span>
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Qualifications & Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3">
                Required Qualifications & Skills
              </h2>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && job.benefits.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-3">
                What We Offer at Synesis IT
              </h2>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                {job.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-2 shrink-0"></span>
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Screening preview note */}
          {job.screening_questions && job.screening_questions.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#085587]" />
                Application Screening Notice
              </p>
              <p>
                This vacancy includes {job.screening_questions.length} job-specific qualification questions configured by hiring managers in Synesis HRIS Main. You will answer these in Step 3 of the application process.
              </p>
            </div>
          )}

          {/* Bottom Call to action banner */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-900">Ready to make an impact?</p>
              <p className="text-xs text-slate-500">
                Takes about 5–8 minutes. Your profile info can be reused for future vacancies.
              </p>
            </div>
            <button
              onClick={handleApplyClick}
              disabled={isExpired || job.status !== 'published'}
              className="py-2.5 px-6 bg-[#085587] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#074771] transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              Apply for this Position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
