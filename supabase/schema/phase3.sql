-- =============================================================================
-- PrepPilot — Phase 3 Database Schema
-- Dependencies: phase1.sql and phase2.sql must be run first.
-- Run in Supabase SQL Editor. NO SEED DATA.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. AI CHAT TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_chats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT,
  summary      TEXT,         -- rolling summary of older messages (memory compression)
  context_json JSONB DEFAULT '{}',  -- structured student context snapshot
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id      UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender       TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  intent       TEXT,         -- classified intent: info, explanation, planning, db_change
  ai_run_id    UUID REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  metadata_json JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AI PATCH / STRUCTURED ACTION TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_patches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id        UUID REFERENCES public.ai_chats(id) ON DELETE SET NULL,
  ai_run_id      UUID REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  intent         TEXT NOT NULL,
  summary        TEXT,
  patch_json     JSONB NOT NULL DEFAULT '{}',   -- proposed operations array
  before_json    JSONB DEFAULT '{}',            -- snapshot before
  after_json     JSONB DEFAULT '{}',            -- preview after
  status         TEXT NOT NULL DEFAULT 'proposed'
                   CHECK (status IN ('proposed','confirmed','cancelled','executed','failed','expired')),
  confirmed_at   TIMESTAMPTZ,
  executed_at    TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RESUME TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resume_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,        -- path in Supabase Storage (private bucket)
  file_name    TEXT NOT NULL,
  file_type    TEXT NOT NULL,        -- 'pdf' | 'docx'
  file_size_bytes BIGINT,
  extracted_text TEXT,               -- raw text extracted from the file
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resume_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resume_file_id  UUID NOT NULL REFERENCES public.resume_files(id) ON DELETE CASCADE,
  role_id         UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  role_name       TEXT,             -- snapshot of role name at analysis time
  ai_run_id       UUID REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  overall_score   NUMERIC(5,2),
  score_breakdown JSONB DEFAULT '{}',
  analysis_json   JSONB DEFAULT '{}',  -- full structured Gemini output
  recommendations JSONB DEFAULT '[]',
  keywords_found  TEXT[] DEFAULT '{}',
  keywords_missing TEXT[] DEFAULT '{}',
  prompt_version  TEXT DEFAULT 'v1.0',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. LEETCODE / DSA TRACKER TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leetcode_problems (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  url          TEXT,
  difficulty   TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  topic        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'solved'
                 CHECK (status IN ('solved','attempted','reviewing')),
  solved_at    TIMESTAMPTZ,
  notes        TEXT,
  metadata_json JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, title)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CANVAS ARTIFACTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.canvas_artifacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  prompt         TEXT NOT NULL,
  language       TEXT NOT NULL DEFAULT 'python',
  artifact_json  JSONB NOT NULL DEFAULT '{}',   -- full CanvasArtifact JSON
  request_hash   TEXT,                          -- for cache/reuse lookup
  source_ai_run_id UUID REFERENCES public.ai_runs(id) ON DELETE SET NULL,
  is_builtin     BOOLEAN NOT NULL DEFAULT FALSE, -- true for bundled demos
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast cache lookup
CREATE INDEX IF NOT EXISTS idx_canvas_artifacts_student_hash
  ON public.canvas_artifacts(student_id, request_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_chats_student     ON public.ai_chats(student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_chat      ON public.ai_messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_patches_student    ON public.ai_patches(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_patches_status     ON public.ai_patches(status);
CREATE INDEX IF NOT EXISTS idx_resume_files_student  ON public.resume_files(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_student ON public.resume_analyses(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leetcode_student       ON public.leetcode_problems(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leetcode_topic         ON public.leetcode_problems(student_id, topic);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. UPDATED_AT TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Reuse or recreate the trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'ai_chats' AND trigger_name = 'trg_ai_chats_updated_at'
  ) THEN
    CREATE TRIGGER trg_ai_chats_updated_at
      BEFORE UPDATE ON public.ai_chats
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'leetcode_problems' AND trigger_name = 'trg_leetcode_updated_at'
  ) THEN
    CREATE TRIGGER trg_leetcode_updated_at
      BEFORE UPDATE ON public.leetcode_problems
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'canvas_artifacts' AND trigger_name = 'trg_canvas_artifacts_updated_at'
  ) THEN
    CREATE TRIGGER trg_canvas_artifacts_updated_at
      BEFORE UPDATE ON public.canvas_artifacts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

-- ai_chats
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns ai_chats" ON public.ai_chats;
CREATE POLICY "Student owns ai_chats" ON public.ai_chats
  FOR ALL USING (student_id = auth.uid());

-- ai_messages
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns ai_messages" ON public.ai_messages;
CREATE POLICY "Student owns ai_messages" ON public.ai_messages
  FOR ALL USING (student_id = auth.uid());

-- ai_patches
ALTER TABLE public.ai_patches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns ai_patches" ON public.ai_patches;
CREATE POLICY "Student owns ai_patches" ON public.ai_patches
  FOR ALL USING (student_id = auth.uid());

-- resume_files
ALTER TABLE public.resume_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns resume_files" ON public.resume_files;
CREATE POLICY "Student owns resume_files" ON public.resume_files
  FOR ALL USING (student_id = auth.uid());

-- resume_analyses
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns resume_analyses" ON public.resume_analyses;
CREATE POLICY "Student owns resume_analyses" ON public.resume_analyses
  FOR ALL USING (student_id = auth.uid());

-- leetcode_problems
ALTER TABLE public.leetcode_problems ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns leetcode_problems" ON public.leetcode_problems;
CREATE POLICY "Student owns leetcode_problems" ON public.leetcode_problems
  FOR ALL USING (student_id = auth.uid());

-- canvas_artifacts
ALTER TABLE public.canvas_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student owns canvas_artifacts" ON public.canvas_artifacts;
CREATE POLICY "Student owns canvas_artifacts" ON public.canvas_artifacts
  FOR ALL USING (student_id = auth.uid() OR is_builtin = TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SUPABASE STORAGE POLICY FOR RESUMES
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this manually in the Supabase dashboard:
-- 1. Go to Storage → Create bucket: "resumes" with type: Private
-- 2. Add policies:
--    INSERT: auth.uid()::text = (storage.foldername(name))[1]
--    SELECT: auth.uid()::text = (storage.foldername(name))[1]
--    DELETE: auth.uid()::text = (storage.foldername(name))[1]
-- This ensures students can only access their own folder: resumes/{user_id}/...
-- The above cannot be done purely in SQL via this migration file.

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. HELPER VIEW — AI USAGE STATS (admin)
-- ─────────────────────────────────────────────────────────────────────────────

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

-- Grant admin access
-- Admin check is done at the app level via user_type = 'admin'
-- View is service-role accessible from Edge Functions

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 migration complete.
-- No seed data has been inserted.
-- Run phase1.sql → phase2.sql → phase3.sql in that order.
-- ─────────────────────────────────────────────────────────────────────────────
