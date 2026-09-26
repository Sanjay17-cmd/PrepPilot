import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Profile, EducationProfile, StudentRole, AppUser } from '../../types'

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  session: Session | null
  appUser: AppUser | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data ?? null
}

async function fetchEducation(userId: string): Promise<EducationProfile | null> {
  const { data } = await supabase
    .from('student_education')
    .select('*')
    .eq('student_id', userId)
    .maybeSingle()
  return data ?? null
}

async function fetchStudentRoles(userId: string): Promise<StudentRole[]> {
  const { data } = await supabase
    .from('student_roles')
    .select('*, role:roles(*)')
    .eq('student_id', userId)
    .order('is_primary', { ascending: false })
  return data ?? []
}

async function buildAppUser(authUser: User): Promise<AppUser> {
  const [profile, education, studentRoles] = await Promise.all([
    fetchProfile(authUser.id),
    fetchEducation(authUser.id),
    fetchStudentRoles(authUser.id),
  ])

  return {
    auth: { id: authUser.id, email: authUser.email ?? null },
    profile,
    education,
    studentRoles,
  }
}

// ---------------------------------------------------------------------------
// Human-readable auth error messages
// ---------------------------------------------------------------------------

function friendlyAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.'
  if (message.includes('Email not confirmed')) return 'Please verify your email before signing in.'
  if (message.includes('User already registered')) return 'An account with this email already exists.'
  if (message.includes('Password should be at least')) return 'Password must be at least 6 characters.'
  if (message.includes('Unable to validate email address')) return 'Please enter a valid email address.'
  if (message.includes('rate limit')) return 'Too many attempts. Please wait a few minutes and try again.'
  return message
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setAppUser(null)
      return
    }
    const user = await buildAppUser(authUser)
    setAppUser(user)
  }, [])

  // Initialize session from Supabase (handles page reload / persistence)
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      await loadUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      setSession(session)
      await loadUser(session?.user ?? null)
      if (loading) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })
    return { error: error ? friendlyAuthError(error.message) : null }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? friendlyAuthError(error.message) : null }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard',
      },
    })
    return { error: error ? friendlyAuthError(error.message) : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setAppUser(null)
    setSession(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const user = await buildAppUser(session.user)
      setAppUser(user)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, appUser, loading, signUp, signIn, signInWithGoogle, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
