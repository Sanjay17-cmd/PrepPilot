/**
 * AI Coach feature config.
 * Defines the allow-list of operations the coach can propose.
 * No arbitrary DB mutations — only these controlled operations are permitted.
 */

export type AllowedOperation =
  | 'complete_task'
  | 'reopen_task'
  | 'remove_task'
  | 'move_task'
  | 'create_daily_plan'
  | 'regenerate_daily_plan'
  | 'rename_roadmap'
  | 'pause_roadmap'
  | 'resume_roadmap'
  | 'add_role'
  | 'remove_role'
  | 'update_daily_minutes'

export const ALLOWED_OPERATIONS = new Set<AllowedOperation>([
  'complete_task',
  'reopen_task',
  'remove_task',
  'move_task',
  'create_daily_plan',
  'regenerate_daily_plan',
  'rename_roadmap',
  'pause_roadmap',
  'resume_roadmap',
  'add_role',
  'remove_role',
  'update_daily_minutes',
])

export const OPERATION_LABELS: Record<AllowedOperation, string> = {
  complete_task:          'Mark task complete',
  reopen_task:            'Reopen task',
  remove_task:            'Remove task',
  move_task:              'Move task to another day',
  create_daily_plan:      'Create today\'s plan',
  regenerate_daily_plan:  'Regenerate today\'s plan',
  rename_roadmap:         'Rename roadmap',
  pause_roadmap:          'Pause roadmap',
  resume_roadmap:         'Resume roadmap',
  add_role:               'Add preparation role',
  remove_role:            'Remove preparation role',
  update_daily_minutes:   'Update daily study time',
}

export type CoachIntent = 'info' | 'explanation' | 'planning' | 'db_change'

export interface CoachOperation {
  operation: AllowedOperation
  task_title?: string
  task_id?: string
  to_date?: string
  from_date?: string
  roadmap_id?: string
  new_name?: string
  role_id?: string
  daily_minutes?: number
}

export interface ProposedPatch {
  summary: string
  operations: CoachOperation[]
}

export interface CoachResponse {
  intent: CoachIntent
  response: string
  requires_confirmation: boolean
  proposed_patch: ProposedPatch | null
}

// DSA topics
export const DSA_TOPICS = [
  'Arrays',
  'Strings',
  'Hashing',
  'Linked List',
  'Stack',
  'Queue',
  'Trees',
  'Heap',
  'Graphs',
  'Greedy',
  'Dynamic Programming',
  'Binary Search',
  'Backtracking',
  'Sorting',
  'Two Pointers',
  'Sliding Window',
  'Recursion',
  'Bit Manipulation',
] as const

export type DSATopic = typeof DSA_TOPICS[number]

export const DSA_DIFFICULTY_COLORS = {
  easy:   'var(--color-success-600)',
  medium: 'var(--color-warning-600)',
  hard:   'var(--color-danger-600)',
} as const
