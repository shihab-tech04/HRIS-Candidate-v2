import type { JobApplication, JobOffer, InterviewInvitation, CandidateDocumentRequest, ApplicationStatus, OnboardingHandoff } from '../types';

/** Adapt the actual Supabase JSON DTO to the existing Careers UI.
 * No sample values, inferred compensation or public storage links.
 * Source: candidate_get_recruitment_context (public.hrmis-saas).
 */
type Row = Record<string, unknown>;
const asText = (value: unknown) => value == null ? '' : String(value);
const asRows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((r): r is Row =>
    r !== null && typeof r === 'object' && !Array.isArray(r)) : [];
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const format = (source: unknown): InterviewInvitation['format'] => {
  const text = asText(source).toLowerCase();
  if (text.includes('video') || text.includes('remote') || text.includes('online')) return 'Video Call';
  if (text.includes('phone') || text.includes('telephone')) return 'Phone Call';
  if (text.includes('in-person') || text.includes('onsite') || text.includes('on-site')) return 'In-person';
  return 'To be confirmed';
};
export function adaptLiveOffer(row: Row): JobOffer {
  return {
    id: asText(row.id),
    application_id: asText(row.application_id),
    job_title: asText(row.job_title),
    department: asText(row.department_name ?? row.department),
    salary: Number(row.salary_amount ?? row.salary),
    currency: asText(row.salary_currency ?? row.currency ?? 'BDT'),
    salary_period: asText(row.pay_period ?? row.salary_period).toLowerCase() === 'annual' ? 'annual' : 'monthly',
    benefits_summary: strings(row.benefits_summary),
    terms: asText(row.terms),
    start_date: asText(row.proposed_joining_date ?? row.start_date),
    expiry_date: asText(row.response_deadline ?? row.expiry_date),
    status: row.status === 'issued' ? 'extended' : (row.status as JobOffer['status']),
    signed_at: row.status === 'accepted' ? asText(row.responded_at ?? row.signed_at) : undefined,
    candidate_signature: row.status === 'accepted' ? asText(row.acceptance_signature) : undefined,
    candidate_response_notes: asText(row.response_note),
    created_at: asText(row.issued_at ?? row.created_at)
  };
}
export function adaptLiveInterview(row: Row): InterviewInvitation {
  const response = asText(row.candidate_response);
  const status: InterviewInvitation['status'] = row.status === 'cancelled' ? 'cancelled'
    : row.status === 'completed' ? 'completed'
    : response === 'confirmed' ? 'accepted'
    : response === 'declined' ? 'declined'
    : response === 'reschedule_requested' ? 'reschedule_requested' : 'pending';
  const location = asText(row.location_or_link);
  return {
    id: asText(row.id),
    application_id: asText(row.application_id),
    job_title: asText(row.job_title),
    department: asText(row.department_name ?? row.department),
    round_name: asText(row.interview_type ?? row.round_name),
    scheduled_at: asText(row.scheduled_at),
    duration_minutes: Number(row.duration_minutes ?? 60),
    format: format(row.interview_type),
    meeting_link: /^https:\/\//i.test(location) ? location : undefined,
    location: location && !/^https:\/\//i.test(location) ? location : undefined,
    interviewers: strings(row.panel_members ?? row.interviewers),
    instructions: asText(row.instructions),
    status,
    candidate_notes: asText(row.candidate_response_note),
    created_at: asText(row.created_at)
  };
}
export function adaptLiveDocumentRequest(row: Row): CandidateDocumentRequest {
  return {
    id: asText(row.id),
    application_id: asText(row.application_id),
    job_title: asText(row.job_title),
    document_type: asText(row.document_type),
    title: asText(row.title),
    instructions: asText(row.instructions),
    status: row.status as CandidateDocumentRequest['status'],
    submitted_file_name: asText(row.submitted_file_name),
    submitted_at: asText(row.submitted_at),
    created_at: asText(row.created_at)
  };
}
export function adaptLiveOnboardingHandoff(raw: unknown): OnboardingHandoff {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Preboarding service returned an invalid response.');
  }
  const row = raw as Row;
  const data = row.candidate_personal_data && typeof row.candidate_personal_data === 'object'
    && !Array.isArray(row.candidate_personal_data) ? row.candidate_personal_data as Row : {};
  const stringFields = [
    'national_id', 'passport_number', 'date_of_birth', 'nationality', 'address',
    'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
    'bank_name', 'bank_account_number', 'tax_identification_number',
  ] as const;
  const personalData = Object.fromEntries(stringFields.flatMap(key =>
    typeof data[key] === 'string' ? [[key, data[key]]] : [])) as OnboardingHandoff['candidate_personal_data'];
  if (typeof data.policies_accepted === 'boolean') personalData.policies_accepted = data.policies_accepted;
  const status = ['pending', 'in_progress', 'completed', 'cancelled'].includes(asText(row.status))
    ? row.status as OnboardingHandoff['status'] : 'pending';
  return {
    id: asText(row.id),
    application_id: asText(row.application_id),
    status,
    candidate_completed_steps: strings(row.candidate_completed_steps),
    candidate_personal_data: personalData,
    candidate_submitted_at: typeof row.candidate_submitted_at === 'string' ? row.candidate_submitted_at : null,
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  };
}
function applicationStatus(row: Row): ApplicationStatus {
  const raw = asText(row.status || row.stage).toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  const valid: ApplicationStatus[] = [
    'draft','submitted','under_review','screening','interview_scheduled','assessment_pending',
    'offer_extended','offer_accepted','offer_declined','withdrawn','rejected','hired'
  ];
  if (valid.includes(raw as ApplicationStatus)) return raw as ApplicationStatus;
  if (raw.includes('withdraw')) return 'withdrawn';
  if (raw.includes('reject')) return 'rejected';
  if (raw.includes('hire')) return 'hired';
  if (raw.includes('offer') && raw.includes('accept')) return 'offer_accepted';
  if (raw.includes('offer') && raw.includes('declin')) return 'offer_declined';
  if (raw.includes('offer')) return 'offer_extended';
  if (raw.includes('assessment')) return 'assessment_pending';
  if (raw.includes('interview')) return 'interview_scheduled';
  if (raw.includes('screen')) return 'screening';
  return 'submitted';
}
const visibleApplicationStatus: Record<ApplicationStatus, string> = {
  draft: 'Draft', submitted: 'Application Submitted', under_review: 'Under Review',
  screening: 'Screening in Progress', interview_scheduled: 'Interview Scheduled',
  assessment_pending: 'Assessment Pending', offer_extended: 'Offer Extended',
  offer_accepted: 'Offer Accepted', offer_declined: 'Offer Declined',
  withdrawn: 'Withdrawn', rejected: 'Not Selected', hired: 'Hired'
};
export function adaptLiveApplication(row: Row): JobApplication {
  const data = row.application_data && typeof row.application_data === 'object' && !Array.isArray(row.application_data)
    ? row.application_data as Row : {};
  const answers = asRows(data.answers);
  const screeningAnswers = Object.fromEntries(answers.flatMap(answer =>
    typeof answer.questionId === 'string' && Object.hasOwn(answer, 'answer')
      ? [[answer.questionId, answer.answer]] : []
  ));
  const status = applicationStatus(row);
  return {
    id: asText(row.id),
    user_id: asText(row.candidate_user_id),
    job_id: asText(row.job_id),
    job_title: asText(row.job_title) || 'Applied Position',
    department: asText(row.department_name),
    cv_id: asText(data.selected_cv_id),
    cv_title: asText(data.cv_title) || undefined,
    status,
    candidate_visible_status: asText(row.candidate_visible_status) || visibleApplicationStatus[status],
    stage_label: asText(row.stage_label || row.stage) || visibleApplicationStatus[status],
    screening_answers: screeningAnswers,
    cover_letter: asText(row.cover_letter) || undefined,
    consent_given: (data.declarations as Row | undefined)?.recruitmentDataConsent === true,
    submitted_at: asText(row.applied_at || row.submitted_at),
    updated_at: asText(row.updated_at || row.applied_at || row.submitted_at),
  };
}
export function adaptLiveRecruitmentContext(raw: unknown): Record<string, any> & {offers:JobOffer[];interviews:InterviewInvitation[];document_requests:CandidateDocumentRequest[]} {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Recruitment service returned an invalid response.');
  }
  const ctx = raw as Row;
  return {
    ...ctx,
    applications: asRows(ctx.applications).map(adaptLiveApplication),
    offers: asRows(ctx.offers).map(adaptLiveOffer),
    interviews: asRows(ctx.interviews).map(adaptLiveInterview),
    document_requests: asRows(ctx.document_requests).map(adaptLiveDocumentRequest)
  };
}
