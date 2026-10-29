import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn, signUp, enableDemoMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSubmitting(true)

    try {
      if (isSignUp) {
        const confirmationRequired = await signUp({ email, password })
        if (confirmationRequired) {
          setNotice('Account created. Check your email to confirm it, then sign in.')
          setIsSignUp(false)
        } else {
          navigate('/dashboard')
        }
      } else {
        await signIn({ email, password })
        navigate('/dashboard')
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-lg font-bold text-sky-300">
            DH
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Secure Portal</p>
            <h1 className="text-2xl font-semibold text-white">DevOps Hub</h1>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-100">
          {isSignUp ? 'Create an account for your workspace.' : 'Sign in to your workspace or continue with demo data.'}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">{isSignUp ? 'Work email' : 'Email'}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500"
              placeholder="you@company.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500"
              placeholder="••••••••"
            />
          </label>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (isSignUp ? 'Creating account...' : 'Signing in...') : isSignUp ? 'Create account' : 'Sign in'}
          </Button>

          <button
            type="button"
            className="w-full text-center text-sm text-sky-300 hover:text-sky-200"
            onClick={() => {
              setIsSignUp((current) => !current)
              setError('')
              setNotice('')
            }}
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Create a Supabase account'}
          </button>

          {!isSignUp ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                enableDemoMode()
                navigate('/dashboard')
              }}
            >
              Continue in demo mode
            </Button>
          ) : null}
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Supabase email confirmation follows your project’s Auth settings.
        </p>
      </div>
    </div>
  )
}
