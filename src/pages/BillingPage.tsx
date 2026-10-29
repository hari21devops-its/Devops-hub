import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import { createExpense, deleteExpense, getExpenses, getProjects, getServices, updateExpense, type ExpenseDraft, type ExpenseRecord } from '../services/data'
import type { Project, Service } from '../types'

const spendSummary = [
  { label: 'Monthly spend', value: '₹18,450', tone: 'neutral' },
  { label: 'This month', value: '+₹2,100', tone: 'warning' },
  { label: 'Forecast', value: '₹22,300', tone: 'neutral' },
  { label: 'Due next', value: '14 Nov', tone: 'success' },
] as const

const invoiceRows = [
  { vendor: 'Supabase', period: 'Oct 2026', amount: '₹4,200', status: 'Paid' },
  { vendor: 'Cloudflare', period: 'Oct 2026', amount: '₹2,850', status: 'Paid' },
  { vendor: 'DigitalOcean', period: 'Oct 2026', amount: '₹6,100', status: 'Pending' },
  { vendor: 'GitHub', period: 'Oct 2026', amount: '₹1,450', status: 'Pending' },
] as const

export function BillingPage() {
  const { isDemoMode } = useAuth()
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>({
    projectId: '', provider: '', service: '', amount: 0, currency: 'INR',
    billingPeriod: new Date().toISOString().slice(0, 7), paymentDate: '', nextPaymentDate: '',
    recurring: false, paymentStatus: 'Pending',
  })
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemoMode) {
      setExpenses([])
      setServices([])
      setError('')
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    void Promise.all([getExpenses(), getServices(), getProjects()])
      .then(([loadedExpenses, loadedServices, loadedProjects]) => {
        if (active) {
          setExpenses(loadedExpenses)
          setServices(loadedServices)
          setProjects(loadedProjects)
          setExpenseDraft((current) => ({ ...current, projectId: current.projectId || loadedProjects[0]?.id || '' }))
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load billing data.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isDemoMode])

  const handleExpenseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!expenseDraft.projectId) return

    try {
      const savedExpense = editingExpenseId
        ? await updateExpense({ ...expenseDraft, id: editingExpenseId })
        : await createExpense(expenseDraft)
      setExpenses((current) => editingExpenseId
        ? current.map((expense) => expense.id === savedExpense.id ? savedExpense : expense)
        : [savedExpense, ...current])
      setEditingExpenseId(null)
      setError('')
      setExpenseDraft((current) => ({ ...current, provider: '', service: '', amount: 0, paymentDate: '', nextPaymentDate: '' }))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save expense.')
    }
  }

  const handleExpenseEdit = (expense: ExpenseRecord) => {
    setEditingExpenseId(expense.id)
    setExpenseDraft({
      projectId: expense.projectId,
      provider: expense.provider,
      service: expense.service,
      amount: expense.amount,
      currency: expense.currency,
      billingPeriod: expense.billingPeriod,
      paymentDate: expense.paymentDate,
      nextPaymentDate: expense.nextPaymentDate,
      recurring: expense.recurring,
      paymentStatus: expense.paymentStatus,
      invoiceUrl: expense.invoiceUrl,
    })
  }

  const handleExpenseDelete = async (expenseId: string) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      await deleteExpense(expenseId)
      setExpenses((current) => current.filter((expense) => expense.id !== expenseId))
      if (editingExpenseId === expenseId) setEditingExpenseId(null)
      setError('')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete expense.')
    }
  }

  const handleCancelExpenseEdit = () => {
    setEditingExpenseId(null)
    setExpenseDraft((current) => ({
      ...current,
      projectId: projects[0]?.id ?? '',
      provider: '',
      service: '',
      amount: 0,
      paymentDate: '',
      nextPaymentDate: '',
    }))
  }

  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentExpenses = expenses.filter((expense) => expense.paymentDate.startsWith(currentMonth) || expense.billingPeriod === currentMonth)
  const monthTotal = currentExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const recurringTotal = services.filter((service) => service.isPaid).reduce((sum, service) => sum + service.monthlyCost, 0)
  const pendingCount = expenses.filter((expense) => expense.paymentStatus.toLowerCase() === 'pending').length
  const nextPayment = expenses.map((expense) => expense.nextPaymentDate).filter((date) => date >= currentMonth + '-01').sort()[0]
  const displayedSummary = isDemoMode ? spendSummary : [
    { label: 'This month', value: `${currentExpenses[0]?.currency ?? 'INR'} ${monthTotal.toLocaleString()}`, tone: 'neutral' },
    { label: 'Recurring services', value: `${services.find((service) => service.isPaid)?.currency ?? 'INR'} ${recurringTotal.toLocaleString()}`, tone: 'neutral' },
    { label: 'Pending invoices', value: String(pendingCount), tone: pendingCount ? 'warning' : 'success' },
    { label: 'Next payment', value: nextPayment ? new Date(`${nextPayment}T00:00:00`).toLocaleDateString() : 'None scheduled', tone: 'neutral' },
  ]
  const displayedRows: ReadonlyArray<{ id?: string; vendor: string; period: string; amount: string; status: string; invoiceUrl?: string | null }> = isDemoMode ? invoiceRows : expenses.map((expense) => ({
    id: expense.id,
    vendor: expense.provider || expense.service || 'Expense',
    period: expense.billingPeriod || expense.paymentDate || 'Unspecified',
    amount: `${expense.currency} ${expense.amount.toLocaleString()}`,
    status: expense.paymentStatus,
    invoiceUrl: expense.invoiceUrl,
  }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Billing & Expenses</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Spend overview and payment status</h2>
      </div>

      {!isDemoMode ? <Badge variant="default">Live expense records</Badge> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? <p className="text-sm text-slate-400">Loading billing data...</p> : displayedSummary.map((item) => (
          <Card key={item.label}>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className="text-2xl font-semibold text-white">{item.value}</p>
              <Badge variant={item.tone === 'warning' ? 'warning' : item.tone === 'success' ? 'success' : 'default'}>
                {item.tone === 'warning' ? 'Above plan' : 'Tracked'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Expense ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 pr-4 font-medium">Vendor</th>
                    <th className="pb-3 pr-4 font-medium">Period</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    {!isDemoMode ? <th className="pb-3 font-medium">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row) => (
                    <tr key={row.id ?? row.vendor} className="border-b border-slate-800 align-middle">
                      <td className="py-3 pr-4">{row.invoiceUrl?.startsWith('https://') ? <a href={row.invoiceUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">{row.vendor}</a> : row.vendor}</td>
                      <td className="py-3 pr-4">{row.period}</td>
                      <td className="py-3 pr-4">{row.amount}</td>
                      <td className="py-3">
                        <Badge variant={row.status === 'Paid' ? 'success' : 'warning'}>{row.status}</Badge>
                      </td>
                      {!isDemoMode && row.id ? <td className="py-3">
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="sm" className="px-2" title="Edit expense" aria-label={`Edit ${row.vendor}`} onClick={() => {
                            const expense = expenses.find((item) => item.id === row.id)
                            if (expense) handleExpenseEdit(expense)
                          }}><Pencil size={14} /></Button>
                          <Button type="button" variant="ghost" size="sm" className="px-2" title="Delete expense" aria-label={`Delete ${row.vendor}`} onClick={() => row.id && void handleExpenseDelete(row.id)}><Trash2 size={14} /></Button>
                        </div>
                      </td> : null}
                    </tr>
                  ))}
                  {!isLoading && displayedRows.length === 0 ? <tr><td className="py-4 text-slate-400" colSpan={isDemoMode ? 4 : 5}>No expense records yet.</td></tr> : null}
                </tbody>
              </table>
            </div>

          </CardContent>
        </Card>

        {!isDemoMode ? (
          <Card>
            <CardHeader><CardTitle>{editingExpenseId ? 'Edit expense' : 'Add expense'}</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleExpenseSubmit}>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Project</span>
                  <select value={expenseDraft.projectId} onChange={(event) => setExpenseDraft((current) => ({ ...current, projectId: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required disabled={!projects.length}>
                    {projects.length === 0 ? <option value="">Create a project first</option> : null}
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Provider</span>
                  <input value={expenseDraft.provider} onChange={(event) => setExpenseDraft((current) => ({ ...current, provider: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Provider" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Service</span>
                  <input value={expenseDraft.service} onChange={(event) => setExpenseDraft((current) => ({ ...current, service: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Service or invoice" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Amount</span>
                  <input type="number" min="0" step="0.01" value={expenseDraft.amount} onChange={(event) => setExpenseDraft((current) => ({ ...current, amount: Number(event.target.value) }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Billing period</span>
                  <input type="month" value={expenseDraft.billingPeriod} onChange={(event) => setExpenseDraft((current) => ({ ...current, billingPeriod: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Payment status</span>
                  <select value={expenseDraft.paymentStatus} onChange={(event) => setExpenseDraft((current) => ({ ...current, paymentStatus: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                    <option>Pending</option><option>Paid</option><option>Failed</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
                  <input type="checkbox" checked={expenseDraft.recurring} onChange={(event) => setExpenseDraft((current) => ({ ...current, recurring: event.target.checked }))} />
                  Recurring
                </label>
                <Button type="submit" className="self-end" disabled={!projects.length}>{editingExpenseId ? 'Update expense' : 'Save expense'}</Button>
                {editingExpenseId ? <Button type="button" variant="outline" className="self-end" onClick={handleCancelExpenseEdit}>Cancel edit</Button> : null}
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
