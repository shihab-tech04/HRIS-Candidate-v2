# HRMIS recovery baseline — 10 October 2026

## Authority and recovery target

This repository is a *Gemini reconstruction candidate*, not the original certified project.
The original account/repositories are currently inaccessible through the connected replacement GitHub identity (404). Do not assert byte-identical restoration.

Historical pre-suspension records (NOT independently recovered in this repository):
- Main HRIS: final work reached at least implementation PR #94 (recorded SHA `3bebe8d63967dd8b94f3cdbdb192b6b7442b1027`).
- Candidate: implementation PR #20 (recorded SHA prefix `e031b832c1`).
- 42 regression cases were recorded as tested; **0 entire product / 1,047-story certification** was established. The exact historical tests and their current compatibility are not verified.
- Remaining blockers: candidate-to-employee onboarding, authorized offer document generation, CV parsing/upload, reminders, expense/travel settlement, production browser/RLS acceptance and the full EN/BN design comparison.

Reference sources held in ChatGPT Project/Library:
- Figma design key `XEXLe9J1oATlITS9I5u1P9`
- 80-page HRIS design PDF `hris all pdf.pdf`
- 78-page live HRIS screenshots `hris live system ss (2).pdf`
- Supabase `hrmis-saas` project `oslgwxaqfbteqtwqvdzs` — **preserve schema, records and Auth identities**.

## Current recovery safety controls

- The `main` branch stays unchanged until a meaningful, verified recovery release.
- Changes are isolated in draft PR(s) with build/typecheck only.
- No GitHub Pages, production frontend release, environment promotion or automatic deployment.
- No SQL migrations, production data writes, production tests or changes to existing Auth records.
- Do not turn local demo actions into production workflows or claim they represent backend success.
- No new roles, leave/payroll policies or backend workflows without source evidence.
- Use a single verified Supabase tenant/contract; preserve candidate ID when converting to employee.
- Never put service-role credentials or private user data into client code.
- Group significant functional changes for one acceptance-led deployment only, after security and cross-platform end-to-end tests.

## Recovery acceptance blockers

1. Reconstruct original feature inventory and compare old/new commits when original source becomes accessible.
2. Staff and candidate authentication with actual Supabase session/tenant roles.
3. All application/offer/preboarding records must round-trip through verified RPCs and RLS.
4. CV storage and required documents must use authenticated private storage; no blob URL substitutions.
5. Cross-role isolated E2E: HR publish -> candidate view -> login -> apply -> review/interview/assessment -> authorized offer -> preboarding -> employee record, same Auth identity.
6. Verify all 80-page design and 78-page live-software source flows, mobile and EN/BN parity where applicable.
7. Protect published salary confidentiality, recruiter-only notes, tenant data, immutable audit trail and offer reissue.
8. CI production build/typecheck, robust integration/regression tests, and authorized acceptance before merge or deployment.

## Release status

**RECOVERY IN PROGRESS / NOT SAFE TO DEPLOY.** No production release or completed historical restoration is claimed.
