import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

import { supabase } from '../services/supabase'
import type { User } from '../types'

type SignInValues = {
  email: string
  password: string
}

type SignUpValues = SignInValues

type AuthContextValue = {
  user: User | null
  isDemoMode: boolean
  isLoading: boolean
  signIn: (values: SignInValues) => Promise<void>
  signUp: (values: SignUpValues) => Promise<boolean>
  enableDemoMode: () => void
  signOut: () => void
}

const demoUser: User = {
  id: 'demo-user',
  email: 'demo@devopshub.app',
  name: 'Demo Operator',
  role: 'Platform Owner',
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const demoModeEnabled = !supabase || import.meta.env.VITE_DEMO_MODE === 'true'
  const [user, setUser] = useState<User | null>(demoModeEnabled ? demoUser : null)
  const [isDemoMode, setIsDemoMode] = useState(demoModeEnabled)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let active = true
    const applySession = (sessionUser: SupabaseUser | null) => {
      if (!active) {
        return
      }

      if (sessionUser) {
        const displayName = sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || demoUser.name
        setUser({
          id: sessionUser.id,
          email: sessionUser.email ?? '',
          name: displayName,
          role: 'Platform Owner',
        })
        setIsDemoMode(false)
      } else {
        setUser(demoModeEnabled ? demoUser : null)
        setIsDemoMode(demoModeEnabled)
      }

      setIsLoading(false)
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      applySession(error ? null : data.session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [demoModeEnabled])

  const signIn = useCallback(async ({ email, password }: SignInValues) => {
    if (!email.trim() || !password.trim()) {
      throw new Error('Email and password are required.')
    }

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        throw new Error(error.message)
      }

      const signedInUser = data.user
      const displayName = signedInUser.user_metadata?.full_name || signedInUser.email?.split('@')[0] || demoUser.name

      setUser({
        id: signedInUser.id,
        email: signedInUser.email ?? email,
        name: displayName,
        role: 'Platform Owner',
      })
      setIsDemoMode(false)
      return
    }

    setUser({ ...demoUser, email, name: email.split('@')[0] || demoUser.name })
    setIsDemoMode(false)
  }, [])

  const signUp = useCallback(async ({ email, password }: SignUpValues) => {
    if (!email.trim() || !password.trim()) {
      throw new Error('Email and password are required.')
    }

    if (!supabase) {
      throw new Error('Supabase is not configured. Use demo mode or configure the Supabase URL and publishable key.')
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: email.trim().split('@')[0] } },
    })

    if (error) {
      throw new Error(error.message)
    }

    if (data.user && data.session) {
      const displayName = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || demoUser.name
      setUser({
        id: data.user.id,
        email: data.user.email ?? email,
        name: displayName,
        role: 'Platform Owner',
      })
      setIsDemoMode(false)
      return false
    }

    return true
  }, [])

  const enableDemoMode = useCallback(() => {
    setUser(demoUser)
    setIsDemoMode(true)
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }

    setUser(null)
    setIsDemoMode(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isDemoMode, isLoading, signIn, signUp, enableDemoMode, signOut }),
    [user, isDemoMode, isLoading, signIn, signUp, enableDemoMode, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
