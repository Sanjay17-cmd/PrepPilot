// TypeScript types for the entire PrepPilot application.
// Keep these in sync with the Supabase schema (supabase/schema/phase1.sql).

export type UserType = 'student' | 'admin';

export type OnboardingStep = 'education' | 'roles' | 'review' | 'complete';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  user_type: UserType;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface EducationProfile {
  id: string;
  student_id: string;
  degree: string | null;
  branch: string | null;
  institution: string | null;
  current_year: number | null;
  current_semester: number | null;
  graduation_year: number | null;
  score_type: 'cgpa' | 'percentage' | null;
  score_value: number | null;
  preferred_programming_language: string | null;
  coding_experience_level: 'beginner' | 'intermediate' | 'advanced' | null;
  additional_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type RoleCategory =
  | 'software'
  | 'data'
  | 'security'
  | 'cloud'
  | 'qa'
  | 'design'
  | 'business'
  | 'core'
  | 'other';

export interface RoleConfiguration {
  modules?: string[];
  skills?: string[];
  assessment_topics?: string[];
  navigation_items?: NavigationItem[];
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  category: RoleCategory;
  description: string | null;
  is_active: boolean;
  is_cse_related: boolean;
  configuration: RoleConfiguration | null;
  created_at: string;
  updated_at: string;
}

export type RoleRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RoleRequest {
  id: string;
  requester_user_id: string;
  requested_role_name: string;
  description: string | null;
  reason: string | null;
  optional_skills: string | null;
  metadata: Record<string, unknown> | null;
  status: RoleRequestStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // Joined
  profiles?: Pick<Profile, 'full_name'>;
}

export interface StudentRole {
  id: string;
  student_id: string;
  role_id: string;
  is_primary: boolean;
  created_at: string;
  // Joined
  role?: Role;
}

export type RoadmapStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Roadmap {
  id: string;
  student_id: string;
  name: string;
  role_id: string | null;
  status: RoadmapStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Joined
  role?: Role;
}

export type AIRunStatus = 'pending' | 'success' | 'error' | 'cached';

export interface AIRun {
  id: string;
  student_id: string | null;
  feature: string;
  provider: string;
  model: string;
  key_slot: number | null;
  request_hash: string | null;
  prompt_version: string | null;
  input_json: Record<string, unknown> | null;
  output_json: Record<string, unknown> | null;
  usage_json: Record<string, unknown> | null;
  status: AIRunStatus;
  error_json: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

// Learning Canvas types
export interface CanvasVariable {
  [key: string]: string | number | boolean | null;
}

export interface CanvasPointer {
  [key: string]: number | null;
}

export interface CanvasStep {
  step: number;
  line: number | null;
  variables: CanvasVariable;
  array: (number | string | null)[];
  pointers?: CanvasPointer;
  markers: Record<string, number | string>;
  explanation: string;
  highlightIndices?: number[];
}

export interface CanvasArtifact {
  title: string;
  language: string;
  description?: string;
  code: string[];
  variables?: string[];
  steps: CanvasStep[];
}

// Navigation
export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: string;
  comingSoon?: boolean;
}

// Auth context
export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AppUser {
  auth: AuthUser;
  profile: Profile | null;
  education: EducationProfile | null;
  studentRoles: StudentRole[];
}
