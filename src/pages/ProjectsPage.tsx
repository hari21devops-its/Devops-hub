import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { normalizeProjectDraft } from '../lib/project-utils'
import { createProject, deleteProject, getProjects, updateProject } from '../services/data'
import { useAuth } from '../contexts/AuthContext'
import type { Project } from '../types'

const emptyDraft: {
  name: string
  description: string
  websiteUrl: string
  repositoryUrl: string
  environment: Project['environment']
  category: string
  clientName: string
  status: Project['status']
  notes: string
  tags: string
  monthlyVisitors: number
} = {
  name: '',
  description: '',
  websiteUrl: '',
  repositoryUrl: '',
  environment: 'Development',
  category: 'General',
  clientName: '',
  status: 'Healthy',
  notes: '',
  tags: 'marketing, internal',
  monthlyVisitors: 0,
}

export function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [draft, setDraft] = useState(emptyDraft)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    void (async () => {
      const hydratedProjects = await getProjects()
      setProjects(hydratedProjects)
    })()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalized = normalizeProjectDraft({
      name: draft.name,
      description: draft.description,
      websiteUrl: draft.websiteUrl,
      repositoryUrl: draft.repositoryUrl,
      environment: draft.environment,
      category: draft.category,
      clientName: draft.clientName,
      status: draft.status,
      notes: draft.notes,
      tags: draft.tags.split(',').map((tag) => tag.trim()),
    })

    if (!normalized.name) {
      return
    }

    const nextProject: Project = {
      id: `proj-${Date.now()}`,
      name: normalized.name,
      description: normalized.description,
      websiteUrl: normalized.websiteUrl || 'https://example.com',
      repositoryUrl: normalized.repositoryUrl || 'https://github.com/example',
      environment: normalized.environment,
      category: normalized.category,
      clientName: normalized.clientName || undefined,
      status: normalized.status,
      createdAt: new Date().toISOString().slice(0, 10),
      notes: normalized.notes,
      tags: normalized.tags,
      monthlyVisitors: draft.monthlyVisitors || 0,
    }

    try {
      const savedProject = editingProjectId
        ? await updateProject(nextProject, user?.id)
        : await createProject(nextProject, user?.id)
      setProjects((current) => editingProjectId
        ? current.map((project) => project.id === savedProject.id ? savedProject : project)
        : [savedProject, ...current])
      setEditingProjectId(null)
      setFormError('')
      setDraft(emptyDraft)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save project.')
    }
  }

  const handleEdit = (project: Project) => {
    setEditingProjectId(project.id)
    setDraft({
      name: project.name,
      description: project.description,
      websiteUrl: project.websiteUrl,
      repositoryUrl: project.repositoryUrl,
      environment: project.environment,
      category: project.category,
      clientName: project.clientName ?? '',
      status: project.status,
      notes: project.notes,
      tags: project.tags.join(', '),
      monthlyVisitors: project.monthlyVisitors,
    })
  }

  const handleDelete = async (projectId: string) => {
    if (!window.confirm('Delete this project and its related records?')) {
      return
    }
    try {
      await deleteProject(projectId)
      setProjects((current) => current.filter((project) => project.id !== projectId))
      if (editingProjectId === projectId) {
        setEditingProjectId(null)
        setDraft(emptyDraft)
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to delete project.')
    }
  }

  const handleCancelEdit = () => {
    setEditingProjectId(null)
    setDraft(emptyDraft)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Projects</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Project portfolio</h2>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              <CardHeader className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/projects/${project.id}`} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
                    <CardTitle>{project.name}</CardTitle>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant={project.status === 'Healthy' ? 'success' : project.status === 'Warning' ? 'warning' : project.status === 'Offline' ? 'danger' : 'default'}>
                      {project.status}
                    </Badge>
                    <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Edit ${project.name}`} title="Edit project" onClick={() => handleEdit(project)}>
                      <Pencil size={14} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="px-2" aria-label={`Delete ${project.name}`} title="Delete project" onClick={() => void handleDelete(project.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Link to={`/projects/${project.id}`} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
              <CardContent className="space-y-4 pt-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Environment</p>
                  <p className="mt-1 text-sm text-slate-200">{project.environment}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Website</p>
                  <p className="mt-1 text-sm text-slate-200">{project.websiteUrl}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Monthly visitors</p>
                  <p className="mt-1 text-sm text-slate-200">{project.monthlyVisitors.toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <Badge key={`${project.id}-${tag}`} variant="default">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
              </Link>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editingProjectId ? 'Edit project' : 'Add project'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Project name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="Northstar Studio"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Website URL</span>
                <input
                  value={draft.websiteUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, websiteUrl: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="https://example.com"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Repository URL</span>
                <input
                  value={draft.repositoryUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, repositoryUrl: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="https://github.com/acme/project"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Environment</span>
                  <select
                    value={draft.environment}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, environment: event.target.value as Project['environment'] }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="Development">Development</option>
                    <option value="Staging">Staging</option>
                    <option value="Production">Production</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Status</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, status: event.target.value as Project['status'] }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="Healthy">Healthy</option>
                    <option value="Warning">Warning</option>
                    <option value="Offline">Offline</option>
                    <option value="Archived">Archived</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Tags</span>
                <input
                  value={draft.tags}
                  onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  placeholder="marketing, internal"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Monthly visitors</span>
                <input
                  type="number"
                  value={draft.monthlyVisitors}
                  onChange={(event) => setDraft((current) => ({ ...current, monthlyVisitors: Number(event.target.value) }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              {formError ? <p role="alert" className="text-sm text-rose-600">{formError}</p> : null}
              <Button type="submit" className="w-full">{editingProjectId ? 'Update project' : 'Save project'}</Button>
              {editingProjectId ? <Button type="button" variant="outline" className="w-full" onClick={handleCancelEdit}>Cancel edit</Button> : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
