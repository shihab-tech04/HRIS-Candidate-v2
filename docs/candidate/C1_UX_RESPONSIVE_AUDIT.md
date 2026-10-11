# C1 UX / RESPONSIVE / ACCESSIBILITY AUDIT

Sources: Candidate-v2 source f41562d, current Synesis Figma design file XEXLe9J1oATlITS9I5u1P9 via connected Figma metadata on page 0:1. The ~2.9 MB page metadata primarily contains HRMIS employee/manager/admin frames, with no distinctly named complete Candidate Careers web journey observed. No pixel-perfect candidate Figma comparison was possible; do not infer approval.

| Area | Inspection and evidence | Verdict |
|---|---|---|
| Brand / typography | Poppins Google font in app.html; #085587 throughout components | PARTIAL — no Figma screenshot match |
| Responsive navigation | Navbar.tsx desktop md:flex and mobile menu, breakpoints | NOT TESTED on physical or automated browser |
| Route and deep-link UX | App.tsx routes by in-memory currentTab and selectedJobId only | BROKEN for shared URL / refresh state |
| Sign-in/register/recovery | AuthModal.tsx loading/error/confirmation notice and modal controls | PARTIAL; focus trap/return focus/keyboard not tested |
| Four-step production application | VerifiedApplyPage.tsx, server-owned draft | PARTIAL; keyboard and long form overflow untested |
| CV upload/preview | CVBuilderPage.tsx and private signed download | PARTIAL; assistive tech not tested |
| Application card/timeline | ApplicationsPage.tsx | PARTIAL; semantics and readability untested |
| Interview / assessment / offer | InterviewsPage, TasksPage, OffersPage | PARTIAL; narrow form actions untested |
| EN/BN | English-only copy observed, no verified switch/localized resource layer | BLOCKED for Bengali parity |
| WCAG 2.2 AA | Some labels/error states; raw spans and small text/tap targets present | NOT TESTED, cannot claim compliance |
| Mobile keyboard / sticky action | Not executed | NOT TESTED |

Required width-by-width audit: 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920 CSS px. ALL nine width visual/browser results: NOT TESTED. No responsive screenshot evidence was created, so no invented results.

Regression scenarios for next authorized test run: public job search and filters; auth dialog keyboard/focus and error announcements; application step forms and cancellation; CV input and signed preview; status timeline; interview and offer actions; Bengali text expansion; keyboard-covering sticky controls; 200–400% zoom, WCAG 2.2 focus visibility, contrast and target sizes.

C1 respects current page layouts. No redesign, token changes, or main HRIS changes were performed.
