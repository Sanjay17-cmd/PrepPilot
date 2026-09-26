/**
 * PageShells.tsx
 * Only the 404 page remains here.
 * All Phase 3 pages (AICoach, Resume, DSA) now have real implementations.
 */
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

// =========================================================================
// 404 Not Found
// =========================================================================
export function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--color-gray-200)', lineHeight: 1 }}>404</div>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginTop: 'var(--space-4)', color: 'var(--text-primary)' }}>Page not found</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>The page you're looking for doesn't exist.</p>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Link to="/dashboard"><Button>Back to Dashboard</Button></Link>
        </div>
      </div>
    </div>
  )
}
