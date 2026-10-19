export type CandidateRoute = {
  tab: string;
  jobId?: string;
  applicationId?: string;
};

const allowedTabs = new Set([
  'jobs', 'job-details', 'apply', 'dashboard', 'applications', 'cv-builder',
  'interviews', 'tasks', 'offers', 'preboarding', 'profile', 'saved-jobs', 'about',
]);

function safeId(value: string | null | undefined): string | undefined {
  return value && /^[A-Za-z0-9_-]{1,160}$/.test(value) ? value : undefined;
}

export function parseCandidateRoute(search: string): CandidateRoute {
  const params = new URLSearchParams(search);
  const jobId = safeId(params.get('job'));
  const applicationId = safeId(params.get('application'));
  const requested = params.get('view');
  const tab = requested && allowedTabs.has(requested) ? requested : jobId ? 'job-details' : 'jobs';
  if ((tab === 'job-details' || tab === 'apply') && !jobId) return { tab: 'jobs' };
  return { tab, jobId, applicationId };
}

export function candidateRouteUrl(currentHref: string, route: CandidateRoute): string {
  const url = new URL(currentHref);
  url.searchParams.delete('view');
  url.searchParams.delete('job');
  url.searchParams.delete('application');
  const tab = allowedTabs.has(route.tab) ? route.tab : 'jobs';
  const jobId = safeId(route.jobId);
  const applicationId = safeId(route.applicationId);
  if ((tab === 'job-details' || tab === 'apply') && !jobId) return url.pathname + url.search + url.hash;
  // A plain ?job= permalink also opens the public-only vacancy preview.
  if (tab !== 'jobs' && tab !== 'job-details') url.searchParams.set('view', tab);
  if ((tab === 'job-details' || tab === 'apply') && jobId) url.searchParams.set('job', jobId);
  if (tab === 'applications' && applicationId) url.searchParams.set('application', applicationId);
  return url.pathname + url.search + url.hash;
}
