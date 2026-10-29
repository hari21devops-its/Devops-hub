import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { BillingPage } from './pages/BillingPage'
import { DashboardPage } from './pages/DashboardPage'
import { DomainsPage } from './pages/DomainsPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailLayout, ProjectOverviewPage, ProjectSectionPage } from './pages/ProjectDetailPage'
import { ServicesPage } from './pages/ServicesPage'
import { SettingsPage } from './pages/SettingsPage'
import { UptimePage } from './pages/UptimePage'
import { UsagePage } from './pages/UsagePage'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Module</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-3 text-slate-400">This section is ready for the next implementation phase.</p>
    </div>
  )
}

function ProtectedLayout() {
  const { user, isDemoMode, isLoading } = useAuth()

  if (isLoading) {
    return <div className="p-8 text-sm text-slate-400">Loading workspace...</div>
  }

  if (!user && !isDemoMode) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailLayout />}>
            <Route index element={<ProjectOverviewPage />} />
            <Route path=":section" element={<ProjectSectionPage />} />
          </Route>
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/domains" element={<DomainsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/deployments" element={<PlaceholderPage title="Deployments" />} />
          <Route path="/uptime" element={<UptimePage />} />
          <Route path="/errors" element={<PlaceholderPage title="Error Tracking" />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
