/**
 * Core Type Definitions for Synesis Careers / Candidate Platform
 * Integrated with Synesis HRIS Main (Supabase project oslgwxaqfbteqtwqvdzs)
 */

export type WorkplaceType = 'Remote' | 'Hybrid' | 'On-site';
export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';

export interface PublishedJob {
  id: string;
  title: string;
  department: string;
  location: string;
  workplace_type: WorkplaceType;
  employment_type: EmploymentType;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefits?: string[];
  published_salary_min?: number;
  published_salary_max?: number;
  salary_currency?: string;
  salary_is_public: boolean;
  vacancy_count: number;
  application_deadline: string; // ISO date string
  status: 'published' | 'closed' | 'archived';
  published_at: string;
  created_at: string;
  screening_questions?: ScreeningQuestion[];
  required_documents?: string[];
}

export type ScreeningQuestionType = 'text' | 'long_text' | 'date' | 'yes_no' | 'select' | 'multiselect' | 'number';

export interface ScreeningQuestion {
  id: string;
  question: string;
  type: ScreeningQuestionType;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  experiences: CandidateExperience[];
  educations: CandidateEducation[];
  skills: string[];
  certifications: string[];
  portfolio_url?: string;
  linkedin_url?: string;
  github_url?: string;
  preferred_workplace?: WorkplaceType[];
  preferred_employment?: EmploymentType[];
  availability?: string;
  created_at: string;
  updated_at: string;
  profile_data?: Record<string, unknown>;
}

export interface CandidateStoredDocument {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  uploadedAt: string;
}

export interface CandidateExperience {
  id: string;
  title: string;
  company: string;
  location?: string;
  start_date: string;
  end_date?: string;
  current: boolean;
  description: string;
}

export interface CandidateEducation {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: string;
  end_year?: string;
  grade?: string;
}

export interface CandidateCV {
  id: string;
  user_id: string;
  title: string;
  version: string;
  is_default: boolean;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  structured_content?: Partial<CandidateProfile>;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'screening'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'assessment_pending'
  | 'offer_extended'
  | 'offer_accepted'
  | 'offer_declined'
  | 'withdrawn'
  | 'rejected'
  | 'hired';

export interface JobApplication {
  id: string;
  user_id: string;
  job_id: string;
  job?: PublishedJob;
  job_title?: string;
  department?: string;
  cv_id: string;
  cv_title?: string;
  status: ApplicationStatus;
  candidate_visible_status: string;
  stage_label: string;
  screening_answers: Record<string, any>;
  cover_letter?: string;
  documents?: { name: string; url: string; type: string }[];
  consent_given: boolean;
  submitted_at: string;
  updated_at: string;
  withdrawal_reason?: string;
  withdrawn_at?: string;
  stage_history?: ApplicationStageHistory[];
}

export interface ApplicationStageHistory {
  id: string;
  application_id: string;
  stage: string;
  created_at: string;
  note?: string;
}

export interface InterviewInvitation {
  id: string;
  application_id: string;
  job_title: string;
  department: string;
  round_name: string;
  scheduled_at: string; // ISO date string
  duration_minutes: number;
  timezone?: string;
  format: 'Video Call' | 'In-person' | 'Phone Call' | 'To be confirmed';
  meeting_link?: string;
  location?: string;
  interviewers: string[];
  instructions: string;
  status: 'pending' | 'accepted' | 'declined' | 'reschedule_requested' | 'completed' | 'cancelled';
  candidate_notes?: string;
  candidate_proposed_times?: string;
  created_at: string;
}

export interface CandidateAssessment {
  id: string;
  application_id: string;
  job_title: string;
  title: string;
  description: string;
  due_date: string;
  status: 'pending' | 'submitted' | 'reviewed';
  instructions: string;
  time_estimate?: string;
  candidate_response?: {
    submission_text?: string;
    file_url?: string;
    file_name?: string;
    submitted_at: string;
  };
  reviewed_at?: string;
  created_at: string;
}

export interface CandidateDocumentRequest {
  id: string;
  application_id: string;
  job_title: string;
  document_type: string;
  title: string;
  instructions: string;
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
  submitted_file_url?: string;
  submitted_file_name?: string;
  submitted_at?: string;
  created_at: string;
}

export interface JobOffer {
  id: string;
  application_id: string;
  job_title: string;
  department: string;
  salary: number;
  currency: string;
  salary_period: 'monthly' | 'annual';
  benefits_summary: string[];
  terms?: string;
  start_date: string;
  expiry_date: string;
  offer_document_url?: string;
  status: 'extended' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  signed_at?: string;
  candidate_signature?: string;
  candidate_response_notes?: string;
  created_at: string;
}

export interface OnboardingHandoff {
  id: string;
  application_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  candidate_completed_steps: string[];
  candidate_personal_data: {
    national_id?: string;
    passport_number?: string;
    date_of_birth?: string;
    nationality?: string;
    address?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    bank_name?: string;
    bank_account_number?: string;
    tax_identification_number?: string;
    policies_accepted?: boolean;
  };
  candidate_submitted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedJob {
  id: string;
  user_id: string;
  job_id: string;
  job: PublishedJob;
  saved_at: string;
}

export interface JobAlert {
  id: string;
  user_id: string;
  title: string;
  department?: string;
  workplace_type?: WorkplaceType;
  frequency: 'daily' | 'weekly';
  is_active: boolean;
  created_at: string;
}

export interface CandidateNotification {
  id: string;
  user_id: string;
  type: 'application' | 'interview' | 'assessment' | 'offer' | 'document' | 'system';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}
