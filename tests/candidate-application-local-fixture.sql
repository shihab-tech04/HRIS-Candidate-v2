-- Test-only schema setup for the disposable Candidate C1 Supabase stack.
-- Application data and users are created and removed by the local E2E runner.
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  name text,
  timezone text
);

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS timezone text;

INSERT INTO public.tenants(id, slug, is_active, name, timezone)
VALUES
  ('22222222-2222-4222-8222-222222222222', 'synesis-it', true, 'Tenant A', 'Asia/Dhaka'),
  ('33333333-3333-4333-8333-333333333333', 'c1-tenant-b', true, 'Tenant B', 'Asia/Dhaka')
ON CONFLICT (slug) DO UPDATE
SET name=EXCLUDED.name, timezone=EXCLUDED.timezone, is_active=EXCLUDED.is_active;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tenants TO authenticated;

ALTER TABLE public.onboarding_handoffs
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS application_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS c1_preboarding_application_uq ON public.onboarding_handoffs(application_id);
CREATE TABLE IF NOT EXISTS public.c1_preboarding_access (
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  permission_id text NOT NULL,
  PRIMARY KEY (user_id, tenant_id, permission_id)
);
REVOKE ALL ON TABLE public.c1_preboarding_access FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.c1_preboarding_access TO service_role;
DROP POLICY IF EXISTS c1_tenant_membership_read ON public.tenants;

CREATE OR REPLACE FUNCTION public.synesis_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT id FROM public.tenants WHERE slug='synesis-it' AND is_active=true LIMIT 1;
$function$;

-- Local-only manager permission fixture. Production uses the membership role map.
CREATE OR REPLACE FUNCTION public.has_tenant_permission(p_tenant_id uuid, p_permission_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT public.is_live_session() AND EXISTS (
    SELECT 1 FROM public.c1_preboarding_access access
    WHERE access.user_id=auth.uid() AND access.tenant_id=p_tenant_id
      AND access.permission_id=p_permission_id
  );
$function$;
REVOKE ALL ON FUNCTION public.has_tenant_permission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_permission(uuid,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.hris_admin_can_read_tenant(p_tenant_id uuid, p_permission_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT public.has_tenant_permission(p_tenant_id,p_permission_id);
$function$;
REVOKE ALL ON FUNCTION public.hris_admin_can_read_tenant(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hris_admin_can_read_tenant(uuid,text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  PRIMARY KEY(user_id,tenant_id)
);
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  employment_status text NOT NULL DEFAULT 'active'
);
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_number text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS official_email text,
  ADD COLUMN IF NOT EXISTS joining_date date;
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  is_super_admin boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.tenant_memberships,public.employees,public.admin_users TO authenticated;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS c1_membership_read_own ON public.tenant_memberships;
CREATE POLICY c1_membership_read_own ON public.tenant_memberships FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS c1_employee_read_own ON public.employees;
CREATE POLICY c1_employee_read_own ON public.employees FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS c1_admin_user_read_own ON public.admin_users;
CREATE POLICY c1_admin_user_read_own ON public.admin_users FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY c1_tenant_membership_read ON public.tenants FOR SELECT TO authenticated USING (
  is_active IS TRUE AND public.is_live_session() AND (
    public.has_tenant_permission(tenants.id,'recruitment.view')
    OR public.has_tenant_permission(tenants.id,'recruitment.manage')
    OR public.has_tenant_permission(tenants.id,'employees.manage')
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id=(SELECT auth.uid()) AND e.tenant_id=tenants.id
        AND e.employment_status NOT IN ('resigned','terminated')
    )
  )
);

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

-- Browser journeys call the existing saved-jobs reader from the shared
-- navigation. Model its documented user-owned table contract in this fixture.
ALTER TABLE public.candidate_saved_jobs
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS candidate_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS saved_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.candidate_saved_jobs
  ALTER COLUMN candidate_user_id SET NOT NULL,
  ALTER COLUMN job_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS c1_apply_saved_jobs_user_job_uq
  ON public.candidate_saved_jobs(candidate_user_id, job_id);
ALTER TABLE public.candidate_saved_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.candidate_saved_jobs FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.candidate_saved_jobs TO authenticated;
GRANT ALL ON TABLE public.candidate_saved_jobs TO service_role;
DROP POLICY IF EXISTS c1_apply_saved_jobs_select_own ON public.candidate_saved_jobs;
DROP POLICY IF EXISTS c1_apply_saved_jobs_insert_own ON public.candidate_saved_jobs;
DROP POLICY IF EXISTS c1_apply_saved_jobs_delete_own ON public.candidate_saved_jobs;
CREATE POLICY c1_apply_saved_jobs_select_own ON public.candidate_saved_jobs
  FOR SELECT TO authenticated USING (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_apply_saved_jobs_insert_own ON public.candidate_saved_jobs
  FOR INSERT TO authenticated WITH CHECK (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_apply_saved_jobs_delete_own ON public.candidate_saved_jobs
  FOR DELETE TO authenticated USING (candidate_user_id=(SELECT auth.uid()));

-- Production-shaped candidate alerts and in-app notification access for this
-- disposable test stack. Production schema/policies are inspected read-only;
-- this fixture never changes the linked Supabase project.
ALTER TABLE public.candidate_job_alerts
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS candidate_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS keywords text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS workplace_type text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'Instant',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.candidate_job_alerts ALTER COLUMN candidate_user_id SET NOT NULL;
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.candidate_job_alerts'::regclass
      AND conname='c1_candidate_job_alerts_frequency_check'
  ) THEN
    ALTER TABLE public.candidate_job_alerts
      ADD CONSTRAINT c1_candidate_job_alerts_frequency_check CHECK (frequency='Instant');
  END IF;
END;
$do$;
REVOKE ALL ON TABLE public.candidate_job_alerts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.candidate_job_alerts TO authenticated;
GRANT ALL ON TABLE public.candidate_job_alerts TO service_role;
ALTER TABLE public.candidate_job_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS c1_candidate_job_alerts_own ON public.candidate_job_alerts;
CREATE POLICY c1_candidate_job_alerts_own ON public.candidate_job_alerts
  FOR ALL TO authenticated
  USING (candidate_user_id=(SELECT auth.uid()))
  WITH CHECK (candidate_user_id=(SELECT auth.uid()));

ALTER TABLE public.candidate_notifications
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS candidate_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS related_application_id uuid,
  ADD COLUMN IF NOT EXISTS related_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action_view text,
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.candidate_notifications ALTER COLUMN candidate_user_id SET NOT NULL;
REVOKE ALL ON TABLE public.candidate_notifications FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON TABLE public.candidate_notifications TO authenticated;
GRANT ALL ON TABLE public.candidate_notifications TO service_role;
ALTER TABLE public.candidate_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS c1_candidate_notifications_read_own ON public.candidate_notifications;
DROP POLICY IF EXISTS c1_candidate_notifications_update_own ON public.candidate_notifications;
CREATE POLICY c1_candidate_notifications_read_own ON public.candidate_notifications
  FOR SELECT TO authenticated USING (candidate_user_id=(SELECT auth.uid()));
CREATE POLICY c1_candidate_notifications_update_own ON public.candidate_notifications
  FOR UPDATE TO authenticated USING (candidate_user_id=(SELECT auth.uid()))
  WITH CHECK (candidate_user_id=(SELECT auth.uid()));

-- Local acceptance analogue of the existing production job-match trigger.
-- The tested rule is exact: active same-tenant profiles, active Instant alerts,
-- and all optional filters must match before an in-app notice is inserted.
CREATE OR REPLACE FUNCTION public.c1_notify_matching_job_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog, public
AS $function$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM public.synesis_tenant_id()
    OR NEW.status <> 'published'
    OR NEW.is_published IS DISTINCT FROM true
    OR NEW.is_active IS DISTINCT FROM true
    OR (NEW.application_deadline IS NOT NULL AND NEW.application_deadline < current_date) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.candidate_notifications
    (candidate_user_id, title, message, notification_type, related_job_id, action_view)
  SELECT alert.candidate_user_id,
    'New job matches your alert',
    NEW.title || ' matches your job alert.',
    'job_alert_match', NEW.id, 'job-detail'
  FROM public.candidate_job_alerts alert
  JOIN public.candidate_profiles profile
    ON profile.user_id=alert.candidate_user_id
   AND profile.tenant_id=NEW.tenant_id
   AND profile.profile_status='active'
  WHERE alert.is_active=true
    AND alert.frequency='Instant'
    AND (alert.department IS NULL OR lower(alert.department)=lower(COALESCE(NEW.department_name,'')))
    AND (alert.location IS NULL OR lower(alert.location)=lower(COALESCE(NEW.location_name,'')))
    AND (alert.workplace_type IS NULL OR lower(alert.workplace_type)=lower(COALESCE(NEW.workplace_type,'')))
    AND (alert.employment_type IS NULL OR lower(alert.employment_type)=lower(COALESCE(NEW.employment_type,'')))
    AND (
      nullif(btrim(COALESCE(alert.keywords,'')),'') IS NULL
      OR EXISTS (
        SELECT 1 FROM regexp_split_to_table(alert.keywords, '\s*,\s*') keyword
        WHERE nullif(btrim(keyword),'') IS NOT NULL
          AND (NEW.title ILIKE '%' || btrim(keyword) || '%'
            OR COALESCE(NEW.department_name,'') ILIKE '%' || btrim(keyword) || '%'
            OR EXISTS (
              SELECT 1 FROM unnest(NEW.skills) skill
              WHERE skill ILIKE '%' || btrim(keyword) || '%'
            ))
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.candidate_notifications existing
      WHERE existing.candidate_user_id=alert.candidate_user_id
        AND existing.related_job_id=NEW.id
        AND existing.notification_type='job_alert_match'
    );
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.c1_notify_matching_job_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.c1_notify_matching_job_alerts() TO service_role;
DROP TRIGGER IF EXISTS c1_candidate_job_alert_match_notification ON public.jobs;
CREATE TRIGGER c1_candidate_job_alert_match_notification
  AFTER INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.c1_notify_matching_job_alerts();

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
