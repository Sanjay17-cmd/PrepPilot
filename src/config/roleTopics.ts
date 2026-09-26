/**
 * Role → Topics mapping for the assessment engine.
 * These are the selectable topics per role in the "Where Are We?" assessment.
 * Phase 2 uses these to generate the MCQ pool and balance topic coverage.
 */

export interface TopicConfig {
  id: string
  label: string
  weight: number    // relative importance for this role (higher = more questions by default)
}

export interface RoleTopicsConfig {
  roleSlug: string
  roleName: string
  topics: TopicConfig[]
}

export const ROLE_TOPICS: RoleTopicsConfig[] = [
  {
    roleSlug: 'software-developer',
    roleName: 'Software Developer',
    topics: [
      { id: 'dsa',       label: 'Data Structures & Algorithms', weight: 3 },
      { id: 'oop',       label: 'Object-Oriented Programming',  weight: 2 },
      { id: 'dbms',      label: 'Database Management Systems',  weight: 2 },
      { id: 'os',        label: 'Operating Systems',            weight: 2 },
      { id: 'cn',        label: 'Computer Networks',            weight: 1 },
      { id: 'sql',       label: 'SQL',                          weight: 2 },
      { id: 'programming', label: 'Programming Fundamentals',   weight: 2 },
    ],
  },
  {
    roleSlug: 'full-stack-developer',
    roleName: 'Full Stack Developer',
    topics: [
      { id: 'dsa',       label: 'Data Structures & Algorithms', weight: 2 },
      { id: 'oop',       label: 'Object-Oriented Programming',  weight: 2 },
      { id: 'dbms',      label: 'Database Management Systems',  weight: 2 },
      { id: 'sql',       label: 'SQL',                          weight: 2 },
      { id: 'web',       label: 'Web Technologies',             weight: 3 },
      { id: 'api',       label: 'REST APIs',                    weight: 2 },
      { id: 'cn',        label: 'Computer Networks',            weight: 1 },
    ],
  },
  {
    roleSlug: 'backend-developer',
    roleName: 'Backend Developer',
    topics: [
      { id: 'dsa',       label: 'Data Structures & Algorithms', weight: 3 },
      { id: 'dbms',      label: 'Database Management Systems',  weight: 3 },
      { id: 'sql',       label: 'SQL',                          weight: 2 },
      { id: 'os',        label: 'Operating Systems',            weight: 2 },
      { id: 'cn',        label: 'Computer Networks',            weight: 2 },
      { id: 'api',       label: 'REST APIs',                    weight: 2 },
      { id: 'oop',       label: 'Object-Oriented Programming',  weight: 2 },
    ],
  },
  {
    roleSlug: 'frontend-developer',
    roleName: 'Frontend Developer',
    topics: [
      { id: 'dsa',       label: 'Data Structures & Algorithms', weight: 2 },
      { id: 'oop',       label: 'Object-Oriented Programming',  weight: 2 },
      { id: 'web',       label: 'Web Technologies',             weight: 3 },
      { id: 'js',        label: 'JavaScript',                   weight: 3 },
      { id: 'css',       label: 'CSS & Layouts',                weight: 2 },
      { id: 'cn',        label: 'Computer Networks',            weight: 1 },
    ],
  },
  {
    roleSlug: 'data-scientist',
    roleName: 'Data Scientist',
    topics: [
      { id: 'python',    label: 'Python',                       weight: 3 },
      { id: 'sql',       label: 'SQL',                          weight: 3 },
      { id: 'stats',     label: 'Statistics & Probability',     weight: 3 },
      { id: 'ml',        label: 'Machine Learning',             weight: 3 },
      { id: 'dsa',       label: 'Data Structures & Algorithms', weight: 1 },
      { id: 'dbms',      label: 'Database Management Systems',  weight: 2 },
    ],
  },
  {
    roleSlug: 'ai-ml-engineer',
    roleName: 'AI/ML Engineer',
    topics: [
      { id: 'python',    label: 'Python',                       weight: 2 },
      { id: 'ml',        label: 'Machine Learning',             weight: 3 },
      { id: 'dl',        label: 'Deep Learning',                weight: 3 },
      { id: 'stats',     label: 'Statistics & Probability',     weight: 2 },
      { id: 'dsa',       label: 'Data Structures & Algorithms', weight: 2 },
      { id: 'sql',       label: 'SQL',                          weight: 1 },
    ],
  },
  {
    roleSlug: 'cybersecurity-engineer',
    roleName: 'Cybersecurity Engineer',
    topics: [
      { id: 'networking', label: 'Networking',                  weight: 3 },
      { id: 'linux',      label: 'Linux & Systems',             weight: 3 },
      { id: 'security',   label: 'Security Concepts',           weight: 3 },
      { id: 'web-sec',    label: 'Web Security',                weight: 2 },
      { id: 'crypto',     label: 'Cryptography',                weight: 2 },
      { id: 'cn',         label: 'Computer Networks',           weight: 2 },
    ],
  },
  {
    roleSlug: 'devops-engineer',
    roleName: 'DevOps Engineer',
    topics: [
      { id: 'linux',     label: 'Linux & Systems',              weight: 3 },
      { id: 'cn',        label: 'Computer Networks',            weight: 2 },
      { id: 'os',        label: 'Operating Systems',            weight: 2 },
      { id: 'cloud',     label: 'Cloud Concepts',               weight: 3 },
      { id: 'ci-cd',     label: 'CI/CD & Automation',          weight: 2 },
      { id: 'containers',label: 'Containers & Docker',         weight: 2 },
    ],
  },
]

// Fallback topics for roles not explicitly configured above.
export const DEFAULT_TOPICS: TopicConfig[] = [
  { id: 'dsa',       label: 'Data Structures & Algorithms', weight: 2 },
  { id: 'oop',       label: 'Object-Oriented Programming',  weight: 2 },
  { id: 'dbms',      label: 'Database Management Systems',  weight: 2 },
  { id: 'os',        label: 'Operating Systems',            weight: 1 },
  { id: 'cn',        label: 'Computer Networks',            weight: 1 },
]

/**
 * Get topics for a given role slug. Falls back to DEFAULT_TOPICS.
 */
export function getTopicsForRole(roleSlug: string): TopicConfig[] {
  return ROLE_TOPICS.find(r => r.roleSlug === roleSlug)?.topics ?? DEFAULT_TOPICS
}

// Assessment configuration options
export const ASSESSMENT_QUESTION_COUNTS = [5, 10, 15, 20] as const
export const ASSESSMENT_TIME_LIMITS = [
  { value: 15,  label: '15 minutes' },
  { value: 30,  label: '30 minutes' },
  { value: 45,  label: '45 minutes' },
  { value: 60,  label: '60 minutes' },
] as const
export const ASSESSMENT_DIFFICULTIES = [
  { value: 'adaptive', label: 'Adaptive',  description: 'Adjusts based on your performance' },
  { value: 'easy',     label: 'Easy',       description: 'Foundational concepts' },
  { value: 'medium',   label: 'Medium',     description: 'Standard placement questions' },
  { value: 'hard',     label: 'Hard',       description: 'Advanced problem-solving' },
] as const

export const MCQ_PROMPT_VERSION = 'v1.0'
