-- Test-only schema setup for the disposable Candidate C1 Supabase stack.
-- Application data and users are created and removed by the local E2E runner.
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);

INSERT INTO public.tenants(id, slug, is_active)
VALUES ('22222222-2222-4222-8222-222222222222', 'synesis-it', true)
ON CONFLICT (slug) DO NOTHING;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.synesis_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT id FROM public.tenants WHERE slug='synesis-it' AND is_active=true LIMIT 1;
$function$;

ALTER TABLE public.candidate_cvs
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS candidate_user_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_summary text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.candidate_application_drafts
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS candidate_user_id uuid,
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS c1_apply_candidate_drafts_user_job_uq
  ON public.candidate_application_drafts(candidate_user_id, job_id);
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.job_applications'::regclass
      AND conname='c1_apply_job_candidate_uq'
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT c1_apply_job_candidate_uq UNIQUE(job_id, candidate_user_id);
  END IF;
END;
$do$;
ALTER TABLE public.job_applications ALTER COLUMN id SET DEFAULT gen_random_uuid();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_cvs,
  public.candidate_application_drafts TO authenticated;
GRANT SELECT ON public.candidate_profiles TO authenticated;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS c1_apply_candidate_profiles_read_own ON public.candidate_profiles;
CREATE POLICY c1_apply_candidate_profiles_read_own ON public.candidate_profiles
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
ALTER TABLE public.candidate_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_application_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS c1_apply_cvs_select_own ON public.candidate_cvs;
DROP POLICY IF EXISTS c1_apply_cvs_insert_own ON public.candidate_cvs;
DROP POLICY IF EXISTS c1_apply_cvs_update_own ON public.candidate_cvs;
DROP POLICY IF EXISTS c1_apply_cvs_delete_own ON public.candidate_cvs;
CREATE POLICY c1_apply_cvs_select_own ON public.candidate_cvs
  FOR SELECT TO authenticated USING (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_apply_cvs_insert_own ON public.candidate_cvs
  FOR INSERT TO authenticated WITH CHECK (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_apply_cvs_update_own ON public.candidate_cvs
  FOR UPDATE TO authenticated USING (candidate_user_id=(SELECT auth.uid()))
  WITH CHECK (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_apply_cvs_delete_own ON public.candidate_cvs
  FOR DELETE TO authenticated USING (candidate_user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS c1_apply_drafts_select_own ON public.candidate_application_drafts;
DROP POLICY IF EXISTS c1_apply_drafts_insert_own ON public.candidate_application_drafts;
DROP POLICY IF EXISTS c1_apply_drafts_update_own ON public.candidate_application_drafts;
DROP POLICY IF EXISTS c1_apply_drafts_delete_own ON public.candidate_application_drafts;
CREATE POLICY c1_apply_drafts_select_own ON public.candidate_application_drafts
  FOR SELECT TO authenticated USING (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_apply_drafts_insert_own ON public.candidate_application_drafts
  FOR INSERT TO authenticated WITH CHECK (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_apply_drafts_update_own ON public.candidate_application_drafts
  FOR UPDATE TO authenticated USING (candidate_user_id=(SELECT auth.uid()))
  WITH CHECK (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_apply_drafts_delete_own ON public.candidate_application_drafts
  FOR DELETE TO authenticated USING (candidate_user_id=(SELECT auth.uid()));

GRANT SELECT ON public.candidate_published_jobs TO anon, authenticated;
ALTER TABLE public.candidate_published_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS c1_apply_published_jobs_read ON public.candidate_published_jobs;
CREATE POLICY c1_apply_published_jobs_read ON public.candidate_published_jobs
  FOR SELECT TO anon, authenticated USING (
    status='published' AND is_published=true AND is_active=true
    AND (application_deadline IS NULL OR application_deadline>=current_date)
  );

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-documents', 'candidate-documents', false, 10485760,
  ARRAY['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS c1_apply_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS c1_apply_storage_delete_own ON storage.objects;
CREATE POLICY c1_apply_storage_insert_own ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='candidate-documents'
    AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
    AND (storage.foldername(name))[2] IN ('cv','application-documents')
    AND EXISTS (
      SELECT 1 FROM public.candidate_profiles cp
      WHERE cp.user_id=(SELECT auth.uid()) AND cp.profile_status='active'
    )
  );
CREATE POLICY c1_apply_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id='candidate-documents'
    AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  );
