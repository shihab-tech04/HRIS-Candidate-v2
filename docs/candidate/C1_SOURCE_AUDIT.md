# C1 SOURCE AUDIT — Synesis Careers Candidate-v2

Date: 2026-10-12 Asia/Dhaka. Source checkpoint: f41562d43888388ca9143398077a13634ebcdeb5. Recovery patch branch fix/c1-release-audit-20261012.
Scope: independent existing-product audit, narrow release recovery; Main HRIS repo remains read-only; shared production SQL unchanged.

## C1A release root cause

Controlled workflow 38162508915 failed after a successful Vite build. GitHub runner compiled dist/index.html and hashed dist/assets/index-*.js and index-*.css, but the workflow then executed test -s dist/app.html and exited 1. All nine legacy Bun tests and TypeScript check passed. The old build base /HRIS-Candidate/ was wrong for HRIS-Candidate-v2. It also committed generated assets to main while invoking deploy-pages. Separate successful Jekyll Pages run 38162572568 was not evidence of the Vite bundle loading. Source index.html omitted its closing head tag. Source 404.html used obsolete asset paths.

Recovery patch: canonical index.html fixed by copying existing valid app.html; Vite base corrected; CI requires compiled index/assets, creates compiled 404 fallback, uploads dist only, deploys with Pages Actions and HTTP-smokes HTML/JS/CSS. No candidate page, data adapter, or business rules changed.

## C1B feature-by-feature source classification

These verdicts describe static implementation, NOT proven runtime functionality. Zero candidate E2E or live SQL isolation tests have passed at this checkpoint.

| # | Feature | Verdict | Evidence and remaining gap |
|---|---|---|---|
| 1 | Published jobs, search and filters | PARTIAL | PublicJobsPage.tsx; api.ts getPublishedJobs queries candidate_published_jobs. Actual anon HTTP not tested |
| 2 | Job details, eligibility and deadlines | PARTIAL | VerifiedJobDetails.tsx, getPublishedJobById, server open-job check; shareable URL and browser reload not supported |
| 3 | Register, login, email verification and recovery | PARTIAL | AuthContext.tsx and AuthModal.tsx Supabase Auth; real verification email/restore not tested |
| 4 | Candidate profile and qualifications | PARTIAL | ProfilePage.tsx; candidate_update_profile RPC; write/read-back not tested |
| 5 | CV builder, versions and private upload | PARTIAL | CVBuilderPage.tsx; candidate_cvs, candidate-documents private bucket and signed URL; real upload/reload untested |
| 6 | Saved jobs | PARTIAL | VerifiedSavedJobsPage.tsx; direct candidate_saved_jobs SQL and ownership policy; no real browser test |
| 7 | Screening and application | PARTIAL | VerifiedApplyPage.tsx, api.ts applyToJob, candidate_apply_to_job; real submission untested |
| 8 | Draft / resume / review | PARTIAL | candidate_application_drafts upsert in api.ts, four-step production form; login refresh and all fields untested |
| 9 | Duplicate prevention | PARTIAL | SQL UNIQUE(job_id,candidate_user_id); no concurrent authenticated submit test |
| 10 | Tracking, milestones and withdrawal | PARTIAL | ApplicationsPage.tsx + recruitment context / withdrawal RPCs; direct stage history note exposure risk |
| 11 | Interview invitations and responses | PARTIAL | InterviewsPage.tsx + candidate_respond_interview; real SQL actor test absent |
| 12 | Assessments and requested documents | PARTIAL | TasksPage.tsx, two RPCs, secure upload; actual file-path negative tests absent |
| 13 | Offers, decisions and signatures | PARTIAL | OffersPage.tsx + candidate_respond_offer_record; no real recipient E2E |
| 14 | Preboarding / joining verification | BLOCKED | PreboardingPage.tsx exists, but api.ts updateOnboardingHandoff intentionally fails outside demo. Employer activation not certified |
| 15 | Notification preferences and alerts | DEMO ONLY / PARTIAL | api.ts getJobAlerts/createJobAlert use localStorage; notification SQL exists but email delivery and preferences unverified |

## Protected behavior and gaps

Production demo mode is disabled by api.ts DEMO_MODE requiring import.meta.env.DEV; development fixtures remain, but are not production records. React App.tsx navigation is state-only: currentTab, selectedJobId and pendingAction are not encoded in URLs or durable storage. A refresh during authentication can lose the intended vacancy. AuthContext retains one Supabase user identity; candidate code does not perform HR employee activation. Old docs/RELEASE_ACCEPTANCE.md uses “Verified Working” for many journeys without current live execution proof; do not reuse those conclusions.

Independent checkpoint: AUDIT RECORDED; feature certification BLOCKED. No broader functional expansion started.
