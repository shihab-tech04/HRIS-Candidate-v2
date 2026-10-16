import { expect, mock, test } from 'bun:test';

const jobId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const applicationId = '33333333-3333-4333-8333-333333333333';
const storageKey = 'synesis_hrmis_candidate_applications';
const stored = new Map<string, string>();

Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key)
  }
});

const publishedJob = {
  id: jobId,
  title: 'Platform Engineer',
  department_name: 'Engineering',
  location_name: 'Dhaka',
  status: 'published',
  is_published: true,
  is_active: true,
  application_deadline: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  screening_questions: []
};

const query: any = {};
query.select = () => query;
query.eq = () => query;
query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
  Promise.resolve({ data: [publishedJob], error: null }).then(resolve, reject);

const rpc = mock(async (): Promise<{ data: string | null; error: { message: string } | null }> => ({
  data: applicationId,
  error: null
}));
const supabase = { from: () => query, rpc };

mock.module('../src/lib/supabase', () => ({ getSupabaseClient: () => supabase }));
const { applyToJob } = await import('../src/lib/api');

const payload = {
  user_id: userId,
  cv_id: '44444444-4444-4444-8444-444444444444',
  screening_answers: {},
  consent_given: true,
  accuracy_certified: true
};

test('live application submission lets HRIS decide duplicates over stale browser state', async () => {
  rpc.mockClear();
  stored.set(storageKey, JSON.stringify([{
    id: 'old-preview-application', user_id: userId, job_id: jobId, status: 'submitted'
  }]));
  rpc.mockResolvedValue({ data: applicationId, error: null });

  const result = await applyToJob(jobId, payload);

  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('candidate_apply_to_job', expect.objectContaining({ p_job_id: jobId }));
  expect(result.success).toBe(true);
  expect(result.application?.id).toBe(applicationId);
});

test('HRIS duplicate rejection is returned to the candidate even when local history is stale', async () => {
  rpc.mockClear();
  stored.set(storageKey, JSON.stringify([{
    id: 'old-preview-application', user_id: userId, job_id: jobId, status: 'submitted'
  }]));
  rpc.mockResolvedValue({ data: null, error: { message: 'You already applied to this job.' } });

  const result = await applyToJob(jobId, payload);

  expect(rpc).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ success: false, error: 'You already applied to this job.' });
});
