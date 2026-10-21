# Candidate Figma screen register — 21 October 2026

## Decision

**No approved Candidate-specific Figma screen has been verified in the linked design source.** The Main HRIS file is not a valid visual target for the Candidate portal. Candidate work may preserve and verify existing Candidate source behavior, but this register does not claim a 1:1 Figma match or authorize a new visual system.

## Design-source evidence

- The only Figma file referenced by the Candidate repository is the Main HRIS file `XEXLe9J1oATlITS9I5u1P9`, also cited in `docs/candidate/C1_UX_RESPONSIVE_AUDIT.md`.
- Connected Figma metadata lists `Page 1` (`0:1`), `Foundations` (`447:39801`), and `Components` (`448:39758`). On 21 October 2026 all three pages were inspected. `Page 1` metadata was 2,880,867 characters and contains employee, manager, HR and recruiter workflows; no Candidate Careers, vacancy list/detail, Candidate dashboard, registration, CV, application, interview, offer, preboarding, or profile frame was found. `Foundations` contains design tokens; `Components` contains the Main HRMIS shell and shared HR form specimens.
- Candidate-related labels found in that Main HRIS page (`Candidate`, `Vacant Seat`, `Resume`, and `New Application`) are not approved Candidate self-service frame mappings. In particular, Employee `New Application` frame `265:48972` is explicitly excluded.
- Candidate repository references and the read-only audit branch `audit/candidate-ux-parity-20261021` (`169b54be1d41bfff0072527474863142e3602171`) contain no separate Candidate Figma file or Candidate node URL. The Figma connection can inspect a known file key but does not expose account-wide file discovery; this finding is limited to the accessible project evidence and does not claim unlinked files were searched. The 15 October PNGs under `docs/evidence/` are implementation captures, not design approval. Their former demo vacancy is not used as current data or a design target.

## Route-to-screen map

The route-by-route acceptance status, source/deployment SHAs, pagination decision, browser test boundary and WS04/WS05 handoff are recorded in `docs/quality/CANDIDATE_UI_ROUTE_ACCEPTANCE_2026-10-21.md`.

| Journey | Candidate source and route | Approved Candidate frame | Production availability |
|---|---|---|---|
| Careers and vacancy search | `PublicOnlyCareers` → `PublicJobsPage`; `/HRIS-Candidate-v2/` | `NO_APPROVED_FRAME` | Public view only; reads published vacancies |
| Vacancy details | `VerifiedJobDetails`; `?job=<published-id>` | `NO_APPROVED_FRAME` | Public published fields only; unavailable records show an explicit not-found state |
| Registration | `AuthModal` (`signup` mode; no standalone route) | `NO_APPROVED_FRAME` | Hidden in the production public-only shell |
| Candidate dashboard | `DashboardPage`; `?view=dashboard` | `NO_APPROVED_FRAME` | Hidden pending WS02 Auth/RLS acceptance |
| CV and documents | `CVBuilderPage`; `?view=cv-builder` | `NO_APPROVED_FRAME` | Hidden pending WS02 Auth/RLS acceptance |
| Applications | `ApplicationsPage`; `?view=applications` | `NO_APPROVED_FRAME` | Hidden pending WS02 Auth/RLS acceptance |
| Interviews | `InterviewsPage`; `?view=interviews` | `NO_APPROVED_FRAME` | Hidden pending WS02 Auth/RLS acceptance |
| Offers | `OffersPage`; `?view=offers` | `NO_APPROVED_FRAME` | Hidden pending WS02 Auth/RLS acceptance |
| Preboarding | `PreboardingPage`; `?view=preboarding` | `NO_APPROVED_FRAME` | Hidden pending WS02 Auth/RLS acceptance |
| Profile | `ProfilePage`; `?view=profile` | `NO_APPROVED_FRAME` | Hidden pending WS02 Auth/RLS acceptance |

## Acceptance needed to claim design parity

WS04/WS05 need an approved Candidate design source: the Figma file and exact node IDs for the public Careers list and detail views at desktop and mobile widths, plus exact frame IDs for each authenticated journey above. If no Figma designs exist, approve a written Candidate visual specification (typography, tokens, shell/navigation, responsive rules, vacancy-card and detail layouts) before any source-based redesign is called complete. Until then, keep the existing Candidate brand and components, record visual parity as **BLOCKED: NO_APPROVED_FRAME**, and make only source-backed accessibility, behavior, privacy, and responsiveness fixes.

## Safety and evidence rules

- Production remains gated to `PublicOnlyCareers` by `VITE_CANDIDATE_PUBLIC_ONLY` in `src/App.tsx`.
- Production vacancy reads never fall back to `INITIAL_PUBLISHED_JOBS`; an authoritative empty response stays empty. No application, registration, save, or private Candidate mutation is enabled in the public-only view.
- The established Poppins font remains primary. The existing Bengali fallback now ships locally as `Noto Sans Bengali Variable`, so EN/BN screenshots render without relying on the host operating system's font set.
- CI screenshots are captured only against an intercepted empty published-vacancy response. A visibly labeled synthetic row is used only in uncaptured browser assertions for responsive card/detail behavior and disabled actions; the route is read-only and no record is written.
- This work does not alter Main HRIS, production SQL, Auth/RLS, or release/deployment configuration.

## Preserved prior acceptance

Before the prior completion packet, exact PR head `795db5117401a6404e37e164b23bcf12a06a6073` passed Candidate UI workflow run `39551170035` (run 7). That completion packet's exact head `28260cdf73b0af312df4cf136b61942f5363b573` then passed run `39554069318` (run 8). The run 7 screenshot artifact `12323686214` (SHA-256 `9c560344fc980edf0ba4878678a602a3768124bbca4db9f8fe89046da0971e4d`) and run 8 screenshot artifact `12324732472` (SHA-256 `908f3dd18fabf6af096b104253511f8d34c2a56fcfe909a2713afb994da6e15c`) remain preserved. Current completion fixes and exact-head evidence are recorded in PR #8 and the linked route-acceptance register.
