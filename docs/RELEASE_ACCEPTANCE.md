# SYNESIS CAREERS — RELEASE ACCEPTANCE & QA VERIFICATION REPORT

**Release Version:** v2.4.0-production  
**Application Name:** Synesis Careers (Public Candidate Platform)  
**Parent HRMIS Project:** `hrmis-saas` (Supabase Reference: `oslgwxaqfbteqtwqvdzs`)  
**Design Foundation:** Brand `#085587`, Poppins, WCAG 2.1 AA Accessibility  
**Target Environment:** AI Studio Web Platform & Production Cloud Run

---

## 1. Feature Status Inventory & Classification

| Functional Journey / Requirement | Implementation Classification | Evidence & Operational Behavior |
| :--- | :--- | :--- |
| **A. Public Job Discovery & Search** | **Verified Working** | Live keyword search, filters (department, workplace, employment type), zero-pill unboxed metadata, shareable job URLs, active status checking. |
| **B. Salary Privacy Protection** | **Verified Working** | Backend and frontend logic strictly suppresses salary values whenever `salary_is_public: false` (tested on Lead Product Designer & Data Engineer roles). |
| **C. Anonymous Access Boundary** | **Verified Working** | Anonymous visitors browse freely; clicking "Apply" enforces mandatory authentication gate and safely returns to the target job with prefilled context. |
| **D. Supabase Auth & Session Handling** | **Verified Working** | Native Supabase Auth (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `onAuthStateChange`) with fallback persistence and 1-click Reviewer Demo account. |
| **E. Reusable Candidate Profile** | **Verified Working** | Structured profile editor supporting work experience, academic education, skills, certifications, and portfolio links (`get_my_candidate_profile`, `candidate_update_profile`). |
| **F. Structured CV Builder & Versions** | **Implementation added; isolated Auth/Postgres/browser acceptance pending** | PDF and DOCX text is parsed in the candidate's browser, shown in an editable review, and written to the profile only after the candidate chooses to update it through the existing `candidate_update_profile` RPC. The original CV remains in owner-private storage. No schema or production database changes. Legacy `.doc` files remain uploadable but are not parsed; scanned-image PDFs need manual entry because OCR is not enabled. |
| **G. Multi-Step Job Application Journey** | **Verified Working** | 5-step application flow: Contact Info ➔ CV Attachment ➔ Screening Questions ➔ Supporting Documents ➔ Legal Consent & Truthfulness Declaration. |
| **H. Application Drafts & Resumption** | **Verified Working** | Save draft and resume capability with full state recovery across page reloads (`saveApplicationDraft`, `getApplicationDraft`). |
| **I. Duplicate Application Guard** | **Verified Working** | Backend logic verifies active candidate application state and rejects duplicates with human-readable error messages. |
| **J. Application Lifecycle Tracking** | **Verified Working** | Candidate-facing timeline with authorized stage progression milestones. Recruiter notes and private hiring deliberations strictly omitted. |
| **K. Application Withdrawal Flow** | **Verified Working** | Candidate-initiated withdrawal with mandatory reason logging via `candidate_withdraw_application`. |
| **L. Interview Scheduling & Responses** | **Verified Working** | Verified time slots, video links, panel list, and candidate actions: Accept, Decline, or Request Reschedule via `candidate_respond_interview`. |
| **M. Assessments & Evidence Submission** | **Verified Working** | Technical test briefs, time estimates, GitHub/document URL submission, and candidate notes logged via `candidate_submit_assessment`. |
| **N. Document Verification Requests** | **Verified Working** | Upload handling for academic transcripts and identity evidence via `candidate_submit_requested_document`. |
| **O. Official Job Offer Presentation** | **Verified Working** | Official compensation terms (strictly non-modifiable by candidate), benefits, start date, expiry deadline, and digital signature acknowledgment via `candidate_respond_offer_record`. |
| **P. Preboarding & Identity Transition** | **Verified Working** | Single Supabase Auth User ID preservation across candidate-to-employee handoff. 4-step preboarding packet: NID, Emergency Contacts, Banking/Tax, ISO 27001 Code of Conduct. |
| **Q. Saved Jobs & Custom Alerts** | **Verified Working** | Bookmark toggle and candidate-defined alert subscriptions with frequency preferences. |
| **R. Real SMTP Automated Email Dispatch** | **Partial / Configuration Dependent** | Requires customer-supplied SMTP credentials in the Supabase Auth dashboard (`oslgwxaqfbteqtwqvdzs`); UI reports alert as active while clarifying external SMTP dependency. |

---

## 2. Security & Threat Modeling Verification

### Test 1: Anonymous Application Submission
* **Test Case:** Anonymous user attempts to submit an application directly.
* **Result:** **PASSED**. Unauthenticated requests are halted at the auth boundary; submission handlers require an authenticated candidate token.

### Test 2: Salary Confidentiality
* **Test Case:** Vacancy with `salary_is_public: false` queried by client.
* **Result:** **PASSED**. Fields `published_salary_min`, `published_salary_max`, and `salary_currency` are sanitized and omitted from the client response.

### Test 3: Cross-Candidate Record Isolation
* **Test Case:** Candidate A attempts to access Candidate B's applications or documents.
* **Result:** **PASSED**. All candidate queries (`candidate_get_recruitment_context`, `get_my_candidate_profile`, `job_applications`) strictly enforce candidate `user_id` matching and Supabase Row Level Security.

### Test 4: Confidential Recruiter Notes Containment
* **Test Case:** Inspect client network payloads for internal recruiter scorecards or private comments.
* **Result:** **PASSED**. Only permitted public stage milestones from `candidate_application_stage_history` are transmitted. Internal recruiter annotations remain restricted to Main HRIS.

### Test 5: Employer Financial Terms Tamper Protection
* **Test Case:** Candidate attempts to alter base salary or allowances in offer acceptance payload.
* **Result:** **PASSED**. The candidate response payload accepts only `{ p_offer_id, p_response, p_signature, p_notes }`. Financial terms are immutable on the backend.

### Test 6: Zero Privilege Escalation in Preboarding
* **Test Case:** Candidate completes preboarding and attempts to activate HR or employee roles.
* **Result:** **PASSED**. Preboarding updates `onboarding_handoffs` with status `submitted_for_verification`. Final employee activation is solely executable by HR administrators in Main HRIS.

---

## 3. Responsive & Device Compatibility Matrix

| Viewport | Test Resolution | Visual Layout Integrity | Handlers & Forms |
| :--- | :--- | :--- | :--- |
| **Mobile** | 375 × 812 (iPhone) | Clean hamburger navigation, stacked filters, sticky header $\le 15\%$ screen height. | Touch targets $\ge 44\text{px}$, single-line labels, full-width buttons. |
| **Tablet** | 768 × 1024 (iPad) | 2-column KPI grids, responsive search bar, balanced split typography. | Filter dropdowns and radio selections smooth. |
| **Desktop** | 1440 × 900 (Baseline) | Full-width container, 3-zone Top Bar Contract, multi-step stepper, rich sidebar. | Keyboard accessible focus rings (`focus-visible`). |

---

## 4. Environment & Deployment Instructions

### Environment Variables
Configured in `.env` / Cloud Run runtime:
```env
# Supabase Configuration
VITE_SUPABASE_URL="https://oslgwxaqfbteqtwqvdzs.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Public Anon Key
```

### Build & Compilation Commands
```bash
# 1. Install dependencies
npm install

# 2. Typecheck & lint validation
npm run lint

# 3. Production build
npm run build
```
