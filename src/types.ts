export type ThemeMode = 'light' | 'dark'

export type User = {
  id: string
  email: string
  name: string
  role: string
}

export type Project = {
  id: string
  name: string
  description: string
  websiteUrl: string
  repositoryUrl: string
  environment: 'Development' | 'Staging' | 'Production'
  category: string
  clientName?: string
  status: 'Healthy' | 'Warning' | 'Offline' | 'Archived'
  createdAt: string
  notes: string
  tags: string[]
  monthlyVisitors: number
}

export type Domain = {
  id: string
  projectId: string
  name: string
  registrar: string
  registrationDate: string
  expirationDate: string
  autoRenew: boolean
  renewalPrice: number
  currency: string
  dnsProvider: string
  nameservers: string[]
  sslStatus: 'Valid' | 'Expiring Soon' | 'Expired' | 'Unknown'
  sslExpirationDate?: string
  status: 'Active' | 'Pending' | 'Expired'
  notes: string
}

export type Service = {
  id: string
  projectId: string
  name: string
  provider: string
  type: string
  planName: string
  isPaid: boolean
  monthlyCost: number
  currency: string
  usageLimit: number
  currentUsage: number
  usageUnit: string
  billingCycle: string
  renewalDate: string
  dashboardUrl: string
  notes: string
  status: 'Healthy' | 'Warning' | 'Offline'
}

export type SummaryMetric = {
  label: string
  value: string
  change?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

export type NotificationItem = {
  id: string
  title: string
  description: string
  type: 'info' | 'warning' | 'critical'
  timestamp: string
}
