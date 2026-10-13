import type { CandidateEducation, CandidateExperience, CandidateProfile } from '../types';

type ProfileData = Record<string, unknown>;
type CandidateProfileRpcPayload = Partial<CandidateProfile> & {
  current_location?: string;
  bio?: string;
  years_experience?: number | null;
  onboarding_completed?: boolean;
  profile_data?: ProfileData;
};

const asRecord = (value: unknown): ProfileData =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as ProfileData
    : {};
const asText = (value: unknown) => value == null ? '' : String(value);
const asRows = (value: unknown) =>
  Array.isArray(value) ? value.filter((row): row is Record<string, unknown> =>
    row !== null && typeof row === 'object' && !Array.isArray(row)) : [];
const asStrings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Map the Candidate HRIS profile DTO onto the existing Profile page model. */
export function adaptLiveCandidateProfile(raw: unknown): CandidateProfile & { profile_data: ProfileData } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Candidate profile service returned an invalid response.');
  }
  const row = raw as ProfileData;
  const profileData = asRecord(row.profile_data);
  return {
    ...row,
    id: asText(row.id ?? row.user_id),
    user_id: asText(row.user_id),
    full_name: asText(row.full_name),
    email: asText(row.email),
    phone: asText(row.phone),
    location: asText(row.current_location ?? row.location),
    headline: asText(row.headline),
    summary: asText(row.bio ?? row.summary),
    experiences: asRows(profileData.experiences) as unknown as CandidateExperience[],
    educations: asRows(profileData.educations) as unknown as CandidateEducation[],
    skills: asStrings(row.skills),
    certifications: asStrings(profileData.certifications),
    portfolio_url: asText(profileData.portfolio_url) || undefined,
    linkedin_url: asText(profileData.linkedin_url) || undefined,
    github_url: asText(profileData.github_url) || undefined,
    preferred_workplace: asStrings(profileData.preferred_workplace) as CandidateProfile['preferred_workplace'],
    preferred_employment: asStrings(profileData.preferred_employment) as CandidateProfile['preferred_employment'],
    availability: asText(profileData.availability) || undefined,
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
    profile_data: profileData,
  } as CandidateProfile & { profile_data: ProfileData };
}

/** Translate UI labels to the current_candidate_profiles RPC columns. */
export function toCandidateProfileRpcPayload(payload: CandidateProfileRpcPayload): ProfileData {
  const profileData = { ...asRecord(payload.profile_data) };
  for (const key of [
    'experiences', 'educations', 'certifications', 'portfolio_url', 'linkedin_url',
    'github_url', 'preferred_workplace', 'preferred_employment', 'availability',
  ] as const) {
    if (Object.hasOwn(payload, key)) profileData[key] = payload[key];
  }

  return {
    full_name: payload.full_name,
    phone: payload.phone,
    current_location: payload.location ?? payload.current_location,
    years_experience: payload.years_experience,
    headline: payload.headline,
    bio: payload.summary ?? payload.bio,
    skills: payload.skills,
    profile_data: profileData,
    onboarding_completed: payload.onboarding_completed,
  };
}
