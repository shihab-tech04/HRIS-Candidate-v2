# Candidate UX route and Figma acceptance baseline — 21 October 2026

## Authoritative source

- Repository `shihab-tech04/HRIS-Candidate-v2`, branch `development/hris-checkpoints`.
- Source code: `src/App.tsx`, `src/lib/candidateRoutes.ts`, `src/pages/*`.
- Exactly **13 distinct CandidateTab route IDs** are enumerated by the current route contract; **17 TSX page files** exist in `src/pages` (including public-only and verified/legacy route variants). Route count does not imply separate screen count.
- The production GitHub Pages site displays **PublicOnlyCareers** under the public-only gate: vacancy browsing is live; candidate registration/applications and private authenticated journeys are not released.
- The only approved HRIS Figma key recovered and verified is [XEXLe9J1oATlITS9I5u1P9](https://www.figma.com/design/XEXLe9J1oATlITS9I5u1P9). Its inspected Page 1 is predominantly Main HRIS; **no canonical Candidate authenticated screen-to-frame inventory is validated yet**. Do not invent frames, pixel-match claims or replacement designs.
- Existing audited source/evidence: Candidate [PR #6](https://github.com/shihab-tech04/HRIS-Candidate-v2/pull/6) demonstrates disposable Auth/RLS/browser coverage at `530c2de`; development behavior is not live sign-in/hosted acceptance. Frozen release [PR #5](https://github.com/shihab-tech04/HRIS-Candidate-v2/pull/5) remains draft and public-only until secure release gates pass.

## Route-level audit queue (source-based, not implementation certification)

| Route | Source page(s) | Production vs development | Audit packet |
|---|---|---|---|
| `jobs` | `PublicJobsPage` | Live public-only preview; standard development jobs route | Vacancy search/filter; empty/success/loading; responsive |
| `job-details` | `VerifiedJobDetails / JobDetailsPage` | Authenticated/public dev routes; production gate | Direct/deep link, return to results, job eligibility |
| `apply` | `VerifiedApplyPage / ApplyPage` | Not live under public-only gate | Auth return path, form validation, upload, submission |
| `dashboard` | `DashboardPage` | Not live under public-only gate | Activity summary; navigation; initial/error/empty |
| `applications` | `ApplicationsPage` | Not live under public-only gate | Status/history/details; owner-only data |
| `cv-builder` | `CVBuilderPage` | Not live under public-only gate | Draft/review/export; protected CV documents |
| `interviews` | `InterviewsPage` | Not live under public-only gate | Invite/confirm/reschedule/cancel/history; timezone |
| `tasks` | `TasksPage` | Not live under public-only gate | Task and status rendering; role-only |
| `offers` | `OffersPage` | Not live under public-only gate | Offer viewing/acceptance; no unapproved writes |
| `preboarding` | `PreboardingPage` | Not live under public-only gate | Packet/steps/documents; eventual HR activation |
| `profile` | `ProfilePage` | Not live under public-only gate | Profile edit/recovery, validation; own-only |
| `saved-jobs` | `VerifiedSavedJobsPage / SavedJobsPage` | Not live under public-only gate | Save/remove; alerts and state persistence |
| `about` | `AboutPage` | Unknown live route under public-only gate | Content, navigation, responsive |

## UX/QA acceptance matrix required for each route

- Entry/navigation/deep-link; responsive desktop (1280/1920), tablet (e.g., 768), mobile (375); active/busy/error/empty/success and recovery; keyboard, focus, semantic names, field validation; Poppins, brand and translations EN/BN; privacy and tenant roles; source/route-to-approved-Figma mapping or approved no-frame rationale; exact source SHA, browser capture and result.
- Keep `DEMO_MODE` source variants clearly separate from verified routes. Do not treat demonstration views as authorized functionality.
- Candidate-specific Figma coverage is **unknown**, not zero design quality. No new screens/tokens/components are authorized without verified source or acceptance.
- Release depends on WS02 hosted RPC/RLS review, WS04 independent parity, WS05 guarded merge, backup and live validation.

## First three independent 20–30-minute execution packets

1. **CAND-UI-01**: Audit the **public jobs** production route at 375/768/1280 and compare dev source/search/filter/empty/error states. Record matched Figma or no-frame gap without redesign.
2. **CAND-UI-02**: Audit **sign-in → apply → application status** route states in isolated browser Auth with owner/foreign/anonymous cases; do not enable public-only gate.
3. **CAND-UI-03**: Audit **interviews/offers/preboarding** as a linked flow; mark missing hosted recruiter APIs separately from Candidate viewer UI and local test success.

**Result:** Route inventory complete; 13 route-level visual parity verdicts pending. No production/config/data writes or release.
