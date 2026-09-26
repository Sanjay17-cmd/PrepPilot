import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { APP_CONFIG } from '../../config/app'
import { BookOpen, AlertCircle, CheckCircle } from 'lucide-react'

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const validate = (): string | null => {
    if (!form.fullName.trim()) return 'Please enter your full name.'
    if (!form.email.includes('@')) return 'Please enter a valid email address.'
    if (form.password.length < 6) return 'Password must be at least 6 characters.'
    if (form.password !== form.confirm) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setError(null)
    setLoading(true)

    const { error } = await signUp(form.email, form.password, form.fullName)
    setLoading(false)

    if (error) {
      setError(error)
    } else {
      // Supabase may require email confirmation depending on project settings.
      // If email confirmation is disabled, the user is logged in and AuthContext
      // will redirect them to onboarding automatically. If confirmation is required,
      // show a success message.
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="auth-layout">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <CheckCircle size={48} color="var(--color-success-600)" style={{ margin: '0 auto 1.5rem' }} />
          <h1 className="auth-card__title" style={{ textAlign: 'center' }}>Check your email</h1>
          <p className="auth-card__subtitle" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            We've sent a verification link to <strong>{form.email}</strong>.
            Click the link to activate your account, then sign in.
          </p>
          <div style={{ marginTop: '2rem' }}>
            <Link to="/login">
              <Button variant="secondary" fullWidth>Back to sign in</Button>
            </Link>
          </div>
        </div>
      </div>
    )
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
          <h1 className="auth-card__title">Create account</h1>
          <p className="auth-card__subtitle">Start your placement preparation journey</p>
        </div>

        {error && (
          <div className="auth-error" style={{ marginTop: '1.5rem' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Full name"
            type="text"
            id="signup-name"
            placeholder="Sanjay Kumar"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            autoComplete="name"
            required
          />
          <Input
            label="Email address"
            type="email"
            id="signup-email"
            placeholder="you@college.edu"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            id="signup-password"
            placeholder="At least 6 characters"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            autoComplete="new-password"
            hint="Minimum 6 characters"
            required
          />
          <Input
            label="Confirm password"
            type="password"
            id="signup-confirm"
            placeholder="Repeat your password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            autoComplete="new-password"
            required
          />

          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={!form.fullName || !form.email || !form.password || !form.confirm}
            id="signup-submit"
          >
            Create account
          </Button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--text-accent)', fontWeight: 500 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
