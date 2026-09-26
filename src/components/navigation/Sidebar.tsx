import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { COMMON_NAV, SETTINGS_NAV, ADMIN_NAV, ROLE_MODULE_NAV } from '../../config/navigation'
import { APP_CONFIG } from '../../config/app'
import { cx, getInitials } from '../../lib/utils'
import {
  LayoutDashboard, ClipboardCheck, Map, CalendarCheck, TrendingUp,
  MonitorPlay, BotMessageSquare, FileText, Settings, LogOut, BookOpen,
  LayoutDashboard as AdminOverview, Inbox, Tag, Menu, X, Lock,
  GitBranch as BinaryTree, Cpu, FolderGit2, Layout, Server, Plug, Code2,
  BrainCircuit, Database, Network, Terminal, ShieldCheck, BarChart2,
} from 'lucide-react'
import type { NavigationItem } from '../../types'

// Icon registry — maps icon name strings to Lucide components
const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, ClipboardCheck, Map, CalendarCheck, TrendingUp,
  MonitorPlay, BotMessageSquare, FileText, Settings, LogOut, BookOpen,
  Inbox, Tag, AdminOverview, BarChart2,
  BinaryTree, Cpu, FolderGit2, Layout, Server, Plug, Code2,
  BrainCircuit, Database, Network, Terminal, ShieldCheck,
}

function NavIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? BookOpen
  return <Icon size={size} />
}

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()

  const profile = appUser?.profile
  const isAdmin = profile?.user_type === 'admin'

  // Get role-specific modules for primary role
  const primaryRole = appUser?.studentRoles?.find((sr) => sr.is_primary)
  const primarySlug = primaryRole?.role?.slug ?? ''
  const roleModules: NavigationItem[] = ROLE_MODULE_NAV[primarySlug] ?? []

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 39 }}
          onClick={onMobileClose}
        />
      )}

      <aside className={cx('sidebar', mobileOpen && 'open')}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand__icon">
            <BookOpen size={14} color="white" />
          </div>
          <span className="sidebar-brand__name">{APP_CONFIG.name}</span>
          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'none' }}
            className="sidebar-mobile-close"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile area */}
        <div className="sidebar-profile">
          <div className="sidebar-profile__inner">
            <div className="sidebar-avatar">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={profile.full_name ?? ''} />
                : getInitials(profile?.full_name)
              }
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div className="sidebar-profile__name">
                {profile?.full_name ?? appUser?.auth.email ?? 'Student'}
              </div>
              <div className="sidebar-profile__role">
                {primaryRole?.role?.name ?? (isAdmin ? 'Admin' : 'Student')}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {/* Common nav */}
          <div className="sidebar-nav__section">
            {COMMON_NAV.map((item) => (
              <SidebarNavItem key={item.id} item={item} onClick={onMobileClose} />
            ))}
          </div>

          {/* Role-specific modules */}
          {roleModules.length > 0 && (
            <div className="sidebar-nav__section">
              <div className="sidebar-nav__label">
                {primaryRole?.role?.name ?? 'Preparation'}
              </div>
              {roleModules.map((item) => (
                <SidebarNavItem key={item.id} item={item} onClick={onMobileClose} />
              ))}
            </div>
          )}

          {/* Admin section */}
          {isAdmin && (
            <div className="sidebar-nav__section">
              <div className="sidebar-nav__label">Admin</div>
              {ADMIN_NAV.map((item) => (
                <SidebarNavItem key={item.id} item={item} onClick={onMobileClose} />
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <SidebarNavItem item={SETTINGS_NAV[0]} onClick={onMobileClose} />
          <button
            className="sidebar-nav__item"
            onClick={handleSignOut}
            aria-label="Sign out"
            id="signout-btn"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}

function SidebarNavItem({ item, onClick }: { item: NavigationItem; onClick: () => void }) {
  if (item.comingSoon) {
    return (
      <div className="sidebar-nav__item sidebar-nav__item--coming-soon" title="Coming soon">
        <NavIcon name={item.icon} />
        <span>{item.label}</span>
        <Lock size={11} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
      </div>
    )
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => cx('sidebar-nav__item', isActive && 'active')}
      onClick={onClick}
    >
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  )
}
