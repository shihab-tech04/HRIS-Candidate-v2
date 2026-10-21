# Candidate UI route acceptance — 21 October 2026

## Scope and design evidence

This is the WS03 acceptance register for Candidate-v2. It records implemented behavior, route availability, and the design decision required for every Candidate screen. An implementation result is not a Figma parity claim.

The only Figma URL found in Candidate repository references is the Main HRIS file XEXLe9J1oATlITS9I5u1P9. Its three pages were inspected: Page 1 (0:1), Foundations (447:39801), and Components (448:39758). Page 1 contains employee, manager, HR and recruiter workflow material, but no approved Candidate Careers, vacancy list/detail, Candidate dashboard, registration, CV, applications, interviews, offers, preboarding or profile frame. Foundations contains design tokens; Components contains the Main HRMIS shell and shared HR form specimens. Neither is Candidate portal approval.

The Figma connection accepts a known file key but does not expose account-wide file discovery. Candidate repository references and the connected Main HRIS file were searched; no separate Candidate file URL or Candidate node URL is recorded. Therefore the finding is: **no approved Candidate-specific frame is verified in the accessible project evidence**. It is not a claim about unlinked files in the complete Figma account.

Main HRIS frames named Candidate, Vacant Seat, Resume, New Application, Dashboard or Profile are not treated as Candidate self-service designs. Employee New Application frame 265:48972 remains excluded. The 15 October PNGs are implementation captures, not design approval.

## Route-by-route acceptance

| Candidate route or screen | Public URL / source route | UI acceptance | Design decision and evidence |
|---|---|---|---|
| Careers home | /HRIS-Candidate-v2/ | SOURCE-BACKED IMPLEMENTATION | BLOCKED DESIGN: no approved Candidate Careers frame. Preserves existing Synesis Candidate branding and EN/BN hero. |
| Published vacancy list | /HRIS-Candidate-v2/ | SOURCE-BACKED IMPLEMENTATION | BLOCKED DESIGN: no approved Candidate vacancy-list frame. Reads only published, active, non-expired vacancies; authoritative empty remains empty. |
| Search and filters | In-page Careers list | SOURCE-BACKED IMPLEMENTATION | BLOCKED DESIGN: no Candidate filter/search specimen or pagination spec. Search, department, workplace type and employment type are source-backed and tested. |
| Vacancy detail | ?job=<published-id> | SOURCE-BACKED IMPLEMENTATION | BLOCKED DESIGN: no approved Candidate detail frame. Only a currently published vacancy returned by the public view can render; unknown, removed or expired IDs show unavailable state. |
| Apply flow | ?view=apply&job=<id> | SECURITY-BLOCKED | Private-only shell is not rendered in the production public build. Apply remains unavailable. |
| Registration and account recovery | AuthModal signup/recovery; no standalone public route | SECURITY-BLOCKED | No registration form or Auth mutation is exposed by the production public-only shell. |
| Candidate dashboard | ?view=dashboard | SECURITY-BLOCKED | Hidden pending WS02 Auth/RLS acceptance. |
| CV and documents | ?view=cv-builder | SECURITY-BLOCKED | Hidden pending WS02 Auth/RLS and private-document acceptance. |
| Applications | ?view=applications | SECURITY-BLOCKED | Hidden pending WS02 Auth/RLS acceptance. |
| Interviews | ?view=interviews | SECURITY-BLOCKED | Hidden pending WS02 Auth/RLS acceptance. |
| Tasks and requested documents | ?view=tasks | SECURITY-BLOCKED | Hidden pending WS02 Auth/RLS acceptance. |
| Offers | ?view=offers | SECURITY-BLOCKED | Hidden pending WS02 Auth/RLS acceptance. |
| Preboarding | ?view=preboarding | SECURITY-BLOCKED | Hidden pending WS02 Auth/RLS acceptance. |
| Profile | ?view=profile | SECURITY-BLOCKED | Hidden pending WS02 Auth/RLS acceptance. |
| Saved jobs | ?view=saved-jobs | SECURITY-BLOCKED | Save controls remain disabled in public-only mode; server-side ownership checks are not a substitute for WS02 acceptance. |
| About / Why Synesis | ?view=about | BLOCKED DESIGN | Existing full-app source screen is not linked from the production public-only shell. No Candidate-specific approved frame or public navigation decision was found. |
| Vacancy pagination | No route or pagination control in current source | BLOCKED DESIGN | No approved pagination layout, page size, sort order, URL behavior, or server-side range contract exists. Do not invent controls or truncate the published result set. |

No route is classified APPROVED DESIGN MATCH. Public routes are source-backed functional implementations with visual design parity still blocked. Private routes stay unavailable until WS02 certifies the underlying access contracts.

## Public behavior and test boundaries

- Production build remains guarded by VITE_CANDIDATE_PUBLIC_ONLY and renders PublicOnlyCareers. This WS03 branch does not alter release or deployment configuration.
- Public search and filters operate on the published-vacancy source; user-entered query state remains in-page. The approved behavior for shareable search/filter URLs is undecided.
- Expired vacancies are excluded from the public list and cannot be retrieved through the detail route.
- Service errors are distinct from a genuine empty result and have a retry action.
- Vacancy selection and return-to-list navigation update the job URL, reset scroll, and place keyboard focus at the destination heading.
- CI screenshots use an empty published-vacancy response only. Synthetic active and expired rows are used only for uncaptured browser assertions. Test APIs permit only GET candidate_published_jobs; Auth, storage, functions and all other REST operations are blocked. No test writes or private data are used.
- EN/BN, named search landmark, department group, focus visibility, loading/error/empty states, responsive widths, expired IDs, direct private-route denial, disabled Apply/Save, and keyboard/browser-history navigation are covered by the Candidate UI workflow. The PR description records the exact source SHA, run and screenshot artifact digests.

## Current source and deployment evidence

- Candidate development base: e3cb9c178cbfb66eb611c640f885a13581b50f51.
- Previous verified WS03 PR head: 28260cdf73b0af312df4cf136b61942f5363b573.
- Current Main branch/deployed Pages source at inspection: 38174c7b607999f951c7eea47aefaa443735080e.
- Latest successful Pages run: 38893422405 on 38174c7b607999f951c7eea47aefaa443735080e. Its build and deploy jobs passed, including the post-deploy check that fetched the served Candidate HTML, JavaScript and CSS. The release build enabled VITE_CANDIDATE_PUBLIC_ONLY=true.
- Public URL recorded by the Pages workflow: https://shihab-tech04.github.io/HRIS-Candidate-v2/.
- PR #8 browser CI is a no-deploy workflow. The current source changes are not deployed by WS03.
- This workstation could not independently retrieve the public page DOM during this check. The deployment source and served asset state above come from the latest successful Pages workflow, not a claim of a new live-browser session.

## Handoffs

- WS04: independently review the Candidate Figma evidence boundary, this route register, and the exact-head rendered artifact. Visual parity cannot be certified until a Candidate-specific frame set or written visual specification is approved.
- WS02: complete Auth/RLS, ownership, and private-document acceptance before enabling registration, application, save, or authenticated routes.
- WS05: coordinate release review; keep release gated pending WS02 acceptance and independent WS04 review. Do not treat the PR's no-deploy browser run as a production release.
