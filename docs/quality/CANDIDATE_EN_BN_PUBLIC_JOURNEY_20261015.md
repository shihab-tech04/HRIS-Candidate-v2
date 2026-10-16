# Candidate EN/BN Public Journey — 2026-10-15

## Scope

Added shared English/Bengali selection and translated the public careers entry journey, vacancy list and details, candidate navigation/footer, sign-in gate, and verified application form. The existing public-only production guard remains enabled by the release configuration. Database calls, authentication rules, application payloads, routes, and business decisions were not changed.

The language choice is stored as `synesis-candidate-locale-v1` and applied to the document `lang` attribute. Vacancy and application content supplied by employers or candidates remains as entered.

## Verification

- TypeScript check (`npm run lint`): passed.
- Candidate route, adapter, recovery, application-contract, and localization tests: 24 passed, 0 failed.
- Production build: passed. Vite reported the existing large-chunk advisory; output was generated successfully.
- Isolated public-only browser journey: 12 checks passed, 0 failed at 1280px and 375px. It covered EN/BN switching, job details, direct-link refresh recovery, guarded Apply behavior, returning to the list, persisted locale, and horizontal-overflow checks.
- Isolated shared-shell/Auth-gate browser journey: 9 checks passed, 0 failed at 1280px and 375px. Apply opened the localized sign-in gate; locale switching inside the dialog and mobile overflow checks passed.
- Browser runs used one synthetic vacancy and a dummy `.invalid` Supabase host. All other external requests were blocked; no production requests were made.

## Evidence and limits

- `docs/evidence/candidate-careers-bn-desktop-20261015.png`
- `docs/evidence/candidate-careers-bn-mobile-20261015.png`
- `docs/evidence/candidate-auth-bn-mobile-20261015.png`

These browser checks verify UI behavior only. Auth/Postgres/RLS acceptance and actual application persistence remain pending until the approved isolated test environment is healthy. No live Auth session was used, and this record does not claim that integration passed.
