-- =============================================================================
-- PrepPilot — Fix RLS Infinite Recursion on `profiles` & Dependent Tables
-- =============================================================================
-- Run this script in the Supabase Dashboard SQL Editor (Project → SQL Editor → New query).
--
-- Why did the error happen?
-- The RLS policies on `profiles` and other tables were executing:
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
-- When evaluating a query on `profiles`, PostgreSQL checked this policy, which triggered
-- another query on `profiles`, creating an infinite loop.
--
-- The fix:
-- 1. Create a `SECURITY DEFINER` function `public.is_admin()` which bypasses RLS on `profiles`.
-- 2. Replace all recursive subqueries across all tables with `public.is_admin()`.
-- 3. Replace the `profiles: student updates own` check with direct column validation.
-- =============================================================================

-- 1. Helper function: runs with superuser privileges, breaking the RLS recursion loop
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT user_type = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- 2. Fix public.profiles policies
DROP POLICY IF EXISTS "profiles: student reads own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: student updates own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin reads all" ON public.profiles;
DROP POLICY IF EXISTS "profiles: student inserts own" ON public.profiles;
DROP POLICY IF EXISTS "admin reads all profiles" ON public.profiles;

-- Students can read their own profile
CREATE POLICY "profiles: student reads own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles (uses SECURITY DEFINER function -> NO RECURSION)
CREATE POLICY "profiles: admin reads all"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Students can update their own profile without self-promoting to admin
CREATE POLICY "profiles: student updates own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (user_type = 'student' OR public.is_admin())
  );

-- Students can insert their own profile
CREATE POLICY "profiles: student inserts own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Fix public.student_education
DROP POLICY IF EXISTS "education: admin reads all" ON public.student_education;
CREATE POLICY "education: admin reads all"
  ON public.student_education FOR SELECT
  USING (public.is_admin());

-- 4. Fix public.roles
DROP POLICY IF EXISTS "roles: admin reads all" ON public.roles;
DROP POLICY IF EXISTS "roles: admin insert" ON public.roles;
DROP POLICY IF EXISTS "roles: admin update" ON public.roles;

CREATE POLICY "roles: admin reads all"
  ON public.roles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "roles: admin insert"
  ON public.roles FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "roles: admin update"
  ON public.roles FOR UPDATE
  USING (public.is_admin());

-- 5. Fix public.student_roles
DROP POLICY IF EXISTS "student_roles: admin reads all" ON public.student_roles;
CREATE POLICY "student_roles: admin reads all"
  ON public.student_roles FOR SELECT
  USING (public.is_admin());

-- 6. Fix public.role_requests
DROP POLICY IF EXISTS "role_requests: admin reads all" ON public.role_requests;
DROP POLICY IF EXISTS "role_requests: admin updates" ON public.role_requests;

CREATE POLICY "role_requests: admin reads all"
  ON public.role_requests FOR SELECT
  USING (public.is_admin());

CREATE POLICY "role_requests: admin updates"
  ON public.role_requests FOR UPDATE
  USING (public.is_admin());

-- 7. Fix public.ai_runs
DROP POLICY IF EXISTS "ai_runs: admin reads all" ON public.ai_runs;
CREATE POLICY "ai_runs: admin reads all"
  ON public.ai_runs FOR SELECT
  USING (public.is_admin());

-- 8. Fix public.audit_logs
DROP POLICY IF EXISTS "audit_logs: admin reads all" ON public.audit_logs;
CREATE POLICY "audit_logs: admin reads all"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

-- 9. Fix Phase 2 tables (if already created)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessments') THEN
    EXECUTE 'DROP POLICY IF EXISTS "assessments: admin reads all" ON public.assessments';
    EXECUTE 'CREATE POLICY "assessments: admin reads all" ON public.assessments FOR SELECT USING (public.is_admin())';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessment_attempts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "attempts: admin reads all" ON public.assessment_attempts';
    EXECUTE 'CREATE POLICY "attempts: admin reads all" ON public.assessment_attempts FOR SELECT USING (public.is_admin())';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assessment_questions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "aq: admin reads all" ON public.assessment_questions';
    EXECUTE 'CREATE POLICY "aq: admin reads all" ON public.assessment_questions FOR SELECT USING (public.is_admin())';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'question_attempts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "qa: admin reads all" ON public.question_attempts';
    EXECUTE 'CREATE POLICY "qa: admin reads all" ON public.question_attempts FOR SELECT USING (public.is_admin())';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_skills') THEN
    EXECUTE 'DROP POLICY IF EXISTS "skills: admin reads all" ON public.student_skills';
    EXECUTE 'CREATE POLICY "skills: admin reads all" ON public.student_skills FOR SELECT USING (public.is_admin())';
  END IF;
END $$;
