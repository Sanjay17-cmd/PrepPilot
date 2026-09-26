import type { NavigationItem } from '../types'

/**
 * Core navigation available to ALL students regardless of role.
 * comingSoon = true shows the item greyed out with a lock.
 */
export const COMMON_NAV: NavigationItem[] = [
  { id: 'dashboard',   label: 'Dashboard',        path: '/dashboard',   icon: 'LayoutDashboard' },
  { id: 'assessment',  label: 'Where Are We?',    path: '/assessment',  icon: 'ClipboardCheck' },
  { id: 'roadmap',     label: 'Roadmap',          path: '/roadmap',     icon: 'Map' },
  { id: 'daily',       label: 'Daily Plan',       path: '/daily',       icon: 'CalendarCheck' },
  { id: 'dsa',         label: 'DSA Tracker',      path: '/dsa',         icon: 'Code2' },
  { id: 'progress',    label: 'Progress',         path: '/progress',    icon: 'TrendingUp' },
  { id: 'canvas',      label: 'Learning Canvas',  path: '/canvas',      icon: 'MonitorPlay' },
  { id: 'coach',       label: 'AI Coach',         path: '/coach',       icon: 'BotMessageSquare' },
  { id: 'resume',      label: 'Resume',           path: '/resume',      icon: 'FileText' },
]

export const SETTINGS_NAV: NavigationItem[] = [
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'Settings' },
]

export const ADMIN_NAV: NavigationItem[] = [
  { id: 'admin-overview',  label: 'Overview',      path: '/admin',               icon: 'LayoutDashboard' },
  { id: 'admin-requests',  label: 'Role Requests', path: '/admin/role-requests', icon: 'Inbox' },
  { id: 'admin-roles',     label: 'Roles',         path: '/admin/roles',         icon: 'Tag' },
  { id: 'admin-ai-usage',  label: 'AI Usage',      path: '/admin/ai-usage',      icon: 'BarChart2' },
]

/**
 * Role-specific navigation modules.
 * These appear under a "Preparation" section for students whose primary role matches.
 * Phase 2+ will activate individual items based on role configuration.
 */
export const ROLE_MODULE_NAV: Record<string, NavigationItem[]> = {
  'software-developer': [
    { id: 'mod-cs',       label: 'CS Fundamentals', path: '/modules/cs',       icon: 'Cpu',         comingSoon: true },
    { id: 'mod-projects', label: 'Projects',        path: '/modules/projects', icon: 'FolderGit2',  comingSoon: true },
  ],
  'full-stack-developer': [
    { id: 'mod-frontend', label: 'Frontend',  path: '/modules/frontend', icon: 'Layout',    comingSoon: true },
    { id: 'mod-backend',  label: 'Backend',   path: '/modules/backend',  icon: 'Server',    comingSoon: true },
    { id: 'mod-apis',     label: 'APIs',      path: '/modules/apis',     icon: 'Plug',      comingSoon: true },
  ],
  'data-scientist': [
    { id: 'mod-python',  label: 'Python',  path: '/modules/python',  icon: 'Code2',     comingSoon: true },
    { id: 'mod-ml',      label: 'ML',      path: '/modules/ml',      icon: 'BrainCircuit', comingSoon: true },
    { id: 'mod-sql',     label: 'SQL',     path: '/modules/sql',     icon: 'Database',  comingSoon: true },
  ],
  'cybersecurity-engineer': [
    { id: 'mod-network', label: 'Networking', path: '/modules/networking', icon: 'Network',   comingSoon: true },
    { id: 'mod-linux',   label: 'Linux',      path: '/modules/linux',      icon: 'Terminal',  comingSoon: true },
    { id: 'mod-security',label: 'Security',   path: '/modules/security',   icon: 'ShieldCheck', comingSoon: true },
  ],
}
