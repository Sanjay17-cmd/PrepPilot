/** Shared utility functions */

/** Generate initials from a full name */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/** Get a time-aware greeting */
export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours()
  let greeting = 'Hello'
  if (hour >= 5 && hour < 12) greeting = 'Good morning'
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon'
  else if (hour >= 17 && hour < 21) greeting = 'Good evening'
  else greeting = 'Good night'

  return name ? `${greeting}, ${name.split(' ')[0]}` : greeting
}

/** Format a date string to a readable format */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Truncate text */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** Build a CSS class string, filtering falsy values */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Sleep for ms milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Generate graduation years from current year + 6 */
export function getGraduationYears(): number[] {
  const current = new Date().getFullYear()
  return Array.from({ length: 8 }, (_, i) => current + i)
}

/** Safely parse a JSON string, returning null on failure */
export function safeJsonParse<T>(str: string | null | undefined): T | null {
  if (!str) return null
  try {
    return JSON.parse(str) as T
  } catch {
    return null
  }
}
