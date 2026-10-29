import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { createDomain, deleteDomain, getDomains, getProjects, updateDomain } from '../services/data'
import type { Domain, Project } from '../types'

const defaultDomain: Omit<Domain, 'id' | 'projectId'> = {
  name: '',
  registrar: '',
  registrationDate: '',
  expirationDate: '',
  autoRenew: true,
  renewalPrice: 0,
  currency: 'INR',
  dnsProvider: '',
  nameservers: [''],
  sslStatus: 'Unknown',
  sslExpirationDate: '',
  status: 'Active',
  notes: '',
}

export function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [draft, setDraft] = useState(defaultDomain)
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      const [hydratedDomains, hydratedProjects] = await Promise.all([getDomains(), getProjects()])
      if (active) {
        setDomains(hydratedDomains)
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
    const nextDomain: Domain = {
      id: `dom-${Date.now()}`,
      projectId: selectedProjectId,
      name: draft.name,
      registrar: draft.registrar,
      registrationDate: draft.registrationDate || new Date().toISOString().slice(0, 10),
      expirationDate: draft.expirationDate || new Date().toISOString().slice(0, 10),
      autoRenew: draft.autoRenew,
      renewalPrice: draft.renewalPrice,
      currency: draft.currency,
      dnsProvider: draft.dnsProvider,
      nameservers: draft.nameservers.filter(Boolean),
      sslStatus: draft.sslStatus,
      sslExpirationDate: draft.sslExpirationDate || undefined,
      status: draft.status,
      notes: draft.notes,
    }

    try {
      const savedDomain = editingDomainId ? await updateDomain(nextDomain) : await createDomain(nextDomain)
      setDomains((current) => editingDomainId
        ? current.map((domain) => domain.id === savedDomain.id ? savedDomain : domain)
        : [savedDomain, ...current])
      setEditingDomainId(null)
      setFormError('')
      setDraft(defaultDomain)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save domain.')
    }
  }

  const handleEdit = (domain: Domain) => {
    setEditingDomainId(domain.id)
    setSelectedProjectId(domain.projectId)
    setDraft({
      name: domain.name,
      registrar: domain.registrar,
      registrationDate: domain.registrationDate,
      expirationDate: domain.expirationDate,
      autoRenew: domain.autoRenew,
      renewalPrice: domain.renewalPrice,
      currency: domain.currency,
      dnsProvider: domain.dnsProvider,
      nameservers: domain.nameservers,
      sslStatus: domain.sslStatus,
      sslExpirationDate: domain.sslExpirationDate ?? '',
      status: domain.status,
      notes: domain.notes,
    })
  }

  const handleDelete = async (domainId: string) => {
    if (!window.confirm('Delete this domain?')) {
      return
    }
    try {
      await deleteDomain(domainId)
      setDomains((current) => current.filter((domain) => domain.id !== domainId))
      if (editingDomainId === domainId) {
        setEditingDomainId(null)
        setDraft(defaultDomain)
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to delete domain.')
    }
  }

  const handleCancelEdit = () => {
    setEditingDomainId(null)
    setDraft(defaultDomain)
    setFormError('')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Domains</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Domain and renewal management</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Domain inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {domains.map((domain) => (
              <div key={domain.id} className="rounded-lg border border-slate-800 bg-slate-950/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{domain.name}</p>
                    <p className="text-sm text-slate-400">{domain.registrar}</p>
                  </div>
                  <div className="flex items-center gap-2">
                  <Badge variant={domain.status === 'Active' ? 'success' : domain.status === 'Pending' ? 'warning' : 'danger'}>
                    {domain.status}
                  </Badge>
                    <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Edit ${domain.name}`} title="Edit domain" onClick={() => handleEdit(domain)}>
                      <Pencil size={14} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Delete ${domain.name}`} title="Delete domain" onClick={() => void handleDelete(domain.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <span>Expires: {domain.expirationDate}</span>
                  <span>SSL: {domain.sslStatus}</span>
                  <span>Renewal: ₹{domain.renewalPrice}</span>
                  <span>DNS: {domain.dnsProvider}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{editingDomainId ? 'Edit domain' : 'Add domain'}</CardTitle>
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
                <span className="mb-1 block text-sm text-slate-300">Domain name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="example.com"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Registrar</span>
                <input
                  value={draft.registrar}
                  onChange={(event) => setDraft((current) => ({ ...current, registrar: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="Namecheap"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Expiration</span>
                  <input
                    type="date"
                    value={draft.expirationDate}
                    onChange={(event) => setDraft((current) => ({ ...current, expirationDate: event.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Renewal price</span>
                  <input
                    type="number"
                    value={draft.renewalPrice}
                    onChange={(event) => setDraft((current) => ({ ...current, renewalPrice: Number(event.target.value) }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
              {formError ? <p role="alert" className="text-sm text-rose-600">{formError}</p> : null}
              <Button type="submit" className="w-full" disabled={projects.length === 0}>{editingDomainId ? 'Update domain' : 'Save domain'}</Button>
              {editingDomainId ? <Button type="button" variant="outline" className="w-full" onClick={handleCancelEdit}>Cancel edit</Button> : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
