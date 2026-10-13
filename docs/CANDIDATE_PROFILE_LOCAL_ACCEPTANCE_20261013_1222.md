# Candidate profile local acceptance — 2026-10-13 12:22 +06

## Implemented

- `candidate_profiles` responses are adapted to the current Candidate profile form (`current_location` → `location`, `bio` → `summary`, plus nested experience, education, certification, and link data).
- Profile saves are translated to the existing `candidate_update_profile(p_payload)` contract. The adapter preserves unrelated nested `profile_data` and omits `user_id`, email, and tenant identifiers.
- The profile route waits for Auth/profile loading before rendering an editable form. If no active profile is returned, it shows an accessible retry/error state instead of a blank editable form.
- Existing personal, employment, education, skills, certification, and professional-link fields now have accessible names. Save errors and success have alert/status semantics.

## Acceptance

- Local Auth-backed UI journey: `CANDIDATE_C1_LOCAL_E2E PASS=19 FAIL=0 viewports=2 inactive_retry=2 profile_read_write=tenant-B refresh=verified auth=local-gotrue`.
- This browser journey is preserved as `tests/candidate-profile-local-e2e.mjs` and runs with `npm run test:local-profile-e2e`. It refuses non-local API URLs, requires the dedicated Candidate C1 test project and zero existing local Auth users, binds the Vite server to a strict port, and restores the synthetic tenant B profile snapshot and profile IDs after execution.
- The browser test used a dedicated Candidate Vite port with strict binding and the isolated Supabase API. It verified an inactive account receives the backend denial and retry UI on desktop and mobile; an active tenant B candidate loads, edits, and saves location, headline, bio, and skill; service-role readback confirmed protected tenant/email values and opaque marker preservation; a new 375px browser session showed the persisted profile with no viewport overflow.
- Test cleanup removed both temporary local Auth users and restored the synthetic fixture profile values and IDs.
- `npm run lint`: pass.
- `npm run test:routes`: 12/12 pass (candidate routing, dashboard recovery, profile DTO/RPC adapter, profile loading/retry, and accessible control contracts).
- `npm run build`: pass. Existing Vite config-loader and large-chunk warnings are non-fatal.

The early browser attempt exposed a real page-loading race: the blank form could render before Auth profile hydration. The page now blocks editing until the profile request completes. The passing database readback used only the isolated local project; it does not certify production integration.
