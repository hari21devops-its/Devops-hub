import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CreditCard,
  FolderKanban,
  Globe,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/button'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Projects', icon: FolderKanban, path: '/projects' },
  { label: 'Website Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Domains', icon: Globe, path: '/domains' },
  { label: 'Hosting & Services', icon: ShieldCheck, path: '/services' },
  { label: 'Deployments', icon: Sparkles, path: '/deployments' },
  { label: 'Uptime Monitoring', icon: TriangleAlert, path: '/uptime' },
  { label: 'Error Tracking', icon: BriefcaseBusiness, path: '/errors' },
  { label: 'Usage & Quotas', icon: CreditCard, path: '/usage' },
  { label: 'Billing & Expenses', icon: CreditCard, path: '/billing' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
  { label: 'Integrations', icon: Users, path: '/integrations' },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

function getStoredTheme(): 'light' | 'dark' {
  try {
    return window.localStorage.getItem('devops-hub-theme') === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem('devops-hub-theme', theme)
    } catch {
      // Theme still applies for the current session when storage is unavailable.
    }
  }, [theme])

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-950/80">
        <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sm font-semibold text-sky-300">
            DH
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operations</p>
            <h1 className="text-lg font-semibold text-white">DevOps Hub</h1>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {navigation.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-inner shadow-slate-900'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-900/70 p-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Account</p>
              <p className="mt-1 text-sm font-medium text-white">{user?.name ?? 'Demo User'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="px-2">
              <LogOut size={14} />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative w-[420px] max-w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                placeholder="Search projects, domains, alerts..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>
              New project
            </Button>
            <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-200">
                {user?.name?.slice(0, 2).toUpperCase() ?? 'DU'}
              </div>
              <div className="text-sm">
                <p className="font-medium text-white">{user?.name ?? 'Demo User'}</p>
                <p className="text-xs text-slate-400">{user?.role ?? 'Platform Owner'}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
