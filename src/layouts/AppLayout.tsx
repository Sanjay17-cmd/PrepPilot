import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/navigation/Sidebar'
import { Menu } from 'lucide-react'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="main-content">
        {/* Mobile top bar */}
        <div
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '3px solid var(--ink-black)',
            background: 'var(--paper-white)',
            boxShadow: '0 4px 0px var(--ink-black)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
          className="mobile-topbar"
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-black)', display: 'flex', alignItems: 'center' }}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--marker-blue)', letterSpacing: '0.02em' }}>
            PrepPilot
          </span>
        </div>

        <Outlet />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-topbar { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
