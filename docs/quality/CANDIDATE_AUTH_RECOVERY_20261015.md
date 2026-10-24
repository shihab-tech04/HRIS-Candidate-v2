# Candidate Authentication Recovery — 2026-10-15

## Functional changes

- Sign-up email confirmation now explicitly returns to the Candidate app path rather than relying on the shared Supabase Site URL.
- Password reset requests explicitly return to the Candidate app and mark the recovery flow, avoiding collisions with signup or other OTP callbacks.
- The Supabase `PASSWORD_RECOVERY` event opens a dedicated password update form. A mismatch is rejected before calling Auth; a successful update clears the local recovery session and returns the candidate to sign-in.
- Escape/close cancels recovery and clears the local recovery session. Expired recovery links open the reset-email form with a localized retry message; expired non-recovery OTPs are not misclassified.
- Recovery field labels, states, validation and messages reuse the existing Auth modal and EN/BN locale.

## Verification

- `npm run lint`: TypeScript passed.
- `npm run test:routes`: 30 passed, 0 failed.
- `npm run build`: passed. Existing Vite native-config and large-chunk advisories remain.
- `npm run test:auth-accessibility`: passed at 1280px and 375px, English and Bengali.
- `npm run test:password-recovery`: passed synthetic sign-up confirmation, app redirect, reset email, recovery callback, mismatched-password rejection, password update, sign-in using the updated password, cancellation, expired-link retry, English/Bengali, and 1280px/375px layouts. The runner blocks non-local network requests.
- `git diff --check`: passed before commit.

## Explicit limits

- The browser test uses a synthetic Auth endpoint and synthetic identity. It does not certify a real Supabase Auth session, delivery email, redirect allowlist, or persisted profile.
- The connected Supabase tools do not expose the Auth redirect allowlist. Supabase requires `redirectTo`/`emailRedirectTo` destinations to be on that project's allowed list; the Candidate production URL must be verified there before the live recovery/confirmation journey can be accepted.
- No production Auth setting, SQL, data, GitHub `main`, or live deployment was changed.
