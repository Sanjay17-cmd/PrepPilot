/**
 * Centralized application configuration.
 * Change the product name, version, and labels here — not scattered throughout the codebase.
 */

export const APP_CONFIG = {
  name: 'PrepPilot',
  tagline: 'Your placement preparation workspace',
  version: '1.0.0-phase1',
  supportEmail: 'support@preppilot.app',
} as const;

export const NAV_LABELS = {
  dashboard: 'Dashboard',
  whereAreWe: 'Where Are We?',
  roadmap: 'Roadmap',
  dailyPlan: 'Daily Plan',
  aiCoach: 'AI Coach',
  resume: 'Resume',
  progress: 'Progress',
  canvas: 'Learning Canvas',
  settings: 'Settings',
  // Admin
  adminOverview: 'Overview',
  adminRoleRequests: 'Role Requests',
  adminRoles: 'Roles',
} as const;

export const ROLE_LABELS = {
  student: 'Student',
  admin: 'Admin',
} as const;

export const FEATURE_FLAGS = {
  adaptiveAssessment: false,
  aiRoadmap: false,
  aiDailyPlan: false,
  aiCoach: false,
  resumeATS: false,
  leetcodeTracking: false,
  canvasGemini: false,
} as const;

export const ONBOARDING_STEPS = [
  { id: 'education', label: 'Education', description: 'Tell us about your education' },
  { id: 'roles', label: 'Target Roles', description: 'What role are you preparing for?' },
  { id: 'review', label: 'Review', description: 'Review and complete your setup' },
] as const;

export const DEGREE_OPTIONS = [
  'B.E.',
  'B.Tech',
  'M.E.',
  'M.Tech',
  'B.Sc',
  'M.Sc',
  'MCA',
  'MBA',
  'Other',
] as const;

export const BRANCH_OPTIONS = [
  'Computer Science and Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Computer Science and Business Systems',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Other',
] as const;

export const PROGRAMMING_LANGUAGE_OPTIONS = [
  'Python',
  'Java',
  'C++',
  'C',
  'JavaScript',
  'TypeScript',
  'Go',
  'Rust',
  'C#',
  'Other',
] as const;

export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner — just starting out' },
  { value: 'intermediate', label: 'Intermediate — comfortable with basics' },
  { value: 'advanced', label: 'Advanced — solved 100+ problems' },
] as const;

export const YEAR_OPTIONS = [1, 2, 3, 4, 5] as const;
export const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
