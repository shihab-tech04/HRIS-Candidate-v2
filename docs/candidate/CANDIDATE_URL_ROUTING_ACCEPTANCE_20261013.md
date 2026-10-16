# Candidate URL Routing — Local Acceptance

**Checkpoint:** 2026-10-13. **State:** locally implemented and verified; not published or deployed.

## Implemented behavior

- Candidate app tabs are represented in the URL query as `view`; vacancy details and application flows also retain the `job` ID, and application tracking can retain the selected `application` ID.
- Initial load and browser back/forward restore the selected tab and record. Vacancy links survive refresh and can be shared. Existing unrelated query parameters and the URL fragment are preserved.
- Legacy `?job=<id>` links open the vacancy details page. Invalid/incomplete detail and application routes recover to the vacancy list.
- A direct application link waits for Auth session restoration; an unauthenticated visitor is prompted to sign in, then returns to the same application after successful authentication.
- The public-only Careers preview keeps its existing query-based route handler.

## Evidence

- `npm run test:routes`: **6/6 PASS** for route parsing/serialization and app wiring contracts.
- `npm run lint`: PASS.
- `npm run build -- --base=/HRIS-Candidate-v2/`: PASS; compiled Pages asset paths use the Candidate-v2 base.
- Local Chromium smoke: PASS for direct vacancy URL, refresh, back/forward, preservation of tracking parameters and fragment, direct application link, sign-in, and application refresh. Browser errors: 0. External requests were blocked; authentication used the local demo identity only.

## Scope and remaining release gates

The change does not submit applications, read or mutate Supabase, or alter public-only routing. Real Auth, Candidate SQL/RLS, private-document, complete recruitment, and production Pages acceptance remain unverified. No GitHub push or deployment occurred.
