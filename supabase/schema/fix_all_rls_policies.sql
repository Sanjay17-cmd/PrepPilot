-- =============================================================================
-- PrepPilot — MASTER RLS & PERMISSIONS FIX (ALL PHASES 1, 2, 3)
-- =============================================================================
-- Execute this entire file in the Supabase Dashboard SQL Editor:
--   Project → SQL Editor → New Query → Paste → Run (Ctrl+Enter)
--
-- What this script fixes once and for all:
-- 1. Eliminates all RLS infinite recursion on `profiles` and child tables.
-- 2. Adds missing INSERT policy for students on `assessment_questions`.
-- 3. Adds missing DELETE policy on `tasks`, `roadmap_phases`, `roadmap_phase_topics`.
-- 4. Fixes `audit_logs` columns and adds authenticated INSERT policy for AI Coach.
-- 5. Configures Phase 3 RLS on `ai_chats`, `ai_messages`, `ai_patches`, `resume_files`,
--    `resume_analyses`, `leetcode_problems`, and `canvas_artifacts`.
-- 6. Configures private `resumes` Storage bucket with student RLS folder access.
-- 7. Fixes `admin_ai_usage` view (`status = 'cached'`).
-- =============================================================================

-- =============================================================================
-- SECTION 1: SECURITY DEFINER ADMIN HELPER (NO RECURSION)
-- =============================================================================

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

-- =============================================================================
-- SECTION 2: PROFILES TABLE
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: student reads own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: student updates own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin reads all" ON public.profiles;
DROP POLICY IF EXISTS "profiles: student inserts own" ON public.profiles;
DROP POLICY IF EXISTS "admin reads all profiles" ON public.profiles;

CREATE POLICY "profiles: student reads own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: admin reads all"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "profiles: student updates own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (user_type = 'student' OR public.is_admin())
  );

CREATE POLICY "profiles: student inserts own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- SECTION 3: STUDENT EDUCATION TABLE
-- =============================================================================

ALTER TABLE public.student_education ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "education: student reads own" ON public.student_education;
DROP POLICY IF EXISTS "education: student inserts own" ON public.student_education;
DROP POLICY IF EXISTS "education: student updates own" ON public.student_education;
DROP POLICY IF EXISTS "education: student deletes own" ON public.student_education;
DROP POLICY IF EXISTS "education: admin reads all" ON public.student_education;

CREATE POLICY "education: student reads own"
  ON public.student_education FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "education: student inserts own"
  ON public.student_education FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "education: student updates own"
  ON public.student_education FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "education: student deletes own"
  ON public.student_education FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "education: admin reads all"
  ON public.student_education FOR SELECT
  USING (public.is_admin());

-- =============================================================================
-- SECTION 4: ROLES TABLE
-- =============================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles: all authenticated can read active" ON public.roles;
DROP POLICY IF EXISTS "roles: admin reads all" ON public.roles;
DROP POLICY IF EXISTS "roles: admin insert" ON public.roles;
DROP POLICY IF EXISTS "roles: admin update" ON public.roles;
DROP POLICY IF EXISTS "roles: admin delete" ON public.roles;

CREATE POLICY "roles: all authenticated can read active"
  ON public.roles FOR SELECT
  USING (auth.role() = 'authenticated' AND (is_active = true OR public.is_admin()));

CREATE POLICY "roles: admin reads all"
  ON public.roles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "roles: admin insert"
  ON public.roles FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "roles: admin update"
  ON public.roles FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "roles: admin delete"
  ON public.roles FOR DELETE
  USING (public.is_admin());

-- =============================================================================
-- SECTION 5: STUDENT ROLES TABLE
-- =============================================================================

ALTER TABLE public.student_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_roles: student reads own" ON public.student_roles;
DROP POLICY IF EXISTS "student_roles: student inserts own" ON public.student_roles;
DROP POLICY IF EXISTS "student_roles: student deletes own" ON public.student_roles;
DROP POLICY IF EXISTS "student_roles: student updates own" ON public.student_roles;
DROP POLICY IF EXISTS "student_roles: admin reads all" ON public.student_roles;

CREATE POLICY "student_roles: student reads own"
  ON public.student_roles FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "student_roles: student inserts own"
  ON public.student_roles FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "student_roles: student deletes own"
  ON public.student_roles FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "student_roles: student updates own"
  ON public.student_roles FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "student_roles: admin reads all"
  ON public.student_roles FOR SELECT
  USING (public.is_admin());

-- =============================================================================
-- SECTION 6: ROLE REQUESTS TABLE
-- =============================================================================

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_requests: student reads own" ON public.role_requests;
DROP POLICY IF EXISTS "role_requests: student inserts own" ON public.role_requests;
DROP POLICY IF EXISTS "role_requests: admin reads all" ON public.role_requests;
DROP POLICY IF EXISTS "role_requests: admin updates" ON public.role_requests;

CREATE POLICY "role_requests: student reads own"
  ON public.role_requests FOR SELECT
  USING (auth.uid() = requester_user_id);

CREATE POLICY "role_requests: student inserts own"
  ON public.role_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_user_id);

CREATE POLICY "role_requests: admin reads all"
  ON public.role_requests FOR SELECT
  USING (public.is_admin());

CREATE POLICY "role_requests: admin updates"
  ON public.role_requests FOR UPDATE
  USING (public.is_admin());

-- =============================================================================
-- SECTION 7: ROADMAPS TABLE
-- =============================================================================

ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roadmaps: student reads own" ON public.roadmaps;
DROP POLICY IF EXISTS "roadmaps: student inserts own" ON public.roadmaps;
DROP POLICY IF EXISTS "roadmaps: student updates own" ON public.roadmaps;
DROP POLICY IF EXISTS "roadmaps: student deletes own" ON public.roadmaps;
DROP POLICY IF EXISTS "roadmaps: admin reads all" ON public.roadmaps;

CREATE POLICY "roadmaps: student reads own"
  ON public.roadmaps FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "roadmaps: student inserts own"
  ON public.roadmaps FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "roadmaps: student updates own"
  ON public.roadmaps FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "roadmaps: student deletes own"
  ON public.roadmaps FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "roadmaps: admin reads all"
  ON public.roadmaps FOR SELECT
  USING (public.is_admin());

-- =============================================================================
-- SECTION 8: AI RUNS TABLE
-- =============================================================================

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_runs: student reads own" ON public.ai_runs;
DROP POLICY IF EXISTS "ai_runs: admin reads all" ON public.ai_runs;
DROP POLICY IF EXISTS "ai_runs: insert allowed" ON public.ai_runs;

CREATE POLICY "ai_runs: student reads own"
  ON public.ai_runs FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "ai_runs: admin reads all"
  ON public.ai_runs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "ai_runs: insert allowed"
  ON public.ai_runs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR student_id = auth.uid());

-- =============================================================================
-- SECTION 9: AUDIT LOGS TABLE
-- =============================================================================

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS feature text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
ALTER TABLE public.audit_logs ALTER COLUMN entity_type DROP NOT NULL;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs: admin reads all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs: student inserts own" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs: authenticated insert" ON public.audit_logs;

CREATE POLICY "audit_logs: admin reads all"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "audit_logs: authenticated insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- SECTION 10: ASSESSMENTS & QUESTIONS (PHASE 2)
-- =============================================================================

-- Assessments
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assessments: student reads own" ON public.assessments;
DROP POLICY IF EXISTS "assessments: student inserts own" ON public.assessments;
DROP POLICY IF EXISTS "assessments: student updates own" ON public.assessments;
DROP POLICY IF EXISTS "assessments: student deletes own" ON public.assessments;
DROP POLICY IF EXISTS "assessments: admin reads all" ON public.assessments;

CREATE POLICY "assessments: student reads own"
  ON public.assessments FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "assessments: student inserts own"
  ON public.assessments FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "assessments: student updates own"
  ON public.assessments FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "assessments: student deletes own"
  ON public.assessments FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "assessments: admin reads all"
  ON public.assessments FOR SELECT
  USING (public.is_admin());

-- Assessment Questions (FIX: added missing student insert/update/delete)
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aq: student reads own" ON public.assessment_questions;
DROP POLICY IF EXISTS "aq: student inserts own" ON public.assessment_questions;
DROP POLICY IF EXISTS "aq: student updates own" ON public.assessment_questions;
DROP POLICY IF EXISTS "aq: student deletes own" ON public.assessment_questions;
DROP POLICY IF EXISTS "aq: admin reads all" ON public.assessment_questions;

CREATE POLICY "aq: student reads own"
  ON public.assessment_questions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND student_id = auth.uid())
  );

CREATE POLICY "aq: student inserts own"
  ON public.assessment_questions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND student_id = auth.uid())
  );

CREATE POLICY "aq: student updates own"
  ON public.assessment_questions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND student_id = auth.uid())
  );

CREATE POLICY "aq: student deletes own"
  ON public.assessment_questions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.assessments WHERE id = assessment_id AND student_id = auth.uid())
  );

CREATE POLICY "aq: admin reads all"
  ON public.assessment_questions FOR SELECT
  USING (public.is_admin());

-- Assessment Attempts
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attempts: student reads own" ON public.assessment_attempts;
DROP POLICY IF EXISTS "attempts: student inserts own" ON public.assessment_attempts;
DROP POLICY IF EXISTS "attempts: student updates own" ON public.assessment_attempts;
DROP POLICY IF EXISTS "attempts: student deletes own" ON public.assessment_attempts;
DROP POLICY IF EXISTS "attempts: admin reads all" ON public.assessment_attempts;

CREATE POLICY "attempts: student reads own"
  ON public.assessment_attempts FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "attempts: student inserts own"
  ON public.assessment_attempts FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "attempts: student updates own"
  ON public.assessment_attempts FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "attempts: student deletes own"
  ON public.assessment_attempts FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "attempts: admin reads all"
  ON public.assessment_attempts FOR SELECT
  USING (public.is_admin());

-- Question Attempts
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa: student reads own" ON public.question_attempts;
DROP POLICY IF EXISTS "qa: student inserts own" ON public.question_attempts;
DROP POLICY IF EXISTS "qa: student updates own" ON public.question_attempts;
DROP POLICY IF EXISTS "qa: student deletes own" ON public.question_attempts;
DROP POLICY IF EXISTS "qa: admin reads all" ON public.question_attempts;

CREATE POLICY "qa: student reads own"
  ON public.question_attempts FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "qa: student inserts own"
  ON public.question_attempts FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "qa: student updates own"
  ON public.question_attempts FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "qa: student deletes own"
  ON public.question_attempts FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "qa: admin reads all"
  ON public.question_attempts FOR SELECT
  USING (public.is_admin());

-- Student Skills
ALTER TABLE public.student_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills: student reads own" ON public.student_skills;
DROP POLICY IF EXISTS "skills: student inserts own" ON public.student_skills;
DROP POLICY IF EXISTS "skills: student updates own" ON public.student_skills;
DROP POLICY IF EXISTS "skills: student deletes own" ON public.student_skills;
DROP POLICY IF EXISTS "skills: admin reads all" ON public.student_skills;

CREATE POLICY "skills: student reads own"
  ON public.student_skills FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "skills: student inserts own"
  ON public.student_skills FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "skills: student updates own"
  ON public.student_skills FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "skills: student deletes own"
  ON public.student_skills FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "skills: admin reads all"
  ON public.student_skills FOR SELECT
  USING (public.is_admin());

-- =============================================================================
-- SECTION 11: DAILY PLANS & TASKS (PHASE 2)
-- =============================================================================

-- Daily Plans
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dp: student reads own" ON public.daily_plans;
DROP POLICY IF EXISTS "dp: student inserts own" ON public.daily_plans;
DROP POLICY IF EXISTS "dp: student updates own" ON public.daily_plans;
DROP POLICY IF EXISTS "dp: student deletes own" ON public.daily_plans;

CREATE POLICY "dp: student reads own"
  ON public.daily_plans FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "dp: student inserts own"
  ON public.daily_plans FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "dp: student updates own"
  ON public.daily_plans FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "dp: student deletes own"
  ON public.daily_plans FOR DELETE
  USING (auth.uid() = student_id);

-- Tasks (FIX: added missing student delete)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks: student reads own" ON public.tasks;
DROP POLICY IF EXISTS "tasks: student inserts own" ON public.tasks;
DROP POLICY IF EXISTS "tasks: student updates own" ON public.tasks;
DROP POLICY IF EXISTS "tasks: student deletes own" ON public.tasks;

CREATE POLICY "tasks: student reads own"
  ON public.tasks FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "tasks: student inserts own"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "tasks: student updates own"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = student_id);

CREATE POLICY "tasks: student deletes own"
  ON public.tasks FOR DELETE
  USING (auth.uid() = student_id);

-- Roadmap Phases & Topics (FIX: added missing delete)
ALTER TABLE public.roadmap_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_phase_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rp: student reads own" ON public.roadmap_phases;
DROP POLICY IF EXISTS "rp: student inserts own" ON public.roadmap_phases;
DROP POLICY IF EXISTS "rp: student updates own" ON public.roadmap_phases;
DROP POLICY IF EXISTS "rp: student deletes own" ON public.roadmap_phases;

CREATE POLICY "rp: student reads own"
  ON public.roadmap_phases FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.roadmaps WHERE id = roadmap_id AND student_id = auth.uid()));

CREATE POLICY "rp: student inserts own"
  ON public.roadmap_phases FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.roadmaps WHERE id = roadmap_id AND student_id = auth.uid()));

CREATE POLICY "rp: student updates own"
  ON public.roadmap_phases FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.roadmaps WHERE id = roadmap_id AND student_id = auth.uid()));

CREATE POLICY "rp: student deletes own"
  ON public.roadmap_phases FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.roadmaps WHERE id = roadmap_id AND student_id = auth.uid()));

DROP POLICY IF EXISTS "rpt: student reads own" ON public.roadmap_phase_topics;
DROP POLICY IF EXISTS "rpt: student inserts own" ON public.roadmap_phase_topics;
DROP POLICY IF EXISTS "rpt: student updates own" ON public.roadmap_phase_topics;
DROP POLICY IF EXISTS "rpt: student deletes own" ON public.roadmap_phase_topics;

CREATE POLICY "rpt: student reads own"
  ON public.roadmap_phase_topics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.roadmap_phases rp
    JOIN public.roadmaps r ON r.id = rp.roadmap_id
    WHERE rp.id = phase_id AND r.student_id = auth.uid()
  ));

CREATE POLICY "rpt: student inserts own"
  ON public.roadmap_phase_topics FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.roadmap_phases rp
    JOIN public.roadmaps r ON r.id = rp.roadmap_id
    WHERE rp.id = phase_id AND r.student_id = auth.uid()
  ));

CREATE POLICY "rpt: student updates own"
  ON public.roadmap_phase_topics FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.roadmap_phases rp
    JOIN public.roadmaps r ON r.id = rp.roadmap_id
    WHERE rp.id = phase_id AND r.student_id = auth.uid()
  ));

CREATE POLICY "rpt: student deletes own"
  ON public.roadmap_phase_topics FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.roadmap_phases rp
    JOIN public.roadmaps r ON r.id = rp.roadmap_id
    WHERE rp.id = phase_id AND r.student_id = auth.uid()
  ));

-- =============================================================================
-- SECTION 12: PRODUCT INTELLIGENCE TABLES (PHASE 3)
-- =============================================================================

-- ai_chats
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns ai_chats" ON public.ai_chats;
CREATE POLICY "Student owns ai_chats" ON public.ai_chats
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- ai_messages
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns ai_messages" ON public.ai_messages;
CREATE POLICY "Student owns ai_messages" ON public.ai_messages
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- ai_patches
ALTER TABLE public.ai_patches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns ai_patches" ON public.ai_patches;
CREATE POLICY "Student owns ai_patches" ON public.ai_patches
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- resume_files
ALTER TABLE public.resume_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns resume_files" ON public.resume_files;
CREATE POLICY "Student owns resume_files" ON public.resume_files
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- resume_analyses
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns resume_analyses" ON public.resume_analyses;
CREATE POLICY "Student owns resume_analyses" ON public.resume_analyses
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- leetcode_problems
ALTER TABLE public.leetcode_problems ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.leetcode_problems ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns leetcode_problems" ON public.leetcode_problems;
CREATE POLICY "Student owns leetcode_problems" ON public.leetcode_problems
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- canvas_artifacts
ALTER TABLE public.canvas_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns canvas_artifacts" ON public.canvas_artifacts;
DROP POLICY IF EXISTS "Student inserts canvas_artifacts" ON public.canvas_artifacts;
DROP POLICY IF EXISTS "Student updates canvas_artifacts" ON public.canvas_artifacts;
DROP POLICY IF EXISTS "Student deletes canvas_artifacts" ON public.canvas_artifacts;

CREATE POLICY "Student owns canvas_artifacts" ON public.canvas_artifacts
  FOR SELECT USING (student_id = auth.uid() OR is_builtin = true);

CREATE POLICY "Student inserts canvas_artifacts" ON public.canvas_artifacts
  FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Student updates canvas_artifacts" ON public.canvas_artifacts
  FOR UPDATE USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE POLICY "Student deletes canvas_artifacts" ON public.canvas_artifacts
  FOR DELETE USING (student_id = auth.uid());

-- =============================================================================
-- SECTION 13: SUPABASE STORAGE BUCKET & POLICIES (RESUMES)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Resumes: student upload" ON storage.objects;
CREATE POLICY "Resumes: student upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Resumes: student read" ON storage.objects;
CREATE POLICY "Resumes: student read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Resumes: student delete" ON storage.objects;
CREATE POLICY "Resumes: student delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================================================
-- SECTION 14: ADMIN AI USAGE VIEW (FIXED)
-- =============================================================================

CREATE OR REPLACE VIEW public.admin_ai_usage AS
SELECT
  feature,
  COUNT(*)                                             AS total_requests,
  COUNT(*) FILTER (WHERE status = 'success')           AS success_count,
  COUNT(*) FILTER (WHERE status = 'error')             AS error_count,
  COUNT(*) FILTER (WHERE status = 'cached')            AS cache_hits,
  SUM((usage_json->>'total_tokens')::INT)              AS total_tokens,
  MAX(created_at)                                      AS last_used_at
FROM public.ai_runs
GROUP BY feature
ORDER BY total_requests DESC;

-- =============================================================================
-- SECTION 15: MOCK INTERVIEWS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mock_interviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_name           TEXT NOT NULL,
  interview_type      TEXT NOT NULL DEFAULT 'technical',
  difficulty          TEXT NOT NULL DEFAULT 'entry_level',
  duration_seconds    INTEGER NOT NULL DEFAULT 0,
  overall_score       INTEGER,
  technical_score     INTEGER,
  communication_score INTEGER,
  confidence_score    INTEGER,
  verdict             TEXT,
  transcript_json     JSONB NOT NULL DEFAULT '[]',
  evaluation_json     JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mock_interviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns mock_interviews" ON public.mock_interviews;
CREATE POLICY "Student owns mock_interviews" ON public.mock_interviews
  FOR ALL USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

