import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Code, RefreshCw } from 'lucide-react'

export function LeetCodePage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`https://alfa-leetcode-api.onrender.com/${username}`)
      if (!res.ok) throw new Error('Failed to fetch LeetCode profile')
      const json = await res.json()
      if (json.errors) throw new Error(json.errors[0]?.message || 'User not found')
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">LeetCode Tracking</h1>
        <p className="page-header__subtitle">Track your competitive programming progress using Alfa LeetCode API.</p>
      </div>

      <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Connect LeetCode Account</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="LeetCode Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. neetcode"
              id="leetcode-username"
            />
          </div>
          <Button onClick={fetchStats} loading={loading} disabled={!username}>
            <RefreshCw size={16} style={{ marginRight: '8px' }} />
            Fetch Stats
          </Button>
        </div>
        {error && <p style={{ color: 'var(--color-danger-600)', marginTop: 'var(--space-2)' }}>{error}</p>}
      </div>

      {data && (
        <div className="progress-stat-grid">
          <div className="progress-stat-card">
            <div className="progress-stat-card__icon"><Code size={18} color="var(--color-accent-500)" /></div>
            <div className="progress-stat-card__label">Total Solved</div>
            <div className="progress-stat-card__value">{data.solvedProblem || 0}</div>
          </div>
          <div className="progress-stat-card">
            <div className="progress-stat-card__icon"><Code size={18} color="var(--color-success-600)" /></div>
            <div className="progress-stat-card__label">Easy</div>
            <div className="progress-stat-card__value" style={{ color: 'var(--color-success-600)' }}>{data.easySolved || 0}</div>
          </div>
          <div className="progress-stat-card">
            <div className="progress-stat-card__icon"><Code size={18} color="var(--color-warning-600)" /></div>
            <div className="progress-stat-card__label">Medium</div>
            <div className="progress-stat-card__value" style={{ color: 'var(--color-warning-600)' }}>{data.mediumSolved || 0}</div>
          </div>
          <div className="progress-stat-card">
            <div className="progress-stat-card__icon"><Code size={18} color="var(--color-danger-600)" /></div>
            <div className="progress-stat-card__label">Hard</div>
            <div className="progress-stat-card__value" style={{ color: 'var(--color-danger-600)' }}>{data.hardSolved || 0}</div>
          </div>
        </div>
      )}
      
      <div className="card" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>How to get API Access</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          We are using the <a href="https://github.com/alfa-schema/Alfa-LeetCode-API" target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent-600)' }}>Alfa LeetCode API</a> open-source project.
        </p>
        <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)' }}>
          <li>No authentication or API key is required to fetch public user stats.</li>
          <li>For private endpoints (like syncing code), you need to self-host the API and provide your LeetCode session cookie.</li>
        </ul>
      </div>
    </div>
  )
}
