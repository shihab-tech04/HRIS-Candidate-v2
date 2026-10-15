export type CandidateRecoveryLocation = Pick<Location, 'origin' | 'pathname'>;

/** Keep confirmation and recovery callbacks on the current Candidate app origin and path. */
export function candidateAppRedirectTo(location: CandidateRecoveryLocation): string {
  const redirect = new URL(location.pathname, location.origin);
  redirect.search = '';
  redirect.hash = '';
  return redirect.toString();
}

export function candidateRecoveryRedirectTo(location: CandidateRecoveryLocation): string {
  const redirect = new URL(candidateAppRedirectTo(location));
  redirect.searchParams.set('auth_flow', 'recovery');
  return redirect.toString();
}

/** Return a safe, non-sensitive recovery hint for an expired Supabase OTP callback. */
export function candidateRecoveryCallbackError(location: Pick<Location, 'search' | 'hash'>): string | null {
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const errorCode = query.get('error_code') || fragment.get('error_code');
  const flow = query.get('auth_flow') || fragment.get('auth_flow');
  return flow === 'recovery' && errorCode === 'otp_expired'
    ? 'This password reset link expired or was already used. Request a new password reset email.'
    : null;
}
