/**
 * Admin AI Usage Page (P3-14)
 * Real data from ai_runs — feature breakdown, key slots, success/failure, cache, tokens.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { LoadingPage } from '../../components/ui/Loading'
import { EmptyState } from '../../components/ui/EmptyState'
import { BarChart2, CheckCircle, XCircle, Zap, TrendingUp } from 'lucide-react'
import { formatDate } from '../../lib/utils'

interface FeatureStat {
  feature: string
  total: number
  success: number
  error: number
  cache_hits: number
  total_tokens: number
}

interface FailedRun {
  id: string
  feature: string
  error_message: string
  created_at: string
}

export function AdminAIUsagePage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<FeatureStat[]>([])
  const [failedRuns, setFailedRuns] = useState<FailedRun[]>([])
  const [keyStats, setKeyStats] = useState<Record<number, number>>({})
  const [totals, setTotals] = useState({ requests: 0, tokens: 0, cacheRate: 0 })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: runs } = await supabase
      .from('ai_runs')
      .select('feature, status, key_slot, usage_json, created_at, id, error_message')
      .order('created_at', { ascending: false })
      .limit(500)

    const allRuns = (runs ?? []) as any[]

    // Feature aggregation
    const featureMap: Record<string, FeatureStat> = {}
    for (const r of allRuns) {
      const f = r.feature ?? 'unknown'
      if (!featureMap[f]) featureMap[f] = { feature: f, total: 0, success: 0, error: 0, cache_hits: 0, total_tokens: 0 }
      featureMap[f].total++
      if (r.status === 'success') featureMap[f].success++
      if (r.status === 'error') featureMap[f].error++
      if (r.status === 'cached') featureMap[f].cache_hits++
      featureMap[f].total_tokens += r.usage_json?.total_tokens ?? 0
    }
    const statsArr = Object.values(featureMap).sort((a, b) => b.total - a.total)
    setStats(statsArr)

    // Key slot aggregation
    const kMap: Record<number, number> = {}
    for (const r of allRuns) {
      if (r.key_slot) kMap[r.key_slot] = (kMap[r.key_slot] ?? 0) + 1
    }
    setKeyStats(kMap)

    // Failed runs
    const failed = allRuns.filter(r => r.status === 'error').slice(0, 10)
    setFailedRuns(failed)

    // Totals
    const totalRequests = allRuns.length
    const totalTokens = allRuns.reduce((s, r) => s + (r.usage_json?.total_tokens ?? 0), 0)
    const cacheCount = allRuns.filter(r => r.status === 'cached').length
    const cacheRate = totalRequests ? Math.round((cacheCount / totalRequests) * 100) : 0

    setTotals({ requests: totalRequests, tokens: totalTokens, cacheRate })
    setLoading(false)
  }

  if (loading) return <LoadingPage />

  return (
    <div className="page-container">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>AI Usage</h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
          Real Gemini usage data from ai_runs. No fake metrics.
        </p>
      </div>

      {/* Summary cards */}
      <div className="stats-row" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <TrendingUp size={18} color="var(--color-accent-500)" />
          <div className="stat-card__value">{totals.requests}</div>
          <div className="stat-card__label">Total Requests</div>
        </div>
        <div className="stat-card">
          <Zap size={18} color="var(--color-warning-600)" />
          <div className="stat-card__value">{totals.tokens.toLocaleString()}</div>
          <div className="stat-card__label">Tokens Used</div>
        </div>
        <div className="stat-card">
          <CheckCircle size={18} color="var(--color-success-600)" />
          <div className="stat-card__value">{totals.cacheRate}%</div>
          <div className="stat-card__label">Cache Hit Rate</div>
        </div>
        <div className="stat-card">
          <BarChart2 size={18} color="var(--color-gray-500)" />
          <div className="stat-card__value">{stats.length}</div>
          <div className="stat-card__label">Features Used</div>
        </div>
      </div>

      {/* Feature breakdown */}
      {stats.length === 0 ? (
        <EmptyState icon={<BarChart2 size={36} />} title="No AI requests yet" description="AI usage will appear here once the gateway is active." />
      ) : (
        <div className="section" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="section__header"><span className="section__title">Requests by Feature</span></div>
          <div className="section__body" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Total</th>
                  <th>Success</th>
                  <th>Errors</th>
                  <th>Cache Hits</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.feature}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{s.feature}</td>
                    <td>{s.total}</td>
                    <td><span style={{ color: 'var(--color-success-600)', fontWeight: 600 }}>{s.success}</span></td>
                    <td><span style={{ color: s.error > 0 ? 'var(--color-danger-600)' : 'var(--text-tertiary)', fontWeight: s.error > 0 ? 700 : 400 }}>{s.error}</span></td>
                    <td>{s.cache_hits}</td>
                    <td>{s.total_tokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Key slot usage */}
      {Object.keys(keyStats).length > 0 && (
        <div className="section" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="section__header"><span className="section__title">Key Slot Usage</span></div>
          <div className="section__body" style={{ display: 'flex', gap: 'var(--space-4)' }}>
            {[1, 2, 3].map(slot => (
              <div key={slot} className="stat-card" style={{ flex: 1 }}>
                <div className="stat-card__value">{keyStats[slot] ?? 0}</div>
                <div className="stat-card__label">Key Slot {slot}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed runs */}
      {failedRuns.length > 0 && (
        <div className="section">
          <div className="section__header">
            <span className="section__title">Recent Errors</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-600)', background: '#fef2f2', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
              {failedRuns.length} failure{failedRuns.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="section__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {failedRuns.map(r => (
              <div key={r.id} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-3)', background: '#fef2f2', borderRadius: 'var(--radius-md)', border: '1px solid #fecaca' }}>
                <XCircle size={14} color="var(--color-danger-600)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>{r.feature}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{r.error_message}</div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatDate(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
