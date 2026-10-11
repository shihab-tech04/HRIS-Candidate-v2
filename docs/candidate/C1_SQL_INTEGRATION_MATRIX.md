# C1 SQL INTEGRATION MATRIX — read-only production inspection

Database: hrmis-saas / oslgwxaqfbteqtwqvdzs. Inspection 2026-10-12. Source and live SQL contracts examined; no schema, auth or user data altered.

| Candidate UI/action | Adapter and SQL contract | RLS/transaction behavior and verdict |
|---|---|---|
| Anonymous published jobs | api.ts getPublishedJobs → candidate_published_jobs (view → candidate_public_jobs_source()) | View anon SELECT and security_invoker; RPC anon EXECUTE; filters published/active/deadline. PARTIAL: public HTTP untested |
| Keyword/filter and job detail | PublicJobsPage, VerifiedJobDetails, getPublishedJobById | Client filters server-sourced jobs; no URL deep link. PARTIAL |
| Login and recovery | AuthContext → Supabase Auth | One auth user identity; verification mail and session expiry NOT TESTED |
| Profile | get_my_candidate_profile(); candidate_update_profile(p_payload jsonb) | Candidate live session and active profile; read-back NOT TESTED |
| CV list/write | candidate_cvs direct SELECT/UPSERT | candidate_user_id=auth.uid() RLS. PARTIAL |
| Private CV/document uploads | storage candidate-documents; createSignedUrl | private bucket, owner path, PDF/DOC/DOCX, 10 MiB. PARTIAL; cross-user negative test absent |
| Saved jobs | candidate_saved_jobs | Own-user RLS; unique(candidate_user_id,job_id). PARTIAL |
| Draft save/load/delete | candidate_application_drafts | Own-user INSERT/UPDATE/SELECT/DELETE, unique(candidate_user_id,job_id); partial form state. PARTIAL |
| Apply | candidate_apply_to_job(p_job_id uuid,p_payload jsonb) | Active session/profile, open job and deadline, owned CV and mandatory screening, unique(job_id,candidate_user_id), returns UUID. PARTIAL |
| Application tracking | candidate_get_recruitment_context() | JSON scopes to auth.uid and strips some private fields. PARTIAL; raw table issue below |
| Withdraw | candidate_withdraw_application(p_application_id uuid,p_reason text) | Candidate-owned state update. PARTIAL |
| Interview | candidate_respond_interview(p_interview_id uuid,p_response text,p_reason text,p_proposed_times text) | Only scheduled own interview; confirmed/declined/reschedule_requested. PARTIAL |
| Assessment | candidate_submit_assessment(p_assessment_id uuid,p_payload jsonb) | Checks live session, candidate ownership, deadline, file storage path. PARTIAL |
| Requested document | candidate_submit_requested_document(p_request_id uuid,p_file_name text,p_file_path text) | Valid owned storage path and pending request; this exact signature matches api.ts. PARTIAL |
| Offer decision | candidate_respond_offer_record(p_offer_id uuid,p_response text,p_note text,p_signature text) | Candidate-own issued offer, response deadline, signature. Does not accept employer financial parameters. PARTIAL |
| Preboarding / hire | onboarding_handoffs + Main HRIS employee provisioning | Client-side production update blocked. HR identity-preserving join NOT TESTED/BLOCKED |
| Alerts and preferences | localStorage methods | No verified SQL preference mutations. DEMO ONLY |

## Explicit security and contract findings

- candidate_published_jobs is security_invoker=true and calls candidate_public_jobs_source. It nulls salary_min and salary_max when salary not published, but returns salary_currency even for hidden salary. Backend confidentiality projection needs review; frontend hiding is insufficient proof.
- candidate_application_stage_history has an authenticated SELECT policy for own application and returns ALL table columns, including note and actor_user_id. candidate_get_recruitment_context strips actor ID and most note text, but direct Data API SELECT can bypass that projection for the user's own application. Treat as security review FAILURE until safely fixed and tested; no claim of real note leakage.
- job_applications SELECT allows candidate owner OR has_permission('recruitment.view/manage'). Main HRIS global RBAC remains uncertified for arbitrary tenants; same applies to staff document access.
- candidate_assessments and candidate_document_requests have no direct RLS SELECT policy in inspected set; authorized security-definer RPCs expose filtered context. Test actual actor boundaries.
- candidate-documents bucket public=false; storage.objects policies restrict candidate path to their Auth ID, while staff access uses has_permission.
- Current production RPC candidate_respond_offer (two fields) is NOT executable by authenticated; correct portal uses candidate_respond_offer_record (four fields).
- No Service Role key is present in the inspected browser client; the release uses a Supabase public publishable key only.

This matrix is implementation/schema evidence only; executed SQL end-to-end PASS count: 0.
