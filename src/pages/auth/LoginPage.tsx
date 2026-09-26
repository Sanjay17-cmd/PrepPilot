import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { APP_CONFIG } from '../../config/app'
import { BookOpen, AlertCircle } from 'lucide-react'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn(form.email, form.password)
    if (error) {
      setError(error)
      setLoading(false)
    } else {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-card__brand">
          <div className="sidebar-brand__icon">
            <BookOpen size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
            {APP_CONFIG.name}
          </span>
        </div>

        <div>
          <h1 className="auth-card__title">Sign in</h1>
          <p className="auth-card__subtitle">Continue your placement preparation</p>
        </div>

        {error && (
          <div className="auth-error" style={{ marginTop: '1.5rem' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email address"
            type="email"
            id="login-email"
            placeholder="you@college.edu"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            required
          />
          <div className="form-group">
            <Input
              label="Password"
              type="password"
              id="login-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </div>

          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={!form.email || !form.password}
            id="login-submit"
          >
            Sign in
          </Button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--text-accent)', fontWeight: 500 }}>
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}
