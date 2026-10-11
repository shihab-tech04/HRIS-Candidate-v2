import type { JobOffer, InterviewInvitation, CandidateDocumentRequest } from '../types';

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
export function adaptLiveRecruitmentContext(raw: unknown): Record<string, any> & {offers:JobOffer[];interviews:InterviewInvitation[];document_requests:CandidateDocumentRequest[]} {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Recruitment service returned an invalid response.');
  }
  const ctx = raw as Row;
  return {
    ...ctx,
    offers: asRows(ctx.offers).map(adaptLiveOffer),
    interviews: asRows(ctx.interviews).map(adaptLiveInterview),
    document_requests: asRows(ctx.document_requests).map(adaptLiveDocumentRequest)
  };
}
