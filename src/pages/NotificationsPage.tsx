import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, Pencil, Trash2, TriangleAlert } from 'lucide-react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import {
  createNotificationRule,
  deleteNotificationRule,
  getNotificationRules,
  getNotifications,
  markNotificationRead,
  updateNotificationRule,
  type NotificationRule,
  type NotificationRuleDraft,
  type NotificationRuleType,
  type WorkspaceNotification,
} from '../services/data'

const notifications = [
  {
    id: 'n-1',
    title: 'Domain renewal alert',
    description: 'northstarstudio.dev expires in 7 days. Renew before the weekly maintenance window.',
    type: 'warning',
    time: '2h ago',
  },
  {
    id: 'n-2',
    title: 'Usage threshold reached',
    description: 'Supabase has crossed 80% of the monthly database quota and may trigger a plan review.',
    type: 'critical',
    time: '4h ago',
  },
  {
    id: 'n-3',
    title: 'Deployment successful',
    description: 'Production deployment for Atlas Commerce completed without rollback or health regressions.',
    type: 'info',
    time: '1d ago',
  },
] as const

export function NotificationsPage() {
  const { user, isDemoMode } = useAuth()
  const [liveNotifications, setLiveNotifications] = useState<WorkspaceNotification[]>([])
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [ruleDraft, setRuleDraft] = useState<NotificationRuleDraft>({ name: '', ruleType: 'domain_expiry', threshold: 7, enabled: true })
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemoMode || !user) {
      setLiveNotifications([])
      setRules([])
      setError('')
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    void Promise.all([getNotifications(user.id), getNotificationRules(user.id)])
      .then(([items, loadedRules]) => {
        if (active) {
          setLiveNotifications(items)
          setRules(loadedRules)
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isDemoMode, user])

  const handleRuleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || isDemoMode) return
    try {
      const savedRule = editingRuleId
        ? await updateNotificationRule({ ...ruleDraft, id: editingRuleId }, user.id)
        : await createNotificationRule(ruleDraft, user.id)
      setRules((current) => editingRuleId
        ? current.map((rule) => rule.id === savedRule.id ? savedRule : rule)
        : [savedRule, ...current])
      setEditingRuleId(null)
      setRuleDraft({ name: '', ruleType: 'domain_expiry', threshold: 7, enabled: true })
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save notification rule.')
    }
  }

  const handleRuleEdit = (rule: NotificationRule) => {
    setEditingRuleId(rule.id)
    setRuleDraft({ name: rule.name, ruleType: rule.ruleType, threshold: rule.threshold, enabled: rule.enabled })
  }

  const handleRuleToggle = async (rule: NotificationRule, enabled: boolean) => {
    if (!user) return
    try {
      const updatedRule = await updateNotificationRule({ ...rule, enabled }, user.id)
      setRules((current) => current.map((item) => item.id === rule.id ? updatedRule : item))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update notification rule.')
    }
  }

  const handleRuleDelete = async (ruleId: string) => {
    if (!user || !window.confirm('Delete this notification rule?')) return
    try {
      await deleteNotificationRule(ruleId, user.id)
      setRules((current) => current.filter((rule) => rule.id !== ruleId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete notification rule.')
    }
  }

  const handleMarkRead = async (notificationId: string) => {
    if (!user) return
    try {
      await markNotificationRead(notificationId, user.id)
      setLiveNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, isRead: true } : item))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update notification.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Notifications</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Incident feed and activity alerts</h2>
      </div>

      {!isDemoMode ? <Badge variant="default">Live recipient notifications</Badge> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Latest alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDemoMode ? notifications.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-md bg-slate-900 p-2 text-slate-200">
                      {item.type === 'critical' ? <TriangleAlert size={16} className="text-rose-300" /> : item.type === 'warning' ? <Bell size={16} className="text-amber-300" /> : <CheckCircle2 size={16} className="text-emerald-300" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.type === 'critical' ? 'danger' : item.type === 'warning' ? 'warning' : 'default'
                    }
                  >
                    {item.type}
                  </Badge>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{item.time}</p>
              </div>
            )) : isLoading ? <p className="text-sm text-slate-400">Loading notifications...</p> : liveNotifications.length === 0 ? <p className="text-sm text-slate-400">No notifications for this account.</p> : liveNotifications.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-md bg-slate-900 p-2 text-slate-200">
                      {item.type === 'critical' ? <TriangleAlert size={16} className="text-rose-500" /> : item.type === 'warning' ? <Bell size={16} className="text-amber-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.message}</p>
                    </div>
                  </div>
                  <Badge variant={item.type === 'critical' ? 'danger' : item.type === 'warning' ? 'warning' : 'default'}>
                    {item.isRead ? 'Read' : item.type}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                  {!item.isRead ? <Button type="button" variant="ghost" size="sm" onClick={() => void handleMarkRead(item.id)}>Mark read</Button> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Notification rules' : 'Notification rules'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isDemoMode ? [
              'Alert on domain expiry within 7 days',
              'Notify when any service crosses 85% quota',
              'Page on critical incidents for 30 minutes',
              'Send weekly spend summary every Monday',
            ].map((rule) => (
              <div key={rule} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200">
                {rule}
              </div>
            )) : (
              <>
                <p className="text-xs text-slate-500">Rules are stored per account. Automated evaluation and delivery require a worker.</p>
                {rules.length === 0 ? <p className="text-sm text-slate-400">No rules configured.</p> : rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{rule.name}</p>
                      <p className="text-xs text-slate-400">{rule.ruleType.replaceAll('_', ' ')}{rule.threshold == null ? '' : ` · threshold ${rule.threshold}`}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <label className="flex items-center gap-1 text-xs text-slate-400">
                        <input type="checkbox" checked={rule.enabled} onChange={(event) => void handleRuleToggle(rule, event.target.checked)} />
                        On
                      </label>
                      <Button type="button" variant="ghost" size="sm" className="px-2" title="Edit rule" aria-label={`Edit ${rule.name}`} onClick={() => handleRuleEdit(rule)}><Pencil size={14} /></Button>
                      <Button type="button" variant="ghost" size="sm" className="px-2" title="Delete rule" aria-label={`Delete ${rule.name}`} onClick={() => void handleRuleDelete(rule.id)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                ))}
                <form className="space-y-3 border-t border-slate-800 pt-4" onSubmit={handleRuleSubmit}>
                  <label className="block">
                    <span className="mb-1 block text-sm text-slate-300">Rule name</span>
                    <input value={ruleDraft.name} onChange={(event) => setRuleDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-slate-300">Condition</span>
                    <select value={ruleDraft.ruleType} onChange={(event) => setRuleDraft((current) => ({ ...current, ruleType: event.target.value as NotificationRuleType }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                      <option value="domain_expiry">Domain expiry</option>
                      <option value="service_quota">Service quota</option>
                      <option value="critical_incident">Critical incident</option>
                      <option value="weekly_spend">Weekly spend</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-slate-300">Threshold (optional)</span>
                    <input type="number" min="0" value={ruleDraft.threshold ?? ''} onChange={(event) => setRuleDraft((current) => ({ ...current, threshold: event.target.value === '' ? null : Number(event.target.value) }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                  </label>
                  <Button type="submit" className="w-full">{editingRuleId ? 'Update rule' : 'Save rule'}</Button>
                  {editingRuleId ? <Button type="button" variant="outline" className="w-full" onClick={() => { setEditingRuleId(null); setRuleDraft({ name: '', ruleType: 'domain_expiry', threshold: 7, enabled: true }) }}>Cancel edit</Button> : null}
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
