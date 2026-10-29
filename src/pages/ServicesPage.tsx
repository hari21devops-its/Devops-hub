import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { createService, deleteService, getProjects, getServices, updateService } from '../services/data'
import type { Project, Service } from '../types'

const defaultService: Omit<Service, 'id' | 'projectId'> = {
  name: '',
  provider: '',
  type: 'Hosting',
  planName: 'Free',
  isPaid: false,
  monthlyCost: 0,
  currency: 'INR',
  usageLimit: 0,
  currentUsage: 0,
  usageUnit: 'GB',
  billingCycle: 'Monthly',
  renewalDate: '',
  dashboardUrl: '',
  notes: '',
  status: 'Healthy',
}

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [draft, setDraft] = useState(defaultService)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      const [hydratedServices, hydratedProjects] = await Promise.all([getServices(), getProjects()])
      if (active) {
        setServices(hydratedServices)
        setProjects(hydratedProjects)
        setSelectedProjectId((current) => current || hydratedProjects[0]?.id || '')
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProjectId) {
      return
    }

    const nextService: Service = {
      id: `svc-${Date.now()}`,
      projectId: selectedProjectId,
      name: draft.name,
      provider: draft.provider,
      type: draft.type,
      planName: draft.planName,
      isPaid: draft.isPaid,
      monthlyCost: draft.monthlyCost,
      currency: draft.currency,
      usageLimit: draft.usageLimit,
      currentUsage: draft.currentUsage,
      usageUnit: draft.usageUnit,
      billingCycle: draft.billingCycle,
      renewalDate: draft.renewalDate || new Date().toISOString().slice(0, 10),
      dashboardUrl: draft.dashboardUrl,
      notes: draft.notes,
      status: draft.status,
    }

    try {
      const savedService = editingServiceId ? await updateService(nextService) : await createService(nextService)
      setServices((current) => editingServiceId
        ? current.map((service) => service.id === savedService.id ? savedService : service)
        : [savedService, ...current])
      setEditingServiceId(null)
      setFormError('')
      setDraft(defaultService)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save service.')
    }
  }

  const handleEdit = (service: Service) => {
    setEditingServiceId(service.id)
    setSelectedProjectId(service.projectId)
    setDraft({
      name: service.name,
      provider: service.provider,
      type: service.type,
      planName: service.planName,
      isPaid: service.isPaid,
      monthlyCost: service.monthlyCost,
      currency: service.currency,
      usageLimit: service.usageLimit,
      currentUsage: service.currentUsage,
      usageUnit: service.usageUnit,
      billingCycle: service.billingCycle,
      renewalDate: service.renewalDate,
      dashboardUrl: service.dashboardUrl,
      notes: service.notes,
      status: service.status,
    })
  }

  const handleDelete = async (serviceId: string) => {
    if (!window.confirm('Delete this service?')) {
      return
    }
    try {
      await deleteService(serviceId)
      setServices((current) => current.filter((service) => service.id !== serviceId))
      if (editingServiceId === serviceId) {
        setEditingServiceId(null)
        setDraft(defaultService)
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to delete service.')
    }
  }

  const handleCancelEdit = () => {
    setEditingServiceId(null)
    setDraft(defaultService)
    setFormError('')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Services</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Hosting and infrastructure services</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Service catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="rounded-lg border border-slate-800 bg-slate-950/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{service.name}</p>
                    <p className="text-sm text-slate-400">{service.provider} • {service.planName}</p>
                  </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={service.status === 'Healthy' ? 'success' : service.status === 'Warning' ? 'warning' : 'danger'}>
                        {service.status}
                      </Badge>
                      <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Edit ${service.name}`} title="Edit service" onClick={() => handleEdit(service)}>
                        <Pencil size={14} />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Delete ${service.name}`} title="Delete service" onClick={() => void handleDelete(service.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <span>Usage: {service.currentUsage} / {service.usageLimit} {service.usageUnit}</span>
                  <span>Monthly: ₹{service.monthlyCost}</span>
                  <span>Billing: {service.billingCycle}</span>
                  <span>Type: {service.type}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{editingServiceId ? 'Edit service' : 'Add service'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Project</span>
                <select
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  required
                  disabled={projects.length === 0}
                >
                  {projects.length === 0 ? <option value="">Create a project first</option> : null}
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Service name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="Firebase Hosting"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Provider</span>
                <input
                  value={draft.provider}
                  onChange={(event) => setDraft((current) => ({ ...current, provider: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="Firebase"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Plan</span>
                  <input
                    value={draft.planName}
                    onChange={(event) => setDraft((current) => ({ ...current, planName: event.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Monthly cost</span>
                  <input
                    type="number"
                    value={draft.monthlyCost}
                    onChange={(event) => setDraft((current) => ({ ...current, monthlyCost: Number(event.target.value) }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
              {formError ? <p role="alert" className="text-sm text-rose-600">{formError}</p> : null}
              <Button type="submit" className="w-full" disabled={projects.length === 0}>{editingServiceId ? 'Update service' : 'Save service'}</Button>
              {editingServiceId ? <Button type="button" variant="outline" className="w-full" onClick={handleCancelEdit}>Cancel edit</Button> : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
