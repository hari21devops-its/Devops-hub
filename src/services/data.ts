import { domainList, projectList, serviceList } from '../lib/demo-data'
import type { Domain, Project, Service } from '../types'
import { supabase } from './supabase'

const fallbackProjectList = [...projectList]
const fallbackDomainList = [...domainList]
const fallbackServiceList = [...serviceList]

export type WorkspaceProfile = {
  id: string
  email: string
  fullName: string
  defaultCurrency: string
  timezone: string
  weekStartDay: string
}

export type AnalyticsDailyRecord = {
  projectId: string
  date: string
  visitors: number
  pageViews: number
  sessions: number
}

export type DeploymentRecord = {
  id: string
  projectId: string
  provider: string
  status: string
  environment: string | null
  commitSha: string | null
  deploymentUrl: string | null
  startedAt: string | null
  completedAt: string | null
}

export type ErrorEventRecord = {
  id: string
  projectId: string
  provider: string
  title: string
  severity: string | null
  environment: string | null
  firstSeenAt: string
  lastSeenAt: string
  occurrences: number
}

export type ProjectIntegrationRecord = {
  id: string
  projectId: string
  provider: string
  resourceType: string
  resourceId: string
  resourceName: string
  connectionStatus: string
  lastSyncedAt: string | null
}

export type SyncRunRecord = {
  id: string
  projectId: string
  provider: string
  status: 'running' | 'succeeded' | 'failed'
  startedAt: string
  completedAt: string | null
  recordsImported: number
  errorMessage: string | null
}

export type ProviderUsageSnapshot = {
  id: string
  projectId: string
  provider: string
  metric: string
  value: number
  unit: string
  periodStart: string | null
  periodEnd: string | null
  syncedAt: string
  limitValue: number | null
  limitUnit: string | null
  overageRate: number | null
  overageCurrency: string | null
}

export type ExpenseRecord = {
  id: string
  projectId: string
  provider: string
  service: string
  amount: number
  currency: string
  billingPeriod: string
  paymentDate: string
  nextPaymentDate: string
  recurring: boolean
  paymentStatus: string
  invoiceUrl?: string | null
}

export type MonitorRecord = {
  id: string
  projectId: string
  url: string
  currentStatus: string
  responseTimeMs: number | null
  failureCount: number
  lastCheckAt: string | null
  enabled: boolean
}

export type MonitorCheckRecord = {
  id: string
  monitorId: string
  checkedAt: string
  isUp: boolean
  statusCode: number | null
  responseTimeMs: number | null
}

export type DomainCheckRecord = {
  id: string
  domainId: string
  projectId: string
  checkedAt: string
  dnsResolves: boolean
  sslReachable: boolean
  details: Record<string, unknown>
}

export type MonitorDraft = {
  projectId: string
  url: string
  checkInterval: number
  expectedStatus: number
}

export type IncidentRecord = {
  id: string
  projectId: string
  title: string
  severity: string
  status: string
  startedAt: string
  resolvedAt: string | null
}

export type WorkspaceNotification = {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

export type NotificationRuleType = 'domain_expiry' | 'service_quota' | 'critical_incident' | 'weekly_spend'

export type NotificationRule = {
  id: string
  name: string
  ruleType: NotificationRuleType
  threshold: number | null
  enabled: boolean
}

export type NotificationRuleDraft = Omit<NotificationRule, 'id'>

const fallbackExpenseList: ExpenseRecord[] = []
const fallbackNotificationRules: NotificationRule[] = []
const fallbackProjectIntegrations: ProjectIntegrationRecord[] = []

export async function getWorkspaceProfile(userId: string, email: string, fullName: string): Promise<WorkspaceProfile> {
  if (!supabase) {
    return { id: userId, email, fullName, defaultCurrency: 'INR', timezone: 'Asia/Kolkata', weekStartDay: 'Monday' }
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('Profile record is missing. Apply the Auth profile trigger migration and sign in again.')
  }

  return {
    id: String(data.id),
    email: String(data.email ?? email),
    fullName: String(data.full_name ?? fullName),
    defaultCurrency: String(data.default_currency ?? 'INR'),
    timezone: String(data.timezone ?? 'Asia/Kolkata'),
    weekStartDay: String(data.week_start_day ?? 'Monday'),
  }
}

export async function saveWorkspaceProfile(profile: WorkspaceProfile): Promise<WorkspaceProfile> {
  if (!supabase) {
    return profile
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      email: profile.email,
      full_name: profile.fullName,
      default_currency: profile.defaultCurrency,
      timezone: profile.timezone,
      week_start_day: profile.weekStartDay,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('Supabase did not return the saved profile.')
  }

  return {
    id: String(data.id),
    email: String(data.email ?? profile.email),
    fullName: String(data.full_name ?? profile.fullName),
    defaultCurrency: String(data.default_currency ?? profile.defaultCurrency),
    timezone: String(data.timezone ?? profile.timezone),
    weekStartDay: String(data.week_start_day ?? profile.weekStartDay),
  }
}

export async function getAnalyticsDaily(projectId?: string, startDate?: string): Promise<AnalyticsDailyRecord[]> {
  if (!supabase) return []

  const queryStartDate = startDate ?? new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  let sourceQuery = supabase.from('analytics_sources').select('id, project_id').eq('is_primary', true).eq('connection_status', 'Connected')
  if (projectId) sourceQuery = sourceQuery.eq('project_id', projectId)
  const { data: sources, error: sourceError } = await sourceQuery
  if (sourceError) throw new Error(sourceError.message)
  const sourceIds = (sources ?? []).map((source) => String(source.id))
  if (sourceIds.length === 0) return []

  let analyticsQuery = supabase
    .from('analytics_daily')
    .select('project_id, date, unique_visitors, page_views, sessions')
    .in('source_id', sourceIds)
    .gte('date', queryStartDate)
    .order('date')
  if (projectId) analyticsQuery = analyticsQuery.eq('project_id', projectId)
  const { data, error } = await analyticsQuery
  if (error) throw new Error(error.message)

  return (data ?? []).map((record) => ({
    projectId: String(record.project_id),
    date: String(record.date),
    visitors: Number(record.unique_visitors ?? 0),
    pageViews: Number(record.page_views ?? 0),
    sessions: Number(record.sessions ?? 0),
  }))
}

export async function getExpenses(projectId?: string): Promise<ExpenseRecord[]> {
  if (!supabase) {
    return fallbackExpenseList.filter((expense) => !projectId || expense.projectId === projectId)
  }

  let query = supabase.from('expenses').select('*').order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((record) => ({
    id: String(record.id),
    projectId: String(record.project_id),
    provider: String(record.provider ?? ''),
    service: String(record.service ?? ''),
    amount: Number(record.amount ?? 0),
    currency: String(record.currency ?? 'INR'),
    billingPeriod: String(record.billing_period ?? ''),
    paymentDate: String(record.payment_date ?? ''),
    nextPaymentDate: String(record.next_payment_date ?? ''),
    recurring: Boolean(record.recurring),
    paymentStatus: String(record.payment_status ?? 'Pending'),
    invoiceUrl: record.invoice_url ? String(record.invoice_url) : null,
  }))
}

export type ExpenseDraft = Omit<ExpenseRecord, 'id'>

export async function createExpense(expense: ExpenseDraft): Promise<ExpenseRecord> {
  if (supabase) {
    const { data, error } = await supabase.from('expenses').insert({
      project_id: expense.projectId,
      provider: expense.provider,
      service: expense.service,
      amount: expense.amount,
      currency: expense.currency,
      billing_period: expense.billingPeriod,
      payment_date: expense.paymentDate || null,
      next_payment_date: expense.nextPaymentDate || null,
      recurring: expense.recurring,
      payment_status: expense.paymentStatus,
      invoice_url: expense.invoiceUrl ?? null,
    }).select().single()

    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      throw new Error('Supabase did not return the saved expense.')
    }

    return {
      id: String(data.id),
      projectId: String(data.project_id),
      provider: String(data.provider ?? ''),
      service: String(data.service ?? ''),
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? 'INR'),
      billingPeriod: String(data.billing_period ?? ''),
      paymentDate: String(data.payment_date ?? ''),
      nextPaymentDate: String(data.next_payment_date ?? ''),
      recurring: Boolean(data.recurring),
      paymentStatus: String(data.payment_status ?? 'Pending'),
      invoiceUrl: data.invoice_url ? String(data.invoice_url) : null,
    }
  }

  const saved = { ...expense, id: `exp-${Date.now()}` }
  fallbackExpenseList.unshift(saved)
  return saved
}

export async function updateExpense(expense: ExpenseRecord): Promise<ExpenseRecord> {
  if (supabase) {
    const { data, error } = await supabase.from('expenses').update({
      project_id: expense.projectId,
      provider: expense.provider,
      service: expense.service,
      amount: expense.amount,
      currency: expense.currency,
      billing_period: expense.billingPeriod,
      payment_date: expense.paymentDate || null,
      next_payment_date: expense.nextPaymentDate || null,
      recurring: expense.recurring,
      payment_status: expense.paymentStatus,
      invoice_url: expense.invoiceUrl ?? null,
    }).eq('id', expense.id).select().single()

    if (error) throw new Error(error.message)
    if (!data) throw new Error('Supabase did not return the updated expense.')
    return {
      id: String(data.id),
      projectId: String(data.project_id),
      provider: String(data.provider ?? ''),
      service: String(data.service ?? ''),
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? 'INR'),
      billingPeriod: String(data.billing_period ?? ''),
      paymentDate: String(data.payment_date ?? ''),
      nextPaymentDate: String(data.next_payment_date ?? ''),
      recurring: Boolean(data.recurring),
      paymentStatus: String(data.payment_status ?? 'Pending'),
      invoiceUrl: data.invoice_url ? String(data.invoice_url) : null,
    }
  }

  const index = fallbackExpenseList.findIndex((item) => item.id === expense.id)
  if (index >= 0) fallbackExpenseList[index] = { ...expense }
  return { ...expense }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (error) throw new Error(error.message)
    return
  }

  const index = fallbackExpenseList.findIndex((item) => item.id === expenseId)
  if (index >= 0) fallbackExpenseList.splice(index, 1)
}

export async function getMonitors(projectId?: string): Promise<MonitorRecord[]> {
  if (!supabase) {
    return []
  }

  let query = supabase.from('monitors').select('*').order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((record) => ({
    id: String(record.id),
    projectId: String(record.project_id),
    url: String(record.url),
    currentStatus: String(record.current_status ?? 'Unknown'),
    responseTimeMs: record.response_time_ms == null ? null : Number(record.response_time_ms),
    failureCount: Number(record.failure_count ?? 0),
    lastCheckAt: record.last_check_at ? String(record.last_check_at) : null,
    enabled: Boolean(record.enabled ?? true),
  }))
}

export async function getMonitorChecks(monitorIds: string[]): Promise<MonitorCheckRecord[]> {
  if (!supabase || monitorIds.length === 0) {
    return []
  }

  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('monitor_checks')
    .select('id, monitor_id, checked_at, is_up, status_code, response_time_ms')
    .in('monitor_id', monitorIds)
    .gte('checked_at', startTime)
    .order('checked_at')
    .limit(500)
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((record) => ({
    id: String(record.id),
    monitorId: String(record.monitor_id),
    checkedAt: String(record.checked_at),
    isUp: Boolean(record.is_up),
    statusCode: record.status_code == null ? null : Number(record.status_code),
    responseTimeMs: record.response_time_ms == null ? null : Number(record.response_time_ms),
  }))
}

export async function getDomainChecks(projectId: string, limit = 50): Promise<DomainCheckRecord[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('domain_checks')
    .select('id, domain_id, project_id, checked_at, dns_resolves, ssl_reachable, details')
    .eq('project_id', projectId)
    .order('checked_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((record) => ({
    id: String(record.id),
    domainId: String(record.domain_id),
    projectId: String(record.project_id),
    checkedAt: String(record.checked_at),
    dnsResolves: Boolean(record.dns_resolves),
    sslReachable: Boolean(record.ssl_reachable),
    details: (record.details ?? {}) as Record<string, unknown>,
  }))
}

export async function createMonitor(monitor: MonitorDraft): Promise<MonitorRecord> {
  if (!supabase) {
    return {
      id: `mon-${Date.now()}`,
      projectId: monitor.projectId,
      url: monitor.url,
      currentStatus: 'Unknown',
      responseTimeMs: null,
      failureCount: 0,
      lastCheckAt: null,
      enabled: true,
    }
  }

  const { data, error } = await supabase.from('monitors').insert({
    project_id: monitor.projectId,
    url: monitor.url,
    check_interval: monitor.checkInterval,
    expected_status: monitor.expectedStatus,
    current_status: 'Unknown',
    enabled: true,
  }).select().single()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('Supabase did not return the saved monitor.')
  }

  return {
    id: String(data.id),
    projectId: String(data.project_id),
    url: String(data.url),
    currentStatus: String(data.current_status ?? 'Unknown'),
    responseTimeMs: data.response_time_ms == null ? null : Number(data.response_time_ms),
    failureCount: Number(data.failure_count ?? 0),
    lastCheckAt: data.last_check_at ? String(data.last_check_at) : null,
    enabled: Boolean(data.enabled ?? true),
  }
}

export async function setMonitorEnabled(monitorId: string, enabled: boolean): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('monitors').update({ enabled }).eq('id', monitorId)
  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteMonitor(monitorId: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from('monitors').delete().eq('id', monitorId)
  if (error) {
    throw new Error(error.message)
  }
}

export async function getIncidents(projectId?: string): Promise<IncidentRecord[]> {
  if (!supabase) {
    return []
  }

  let query = supabase.from('incidents').select('*').order('started_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((record) => ({
    id: String(record.id),
    projectId: String(record.project_id),
    title: String(record.title),
    severity: String(record.severity ?? 'Medium'),
    status: String(record.status ?? 'Open'),
    startedAt: String(record.started_at),
    resolvedAt: record.resolved_at ? String(record.resolved_at) : null,
  }))
}

export async function getDeployments(projectId?: string): Promise<DeploymentRecord[]> {
  if (!supabase) return []

  let query = supabase.from('deployments').select('*').order('started_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((record) => ({
    id: String(record.id),
    projectId: String(record.project_id),
    provider: String(record.provider),
    status: String(record.status),
    environment: record.environment ? String(record.environment) : null,
    commitSha: record.commit_sha ? String(record.commit_sha) : null,
    deploymentUrl: record.deployment_url ? String(record.deployment_url) : null,
    startedAt: record.started_at ? String(record.started_at) : null,
    completedAt: record.completed_at ? String(record.completed_at) : null,
  }))
}

export async function getErrorEvents(projectId?: string): Promise<ErrorEventRecord[]> {
  if (!supabase) return []

  let query = supabase.from('error_events').select('*').order('last_seen_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((record) => ({
    id: String(record.id),
    projectId: String(record.project_id),
    provider: String(record.provider),
    title: String(record.title),
    severity: record.severity ? String(record.severity) : null,
    environment: record.environment ? String(record.environment) : null,
    firstSeenAt: String(record.first_seen_at),
    lastSeenAt: String(record.last_seen_at),
    occurrences: Number(record.occurrences ?? 0),
  }))
}

export async function getProjectIntegrations(projectId?: string): Promise<ProjectIntegrationRecord[]> {
  if (!supabase) return fallbackProjectIntegrations.filter((item) => !projectId || item.projectId === projectId)

  let query = supabase.from('project_integrations').select('*').order('provider')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((record) => ({
    id: String(record.id),
    projectId: String(record.project_id),
    provider: String(record.provider),
    resourceType: String(record.resource_type),
    resourceId: String(record.resource_id),
    resourceName: String(record.resource_name),
    connectionStatus: String(record.connection_status),
    lastSyncedAt: record.last_synced_at ? String(record.last_synced_at) : null,
  }))
}

export async function getSyncRuns(projectId: string, limit = 20): Promise<SyncRunRecord[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('sync_runs')
    .select('id, project_id, provider, status, started_at, completed_at, records_imported, error_message')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((record) => ({
    id: String(record.id),
    projectId: String(record.project_id),
    provider: String(record.provider),
    status: record.status as SyncRunRecord['status'],
    startedAt: String(record.started_at),
    completedAt: record.completed_at ? String(record.completed_at) : null,
    recordsImported: Number(record.records_imported ?? 0),
    errorMessage: record.error_message ? String(record.error_message) : null,
  }))
}

export async function getProviderUsageSnapshots(projectId?: string): Promise<ProviderUsageSnapshot[]> {
  if (!supabase) return []

  let query = supabase
    .from('provider_usage_snapshots')
    .select('id, project_id, provider, metric, value, unit, period_start, period_end, synced_at, limit_value, limit_unit, overage_rate, overage_currency')
    .order('synced_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((record) => ({
    id: String(record.id),
    projectId: String(record.project_id),
    provider: String(record.provider),
    metric: String(record.metric),
    value: Number(record.value ?? 0),
    unit: String(record.unit),
    periodStart: record.period_start ? String(record.period_start) : null,
    periodEnd: record.period_end ? String(record.period_end) : null,
    syncedAt: String(record.synced_at),
    limitValue: record.limit_value == null ? null : Number(record.limit_value),
    limitUnit: record.limit_unit ? String(record.limit_unit) : null,
    overageRate: record.overage_rate == null ? null : Number(record.overage_rate),
    overageCurrency: record.overage_currency ? String(record.overage_currency) : null,
  }))
}

export async function createProjectIntegration(integration: Omit<ProjectIntegrationRecord, 'id' | 'lastSyncedAt'>): Promise<ProjectIntegrationRecord> {
  if (!supabase) {
    const saved = { ...integration, id: `int-${Date.now()}`, lastSyncedAt: null }
    fallbackProjectIntegrations.unshift(saved)
    return saved
  }

  const { data, error } = await supabase.from('project_integrations').insert({
    project_id: integration.projectId,
    provider: integration.provider,
    resource_type: integration.resourceType,
    resource_id: integration.resourceId,
    resource_name: integration.resourceName,
    connection_status: integration.connectionStatus,
  }).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Supabase did not return the saved project integration.')
  return {
    id: String(data.id),
    projectId: String(data.project_id),
    provider: String(data.provider),
    resourceType: String(data.resource_type),
    resourceId: String(data.resource_id),
    resourceName: String(data.resource_name),
    connectionStatus: String(data.connection_status),
    lastSyncedAt: data.last_synced_at ? String(data.last_synced_at) : null,
  }
}

export async function deleteProjectIntegration(integrationId: string): Promise<void> {
  if (!supabase) {
    const index = fallbackProjectIntegrations.findIndex((item) => item.id === integrationId)
    if (index >= 0) fallbackProjectIntegrations.splice(index, 1)
    return
  }
  const { error } = await supabase.from('project_integrations').delete().eq('id', integrationId)
  if (error) throw new Error(error.message)
}

export async function setIncidentStatus(incidentId: string, status: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('incidents')
    .update({ status, resolved_at: status === 'Resolved' ? new Date().toISOString() : null })
    .eq('id', incidentId)
  if (error) {
    throw new Error(error.message)
  }
}

export async function getNotifications(userId: string): Promise<WorkspaceNotification[]> {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((record) => ({
    id: String(record.id),
    title: String(record.title),
    message: String(record.message ?? ''),
    type: String(record.type),
    isRead: Boolean(record.is_read),
    createdAt: String(record.created_at),
  }))
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  if (!supabase) {
    return
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('recipient_id', userId)
  if (error) {
    throw new Error(error.message)
  }
}

export async function getNotificationRules(userId: string): Promise<NotificationRule[]> {
  if (!supabase) {
    return [...fallbackNotificationRules]
  }

  const { data, error } = await supabase
    .from('notification_rules')
    .select('id, name, rule_type, threshold, enabled')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((record) => ({
    id: String(record.id),
    name: String(record.name),
    ruleType: record.rule_type as NotificationRuleType,
    threshold: record.threshold == null ? null : Number(record.threshold),
    enabled: Boolean(record.enabled),
  }))
}

export async function createNotificationRule(rule: NotificationRuleDraft, recipientId: string): Promise<NotificationRule> {
  if (!supabase) {
    const saved = { ...rule, id: `rule-${Date.now()}` }
    fallbackNotificationRules.unshift(saved)
    return saved
  }

  const { data, error } = await supabase.from('notification_rules').insert({
    recipient_id: recipientId,
    name: rule.name,
    rule_type: rule.ruleType,
    threshold: rule.threshold,
    enabled: rule.enabled,
  }).select('id, name, rule_type, threshold, enabled').single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Supabase did not return the saved notification rule.')

  return {
    id: String(data.id),
    name: String(data.name),
    ruleType: data.rule_type as NotificationRuleType,
    threshold: data.threshold == null ? null : Number(data.threshold),
    enabled: Boolean(data.enabled),
  }
}

export async function updateNotificationRule(rule: NotificationRule, recipientId: string): Promise<NotificationRule> {
  if (!supabase) {
    const index = fallbackNotificationRules.findIndex((item) => item.id === rule.id)
    if (index >= 0) fallbackNotificationRules[index] = { ...rule }
    return { ...rule }
  }

  const { data, error } = await supabase.from('notification_rules').update({
    name: rule.name,
    rule_type: rule.ruleType,
    threshold: rule.threshold,
    enabled: rule.enabled,
    updated_at: new Date().toISOString(),
  }).eq('id', rule.id).eq('recipient_id', recipientId).select('id, name, rule_type, threshold, enabled').single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Supabase did not return the updated notification rule.')

  return {
    id: String(data.id),
    name: String(data.name),
    ruleType: data.rule_type as NotificationRuleType,
    threshold: data.threshold == null ? null : Number(data.threshold),
    enabled: Boolean(data.enabled),
  }
}

export async function deleteNotificationRule(ruleId: string, recipientId: string): Promise<void> {
  if (!supabase) {
    const index = fallbackNotificationRules.findIndex((rule) => rule.id === ruleId)
    if (index >= 0) fallbackNotificationRules.splice(index, 1)
    return
  }

  const { error } = await supabase.from('notification_rules').delete().eq('id', ruleId).eq('recipient_id', recipientId)
  if (error) throw new Error(error.message)
}

function toProjectRecord(project: Project, ownerId: string) {
  return {
    owner_id: ownerId,
    name: project.name,
    description: project.description,
    website_url: project.websiteUrl,
    repository_url: project.repositoryUrl,
    environment: project.environment,
    category: project.category,
    client_name: project.clientName ?? null,
    status: project.status === 'Archived' ? 'Archived' : project.status === 'Warning' ? 'Paused' : 'Active',
    project_notes: project.notes,
    tags: project.tags,
  }
}

function fromProjectRecord(record: Record<string, unknown>): Project {
  return {
    id: String(record.id ?? 'proj-demo'),
    name: String(record.name ?? 'Untitled project'),
    description: String(record.description ?? ''),
    websiteUrl: String(record.website_url ?? record.websiteUrl ?? 'https://example.com'),
    repositoryUrl: String(record.repository_url ?? record.repositoryUrl ?? 'https://github.com/example'),
    environment: (record.environment as Project['environment']) ?? 'Development',
    category: String(record.category ?? 'General'),
    clientName: record.client_name ? String(record.client_name) : undefined,
    status: record.status === 'Archived' ? 'Archived' : record.status === 'Paused' ? 'Warning' : 'Healthy',
    createdAt: String(record.created_at ?? new Date().toISOString().slice(0, 10)),
    notes: String(record.project_notes ?? record.notes ?? ''),
    tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
    monthlyVisitors: Number(record.monthly_visitors ?? record.monthlyVisitors ?? 0),
  }
}

function toDomainRecord(domain: Domain) {
  return {
    project_id: domain.projectId,
    domain_name: domain.name,
    registrar: domain.registrar,
    registration_date: domain.registrationDate,
    expiration_date: domain.expirationDate,
    auto_renew: domain.autoRenew,
    renewal_price: domain.renewalPrice,
    currency: domain.currency,
    dns_provider: domain.dnsProvider,
    nameservers: domain.nameservers,
    ssl_status: domain.sslStatus,
    ssl_expires_at: domain.sslExpirationDate,
    domain_status: domain.status,
    notes: domain.notes,
  }
}

function fromDomainRecord(record: Record<string, unknown>): Domain {
  return {
    id: String(record.id ?? 'dom-demo'),
    projectId: String(record.project_id ?? 'proj-demo'),
    name: String(record.domain_name ?? record.name ?? ''),
    registrar: String(record.registrar ?? ''),
    registrationDate: String(record.registration_date ?? ''),
    expirationDate: String(record.expiration_date ?? ''),
    autoRenew: Boolean(record.auto_renew ?? false),
    renewalPrice: Number(record.renewal_price ?? 0),
    currency: String(record.currency ?? 'INR'),
    dnsProvider: String(record.dns_provider ?? ''),
    nameservers: Array.isArray(record.nameservers) ? record.nameservers.map(String) : [],
    sslStatus: (record.ssl_status as Domain['sslStatus']) ?? 'Unknown',
    sslExpirationDate: record.ssl_expires_at ? String(record.ssl_expires_at) : undefined,
    status: (record.domain_status as Domain['status']) ?? 'Active',
    notes: String(record.notes ?? ''),
  }
}

function toServiceRecord(service: Service) {
  return {
    project_id: service.projectId,
    name: service.name,
    provider: service.provider,
    service_type: service.type,
    plan_name: service.planName,
    is_paid: service.isPaid,
    monthly_cost: service.monthlyCost,
    currency: service.currency,
    usage_limit: service.usageLimit,
    current_usage: service.currentUsage,
    usage_unit: service.usageUnit,
    billing_cycle: service.billingCycle,
    renewal_date: service.renewalDate,
    dashboard_url: service.dashboardUrl,
    status: service.status,
    notes: service.notes,
  }
}

function fromServiceRecord(record: Record<string, unknown>): Service {
  return {
    id: String(record.id ?? 'svc-demo'),
    projectId: String(record.project_id ?? 'proj-demo'),
    name: String(record.name ?? ''),
    provider: String(record.provider ?? ''),
    type: String(record.service_type ?? record.type ?? 'Hosting'),
    planName: String(record.plan_name ?? record.planName ?? 'Free'),
    isPaid: Boolean(record.is_paid ?? false),
    monthlyCost: Number(record.monthly_cost ?? record.monthlyCost ?? 0),
    currency: String(record.currency ?? 'INR'),
    usageLimit: Number(record.usage_limit ?? record.usageLimit ?? 0),
    currentUsage: Number(record.current_usage ?? record.currentUsage ?? 0),
    usageUnit: String(record.usage_unit ?? record.usageUnit ?? 'GB'),
    billingCycle: String(record.billing_cycle ?? record.billingCycle ?? 'Monthly'),
    renewalDate: String(record.renewal_date ?? record.renewalDate ?? ''),
    dashboardUrl: String(record.dashboard_url ?? record.dashboardUrl ?? ''),
    notes: String(record.notes ?? ''),
    status: (record.status as Service['status']) ?? 'Healthy',
  }
}

export async function getProjects(): Promise<Project[]> {
  if (supabase) {
    const { data, error } = await supabase.from('projects').select('*')

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []).map((item) => fromProjectRecord(item as Record<string, unknown>))
  }

  return [...fallbackProjectList]
}

export async function createProject(project: Project, ownerId?: string): Promise<Project> {
  if (supabase) {
    if (!ownerId) {
      throw new Error('Sign in before creating a project.')
    }

    const { data, error } = await supabase.from('projects').insert(toProjectRecord(project, ownerId)).select().single()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      throw new Error('Supabase did not return the saved project.')
    }

    return fromProjectRecord(data as Record<string, unknown>)
  }

  const saved = { ...project, id: project.id || `proj-${Date.now()}` }
  fallbackProjectList.unshift(saved)
  return saved
}

export async function updateProject(project: Project, ownerId?: string): Promise<Project> {
  if (supabase) {
    if (!ownerId) {
      throw new Error('Sign in before updating a project.')
    }

    const { data, error } = await supabase.from('projects').update(toProjectRecord(project, ownerId)).eq('id', project.id).select().single()
    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      throw new Error('Supabase did not return the updated project.')
    }
    return fromProjectRecord(data as Record<string, unknown>)
  }

  const index = fallbackProjectList.findIndex((item) => item.id === project.id)
  if (index >= 0) {
    fallbackProjectList[index] = { ...project }
  }
  return { ...project }
}

export async function deleteProject(projectId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) {
      throw new Error(error.message)
    }
    return
  }

  const index = fallbackProjectList.findIndex((item) => item.id === projectId)
  if (index >= 0) {
    fallbackProjectList.splice(index, 1)
  }
}

export async function getDomains(projectId?: string): Promise<Domain[]> {
  if (supabase) {
    let query = supabase.from('domains').select('*')
    if (projectId) query = query.eq('project_id', projectId)
    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []).map((item) => fromDomainRecord(item as Record<string, unknown>))
  }

  return fallbackDomainList.filter((domain) => !projectId || domain.projectId === projectId)
}

export async function createDomain(domain: Domain): Promise<Domain> {
  if (supabase) {
    const { data, error } = await supabase.from('domains').insert(toDomainRecord(domain)).select().single()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      throw new Error('Supabase did not return the saved domain.')
    }

    return fromDomainRecord(data as Record<string, unknown>)
  }

  const saved = { ...domain, id: domain.id || `dom-${Date.now()}` }
  fallbackDomainList.unshift(saved)
  return saved
}

export async function updateDomain(domain: Domain): Promise<Domain> {
  if (supabase) {
    const { data, error } = await supabase.from('domains').update(toDomainRecord(domain)).eq('id', domain.id).select().single()
    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      throw new Error('Supabase did not return the updated domain.')
    }
    return fromDomainRecord(data as Record<string, unknown>)
  }

  const index = fallbackDomainList.findIndex((item) => item.id === domain.id)
  if (index >= 0) {
    fallbackDomainList[index] = { ...domain }
  }
  return { ...domain }
}

export async function deleteDomain(domainId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('domains').delete().eq('id', domainId)
    if (error) {
      throw new Error(error.message)
    }
    return
  }

  const index = fallbackDomainList.findIndex((item) => item.id === domainId)
  if (index >= 0) {
    fallbackDomainList.splice(index, 1)
  }
}

export async function getServices(projectId?: string): Promise<Service[]> {
  if (supabase) {
    let query = supabase.from('services').select('*')
    if (projectId) query = query.eq('project_id', projectId)
    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    return (data ?? []).map((item) => fromServiceRecord(item as Record<string, unknown>))
  }

  return fallbackServiceList.filter((service) => !projectId || service.projectId === projectId)
}

export async function createService(service: Service): Promise<Service> {
  if (supabase) {
    const { data, error } = await supabase.from('services').insert(toServiceRecord(service)).select().single()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      throw new Error('Supabase did not return the saved service.')
    }

    return fromServiceRecord(data as Record<string, unknown>)
  }

  const saved = { ...service, id: service.id || `svc-${Date.now()}` }
  fallbackServiceList.unshift(saved)
  return saved
}

export async function updateService(service: Service): Promise<Service> {
  if (supabase) {
    const { data, error } = await supabase.from('services').update(toServiceRecord(service)).eq('id', service.id).select().single()
    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      throw new Error('Supabase did not return the updated service.')
    }
    return fromServiceRecord(data as Record<string, unknown>)
  }

  const index = fallbackServiceList.findIndex((item) => item.id === service.id)
  if (index >= 0) {
    fallbackServiceList[index] = { ...service }
  }
  return { ...service }
}

export async function deleteService(serviceId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('services').delete().eq('id', serviceId)
    if (error) {
      throw new Error(error.message)
    }
    return
  }

  const index = fallbackServiceList.findIndex((item) => item.id === serviceId)
  if (index >= 0) {
    fallbackServiceList.splice(index, 1)
  }
}
