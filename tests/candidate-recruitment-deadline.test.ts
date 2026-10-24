import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { isRecruitmentDeadlineOpen } from '../src/lib/recruitmentDeadline';

describe('Candidate public list / application deadline parity with hosted Postgres UTC calendar DATE', () => {
  const deadline = '2026-10-24';
  test('opening minute and last second of deadline are both accepted', () => {
    expect(isRecruitmentDeadlineOpen(deadline, new Date('2026-10-24T00:00:00.000Z'))).toBe(true);
    expect(isRecruitmentDeadlineOpen(deadline, new Date('2026-10-24T23:59:59.999Z'))).toBe(true);
  });
  test('the following UTC day is expired', () => {
    expect(isRecruitmentDeadlineOpen(deadline, new Date('2026-10-25T00:00:00.000Z'))).toBe(false);
  });
  test('future date is open; missing date keeps existing public listing behavior', () => {
    expect(isRecruitmentDeadlineOpen('2026-10-25', new Date('2026-10-24T12:00:00.000Z'))).toBe(true);
    expect(isRecruitmentDeadlineOpen(null, new Date('2026-10-24T12:00:00.000Z'))).toBe(true);
  });
  test('malformed date is not treated as open', () => {
    expect(isRecruitmentDeadlineOpen('2026-24-10', new Date('2026-10-24T12:00:00.000Z'))).toBe(false);
    expect(isRecruitmentDeadlineOpen('2026/10/24', new Date('2026-10-24T12:00:00.000Z'))).toBe(false);
  });
  test('public vacancy list and protected application flow call the same helper', () => {
    const code = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
    expect(code).toContain('isRecruitmentDeadlineOpen(j.application_deadline)');
    expect(code).toContain('if (!isRecruitmentDeadlineOpen(job.application_deadline)) {');
    expect(code).not.toContain('new Date(job.application_deadline).getTime() < Date.now()');
  });
});
