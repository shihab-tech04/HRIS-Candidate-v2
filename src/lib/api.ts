import { getSupabaseClient } from './supabase';
import { adaptLiveOnboardingHandoff, adaptLiveRecruitmentContext } from './recruitmentAdapters';
import { adaptLiveCandidateProfile, toCandidateProfileRpcPayload } from './candidateProfileAdapters';
import {
  PublishedJob,
  CandidateProfile,
  JobApplication,
  InterviewInvitation,
  CandidateAssessment,
  CandidateDocumentRequest,
  JobOffer,
  OnboardingHandoff,
  CandidateCV,
  SavedJob,
  JobAlert,
  CandidateNotification,
  CandidateStoredDocument
} from '../types';
import { INITIAL_PUBLISHED_JOBS } from './mockData';
import { isRecruitmentDeadlineOpen } from './recruitmentDeadline';
import { mapSqlScreeningQuestionType } from './screeningQuestionTypes';

const LOCAL_STORAGE_KEY_PREFIX = 'synesis_hrmis_candidate_';

type CandidateRecruitmentContext = Record<string, any> & {
  applications: JobApplication[];
  interviews: InterviewInvitation[];
  assessments: CandidateAssessment[];
  document_requests: CandidateDocumentRequest[];
  offers: JobOffer[];
  onboarding: OnboardingHandoff | null;
  notifications: Array<CandidateNotification | VerifiedCandidateNotification>;
  notification_load_error?: boolean;
};

function normalizeDemoOnboardingHandoff(raw: Record<string, any>): OnboardingHandoff {
  const oldStatus = String(raw.status || 'pending');
  const status: OnboardingHandoff['status'] = ['pending', 'in_progress', 'completed', 'cancelled'].includes(oldStatus)
    ? oldStatus as OnboardingHandoff['status']
    : oldStatus === 'joining_confirmed' || oldStatus === 'verified_by_hr' ? 'completed'
      : oldStatus === 'submitted_for_verification' ? 'in_progress' : 'pending';
  const oldData = raw.candidate_personal_data ?? raw.personal_data;
  const personalData = oldData && typeof oldData === 'object' && !Array.isArray(oldData) ? oldData : {};
  const oldSteps = raw.candidate_completed_steps ?? raw.completed_steps;
  const submittedAt = raw.candidate_submitted_at ?? (
    ['submitted_for_verification', 'verified_by_hr', 'joining_confirmed'].includes(oldStatus)
      ? raw.updated_at ?? raw.created_at ?? null : null
  );
  return {
    id: String(raw.id || ''),
    application_id: String(raw.application_id || ''),
    status,
    candidate_completed_steps: Array.isArray(oldSteps) ? oldSteps.filter((step: unknown): step is string => typeof step === 'string') : [],
    candidate_personal_data: personalData,
    candidate_submitted_at: typeof submittedAt === 'string' ? submittedAt : null,
    created_at: String(raw.created_at || ''),
    updated_at: String(raw.updated_at || raw.created_at || ''),
  };
}

// Explicit opt-in for isolated local development only. Never use sample data as live HR records.
export const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

function getLocal<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error('Failed reading from localStorage', e);
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed writing to localStorage', e);
  }
}

// Initial seed setup for reliable offline and demo operation
function initializeLocalState() {
  if (!DEMO_MODE || typeof window === 'undefined') return;

  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'jobs')) {
    setLocal('jobs', INITIAL_PUBLISHED_JOBS);
  }

  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'applications')) {
    // Seed one initial application so dashboard and timeline have demonstrable verified history
    const defaultApp: JobApplication = {
      id: 'app-synesis-098',
      user_id: 'user-demo-candidate-123',
      job_id: 'job-synesis-001',
      job: INITIAL_PUBLISHED_JOBS[0],
      cv_id: 'cv-default-001',
      cv_title: 'Senior_FullStack_Resume_v2026.pdf',
      status: 'interview_scheduled',
      candidate_visible_status: 'Interview Round Scheduled',
      stage_label: 'Technical Panel Interview',
      screening_answers: {
        q1: '5 - 7 years',
        q2: 'Yes',
        q3: '30 days',
        q4: 'https://github.com/synesis-talent/cloud-recruitment'
      },
      cover_letter: 'I am excited to bring my 6+ years of full-stack TypeScript experience to Synesis IT and contribute to your enterprise SaaS vision.',
      consent_given: true,
      submitted_at: '2026-10-06T10:30:00Z',
      updated_at: '2026-10-08T14:00:00Z'
    };
    setLocal('applications', [defaultApp]);
  }

  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'interviews')) {
    const defaultInterview: InterviewInvitation = {
      id: 'inv-synesis-501',
      application_id: 'app-synesis-098',
      job_title: 'Senior Full-Stack Engineer (TypeScript & Cloud)',
      department: 'Engineering',
      round_name: 'Technical Architecture & System Design Panel',
      scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
      duration_minutes: 60,
      format: 'Video Call',
      meeting_link: 'https://meet.google.com/syn-rec-tech-2026',
      interviewers: ['Tariqul Islam (Lead Architect)', 'Sabrina Karim (Engineering VP)'],
      instructions:
        'Please join 5 minutes early. We will discuss distributed state management, PostgreSQL RLS designs, and your previous full-stack achievements.',
      status: 'pending',
      created_at: '2026-10-08T14:00:00Z'
    };
    setLocal('interviews', [defaultInterview]);
  }

  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'assessments')) {
    const defaultAssessment: CandidateAssessment = {
      id: 'asm-synesis-701',
      application_id: 'app-synesis-098',
      job_title: 'Senior Full-Stack Engineer (TypeScript & Cloud)',
      title: 'Full-Stack Performance & Security Audit Exercise',
      description: 'Review a sample Supabase RLS schema and provide architectural recommendations for query index tuning and policy containment.',
      due_date: new Date(Date.now() + 86400000 * 4).toISOString(),
      status: 'pending',
      time_estimate: '1.5 - 2 hours',
      instructions: 'Submit a PDF report or GitHub gist link detailing potential edge cases and security boundaries.',
      created_at: '2026-10-07T09:00:00Z'
    };
    setLocal('assessments', [defaultAssessment]);
  }

  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'document_requests')) {
    const defaultDocReq: CandidateDocumentRequest = {
      id: 'doc-synesis-801',
      application_id: 'app-synesis-098',
      job_title: 'Senior Full-Stack Engineer (TypeScript & Cloud)',
      document_type: 'Degree Certificate / Academic Transcript',
      title: 'Undergraduate Degree Certificate Verification',
      instructions: 'Please upload a clear scanned copy of your Bachelor or Master degree certificate for pre-qualification verification.',
      status: 'pending',
      created_at: '2026-10-07T09:00:00Z'
    };
    setLocal('document_requests', [defaultDocReq]);
  }

  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'offers')) {
    const defaultOffer: JobOffer = {
      id: 'ofr-synesis-901',
      application_id: 'app-synesis-098',
      job_title: 'Senior Full-Stack Engineer (TypeScript & Cloud)',
      department: 'Engineering',
      salary: 195000,
      currency: 'BDT',
      salary_period: 'monthly',
      benefits_summary: [
        'Full medical, dental & optical hospitalisation coverage for self & family',
        'Bi-annual performance incentive and two festival bonuses',
        'Equipment allowance for MacBook Pro and ergonomic accessories',
        '24 calendar days annual paid leave + national holidays'
      ],
      start_date: '2026-12-01',
      expiry_date: new Date(Date.now() + 86400000 * 7).toISOString(),
      status: 'extended',
      created_at: '2026-10-08T16:00:00Z'
    };
    setLocal('offers', [defaultOffer]);
  }

  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'onboarding')) {
    const defaultOnboarding: OnboardingHandoff = {
      id: 'onb-synesis-301',
      application_id: 'app-synesis-098',
      status: 'pending',
      candidate_completed_steps: [],
      candidate_personal_data: {},
      candidate_submitted_at: null,
      created_at: '2026-10-08T16:30:00Z',
      updated_at: '2026-10-08T16:30:00Z'
    };
    setLocal('onboarding', [defaultOnboarding]);
  }

  if (!localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + 'notifications')) {
    const defaultNotifs: CandidateNotification[] = [
      {
        id: 'notif-1',
        user_id: 'user-demo-candidate-123',
        type: 'interview',
        title: 'New Interview Invitation',
        message: 'You have been invited to a Technical Architecture & System Design Panel for Senior Full-Stack Engineer.',
        link: '/interviews',
        read: false,
        created_at: '2026-10-08T14:05:00Z'
      },
      {
        id: 'notif-2',
        user_id: 'user-demo-candidate-123',
        type: 'offer',
        title: 'Official Job Offer Received',
        message: 'Congratulations! Synesis IT has extended an official employment offer for Senior Full-Stack Engineer.',
        link: '/offers',
        read: false,
        created_at: '2026-10-08T16:05:00Z'
      }
    ];
    setLocal('notifications', defaultNotifs);
  }
}

initializeLocalState();

// -------------------------------------------------------------
// PUBLIC VACANCIES: candidate_published_jobs (verified projection)
// -------------------------------------------------------------
function normalizePublishedJob(row: Record<string, any>): PublishedJob {
  const salaryPublic = row.is_salary_published === true;
  const workplace = String(row.workplace_type || '').toLowerCase();
  const employment = String(row.employment_type || '').toLowerCase();
  const screening = Array.isArray(row.screening_questions) ? row.screening_questions : [];
  return {
    id: String(row.id),
    title: String(row.title || ''),
    department: String(row.department_name || ''),
    location: String(row.location_name || ''),
    workplace_type: (workplace === 'remote' ? 'Remote' : workplace === 'hybrid' ? 'Hybrid' : 'On-site') as PublishedJob['workplace_type'],
    employment_type: (employment.includes('part') ? 'Part-time' : employment.includes('contract') ? 'Contract' : employment.includes('intern') ? 'Internship' : 'Full-time') as PublishedJob['employment_type'],
    summary: String(row.instructions || ''),
    responsibilities: Array.isArray(row.responsibilities) ? row.responsibilities : [],
    requirements: Array.isArray(row.requirements) ? row.requirements : [],
    benefits: Array.isArray(row.benefits) ? row.benefits : [],
    salary_is_public: salaryPublic,
    published_salary_min: salaryPublic && row.salary_min != null ? Number(row.salary_min) : undefined,
    published_salary_max: salaryPublic && row.salary_max != null ? Number(row.salary_max) : undefined,
    salary_currency: salaryPublic ? row.salary_currency ?? undefined : undefined,
    vacancy_count: Number(row.vacancy_count || 0),
    application_deadline: String(row.application_deadline || ''),
    status: 'published',
    published_at: String(row.published_at || row.created_at || ''),
    created_at: String(row.created_at || ''),
    screening_questions: screening.map((q: Record<string, any>) => ({
      id: String(q.id || ''),
      question: String(q.questionText || q.question || ''),
      type: mapSqlScreeningQuestionType(q.type),
      required: q.required === true,
      options: Array.isArray(q.options) ? q.options : undefined,
    })),
    required_documents: Array.isArray(row.required_documents)
      ? row.required_documents.filter((item: unknown): item is string => typeof item === 'string') : []
  };
}

export async function getPublishedJobs(params?: {
  search?: string;
  department?: string;
  workplace_type?: string;
  employment_type?: string;
}): Promise<PublishedJob[]> {
  const supabase = getSupabaseClient();
  let jobs: PublishedJob[];

  if (!supabase) {
    if (!DEMO_MODE) throw new Error('Careers service is not configured. Vacancies cannot be verified.');
    jobs = getLocal<PublishedJob[]>('jobs', INITIAL_PUBLISHED_JOBS);
  } else {
    const { data, error } = await supabase.from('candidate_published_jobs').select('*')
      .eq('status', 'published')
      .eq('is_published', true)
      .eq('is_active', true);
    if (error) {
      if (!DEMO_MODE) throw new Error('Unable to verify published vacancies. Please retry.');
      jobs = getLocal<PublishedJob[]>('jobs', INITIAL_PUBLISHED_JOBS);
    } else {
      // An authoritative empty result must stay empty: do not replace with sample vacancies.
      jobs = (data || []).map((row) => normalizePublishedJob(row as Record<string, any>));
    }
  }

  let filtered = jobs.filter((j) => j.status === 'published' &&
    isRecruitmentDeadlineOpen(j.application_deadline));
  if (params?.search?.trim()) {
    const term = params.search.toLowerCase().trim();
    filtered = filtered.filter((j) =>
      j.title.toLowerCase().includes(term) ||
      j.department.toLowerCase().includes(term) ||
      j.location.toLowerCase().includes(term) ||
      j.summary.toLowerCase().includes(term) ||
      j.requirements.some((r) => String(r).toLowerCase().includes(term)));
  }
  if (params?.department && params.department !== 'All') filtered = filtered.filter(j => j.department === params.department);
  if (params?.workplace_type && params.workplace_type !== 'All') filtered = filtered.filter(j => j.workplace_type === params.workplace_type);
  if (params?.employment_type && params.employment_type !== 'All') filtered = filtered.filter(j => j.employment_type === params.employment_type);
  return filtered.map((j) => j.salary_is_public ? j : {
    ...j, published_salary_min: undefined, published_salary_max: undefined, salary_currency: undefined
  });
}

export async function getPublishedJobById(jobId: string): Promise<PublishedJob | null> {
  const jobs = await getPublishedJobs();
  return jobs.find(j => j.id === jobId) || null;
}

// -------------------------------------------------------------
// CANDIDATE PROFILE: get_my_candidate_profile & candidate_update_profile
// -------------------------------------------------------------
export async function getMyCandidateProfile(userId: string): Promise<CandidateProfile | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('get_my_candidate_profile');
      if (!error && data) {
        return adaptLiveCandidateProfile(data);
      }
    } catch (e) {
      console.warn('Supabase get_my_candidate_profile error', e);
    }
  }

  if (!DEMO_MODE) return null;
  const profiles = getLocal<Record<string, CandidateProfile>>('profiles', {});
  return profiles[userId] || null;
}

export async function updateCandidateProfile(
  userId: string,
  payload: Partial<CandidateProfile>
): Promise<CandidateProfile> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('candidate_update_profile', {
        p_payload: toCandidateProfileRpcPayload(payload)
      });
      if (!error && data) {
        return adaptLiveCandidateProfile(data);
      }
    } catch (e) {
      console.warn('Supabase candidate_update_profile error, updating local storage', e);
    }
  }

  if (!DEMO_MODE) throw new Error('Candidate profile was not saved to HRMIS. Please retry.');
  const profiles = getLocal<Record<string, CandidateProfile>>('profiles', {});
  const existing = profiles[userId] || {
    id: 'prof-' + userId,
    user_id: userId,
    full_name: '',
    email: '',
    phone: '',
    location: '',
    headline: '',
    summary: '',
    experiences: [],
    educations: [],
    skills: [],
    certifications: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const updated: CandidateProfile = {
    ...existing,
    ...payload,
    updated_at: new Date().toISOString()
  };

  profiles[userId] = updated;
  setLocal('profiles', profiles);
  return updated;
}

// -------------------------------------------------------------
// CANDIDATE RECRUITMENT CONTEXT: candidate_get_recruitment_context
// -------------------------------------------------------------
export async function getRecruitmentContext(userId: string): Promise<CandidateRecruitmentContext> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('candidate_get_recruitment_context');
      if (!error && data) {
        const context = adaptLiveRecruitmentContext(data) as CandidateRecruitmentContext;
        let notifications: VerifiedCandidateNotification[] = [];
        let notification_load_error = false;
        try {
          notifications = await listVerifiedCandidateNotifications(userId);
        } catch (notificationError) {
          notification_load_error = true;
          console.warn('Supabase candidate notifications error', notificationError);
        }
        return { ...context, notifications, notification_load_error, onboarding: null };
      }
      if (error) throw error;
    } catch (e) {
      console.warn('Supabase candidate recruitment context error', e);
      if (!DEMO_MODE) throw new Error('Recruitment and preboarding records could not be verified. Please retry.');
    }
  }

  if (!DEMO_MODE) throw new Error('Recruitment records could not be verified. Please retry.');
  const allApps = getLocal<JobApplication[]>('applications', []);
  const userApps = allApps.filter((a) => a.user_id === userId);

  const allInterviews = getLocal<InterviewInvitation[]>('interviews', []);
  const allAssessments = getLocal<CandidateAssessment[]>('assessments', []);
  const allDocRequests = getLocal<CandidateDocumentRequest[]>('document_requests', []);
  const allOffers = getLocal<JobOffer[]>('offers', []);
  const allOnboarding = getLocal<OnboardingHandoff[]>('onboarding', []);
  const allNotifications = getLocal<CandidateNotification[]>('notifications', []);

  return {
    applications: userApps,
    interviews: allInterviews,
    assessments: allAssessments,
    document_requests: allDocRequests,
    offers: allOffers,
    onboarding: (() => {
      const handoff = allOnboarding.find(item => userApps.some(app => app.id === item.application_id));
      return handoff ? normalizeDemoOnboardingHandoff(handoff as unknown as Record<string, any>) : null;
    })(),
    notifications: allNotifications.filter((n) => n.user_id === userId)
  };
}

export async function getMyPreboardingHandoff(applicationId: string): Promise<OnboardingHandoff | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const result = await supabase.rpc('candidate_get_my_preboarding_handoff', { p_application_id: applicationId });
      if (result.error) throw result.error;
      return result.data ? adaptLiveOnboardingHandoff(result.data) : null;
    } catch (cause) {
      if (!DEMO_MODE) throw new Error(cause instanceof Error ? cause.message : 'Preboarding records could not be verified.');
    }
  }
  if (!DEMO_MODE) throw new Error('Preboarding records could not be verified. Please retry.');
  const handoff = getLocal<Record<string, any>[]>('onboarding', []).find(item => item.application_id === applicationId);
  return handoff ? normalizeDemoOnboardingHandoff(handoff) : null;
}

// -------------------------------------------------------------
// JOB APPLICATIONS: candidate_apply_to_job
// -------------------------------------------------------------
export async function applyToJob(
  jobId: string,
  payload: {
    user_id: string;
    cv_id: string;
    cv_title?: string;
    screening_answers: Record<string, any>;
    cover_letter?: string;
    documents?: { name: string; url: string; type: string }[];
    consent_given: boolean;
    accuracy_certified: boolean;
    full_name?: string;
    phone?: string;
    years_experience?: number;
    skills?: string[];
    document_ids?: string[];
    required_document_map?: Record<string, string>;
  }
): Promise<{ success: boolean; application?: JobApplication; error?: string }> {
  // Validate consent
  if (!payload.consent_given || !payload.accuracy_certified) {
    return { success: false, error: 'Recruitment data consent is strictly mandatory.' };
  }

  // Check if job exists and is still open
  const job = await getPublishedJobById(jobId);
  if (!job) {
    return { success: false, error: 'Vacancy does not exist or has been removed.' };
  }
  if (job.status !== 'published') {
    return { success: false, error: 'This vacancy is no longer accepting new applications.' };
  }
  if (!isRecruitmentDeadlineOpen(job.application_deadline)) {
    return { success: false, error: 'The application deadline for this position has expired.' };
  }

  // Check duplicate application
  // Local application history is authoritative only in the isolated demo. A
  // production browser can contain stale data from an earlier preview, so let
  // HRIS enforce its configured duplicate rule against persisted applications.
  const existingApps = DEMO_MODE ? getLocal<JobApplication[]>('applications', []) : [];
  const alreadyApplied = DEMO_MODE && existingApps.some(
    (a) => a.user_id === payload.user_id && a.job_id === jobId && a.status !== 'withdrawn'
  );
  if (alreadyApplied) {
    return {
      success: false,
      error: 'You have already submitted an active application for this position.'
    };
  }

  // Browser blob URLs and demo CV ids are not legitimate server documents.
  if (!DEMO_MODE && payload.documents?.length) {
    return { success: false, error: 'Upload documents to secure candidate storage before submitting.' };
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('candidate_apply_to_job', {
        p_job_id: jobId,
        p_payload: {
          selected_cv_id: payload.cv_id,
          full_name: payload.full_name || null,
          phone: payload.phone || null,
          years_experience: payload.years_experience ?? null,
          skills: payload.skills || null,
          answers: Object.entries(payload.screening_answers).map(([questionId, answer]) => ({ questionId, answer })),
          cover_letter: payload.cover_letter || null,
          document_ids: payload.document_ids || [],
          required_document_map: payload.required_document_map || {},
          declarations: {
            accuracyCertified: payload.accuracy_certified,
            recruitmentDataConsent: payload.consent_given
          }
        }
      });
      if (error) return { success: false, error: error.message };
      if (typeof data === 'string' && data) {
        return {
          success: true,
          application: {
            id: data,
            user_id: payload.user_id,
            job_id: jobId,
            job,
            cv_id: payload.cv_id,
            cv_title: payload.cv_title,
            status: 'submitted',
            candidate_visible_status: 'Application Submitted',
            stage_label: 'Submitted',
            screening_answers: payload.screening_answers,
            cover_letter: payload.cover_letter,
            consent_given: true,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      }
      return { success: false, error: 'Application response was not confirmed.' };
    } catch {
      return { success: false, error: 'Could not reach HRMIS. Please retry.' };
    }
  }

  if (!DEMO_MODE) return { success: false, error: 'Application was not saved to HRMIS. Please retry.' };

  const newApp: JobApplication = {
    id: 'app-' + Math.random().toString(36).substring(2, 9),
    user_id: payload.user_id,
    job_id: jobId,
    job: job,
    cv_id: payload.cv_id,
    cv_title: payload.cv_title || 'Candidate_Resume.pdf',
    status: 'submitted',
    candidate_visible_status: 'Application Submitted',
    stage_label: 'Application Screening',
    screening_answers: payload.screening_answers,
    cover_letter: payload.cover_letter,
    documents: payload.documents,
    consent_given: true,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const updatedApps = [newApp, ...existingApps];
  setLocal('applications', updatedApps);

  // Add notification
  const notifs = getLocal<CandidateNotification[]>('notifications', []);
  notifs.unshift({
    id: 'notif-' + Date.now(),
    user_id: payload.user_id,
    type: 'application',
    title: 'Application Received',
    message: `Your application for "${job.title}" has been successfully logged with Synesis HR.`,
    link: '/applications',
    read: false,
    created_at: new Date().toISOString()
  });
  setLocal('notifications', notifs);

  // Clear draft if any
  deleteApplicationDraft(jobId, payload.user_id);

  return { success: true, application: newApp };
}

// -------------------------------------------------------------
// WITHDRAW APPLICATION: candidate_withdraw_application
// -------------------------------------------------------------
export async function withdrawApplication(
  applicationId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.rpc('candidate_withdraw_application', {
        p_application_id: applicationId,
        p_reason: reason
      });
      if (!error) return { success: true };
    } catch (e) {
      console.warn('Supabase candidate_withdraw_application error', e);
    }
  }

  if (!DEMO_MODE) return { success: false, error: 'withdraw change was not saved to HRMIS. Please retry.' };
  const apps = getLocal<JobApplication[]>('applications', []);
  const index = apps.findIndex((a) => a.id === applicationId);
  if (index === -1) return { success: false, error: 'Application not found' };

  apps[index] = {
    ...apps[index],
    status: 'withdrawn',
    candidate_visible_status: 'Application Withdrawn by Candidate',
    stage_label: 'Withdrawn',
    withdrawal_reason: reason,
    withdrawn_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  setLocal('applications', apps);
  return { success: true };
}

// -------------------------------------------------------------
// RESPOND TO INTERVIEW: candidate_respond_interview
// -------------------------------------------------------------
export async function respondToInterview(
  interviewId: string,
  response: 'accepted' | 'declined' | 'reschedule_requested',
  notes?: string,
  proposedTimes?: string
): Promise<{ success: boolean; error?: string }> {
  if (response === 'reschedule_requested' && (!notes?.trim() || !proposedTimes?.trim())) {
    return { success: false, error: 'Reason and alternative availability are required.' };
  }
  const supabase = getSupabaseClient();
  if (supabase && !DEMO_MODE) {
    try {
      const { error } = await supabase.rpc('candidate_respond_interview', {
        p_interview_id: interviewId,
        p_response: response === 'accepted' ? 'confirmed' : response,
        p_reason: notes?.trim() || null,
        p_proposed_times: response === 'reschedule_requested' ? proposedTimes?.trim() : null
      });
      return error ? { success: false, error: error.message } : { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Interview response failed.' };
    }
  }

  if (!DEMO_MODE) return { success: false, error: 'interview change was not saved to HRMIS. Please retry.' };
  const interviews = getLocal<InterviewInvitation[]>('interviews', []);
  const index = interviews.findIndex((i) => i.id === interviewId);
  if (index === -1) return { success: false, error: 'Interview invitation not found' };

  interviews[index] = {
    ...interviews[index],
    status: response,
    candidate_notes: notes
  };
  setLocal('interviews', interviews);
  return { success: true };
}

// -------------------------------------------------------------
// SUBMIT ASSESSMENT: candidate_submit_assessment
// -------------------------------------------------------------
export async function submitAssessment(
  assessmentId: string,
  payload: { submission_text?: string; file_url?: string; file_name?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.rpc('candidate_submit_assessment', {
        p_assessment_id: assessmentId,
        p_payload: payload
      });
      if (!error) return { success: true };
    } catch (e) {
      console.warn('Supabase candidate_submit_assessment error', e);
    }
  }

  if (!DEMO_MODE) return { success: false, error: 'assessment change was not saved to HRMIS. Please retry.' };
  const assessments = getLocal<CandidateAssessment[]>('assessments', []);
  const index = assessments.findIndex((a) => a.id === assessmentId);
  if (index === -1) return { success: false, error: 'Assessment not found' };

  assessments[index] = {
    ...assessments[index],
    status: 'submitted',
    candidate_response: {
      ...payload,
      submitted_at: new Date().toISOString()
    }
  };
  setLocal('assessments', assessments);
  return { success: true };
}

// -------------------------------------------------------------
// SUBMIT REQUESTED DOCUMENT: candidate_submit_requested_document
// -------------------------------------------------------------
export async function submitRequestedDocument(
  requestId: string,
  file: File
): Promise<{ success: boolean; error?: string }> {
  if (!file || file.size <= 0 || file.size > 10 * 1024 * 1024) {
    return { success: false, error: 'Select a PDF or Word file up to 10 MB.' };
  }
  const ext = file.name.toLowerCase().split('.').pop();
  const mimeByExtension: Record<string,string> = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  if (!ext || !mimeByExtension[ext]) {
    return { success: false, error: 'Only PDF, DOC and DOCX documents are supported.' };
  }
  if (!DEMO_MODE) {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'Candidate document service is unavailable.' };
    try {
      const { data: verified, error: authError } = await supabase.auth.getUser();
      if (authError || !verified.user) return { success: false, error: 'Sign in before submitting a document.' };
      const path = `${verified.user.id}/requested/${requestId}/${crypto.randomUUID()}.${ext}`;
      const uploaded = await supabase.storage.from('candidate-documents')
        .upload(path, file, { upsert: false, contentType: mimeByExtension[ext] });
      if (uploaded.error) return { success: false, error: uploaded.error.message };
      const response = await supabase.rpc('candidate_submit_requested_document', {
        p_request_id: requestId, p_file_name: file.name, p_file_path: path
      });
      if (response.error) {
        await supabase.storage.from('candidate-documents').remove([path]);
        return { success: false, error: response.error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Document submission failed.' };
    }
  }

  // The developer-only preview stays local and never uploads to production storage.
  const docs = getLocal<CandidateDocumentRequest[]>('document_requests', []);
  const index = docs.findIndex((d) => d.id === requestId);
  if (index === -1) return { success: false, error: 'Document request not found' };
  docs[index] = {
    ...docs[index], status: 'submitted',
    submitted_file_name: file.name,
    submitted_at: new Date().toISOString()
  };
  setLocal('document_requests', docs);
  return { success: true };
}

// -------------------------------------------------------------
// RESPOND TO OFFER: candidate_respond_offer_record
// -------------------------------------------------------------
export async function respondToOffer(
  offerId: string,
  response: 'accepted' | 'declined',
  signature?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.rpc('candidate_respond_offer_record', {
        p_offer_id: offerId,
        p_response: response,
        p_signature: signature || '',
        p_note: notes || ''
      });
      if (!error) return { success: true };
      if (!DEMO_MODE) return { success: false, error: error.message };
    } catch (e) {
      if (!DEMO_MODE) return { success: false, error: e instanceof Error ? e.message : 'Offer response failed.' };
      console.warn('Supabase candidate_respond_offer_record error', e);
    }
  }

  if (!DEMO_MODE) return { success: false, error: 'offer response change was not saved to HRMIS. Please retry.' };
  const offers = getLocal<JobOffer[]>('offers', []);
  const index = offers.findIndex((o) => o.id === offerId);
  if (index === -1) return { success: false, error: 'Offer not found' };

  offers[index] = {
    ...offers[index],
    status: response,
    signed_at: response === 'accepted' ? new Date().toISOString() : undefined,
    candidate_signature: signature,
    candidate_response_notes: notes
  };
  setLocal('offers', offers);

  // If accepted, initiate onboarding handoff record
  if (response === 'accepted') {
    const handoffs = getLocal<OnboardingHandoff[]>('onboarding', []);
      let handoff = handoffs.find((h) => h.application_id === offers[index].application_id);
    if (!handoff) {
      handoff = {
        id: 'onb-' + Date.now(),
        application_id: offers[index].application_id,
          status: 'pending',
          candidate_completed_steps: [],
          candidate_personal_data: {},
          candidate_submitted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      handoffs.push(handoff);
      setLocal('onboarding', handoffs);
    }
  }

  return { success: true };
}

// -------------------------------------------------------------
// PREBOARDING HANDOFF UPDATES
// -------------------------------------------------------------
export async function updateOnboardingHandoff(
  applicationId: string,
  stepKey: string,
  stepData: Partial<OnboardingHandoff['candidate_personal_data']>
): Promise<{ success: boolean; handoff?: OnboardingHandoff; error?: string }> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const allowedByStep: Record<string, string[]> = {
      step_identity: ['national_id', 'passport_number', 'date_of_birth', 'nationality', 'address'],
      step_emergency: ['emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation'],
      step_payroll: ['bank_name', 'bank_account_number', 'tax_identification_number'],
      step_policies: ['policies_accepted'],
    };
    const allowed = allowedByStep[stepKey];
    if (!allowed) return { success: false, error: 'Unknown preboarding step.' };
    const payload = Object.fromEntries(allowed.filter(key => Object.hasOwn(stepData, key))
      .map(key => [key, stepData[key as keyof typeof stepData]]));
    try {
      const result = await supabase.rpc('candidate_save_my_preboarding_step', {
        p_application_id: applicationId,
        p_step_key: stepKey,
        p_payload: payload,
      });
      if (result.error) return { success: false, error: result.error.message };
      return { success: true, handoff: adaptLiveOnboardingHandoff(result.data) };
    } catch (cause) {
      return { success: false, error: cause instanceof Error ? cause.message : 'Preboarding changes were not saved. Please retry.' };
    }
  }
  if (!DEMO_MODE) return { success: false, error: 'Preboarding changes could not be saved. Please retry.' };
  const handoffs = getLocal<Record<string, any>[]>('onboarding', []);
  const index = handoffs.findIndex((h) => h.application_id === applicationId);
  if (index === -1) return { success: false, error: 'Onboarding record not found' };

  const current = normalizeDemoOnboardingHandoff(handoffs[index]);
  const completedSteps = Array.from(new Set([...current.candidate_completed_steps, stepKey]));
  const personalData = { ...current.candidate_personal_data, ...stepData };
  const submitted = completedSteps.length >= 4;

  const updated: OnboardingHandoff = {
    ...current,
    candidate_completed_steps: completedSteps,
    candidate_personal_data: personalData,
    candidate_submitted_at: submitted ? current.candidate_submitted_at || new Date().toISOString() : current.candidate_submitted_at,
    status: completedSteps.length ? 'in_progress' : current.status,
    updated_at: new Date().toISOString()
  };

  handoffs[index] = updated;
  setLocal('onboarding', handoffs);
  return { success: true, handoff: updated };
}

// -------------------------------------------------------------
// APPLICATION DRAFTS
// -------------------------------------------------------------
export function saveApplicationDraft(jobId: string, userId: string, draftPayload: any) {
  const drafts = getLocal<Record<string, any>>('drafts', {});
  drafts[`${userId}_${jobId}`] = {
    jobId,
    userId,
    payload: draftPayload,
    updated_at: new Date().toISOString()
  };
  setLocal('drafts', drafts);
}

export function getApplicationDraft(jobId: string, userId: string) {
  const drafts = getLocal<Record<string, any>>('drafts', {});
  return drafts[`${userId}_${jobId}`]?.payload || null;
}

export function deleteApplicationDraft(jobId: string, userId: string) {
  const drafts = getLocal<Record<string, any>>('drafts', {});
  delete drafts[`${userId}_${jobId}`];
  setLocal('drafts', drafts);
}

// -------------------------------------------------------------
// SAVED JOBS & ALERTS
// -------------------------------------------------------------
export function getSavedJobs(userId: string): SavedJob[] {
  const all = getLocal<SavedJob[]>('saved_jobs', []);
  return all.filter((s) => s.user_id === userId);
}

export function toggleSaveJob(userId: string, job: PublishedJob): boolean {
  const all = getLocal<SavedJob[]>('saved_jobs', []);
  const existingIndex = all.findIndex((s) => s.user_id === userId && s.job_id === job.id);
  if (existingIndex > -1) {
    all.splice(existingIndex, 1);
    setLocal('saved_jobs', all);
    return false; // now unsaved
  } else {
    all.unshift({
      id: 'saved-' + Date.now(),
      user_id: userId,
      job_id: job.id,
      job,
      saved_at: new Date().toISOString()
    });
    setLocal('saved_jobs', all);
    return true; // now saved
  }
}

export function getJobAlerts(userId: string): JobAlert[] {
  const all = getLocal<JobAlert[]>('job_alerts', []);
  return all.filter((a) => a.user_id === userId);
}

export function createJobAlert(userId: string, alert: Omit<JobAlert, 'id' | 'user_id' | 'created_at'>): JobAlert {
  const all = getLocal<JobAlert[]>('job_alerts', []);
  const newAlert: JobAlert = {
    id: 'alert-' + Date.now(),
    user_id: userId,
    ...alert,
    created_at: new Date().toISOString()
  };
  all.unshift(newAlert);
  setLocal('job_alerts', all);
  return newAlert;
}

export function deleteJobAlert(alertId: string): void {
  const all = getLocal<JobAlert[]>('job_alerts', []);
  setLocal(
    'job_alerts',
    all.filter((a) => a.id !== alertId)
  );
}

// -------------------------------------------------------------
// CVs MANAGEMENT
// -------------------------------------------------------------
export function getCandidateCVs(userId: string): CandidateCV[] {
  const all = getLocal<CandidateCV[]>('cvs', []);
  const userCVs = all.filter((c) => c.user_id === userId);
  if (userCVs.length === 0 && DEMO_MODE) {
    // Return standard default CV template
    const defaultCV: CandidateCV = {
      id: 'cv-default-001',
      user_id: userId,
      title: 'Senior Software Engineer CV',
      version: 'v2.4',
      is_default: true,
      file_name: 'Candidate_Software_Engineering_CV.pdf',
      file_size: 1024 * 340,
      created_at: '2026-10-01T12:00:00Z',
      updated_at: '2026-10-06T10:00:00Z'
    };
    setLocal('cvs', [defaultCV]);
    return [defaultCV];
  }
  return userCVs;
}

export function saveCandidateCV(userId: string, cvData: Partial<CandidateCV>): CandidateCV {
  const all = getLocal<CandidateCV[]>('cvs', []);
  const newCV: CandidateCV = {
    id: cvData.id || 'cv-' + Date.now(),
    user_id: userId,
    title: cvData.title || 'Untitled CV',
    version: cvData.version || 'v1.0',
    is_default: !!cvData.is_default,
    file_name: cvData.file_name,
    file_size: cvData.file_size,
    file_url: cvData.file_url,
    structured_content: cvData.structured_content,
    created_at: cvData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (newCV.is_default) {
    all.forEach((c) => {
      if (c.user_id === userId) c.is_default = false;
    });
  }

  const existingIdx = all.findIndex((c) => c.id === newCV.id);
  if (existingIdx > -1) {
    all[existingIdx] = newCV;
  } else {
    all.unshift(newCV);
  }
  setLocal('cvs', all);
  return newCV;
}


// -----------------------------------------------------------------------------
// Authoritative CV records (available to authenticated candidates only).
// The existing candidate_cvs table is protected by ownership RLS. This API
// never fabricates a CV, pretends to upload a file or stores data in public buckets.
// -----------------------------------------------------------------------------
function cvFromRow(row: Record<string, any>): CandidateCV {
  return {
    id: String(row.id),
    user_id: String(row.candidate_user_id),
    title: String(row.title || 'Untitled CV'),
    version: 'v1',
    is_default: row.is_default === true,
    file_url: row.document_url || undefined,
    file_name: row.document_url ? String(row.document_url).split('/').pop() : undefined,
    structured_content: row.custom_summary ? { summary: String(row.custom_summary) } : {},
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || '')
  };
}

async function authorizedCandidate(userId: string) {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase is not configured.');
  const { data, error } = await sb.auth.getUser();
  if (error || data.user?.id !== userId)
    throw new Error('Verified candidate sign-in is required.');
  return sb;
}

export async function listCandidateCVs(userId: string): Promise<CandidateCV[]> {
  if (DEMO_MODE) return getCandidateCVs(userId);
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_cvs')
    .select('id,candidate_user_id,title,is_default,custom_summary,document_url,created_at,updated_at')
    .eq('candidate_user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(row => cvFromRow(row as Record<string, any>));
}

export async function persistCandidateCV(userId: string, cv: Partial<CandidateCV>): Promise<CandidateCV> {
  if (DEMO_MODE) return saveCandidateCV(userId, cv);
  const sb = await authorizedCandidate(userId);
  if (!cv.title?.trim()) throw new Error('CV title is required.');
  const payload = {
    title: cv.title.trim(),
    is_default: cv.is_default === true,
    custom_summary: String(cv.structured_content?.summary || ''),
    ...(cv.file_url?.startsWith(userId + '/') ? { document_url: cv.file_url } : {})
  };
  let response;
  if (cv.id) {
    response = await sb.from('candidate_cvs')
      .update(payload).eq('id', cv.id).eq('candidate_user_id', userId)
      .select('id,candidate_user_id,title,is_default,custom_summary,document_url,created_at,updated_at')
      .single();
  } else {
    response = await sb.from('candidate_cvs')
      .insert({ ...payload, candidate_user_id: userId })
      .select('id,candidate_user_id,title,is_default,custom_summary,document_url,created_at,updated_at')
      .single();
  }
  if (response.error || !response.data) throw new Error(response.error?.message || 'CV was not saved.');
  return cvFromRow(response.data as Record<string, any>);
}


/** Private CV uploads. The storage policy requires `{auth.uid()}/...` and an
 * active candidate profile. Never expose a public URL or fabricated PDF.
 */
export async function uploadCandidateCV(userId: string, cv: CandidateCV, file: File): Promise<CandidateCV> {
  const sb = await authorizedCandidate(userId);
  const ext = file.name.toLowerCase().split('.').pop();
  const allowed = ['pdf', 'doc', 'docx'];
  if (!ext || !allowed.includes(ext)) throw new Error('Upload a PDF or Word CV.');
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('CV must be between 1 byte and 10 MB.');
  const path = `${userId}/cv/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await sb.storage.from('candidate-documents')
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (uploadError) throw new Error(uploadError.message);
  try {
    return await persistCandidateCV(userId, { ...cv, file_url: path });
  } catch (error) {
    await sb.storage.from('candidate-documents').remove([path]);
    throw error;
  }
}

/** Upload and register a candidate-owned private supporting document. */
export async function uploadCandidateApplicationDocument(
  userId: string, title: string, file: File
): Promise<CandidateStoredDocument> {
  const sb = await authorizedCandidate(userId);
  const normalizedTitle = title.trim();
  if (!normalizedTitle || normalizedTitle.length > 120) {
    throw new Error('Document title must be between 1 and 120 characters.');
  }
  const ext = file.name.toLowerCase().split('.').pop();
  const mimeByExtension: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  if (!ext || !mimeByExtension[ext]) throw new Error('Upload a PDF or Word document.');
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Document must be between 1 byte and 10 MB.');
  }

  const path = `${userId}/application-documents/${crypto.randomUUID()}.${ext}`;
  const contentType = mimeByExtension[ext];
  const { error: uploadError } = await sb.storage.from('candidate-documents')
    .upload(path, file, { upsert: false, contentType });
  if (uploadError) throw new Error(uploadError.message);

  try {
    const { data, error } = await sb.rpc('candidate_add_application_document', {
      p_title: normalizedTitle,
      p_file_name: file.name,
      p_file_path: path,
      p_content_type: contentType
    });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(error?.message || 'Document metadata was not confirmed by HRMIS.');
    }
    const row = data as Record<string, unknown>;
    return {
      id: String(row.id || ''),
      title: String(row.title || normalizedTitle),
      fileName: String(row.fileName || file.name),
      fileUrl: String(row.fileUrl || path),
      contentType: String(row.contentType || contentType),
      uploadedAt: String(row.uploadedAt || new Date().toISOString())
    };
  } catch (error) {
    await sb.storage.from('candidate-documents').remove([path]);
    throw error;
  }
}

/** Signed links are short-lived and scoped by the user's storage policy. */
export async function getCandidateCVDownloadUrl(userId: string, cv: CandidateCV): Promise<string> {
  const sb = await authorizedCandidate(userId);
  if (!cv.file_url?.startsWith(userId + '/')) throw new Error('This CV has no verified private file.');
  const { data, error } = await sb.storage.from('candidate-documents')
    .createSignedUrl(cv.file_url, 60);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Unable to authorize CV download.');
  return data.signedUrl;
}


// Server-side application drafts, keyed by the verified candidate and job.
// The existing unique constraint on (candidate_user_id, job_id) prevents duplicates.
export type VerifiedApplicationDraft = {
  step: number;
  cvId?: string;
  answers: Record<string, unknown>;
  coverLetter: string;
  documentIds?: string[];
  requiredDocumentMap?: Record<string, string>;
};
export async function loadVerifiedApplicationDraft(userId: string, jobId: string):
  Promise<VerifiedApplicationDraft | null> {
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_application_drafts')
    .select('current_step,draft_data')
    .eq('candidate_user_id',userId).eq('job_id',jobId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const draft = data.draft_data as Record<string, unknown> | null;
  return {
    step: Number(data.current_step) || 1,
    cvId: typeof draft?.cvId === 'string' ? draft.cvId : undefined,
    answers: draft?.answers && typeof draft.answers === 'object' && !Array.isArray(draft.answers)
      ? draft.answers as Record<string, unknown> : {},
    coverLetter: typeof draft?.coverLetter === 'string' ? draft.coverLetter : '',
    documentIds: Array.isArray(draft?.documentIds)
      ? draft.documentIds.filter((id): id is string => typeof id === 'string') : [],
    requiredDocumentMap: draft?.requiredDocumentMap && typeof draft.requiredDocumentMap === 'object' && !Array.isArray(draft.requiredDocumentMap)
      ? Object.fromEntries(Object.entries(draft.requiredDocumentMap).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
  };
}
export async function saveVerifiedApplicationDraft(userId: string, jobId: string,
  draft: VerifiedApplicationDraft): Promise<void> {
  const sb = await authorizedCandidate(userId);
  const { error } = await sb.from('candidate_application_drafts').upsert({
    candidate_user_id: userId, job_id: jobId,
    current_step: Math.max(1, Math.min(4, Math.trunc(draft.step))),
    draft_data: {
      cvId: draft.cvId || null, answers: draft.answers, coverLetter: draft.coverLetter,
      documentIds: draft.documentIds || [], requiredDocumentMap: draft.requiredDocumentMap || {}
    }
  }, { onConflict: 'candidate_user_id,job_id' });
  if (error) throw new Error(error.message);
}
export async function clearVerifiedApplicationDraft(userId: string, jobId: string): Promise<void> {
  const sb = await authorizedCandidate(userId);
  const { error } = await sb.from('candidate_application_drafts')
    .delete().eq('candidate_user_id',userId).eq('job_id',jobId);
  if (error) throw new Error(error.message);
}


// Candidate-owned server-side saved jobs, shared across browsers.
export async function listVerifiedSavedJobIds(userId: string): Promise<string[]> {
  if (DEMO_MODE) return getSavedJobs(userId).map(x => x.job_id);
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_saved_jobs').select('job_id')
    .eq('candidate_user_id', userId).order('saved_at',{ascending:false});
  if (error) throw new Error(error.message);
  return (data || []).map(x => String(x.job_id));
}
export async function toggleVerifiedSavedJob(userId: string, jobId: string, demoJob?: PublishedJob): Promise<boolean> {
  if (DEMO_MODE) {
    if (!demoJob) throw new Error('Sample job required for isolated preview.');
    return toggleSaveJob(userId, demoJob);
  }
  const sb = await authorizedCandidate(userId);
  const {data, error} = await sb.from('candidate_saved_jobs').select('id')
    .eq('candidate_user_id',userId).eq('job_id',jobId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    const response=await sb.from('candidate_saved_jobs').delete()
      .eq('id',data.id).eq('candidate_user_id',userId);
    if (response.error) throw new Error(response.error.message);
    return false;
  }
  const response=await sb.from('candidate_saved_jobs')
    .insert({candidate_user_id:userId,job_id:jobId});
  if (response.error) throw new Error(response.error.message);
  return true;
}

export type VerifiedCandidateJobAlert = {
  id: string;
  title: string;
  keywords: string | null;
  department: string | null;
  location: string | null;
  workplace_type: string | null;
  employment_type: string | null;
  frequency: 'Instant';
  is_active: boolean;
  created_at: string;
};

export type VerifiedCandidateJobAlertInput = Pick<VerifiedCandidateJobAlert,
  'title' | 'keywords' | 'department' | 'location' | 'workplace_type' | 'employment_type'>;

export type VerifiedCandidateNotification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  related_application_id: string | null;
  related_job_id: string | null;
  action_view: string | null;
  is_read: boolean;
  created_at: string;
};

/** Live candidate alerts use the verified production table and owner-bound RLS. */
export async function listVerifiedCandidateJobAlerts(userId: string): Promise<VerifiedCandidateJobAlert[]> {
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_job_alerts')
    .select('id,title,keywords,department,location,workplace_type,employment_type,frequency,is_active,created_at')
    .eq('candidate_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(row => ({
    id: String(row.id),
    title: String(row.title || ''),
    keywords: row.keywords == null ? null : String(row.keywords),
    department: row.department == null ? null : String(row.department),
    location: row.location == null ? null : String(row.location),
    workplace_type: row.workplace_type == null ? null : String(row.workplace_type),
    employment_type: row.employment_type == null ? null : String(row.employment_type),
    frequency: 'Instant',
    is_active: row.is_active === true,
    created_at: String(row.created_at || ''),
  }));
}

export async function createVerifiedCandidateJobAlert(
  userId: string, input: VerifiedCandidateJobAlertInput
): Promise<VerifiedCandidateJobAlert> {
  const sb = await authorizedCandidate(userId);
  const title = input.title.trim();
  if (!title) throw new Error('Enter a name for this job alert.');
  const nullableText = (value: string | null) => value?.trim() || null;
  const { data, error } = await sb.from('candidate_job_alerts').insert({
    candidate_user_id: userId,
    title,
    keywords: nullableText(input.keywords),
    department: nullableText(input.department),
    location: nullableText(input.location),
    workplace_type: nullableText(input.workplace_type),
    employment_type: nullableText(input.employment_type),
    frequency: 'Instant',
    is_active: true,
  }).select('id,title,keywords,department,location,workplace_type,employment_type,frequency,is_active,created_at')
    .single();
  if (error || !data) throw new Error(error?.message || 'Job alert was not saved.');
  return {
    id: String(data.id), title: String(data.title || ''),
    keywords: data.keywords == null ? null : String(data.keywords),
    department: data.department == null ? null : String(data.department),
    location: data.location == null ? null : String(data.location),
    workplace_type: data.workplace_type == null ? null : String(data.workplace_type),
    employment_type: data.employment_type == null ? null : String(data.employment_type),
    frequency: 'Instant', is_active: data.is_active === true, created_at: String(data.created_at || ''),
  };
}

export async function updateVerifiedCandidateJobAlert(
  userId: string, alertId: string, input: VerifiedCandidateJobAlertInput
): Promise<VerifiedCandidateJobAlert> {
  const sb = await authorizedCandidate(userId);
  const title = input.title.trim();
  if (!title) throw new Error('Enter a name for this job alert.');
  const nullableText = (value: string | null) => value?.trim() || null;
  const { data, error } = await sb.from('candidate_job_alerts').update({
    title,
    keywords: nullableText(input.keywords),
    department: nullableText(input.department),
    location: nullableText(input.location),
    workplace_type: nullableText(input.workplace_type),
    employment_type: nullableText(input.employment_type),
  }).eq('id', alertId).eq('candidate_user_id', userId)
    .select('id,title,keywords,department,location,workplace_type,employment_type,frequency,is_active,created_at')
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || 'Job alert is no longer available.');
  return {
    id: String(data.id), title: String(data.title || ''),
    keywords: data.keywords == null ? null : String(data.keywords),
    department: data.department == null ? null : String(data.department),
    location: data.location == null ? null : String(data.location),
    workplace_type: data.workplace_type == null ? null : String(data.workplace_type),
    employment_type: data.employment_type == null ? null : String(data.employment_type),
    frequency: 'Instant', is_active: data.is_active === true, created_at: String(data.created_at || ''),
  };
}

export async function setVerifiedCandidateJobAlertActive(
  userId: string, alertId: string, isActive: boolean
): Promise<VerifiedCandidateJobAlert> {
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_job_alerts').update({ is_active: isActive })
    .eq('id', alertId).eq('candidate_user_id', userId)
    .select('id,title,keywords,department,location,workplace_type,employment_type,frequency,is_active,created_at')
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || 'Job alert is no longer available.');
  return {
    id: String(data.id), title: String(data.title || ''),
    keywords: data.keywords == null ? null : String(data.keywords),
    department: data.department == null ? null : String(data.department),
    location: data.location == null ? null : String(data.location),
    workplace_type: data.workplace_type == null ? null : String(data.workplace_type),
    employment_type: data.employment_type == null ? null : String(data.employment_type),
    frequency: 'Instant', is_active: data.is_active === true, created_at: String(data.created_at || ''),
  };
}

export async function deleteVerifiedCandidateJobAlert(userId: string, alertId: string): Promise<void> {
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_job_alerts').delete()
    .eq('id', alertId).eq('candidate_user_id', userId).select('id').maybeSingle();
  if (error || !data) throw new Error(error?.message || 'Job alert is no longer available.');
}

/** Candidate notifications are read through owner-scoped RLS; writes are limited to the existing read-state field. */
export async function listVerifiedCandidateNotifications(userId: string): Promise<VerifiedCandidateNotification[]> {
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_notifications')
    .select('id,title,message,notification_type,related_application_id,related_job_id,action_view,is_read,created_at')
    .eq('candidate_user_id', userId)
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(row => ({
    id: String(row.id), title: String(row.title || ''), message: String(row.message || ''),
    notification_type: String(row.notification_type || 'system'),
    related_application_id: row.related_application_id == null ? null : String(row.related_application_id),
    related_job_id: row.related_job_id == null ? null : String(row.related_job_id),
    action_view: row.action_view == null ? null : String(row.action_view),
    is_read: row.is_read === true, created_at: String(row.created_at || ''),
  }));
}

/** Preserve the saved-jobs page contract while sharing the owner-scoped notification read. */
export async function listVerifiedJobAlertNotifications(userId: string): Promise<VerifiedCandidateNotification[]> {
  return (await listVerifiedCandidateNotifications(userId))
    .filter(notification => notification.notification_type === 'job_alert_match');
}

export async function markVerifiedCandidateNotificationRead(userId: string, notificationId: string): Promise<void> {
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_notifications').update({ is_read: true })
    .eq('id', notificationId).eq('candidate_user_id', userId).select('id').maybeSingle();
  if (error || !data) throw new Error(error?.message || 'Notification is no longer available.');
}

export async function markVerifiedJobAlertNotificationRead(userId: string, notificationId: string): Promise<void> {
  const sb = await authorizedCandidate(userId);
  const { data, error } = await sb.from('candidate_notifications').update({ is_read: true })
    .eq('id', notificationId).eq('candidate_user_id', userId)
    .eq('notification_type', 'job_alert_match').select('id').maybeSingle();
  if (error || !data) throw new Error(error?.message || 'Notification is no longer available.');
}
