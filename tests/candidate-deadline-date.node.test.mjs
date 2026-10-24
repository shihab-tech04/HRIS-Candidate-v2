import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRecruitmentDeadlineDate, isRecruitmentDeadlineOpen } from '../src/lib/recruitmentDeadline.ts';

// PostgreSQL DATE is independent of browser timezone; changing client
// timezone must not display a different published application deadline.
test('public vacancy deadline date is stable across UTC, Dhaka, and western timezones in EN/BN', () => {
  const before = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Dhaka', 'America/Los_Angeles', 'Pacific/Honolulu']) {
      process.env.TZ = zone;
      assert.equal(formatRecruitmentDeadlineDate('2026-10-24', 'en-BD'), '10/24/2026', zone);
      assert.equal(formatRecruitmentDeadlineDate('2026-10-24', 'bn-BD'), '২৪/১০/২০২৬', zone);
    }
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test('published application deadline remains open through its UTC calendar day', () => {
  assert.equal(isRecruitmentDeadlineOpen('2026-10-24', new Date('2026-10-24T23:59:59.999Z')), true);
  assert.equal(isRecruitmentDeadlineOpen('2026-10-24', new Date('2026-10-25T00:00:00.000Z')), false);
  assert.equal(isRecruitmentDeadlineOpen('2026-02-30', new Date('2026-02-24T00:00:00.000Z')), false);
});
