import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { APP_CONFIG } from '../../config/app'
import { BookOpen, AlertCircle } from 'lucide-react'

export function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth()
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
          
          <div style={{ margin: '1rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            or
          </div>
          
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={async () => {
              setLoading(true)
              const { error } = await signInWithGoogle()
              if (error) {
                setError(error)
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            <svg style={{ width: 16, height: 16, marginRight: 8 }} viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
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
