import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptLiveCandidateProfile, toCandidateProfileRpcPayload } from '../src/lib/candidateProfileAdapters.ts';

test('live candidate profile DTO maps HRIS columns and profile data to the existing form', () => {
  const profile = adaptLiveCandidateProfile({
    user_id: 'user-b', email: 'b@example.test', full_name: 'Candidate B', phone: '+8801',
    current_location: 'Chattogram', headline: 'Designer', bio: 'Profile summary',
    skills: ['Figma'], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
    profile_data: {
      experiences: [{ id: 'exp-1', title: 'Designer' }],
      educations: [{ id: 'edu-1', degree: 'BFA' }],
      certifications: ['UX Certificate'], portfolio_url: 'https://portfolio.example',
      linkedin_url: 'https://linkedin.example', github_url: 'https://github.example',
      availability: '30 days', untouched: { value: 'preserve' },
    },
  });

  assert.equal(profile.id, 'user-b');
  assert.equal(profile.location, 'Chattogram');
  assert.equal(profile.summary, 'Profile summary');
  assert.equal(profile.experiences[0].id, 'exp-1');
  assert.equal(profile.educations[0].degree, 'BFA');
  assert.deepEqual(profile.skills, ['Figma']);
  assert.deepEqual(profile.certifications, ['UX Certificate']);
  assert.equal(profile.portfolio_url, 'https://portfolio.example');
  assert.equal(profile.profile_data.untouched.value, 'preserve');
});

test('profile form payload maps writable UI fields and preserves opaque HRIS profile data', () => {
  const payload = toCandidateProfileRpcPayload({
    id: 'user-b', user_id: 'user-b', email: 'b@example.test', full_name: 'Candidate B',
    phone: '+8802', location: 'Sylhet', headline: 'Senior Designer', summary: 'Updated summary',
    experiences: [{ id: 'exp-1', title: 'Lead Designer' }],
    educations: [{ id: 'edu-1', degree: 'MFA' }], skills: ['Figma', 'Research'],
    certifications: ['UX Certificate', 'Accessibility'], portfolio_url: 'https://portfolio.example',
    linkedin_url: 'https://linkedin.example', github_url: 'https://github.example',
    profile_data: { untouched: { value: 'preserve' } },
  });

  assert.equal(payload.current_location, 'Sylhet');
  assert.equal(payload.bio, 'Updated summary');
  assert.deepEqual(payload.skills, ['Figma', 'Research']);
  assert.deepEqual(payload.profile_data.experiences, [{ id: 'exp-1', title: 'Lead Designer' }]);
  assert.deepEqual(payload.profile_data.educations, [{ id: 'edu-1', degree: 'MFA' }]);
  assert.deepEqual(payload.profile_data.certifications, ['UX Certificate', 'Accessibility']);
  assert.equal(payload.profile_data.untouched.value, 'preserve');
  assert.equal(Object.hasOwn(payload, 'tenant_id'), false);
  assert.equal(Object.hasOwn(payload, 'email'), false);
  assert.equal(Object.hasOwn(payload, 'user_id'), false);
});
