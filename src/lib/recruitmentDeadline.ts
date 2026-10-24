/**
 * Date-only recruitment deadline parity with PostgreSQL CURRENT_DATE.
 *
 * Hosted HRIS uses UTC as its PostgreSQL TimeZone. A DATE value is inclusive
 * for the full UTC calendar day; never parse it as midnight and compare
 * against an instant (that incorrectly expires applications during their
 * published deadline). The authoritative server still validates submissions.
 */
export function isRecruitmentDeadlineOpen(
  deadline: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deadline) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false;
  const parsed = new Date(`${deadline}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== deadline) return false;
  return deadline >= now.toISOString().slice(0, 10);
}

/**
 * PostgreSQL DATE values are calendar dates, not viewer-local instants.
 * Force UTC when displaying the same deadline in English or Bengali, so
 * viewers west of UTC never see the previous day in a public vacancy.
 */
export function formatRecruitmentDeadlineDate(
  deadline: string,
  locale: 'en-BD' | 'bn-BD',
): string {
  return new Date(deadline).toLocaleDateString(locale, { timeZone: 'UTC' });
}
