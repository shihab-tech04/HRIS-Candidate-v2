export const CANDIDATE_TABS = [
  'jobs',
  'job-details',
  'apply',
  'dashboard',
  'applications',
  'cv-builder',
  'interviews',
  'tasks',
  'offers',
  'preboarding',
  'profile',
  'saved-jobs',
  'about',
] as const;

export type CandidateTab = typeof CANDIDATE_TABS[number];

export type CandidateRoute = {
  tab: CandidateTab;
  jobId?: string;
  applicationId?: string;
};

type LocationParts = {
  pathname: string;
  search: string;
  hash: string;
};

function isCandidateTab(value: string | null): value is CandidateTab {
  return value !== null && CANDIDATE_TABS.includes(value as CandidateTab);
}

export function parseCandidateRoute(search: string): CandidateRoute {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const requestedTab = params.get('view');
  let tab: CandidateTab = isCandidateTab(requestedTab) ? requestedTab : 'jobs';
  const jobId = params.get('job')?.trim() || undefined;

  // Keep legacy share links such as ?job=<id> opening the vacancy details.
  if (requestedTab === null && jobId) tab = 'job-details';
  if ((tab === 'job-details' || tab === 'apply') && !jobId) tab = 'jobs';

  if (tab === 'job-details' || tab === 'apply') return { tab, jobId };
  if (tab === 'applications') {
    const applicationId = params.get('application')?.trim() || undefined;
    return { tab, ...(applicationId ? { applicationId } : {}) };
  }
  return { tab };
}

export function candidateRouteHref(
  location: LocationParts,
  route: CandidateRoute,
): string {
  const params = new URLSearchParams(location.search);
  params.delete('view');
  params.delete('job');
  params.delete('application');

  if (route.tab !== 'jobs') params.set('view', route.tab);
  if ((route.tab === 'job-details' || route.tab === 'apply') && route.jobId) {
    params.set('job', route.jobId);
  }
  if (route.tab === 'applications' && route.applicationId) {
    params.set('application', route.applicationId);
  }

  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
}
