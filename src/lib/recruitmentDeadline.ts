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
