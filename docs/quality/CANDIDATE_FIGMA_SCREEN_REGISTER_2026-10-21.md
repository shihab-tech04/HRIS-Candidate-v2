# Candidate Figma screen register — 21 October 2026

## Decision

**No approved Candidate-specific Figma screen has been verified in the linked design source.** The Main HRIS file is not a valid visual target for the Candidate portal. Candidate work may preserve and verify existing Candidate source behavior, but this register does not claim a 1:1 Figma match or authorize a new visual system.

## Design-source evidence

- The only Figma file referenced by the Candidate repository is the Main HRIS file `XEXLe9J1oATlITS9I5u1P9`, also cited in `docs/candidate/C1_UX_RESPONSIVE_AUDIT.md`.
- Connected Figma metadata lists `Page 1`, `Foundations`, and `Components`. The `Page 1` metadata was inspected on 21 October 2026 (2,880,867 characters). Its named frames include HRIS and recruiter workflows; no named Candidate Careers, vacancy list/detail, candidate dashboard, registration, CV, application, interview, offer, preboarding, or profile screens were found.
- Candidate-related labels found in that Main HRIS page (`Candidate`, `Vacant Seat`, `Resume`, and `New Application`) are not approved Candidate self-service frame mappings. In particular, Employee `New Application` frame `265:48972` is explicitly excluded.
- Repository search found no separate Candidate Figma file or Candidate node URL. The 15 October PNGs under `docs/evidence/` are implementation captures, not design approval. Their former demo vacancy is not used as current data or a design target.

## Route-to-screen map

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

Before this packet, exact PR head `795db5117401a6404e37e164b23bcf12a06a6073` passed Candidate UI workflow run `39551170035` (run 7, 21 October 2026). The existing responsive screenshot artifact `12323686214` (`candidate-public-responsive-screenshots`, SHA-256 `9c560344fc980edf0ba4878678a602a3768124bbca4db9f8fe89046da0971e4d`) and static build artifact `12323946026` (SHA-256 `917d788077029c59b4ecb09d330d27bcc0794c1cc680ed0ac488e89c3143e2f9`) are preserved. This register does not replace that passing result; the updated acceptance run will produce new evidence on its own exact commit.
