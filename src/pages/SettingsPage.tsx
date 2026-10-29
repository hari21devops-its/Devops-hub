import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import { getWorkspaceProfile, saveWorkspaceProfile } from '../services/data'

const defaultProfile = {
  displayName: 'Demo Operator',
  defaultCurrency: 'INR',
  timezone: 'Asia/Kolkata',
  weekStart: 'Monday',
}

export function SettingsPage() {
  const { user, isDemoMode } = useAuth()
  const providerStatus = [
    { name: 'Supabase', status: isDemoMode ? 'Demo mode' : 'Connected', tone: isDemoMode ? 'warning' : 'success' },
    { name: 'Google Analytics', status: 'Not configured', tone: 'warning' },
    { name: 'Cloudflare', status: 'Not configured', tone: 'warning' },
    { name: 'Telegram', status: 'Not configured', tone: 'warning' },
  ] as const
  const [profile, setProfile] = useState(defaultProfile)
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (isDemoMode) {
      try {
        const savedProfile = window.localStorage.getItem('devops-hub-profile')
        if (savedProfile && active) {
          setProfile({ ...defaultProfile, ...JSON.parse(savedProfile) as typeof defaultProfile })
        }
      } catch {
        setError('Could not read locally saved preferences.')
      }
      setIsLoading(false)
      return () => {
        active = false
      }
    }

    if (!user) {
      setIsLoading(false)
      return () => {
        active = false
      }
    }

    setIsLoading(true)
    void getWorkspaceProfile(user.id, user.email, user.name)
      .then((savedProfile) => {
        if (active) {
          setProfile({
            displayName: savedProfile.fullName,
            defaultCurrency: savedProfile.defaultCurrency,
            timezone: savedProfile.timezone,
            weekStart: savedProfile.weekStartDay,
          })
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load profile preferences.')
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isDemoMode, user])

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)

    try {
      if (isDemoMode) {
        window.localStorage.setItem('devops-hub-profile', JSON.stringify(profile))
      } else if (user) {
        await saveWorkspaceProfile({
          id: user.id,
          email: user.email,
          fullName: profile.displayName,
          defaultCurrency: profile.defaultCurrency,
          timezone: profile.timezone,
          weekStartDay: profile.weekStart,
        })
      }
      setMessage(isDemoMode ? 'Preferences saved on this device.' : 'Profile preferences saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile preferences.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Settings</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Workspace preferences</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <p className="text-sm text-slate-400">Loading profile preferences...</p> : null}
            <form className="space-y-4" onSubmit={handleSave}>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Display name</span>
              <input
                value={profile.displayName}
                onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Default currency</span>
              <input
                value={profile.defaultCurrency}
                onChange={(event) => setProfile((current) => ({ ...current, defaultCurrency: event.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Timezone</span>
              <input
                value={profile.timezone}
                onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Week starts on</span>
              <input
                value={profile.weekStart}
                onChange={(event) => setProfile((current) => ({ ...current, weekStart: event.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
              />
            </label>
            {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
            {message ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}
            <Button type="submit" disabled={isLoading || isSaving}>{isSaving ? 'Saving...' : 'Save profile'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integration status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {providerStatus.map((provider) => (
              <div key={provider.name} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <span className="text-sm text-slate-200">{provider.name}</span>
                <Badge variant={provider.tone === 'success' ? 'success' : 'warning'}>{provider.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
