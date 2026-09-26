-- =============================================================================
-- PrepPilot — Phase 2 Database Schema
-- =============================================================================
-- Run AFTER phase1.sql.
-- Execute in Supabase SQL Editor → New query.
--
-- Phase 2 adds:
--   - assessments + attempts + questions + question_attempts
--   - student_skills (with history)
--   - daily_plans + tasks
--   - Extended roadmap support
-- =============================================================================

-- =============================================================================
-- SECTION 1: ASSESSMENTS
-- Configuration record for each assessment a student creates.
-- =============================================================================

create table if not exists public.assessments (
  id                  uuid primary key default uuid_generate_v4(),
  student_id          uuid not null references public.profiles(id) on delete cascade,
  role_id             uuid references public.roles(id),
  configuration_json  jsonb not null default '{}',
  -- configuration_json contains: { topics, question_count, time_limit_minutes, difficulty }
  created_at          timestamptz not null default now()
);

comment on table public.assessments is
  'Assessment configuration objects. One per student assessment session.';
comment on column public.assessments.configuration_json is
  'Stores selected topics, question count, time limit, difficulty mode.';

create index if not exists assessments_student_idx on public.assessments(student_id);

-- RLS
alter table public.assessments enable row level security;
create policy "assessments: student reads own"       on public.assessments for select using (auth.uid() = student_id);
create policy "assessments: student inserts own"     on public.assessments for insert with check (auth.uid() = student_id);
create policy "assessments: admin reads all"         on public.assessments for select using (public.is_admin());

-- =============================================================================
-- SECTION 2: ASSESSMENT ATTEMPTS
-- Each time a student starts an assessment.
-- =============================================================================

create table if not exists public.assessment_attempts (
  id              uuid primary key default uuid_generate_v4(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'in_progress'
                    check (status in ('in_progress','submitted','abandoned','timed_out')),
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  time_taken_seconds int,
  total_questions int,
  correct_count   int,
  wrong_count     int,
  skipped_count   int,
  score           numeric(5,2),           -- raw score
  percentage      numeric(5,2),           -- 0–100
  result_json     jsonb default '{}',
  -- result_json: { topic_scores: {DSA: 80, DBMS: 50, …}, difficulty_scores: {easy:%, medium:%, hard:%} }
  violation_json  jsonb default '{}',
  -- violation_json: { fullscreen_exits: 0, visibility_changes: 0, copy_attempts: 0 }
  created_at      timestamptz not null default now()
);

comment on table public.assessment_attempts is
  'Each attempt at an assessment. Previous attempts are never overwritten.';
comment on column public.assessment_attempts.violation_json is
  'Browser-level test violation events. Not a guarantee of cheating detection.';

create index if not exists attempts_student_idx     on public.assessment_attempts(student_id);
create index if not exists attempts_assessment_idx  on public.assessment_attempts(assessment_id);
create index if not exists attempts_status_idx      on public.assessment_attempts(status);

-- RLS
alter table public.assessment_attempts enable row level security;
create policy "attempts: student reads own"   on public.assessment_attempts for select using (auth.uid() = student_id);
create policy "attempts: student inserts own" on public.assessment_attempts for insert with check (auth.uid() = student_id);
create policy "attempts: student updates own" on public.assessment_attempts for update using (auth.uid() = student_id);
create policy "attempts: admin reads all"     on public.assessment_attempts for select using (public.is_admin());

-- =============================================================================
-- SECTION 3: ASSESSMENT QUESTIONS
-- The generated question pool for an assessment.
-- 2× pool strategy: if student requests 10, we generate 20.
-- =============================================================================

create table if not exists public.assessment_questions (
  id              uuid primary key default uuid_generate_v4(),
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  ai_run_id       uuid references public.ai_runs(id),    -- links to generation record
  question_hash   text,                                   -- SHA256 of normalized question text (dedup)
  topic           text not null,
  subtopic        text,
  difficulty      text not null check (difficulty in ('easy','medium','hard')),
  question_data   jsonb not null,
  -- question_data: { question_id, question, options: [A,B,C,D], correct_answer, explanation, concept }
  created_at      timestamptz not null default now()
);

comment on table public.assessment_questions is
  'Generated MCQ pool for an assessment. Pool size = requested_count × 2.';
comment on column public.assessment_questions.question_hash is
  'Normalized SHA256 for deduplication. Same hash = same question.';

create index if not exists aq_assessment_idx  on public.assessment_questions(assessment_id);
create index if not exists aq_topic_diff_idx  on public.assessment_questions(assessment_id, topic, difficulty);
create index if not exists aq_hash_idx        on public.assessment_questions(question_hash) where question_hash is not null;

-- RLS
alter table public.assessment_questions enable row level security;
create policy "aq: student reads own" on public.assessment_questions for select using (
  exists (select 1 from public.assessments where id = assessment_id and student_id = auth.uid())
);
-- Inserts happen via Edge Functions (service role)
create policy "aq: admin reads all" on public.assessment_questions for select using (public.is_admin());

-- =============================================================================
-- SECTION 4: QUESTION ATTEMPTS
-- One row per question answered in an attempt.
-- =============================================================================

create table if not exists public.question_attempts (
  id                  uuid primary key default uuid_generate_v4(),
  attempt_id          uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id         uuid not null references public.assessment_questions(id),
  student_id          uuid not null references public.profiles(id),
  selected_answer     text,        -- 'A','B','C','D' or null if skipped
  correct             boolean,
  presented_order     smallint,    -- 1-indexed position in the attempt
  time_spent_seconds  int,
  topic               text,
  difficulty          text,
  created_at          timestamptz not null default now()
);

comment on table public.question_attempts is
  'Per-question answer records for each attempt. Used for topic/difficulty scoring.';

create index if not exists qa_attempt_idx   on public.question_attempts(attempt_id);
create index if not exists qa_student_idx   on public.question_attempts(student_id);
create index if not exists qa_topic_idx     on public.question_attempts(student_id, topic);

-- RLS
alter table public.question_attempts enable row level security;
create policy "qa: student reads own"   on public.question_attempts for select using (auth.uid() = student_id);
create policy "qa: student inserts own" on public.question_attempts for insert with check (auth.uid() = student_id);
create policy "qa: admin reads all"     on public.question_attempts for select using (public.is_admin());

-- =============================================================================
-- SECTION 5: STUDENT SKILLS
-- Per-student, per-topic skill measurements.
-- Historical rows are preserved — never overwrite, always insert.
-- Latest value = max(measured_at) for student+topic combination.
-- =============================================================================

create table if not exists public.student_skills (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid not null references public.profiles(id) on delete cascade,
  role_id         uuid references public.roles(id),
  topic           text not null,
  score           numeric(5,2) not null,    -- 0–100
  attempt_id      uuid references public.assessment_attempts(id),
  measured_at     timestamptz not null default now(),
  metadata_json   jsonb default '{}'
  -- metadata_json: { correct, total, difficulty_breakdown }
);

comment on table public.student_skills is
  'Historical skill measurements. Never delete or update — always insert new rows.';
comment on column public.student_skills.score is
  '0–100 percentage score for this topic in the linked assessment attempt.';

create index if not exists skills_student_topic_idx on public.student_skills(student_id, topic);
create index if not exists skills_student_role_idx  on public.student_skills(student_id, role_id);
create index if not exists skills_measured_at_idx   on public.student_skills(student_id, measured_at desc);

-- RLS
alter table public.student_skills enable row level security;
create policy "skills: student reads own"   on public.student_skills for select using (auth.uid() = student_id);
create policy "skills: student inserts own" on public.student_skills for insert with check (auth.uid() = student_id);
create policy "skills: admin reads all"     on public.student_skills for select using (public.is_admin());

-- =============================================================================
-- SECTION 6: DAILY PLANS
-- One plan per student per day. Reused on page refresh (no Gemini on reload).
-- =============================================================================

create table if not exists public.daily_plans (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  roadmap_id  uuid references public.roadmaps(id),
  ai_run_id   uuid references public.ai_runs(id),
  plan_date   date not null,
  status      text not null default 'active' check (status in ('active','completed','skipped')),
  plan_json   jsonb default '{}',         -- full Gemini-generated plan for reference
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, plan_date)          -- one plan per student per day
);

comment on table public.daily_plans is
  'One plan per student per day. Reloading page uses existing plan — no Gemini re-call.';

drop trigger if exists daily_plans_set_updated_at on public.daily_plans;
create trigger daily_plans_set_updated_at
  before update on public.daily_plans
  for each row execute procedure public.set_updated_at();

create index if not exists dp_student_date_idx on public.daily_plans(student_id, plan_date desc);

-- RLS
alter table public.daily_plans enable row level security;
create policy "dp: student reads own"   on public.daily_plans for select using (auth.uid() = student_id);
create policy "dp: student inserts own" on public.daily_plans for insert with check (auth.uid() = student_id);
create policy "dp: student updates own" on public.daily_plans for update using (auth.uid() = student_id);

-- =============================================================================
-- SECTION 7: TASKS
-- Individual tasks within a daily plan.
-- =============================================================================

create table if not exists public.tasks (
  id                  uuid primary key default uuid_generate_v4(),
  daily_plan_id       uuid not null references public.daily_plans(id) on delete cascade,
  student_id          uuid not null references public.profiles(id),
  topic               text not null,
  title               text not null,
  description         text,
  estimated_minutes   smallint,
  priority            text not null default 'medium'
                        check (priority in ('high','medium','low')),
  status              text not null default 'pending'
                        check (status in ('pending','in_progress','completed','skipped')),
  display_order       smallint,
  metadata_json       jsonb default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.tasks is
  'Individual tasks in a daily plan. Completion is a deterministic DB update — no Gemini.';

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

create index if not exists tasks_plan_idx    on public.tasks(daily_plan_id);
create index if not exists tasks_student_idx on public.tasks(student_id);

-- RLS
alter table public.tasks enable row level security;
create policy "tasks: student reads own"   on public.tasks for select using (auth.uid() = student_id);
create policy "tasks: student inserts own" on public.tasks for insert with check (auth.uid() = student_id);
create policy "tasks: student updates own" on public.tasks for update using (auth.uid() = student_id);

-- =============================================================================
-- SECTION 8: ROADMAP PHASES (extends Phase 1 roadmaps table)
-- Normalised roadmap structure so the UI can query without parsing JSON.
-- =============================================================================

create table if not exists public.roadmap_phases (
  id                  uuid primary key default uuid_generate_v4(),
  roadmap_id          uuid not null references public.roadmaps(id) on delete cascade,
  title               text not null,
  description         text,
  display_order       smallint not null,
  duration_days       smallint,
  status              text not null default 'not_started'
                        check (status in ('not_started','in_progress','completed','paused')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.roadmap_phase_topics (
  id                  uuid primary key default uuid_generate_v4(),
  phase_id            uuid not null references public.roadmap_phases(id) on delete cascade,
  topic               text not null,
  priority            text not null default 'medium'
                        check (priority in ('high','medium','low')),
  estimated_minutes   int,
  status              text not null default 'not_started'
                        check (status in ('not_started','in_progress','completed')),
  created_at          timestamptz not null default now()
);

comment on table public.roadmap_phases is
  'Normalized phases of a roadmap for UI querying without parsing JSON blobs.';

-- Triggers
drop trigger if exists rp_set_updated_at on public.roadmap_phases;
create trigger rp_set_updated_at before update on public.roadmap_phases
  for each row execute procedure public.set_updated_at();

-- Indexes
create index if not exists rp_roadmap_idx on public.roadmap_phases(roadmap_id);
create index if not exists rpt_phase_idx  on public.roadmap_phase_topics(phase_id);

-- RLS for roadmap_phases (inherit roadmap ownership check)
alter table public.roadmap_phases enable row level security;
alter table public.roadmap_phase_topics enable row level security;

create policy "rp: student reads own" on public.roadmap_phases for select using (
  exists (select 1 from public.roadmaps where id = roadmap_id and student_id = auth.uid())
);
create policy "rp: student inserts own" on public.roadmap_phases for insert with check (
  exists (select 1 from public.roadmaps where id = roadmap_id and student_id = auth.uid())
);
create policy "rp: student updates own" on public.roadmap_phases for update using (
  exists (select 1 from public.roadmaps where id = roadmap_id and student_id = auth.uid())
);

create policy "rpt: student reads own" on public.roadmap_phase_topics for select using (
  exists (
    select 1 from public.roadmap_phases rp
    join public.roadmaps r on r.id = rp.roadmap_id
    where rp.id = phase_id and r.student_id = auth.uid()
  )
);
create policy "rpt: student inserts own" on public.roadmap_phase_topics for insert with check (
  exists (
    select 1 from public.roadmap_phases rp
    join public.roadmaps r on r.id = rp.roadmap_id
    where rp.id = phase_id and r.student_id = auth.uid()
  )
);
create policy "rpt: student updates own" on public.roadmap_phase_topics for update using (
  exists (
    select 1 from public.roadmap_phases rp
    join public.roadmaps r on r.id = rp.roadmap_id
    where rp.id = phase_id and r.student_id = auth.uid()
  )
);

-- =============================================================================
-- SECTION 9: HELPER VIEW — Student Latest Skills
-- =============================================================================

create or replace view public.student_latest_skills as
  select distinct on (student_id, topic)
    student_id,
    role_id,
    topic,
    score,
    attempt_id,
    measured_at
  from public.student_skills
  order by student_id, topic, measured_at desc;

comment on view public.student_latest_skills is
  'Most recent skill score per student per topic. Use for current readiness display.';

-- =============================================================================
-- END OF PHASE 2 SCHEMA
-- =============================================================================
-- Phase 2 features that use Edge Functions:
--   ai-gateway: MCQ generation, roadmap generation, daily plan generation
-- All Gemini calls write to ai_runs (Phase 1 table — no changes needed).
-- =============================================================================
