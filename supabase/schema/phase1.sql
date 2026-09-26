-- =============================================================================
-- PrepPilot — Phase 1 Database Schema
-- =============================================================================
-- Execute this file in Supabase SQL Editor (Project → SQL Editor → New query).
-- Run the full file in order. It is safe to re-run (idempotent where marked).
--
-- IMPORTANT: Supabase is the source of truth. Gemini is an intelligence layer.
-- =============================================================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- SECTION 1: PROFILES
-- Extends auth.users. One row per user.
-- =============================================================================

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  avatar_url      text,
  user_type       text not null default 'student'
                    check (user_type in ('student', 'admin')),
  onboarding_completed boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile information extending auth.users. One row per user.';
comment on column public.profiles.user_type is
  'student | admin. Never trust a frontend-supplied value; set admin from the database.';
comment on column public.profiles.onboarding_completed is
  'Set to true after the student finishes the onboarding wizard.';

-- Auto-create a profile row when a user signs up via auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, user_type)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    'student'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at on any update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Helper: security definer function to avoid RLS recursion when checking admin status
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select user_type = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- RLS: profiles
alter table public.profiles enable row level security;

-- Students can read their own profile
create policy "profiles: student reads own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles (uses security definer -> no recursion)
create policy "profiles: admin reads all"
  on public.profiles for select
  using (public.is_admin());

-- Students can update their own profile
create policy "profiles: student updates own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent self-promotion to admin unless already admin
    and (user_type = 'student' or public.is_admin())
  );

-- Students can insert their own profile
create policy "profiles: student inserts own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- =============================================================================
-- SECTION 2: STUDENT EDUCATION
-- Separate from profile so personal identity and education stay decoupled.
-- =============================================================================

create table if not exists public.student_education (
  id                              uuid primary key default uuid_generate_v4(),
  student_id                      uuid not null references public.profiles(id) on delete cascade,
  degree                          text,
  branch                          text,
  institution                     text,
  current_year                    smallint check (current_year between 1 and 6),
  current_semester                smallint check (current_semester between 1 and 10),
  graduation_year                 smallint check (graduation_year between 2020 and 2040),
  score_type                      text check (score_type in ('cgpa', 'percentage')),
  score_value                     numeric(5,2),
  preferred_programming_language  text,
  coding_experience_level         text check (coding_experience_level in ('beginner','intermediate','advanced')),
  additional_data                 jsonb default '{}',
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (student_id)             -- one education record per student
);

comment on table public.student_education is
  'Student academic background. One row per student.';

drop trigger if exists student_education_set_updated_at on public.student_education;
create trigger student_education_set_updated_at
  before update on public.student_education
  for each row execute procedure public.set_updated_at();

-- RLS: student_education
alter table public.student_education enable row level security;

create policy "education: student reads own"
  on public.student_education for select
  using (auth.uid() = student_id);

create policy "education: student inserts own"
  on public.student_education for insert
  with check (auth.uid() = student_id);

create policy "education: student updates own"
  on public.student_education for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy "education: admin reads all"
  on public.student_education for select
  using (public.is_admin());

-- =============================================================================
-- SECTION 3: ROLES
-- Database-driven role catalogue. Admins manage this table.
-- =============================================================================

create table if not exists public.roles (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text not null unique,
  category        text not null default 'other'
                    check (category in ('software','data','security','cloud','qa','design','business','core','other')),
  description     text,
  is_active       boolean not null default true,
  is_cse_related  boolean not null default false,
  configuration   jsonb default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.roles is
  'Preparation roles students can select. Managed by admins.';
comment on column public.roles.configuration is
  'JSON: { modules, skills, assessment_topics, navigation_items }. Drives role-specific UI.';

drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at
  before update on public.roles
  for each row execute procedure public.set_updated_at();

-- RLS: roles (readable by all authenticated, editable by admins only)
alter table public.roles enable row level security;

create policy "roles: all authenticated can read active"
  on public.roles for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "roles: admin reads all"
  on public.roles for select
  using (public.is_admin());

create policy "roles: admin insert"
  on public.roles for insert
  with check (public.is_admin());

create policy "roles: admin update"
  on public.roles for update
  using (public.is_admin());

-- =============================================================================
-- SECTION 4: STUDENT ROLES
-- Many-to-many: students ↔ roles
-- =============================================================================

create table if not exists public.student_roles (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete cascade,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (student_id, role_id)
);

comment on table public.student_roles is
  'Which roles a student is preparing for. Many-to-many.';

-- RLS: student_roles
alter table public.student_roles enable row level security;

create policy "student_roles: student reads own"
  on public.student_roles for select
  using (auth.uid() = student_id);

create policy "student_roles: student inserts own"
  on public.student_roles for insert
  with check (auth.uid() = student_id);

create policy "student_roles: student deletes own"
  on public.student_roles for delete
  using (auth.uid() = student_id);

create policy "student_roles: student updates own"
  on public.student_roles for update
  using (auth.uid() = student_id);

create policy "student_roles: admin reads all"
  on public.student_roles for select
  using (public.is_admin());

-- =============================================================================
-- SECTION 5: ROLE REQUESTS
-- Students request roles not in the catalogue. Admins approve/reject.
-- =============================================================================

create table if not exists public.role_requests (
  id                  uuid primary key default uuid_generate_v4(),
  requester_user_id   uuid not null references public.profiles(id) on delete cascade,
  requested_role_name text not null,
  description         text,
  reason              text,
  optional_skills     text,
  metadata            jsonb default '{}',
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected')),
  admin_notes         text,
  reviewed_by         uuid references public.profiles(id),
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now()
);

comment on table public.role_requests is
  'Student-submitted requests for roles not in the catalogue.';

-- RLS: role_requests
alter table public.role_requests enable row level security;

create policy "role_requests: student reads own"
  on public.role_requests for select
  using (auth.uid() = requester_user_id);

create policy "role_requests: student inserts own"
  on public.role_requests for insert
  with check (auth.uid() = requester_user_id);

-- Students cannot update their own requests after submission (admin-only)
create policy "role_requests: admin reads all"
  on public.role_requests for select
  using (public.is_admin());

create policy "role_requests: admin updates"
  on public.role_requests for update
  using (public.is_admin());

-- =============================================================================
-- SECTION 6: ROADMAPS
-- Each student can have multiple named roadmaps. AI content comes in Phase 2.
-- =============================================================================

create table if not exists public.roadmaps (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  role_id     uuid references public.roles(id),
  status      text not null default 'draft'
                check (status in ('draft','active','completed','archived')),
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.roadmaps is
  'Named preparation roadmaps. AI-generated content stored in metadata/linked tables in Phase 2.';

drop trigger if exists roadmaps_set_updated_at on public.roadmaps;
create trigger roadmaps_set_updated_at
  before update on public.roadmaps
  for each row execute procedure public.set_updated_at();

-- RLS: roadmaps
alter table public.roadmaps enable row level security;

create policy "roadmaps: student reads own"
  on public.roadmaps for select
  using (auth.uid() = student_id);

create policy "roadmaps: student inserts own"
  on public.roadmaps for insert
  with check (auth.uid() = student_id);

create policy "roadmaps: student updates own"
  on public.roadmaps for update
  using (auth.uid() = student_id);

create policy "roadmaps: student deletes own"
  on public.roadmaps for delete
  using (auth.uid() = student_id);

-- =============================================================================
-- SECTION 7: AI RUNS
-- CRITICAL: Every Gemini call must produce a record here.
-- Structured JSON output is preserved for reuse and debugging.
-- Gemini credit conservation rule: cache reusable AI output via request_hash.
-- =============================================================================

create table if not exists public.ai_runs (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid references public.profiles(id) on delete set null,
  feature         text not null,   -- e.g. 'roadmap', 'assessment', 'canvas', 'chat'
  provider        text not null default 'gemini',
  model           text not null,   -- e.g. 'gemini-1.5-flash'
  key_slot        smallint,        -- 1, 2, or 3 (which API key was used)
  request_hash    text,            -- SHA256 of the canonical input for dedup/cache
  prompt_version  text,            -- e.g. 'v1.0' for prompt engineering version tracking
  input_json      jsonb,           -- full input sent to the model
  output_json     jsonb,           -- full structured JSON output from the model
  usage_json      jsonb,           -- token usage stats from the provider
  status          text not null default 'pending'
                    check (status in ('pending','success','error','cached')),
  error_json      jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.ai_runs is
  'Immutable log of every AI generation. Never delete rows; set status=error if failed.';
comment on column public.ai_runs.request_hash is
  'SHA256 of canonical input. Check this before calling Gemini to avoid duplicate spend.';
comment on column public.ai_runs.key_slot is
  'Which Gemini API key slot was used (1/2/3). Keys are server-side only.';

create index if not exists ai_runs_student_feature_idx on public.ai_runs(student_id, feature);
create index if not exists ai_runs_request_hash_idx on public.ai_runs(request_hash) where request_hash is not null;

-- RLS: ai_runs
alter table public.ai_runs enable row level security;

create policy "ai_runs: student reads own"
  on public.ai_runs for select
  using (auth.uid() = student_id);

-- Students cannot insert directly — writes happen via Edge Functions (service role)
create policy "ai_runs: admin reads all"
  on public.ai_runs for select
  using (public.is_admin());

-- =============================================================================
-- SECTION 8: AUDIT LOGS
-- Immutable record of important administrative and AI-driven actions.
-- =============================================================================

create table if not exists public.audit_logs (
  id              uuid primary key default uuid_generate_v4(),
  actor_user_id   uuid references public.profiles(id) on delete set null,
  action          text not null,         -- e.g. 'role_request.approved'
  entity_type     text not null,         -- e.g. 'role_request', 'role', 'profile'
  entity_id       text,                  -- the affected row id (text for flexibility)
  before_json     jsonb,                 -- state before action
  after_json      jsonb,                 -- state after action
  metadata_json   jsonb default '{}',
  created_at      timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only audit trail. Never delete or update rows.';

create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

-- RLS: audit_logs (admin-read only; writes via service role in Edge Functions)
alter table public.audit_logs enable row level security;

create policy "audit_logs: admin reads all"
  on public.audit_logs for select
  using (public.is_admin());

-- =============================================================================
-- SECTION 9: STORAGE BUCKETS (documentation — execute separately if needed)
-- =============================================================================
-- The following buckets are intended for future phases.
-- Create them in Supabase Dashboard → Storage → New Bucket.
--
--   Bucket: avatars
--   Public: false
--   Max file size: 2MB
--   Allowed MIME: image/jpeg, image/png, image/webp
--
--   Bucket: resumes          (Phase 2)
--   Public: false
--   Max file size: 5MB
--   Allowed MIME: application/pdf
--
--   Bucket: canvas-artifacts (Phase 2+)
--   Public: false
-- =============================================================================

-- =============================================================================
-- SECTION 10: HELPFUL VIEWS (optional, for admin queries)
-- =============================================================================

create or replace view public.admin_role_requests_view as
  select
    rr.id,
    rr.requested_role_name,
    rr.description,
    rr.reason,
    rr.optional_skills,
    rr.status,
    rr.admin_notes,
    rr.created_at,
    rr.reviewed_at,
    p.full_name as requester_name,
    p.id as requester_id,
    reviewer.full_name as reviewer_name
  from public.role_requests rr
  join public.profiles p on p.id = rr.requester_user_id
  left join public.profiles reviewer on reviewer.id = rr.reviewed_by
  order by rr.created_at desc;

comment on view public.admin_role_requests_view is
  'Convenience view for admin role request management. Do not grant direct student access.';

-- =============================================================================
-- END OF PHASE 1 SCHEMA
-- =============================================================================
-- Next: Execute supabase/seed/phase1-seed.sql to populate starter roles.
-- Then: Set your first admin user:
--   update public.profiles set user_type = 'admin' where id = '<your-auth-user-id>';
-- =============================================================================
