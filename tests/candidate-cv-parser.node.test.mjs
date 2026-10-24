import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractCandidateProfileFromCvFile, extractCandidateProfileFromCvText } from '../src/lib/candidateCvParser.ts';
import { toCandidateProfileRpcPayload } from '../src/lib/candidateProfileAdapters.ts';

const fixturePath = new URL('./fixtures/candidate-cv-parsing-fixture.docx', import.meta.url);

test('CV parser extracts editable profile suggestions from a DOCX file', async () => {
  const file = new File([await readFile(fixturePath)], 'candidate-cv-parsing-fixture.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const extraction = await extractCandidateProfileFromCvFile(file);

  assert.equal(extraction.profile.full_name, 'Mira Rani Patel');
  assert.equal(extraction.accountEmail, 'mira.patel@example.test');
  assert.equal(extraction.profile.summary, 'Design systems lead with 8 years of experience.');
  assert.deepEqual(extraction.profile.skills, ['Figma', 'User research', 'Accessibility']);
  assert.equal(extraction.profile.experiences?.[0].company, 'Example Studio');
  assert.equal(extraction.profile.educations?.[0].institution, 'Example University');
  assert.deepEqual(extraction.warnings, []);
});

test('CV parser avoids treating employment dates as a phone number and reports missing sections', () => {
  const extraction = extractCandidateProfileFromCvText('Mira Patel\n2021 - 2024\nSUMMARY\nProduct designer.');

  assert.equal(extraction.profile.phone, undefined);
  assert.equal(extraction.profile.summary, 'Product designer.');
  assert.ok(extraction.warnings.some(warning => warning.includes('email address was not detected')));
  assert.ok(extraction.warnings.some(warning => warning.includes('Work and education sections were not recognized')));
});

test('candidate profile adapter keeps existing opaque profile data and does not write the CV email', async () => {
  const file = new File([await readFile(fixturePath)], 'candidate-cv-parsing-fixture.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const extraction = await extractCandidateProfileFromCvFile(file);
  const current = {
    id: 'candidate-1', user_id: 'candidate-1', email: 'account@example.test', full_name: 'Old Name',
    phone: '', location: '', headline: '', summary: '', experiences: [], educations: [], skills: [],
    certifications: [], created_at: '', updated_at: '', profile_data: { marker: 'preserve', existing_setting: true },
  };
  const payload = toCandidateProfileRpcPayload({
    ...current,
    ...extraction.profile,
    profile_data: { ...current.profile_data, ...(extraction.profile.profile_data || {}) },
  });

  assert.equal(payload.full_name, 'Mira Rani Patel');
  assert.equal(payload.profile_data.marker, 'preserve');
  assert.equal(payload.profile_data.existing_setting, true);
  assert.equal(payload.profile_data.experiences[0].company, 'Example Studio');
  assert.equal(Object.hasOwn(payload, 'email'), false);
});

test('legacy DOC remains a private-uploadable file but is reported as unsupported for local parsing', async () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'legacy.doc', { type: 'application/msword' });
  await assert.rejects(
    extractCandidateProfileFromCvFile(file),
    /uploaded privately, but automatic parsing supports PDF and DOCX/,
  );
});
