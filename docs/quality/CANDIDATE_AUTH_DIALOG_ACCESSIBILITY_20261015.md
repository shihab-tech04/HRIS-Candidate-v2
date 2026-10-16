# Phase 18 — Candidate Auth Dialog Accessibility

## Change

- The sign-in dialog now has a programmatic name and description, associated labels for name/email/password fields, announced error and success states, initial focus, keyboard focus containment, Escape dismissal, and focus restoration to its opener.
- The existing Auth actions, labels, locale switching, layout, and release guard are preserved.

## Verification

- `npm run lint`: PASS.
- `npm run test:routes`: PASS — 26/26.
- `npm run build`: PASS. Existing Vite configuration and large-chunk advisories remain.
- `npm run test:auth-accessibility`: PASS — desktop 1280px and mobile 375px, English and Bengali, field labels, focus trap/restore, mobile overflow, and blocked external requests.
- Browser acceptance uses synthetic Auth with a dummy `.invalid` Supabase endpoint and does not certify live Auth/Postgres integration.
- No production data, permissions, GitHub `main`, or deployment changed.
