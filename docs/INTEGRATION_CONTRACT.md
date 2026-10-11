# SYNESIS CAREERS — HRMIS MAIN INTEGRATION CONTRACT

**Document Version:** 2.4.0  
**Target Backend:** Supabase HRMIS Project `hrmis-saas`  
**Project Reference:** `oslgwxaqfbteqtwqvdzs`  
**Host URL:** `https://oslgwxaqfbteqtwqvdzs.supabase.co`  
**Authentication Authority:** Supabase Auth (Unified Candidate & Employee Identity)

---

## 1. Executive Summary & Integration Principles

This contract governs the data interface between **Synesis Careers** (the public recruitment & candidate management platform) and **Synesis HRIS Main** (the internal enterprise HR administration system).

### Core Architectural Principles:
1. **Single Source of Truth:** All candidate profiles, published vacancies, screening questions, applications, interview responses, and offer signatures reside in the shared Supabase database.
2. **Unified Identity Handoff:** When a candidate accepts an official job offer, their Supabase Auth User ID (`user_id`) transitions directly into the employee record in `employees`. No secondary account or credential split is permitted.
3. **Strict Information Boundary:** Internal recruiter evaluations, confidential salary approval chains, and private hiring manager notes are shielded by Row Level Security (RLS) and never queryable by candidate tokens.
4. **Non-Modifiable Financial Terms:** Candidates cannot edit or negotiate financial figures inside the digital signature payload; only employer-approved terms in `job_offers` may be executed.

---

## 2. Shared Integration Workflows

### X01 — Job Publication Lifecycle
```
[Main HRIS: HR Recruiter]
   │
   ├─► Creates vacancy & screening questions
   ├─► Sets salary visibility flag (`salary_is_public: true/false`)
   ├─► Sets application deadline and vacancy count
   └─► Sets status to `published`
         │
         ▼
[PostgreSQL View: candidate_published_jobs]
         │
         ▼
[Synesis Careers: Candidate Web Platform]
   ├─► Anonymously queryable via public REST view
   ├─► Filters out closed/draft jobs
   ├─► Suppresses salary fields if `salary_is_public = false`
   └─► Blocks new applications if deadline < NOW() or status != 'published'
```

### X02 — Candidate Application & Screening Flow
```
[Synesis Careers: Candidate]
   │
   ├─► Authenticates via Supabase Auth (Sign In / Register)
   ├─► Pre-fills personal data from `candidate_profiles`
   ├─► Selects or uploads versioned CV from `candidate_cvs`
   ├─► Answers mandatory job-specific screening questions
   ├─► Submits legal recruitment consent & truthfulness declaration
   └─► Invokes RPC: `candidate_apply_to_job(p_job_id, p_payload)`
         │
         ▼
[HRMIS Database: job_applications & stage_history]
   ├─► Validates no duplicate active application exists
   ├─► Validates job is open and accepting submissions
   └─► Persists application with status `submitted`
         │
         ▼
[Main HRIS: Recruiter Review]
   ├─► Visible instantly in applicant tracker
   ├─► Recruiter schedules interview or issues task
   └─► Updates external milestone label in `candidate_application_stage_history`
```

### X03 — Job Offer, Preboarding & Employee Activation
```
[Main HRIS: Executive Approval]
   │
   ├─► HR issues official offer record into `job_offers`
   ├─► Status: `extended` with non-editable salary, benefits, start date
         │
         ▼
[Synesis Careers: Candidate Action]
   ├─► Receives notification & reviews compensation breakdown
   ├─► Candidate signs digitally via RPC: `candidate_respond_offer_record`
   ├─► Accepts offer ──► Automatically provisions `onboarding_handoffs`
         │
         ▼
[Synesis Careers: Preboarding Packet]
   ├─► Step 1: Legal Identity & NID
   ├─► Step 2: Emergency Contact Information
   ├─► Step 3: Bank Account & Tax Identification (e-TIN)
   ├─► Step 4: ISO 27001 & Code of Conduct acknowledgment
   └─► Candidate submits handoff packet for HR verification
         │
         ▼
[Main HRIS: HR Final Verification & Joining Confirmation]
   ├─► HR reviews uploaded documents
   ├─► Confirms joining date and assigns employee code
   └─► Activates employee status in `employees` maintaining the SAME Auth User ID
```

---

## 3. Verified RPC Contracts & Payloads

### A. Vacancy Listing
* **Target View:** `candidate_published_jobs`
* **Access Level:** Anonymous Public Access
* **Fields:**
```json
{
  "id": "uuid",
  "title": "text",
  "department": "text",
  "location": "text",
  "workplace_type": "Remote | Hybrid | On-site",
  "employment_type": "Full-time | Part-time | Contract",
  "summary": "text",
  "responsibilities": ["text"],
  "requirements": ["text"],
  "benefits": ["text"],
  "published_salary_min": "numeric (nullable)",
  "published_salary_max": "numeric (nullable)",
  "salary_currency": "text",
  "salary_is_public": "boolean",
  "vacancy_count": "integer",
  "application_deadline": "timestamptz",
  "status": "published | closed | archived",
  "screening_questions": [
    {
      "id": "text",
      "question": "text",
      "type": "text | yes_no | select | multiselect | number",
      "required": "boolean",
      "options": ["text"]
    }
  ]
}
```

### B. Application Submission
* **Target RPC:** `candidate_apply_to_job`
* **Parameters:** `p_job_id (uuid)`, `p_payload (jsonb)`
* **Payload Schema:**
```json
{
  "user_id": "uuid",
  "cv_id": "uuid",
  "cv_title": "string",
  "screening_answers": {
    "q1": "value",
    "q2": "value"
  },
  "cover_letter": "string (optional)",
  "documents": [
    { "name": "string", "url": "string", "type": "string" }
  ],
  "consent_given": true
}
```

### C. Application Withdrawal
* **Target RPC:** `candidate_withdraw_application`
* **Parameters:** `p_application_id (uuid)`, `p_reason (text)`

### D. Interview Response
* **Target RPC:** `candidate_respond_interview`
* **Parameters:** `p_interview_id (uuid)`, `p_response (accepted | declined | reschedule_requested)`, `p_notes (text)`

### E. Assessment Work Submission
* **Target RPC:** `candidate_submit_assessment`
* **Parameters:** `p_assessment_id (uuid)`, `p_payload (jsonb)`
```json
{
  "submission_text": "string",
  "file_url": "string (optional)",
  "file_name": "string (optional)"
}
```

### F. Requested Document Submission
* **Target RPC:** `candidate_submit_requested_document`
* **Parameters:** `p_request_id (uuid)`, `p_payload (jsonb)`
```json
{
  "file_url": "string",
  "file_name": "string"
}
```

### G. Job Offer Response
* **Target RPC:** `candidate_respond_offer_record`
* **Parameters:** `p_offer_id (uuid)`, `p_response (accepted | declined)`, `p_signature (text)`, `p_notes (text)`

---

## 4. Status Mapping Table

| Internal HRIS Status | Candidate Visible Label | Candidate Next Action |
| :--- | :--- | :--- |
| `new_inbound` | Application Submitted | Awaiting screening review |
| `screening_pass` | Application Screening | Candidate verified |
| `interview_scheduled` | Interview Round Scheduled | Accept / Reschedule in portal |
| `interview_completed` | Interview Under Evaluation | Awaiting hiring decision |
| `assessment_assigned` | Technical Assessment Active | Complete & submit by due date |
| `offer_extended` | Official Offer Received | Review terms & digitally sign |
| `offer_accepted` | Offer Accepted · Preboarding | Complete preboarding packet |
| `onboarding_verified` | Verified · Joining Confirmed | First day preparation |
| `candidate_withdrawn` | Application Withdrawn | Inactive |
| `archived_declined` | Application Concluded | View other vacancies |
