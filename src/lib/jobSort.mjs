/** Stable display sorting. Never mutate or refetch the published-job API response. */
export function sortPublishedJobs(jobs, mode = 'default') {
  const result = [...jobs];
  if (mode === 'default') return result;
  if (mode === 'title') {
    return result.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'en', { sensitivity: 'base' }));
  }
  if (mode !== 'newest' && mode !== 'deadline') return result;
  const timestamp = job => {
    const value = mode === 'newest' ? (job.published_at || job.created_at) : job.application_deadline;
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : null;
  };
  return result.sort((a, b) => {
    const aDate = timestamp(a);
    const bDate = timestamp(b);
    if (aDate === null) return bDate === null ? 0 : 1;
    if (bDate === null) return -1;
    return mode === 'newest' ? bDate - aDate : aDate - bDate;
  });
}
