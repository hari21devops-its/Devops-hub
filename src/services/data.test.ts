import { describe, expect, it, vi } from 'vitest'

import { createProject, deleteProject, getProjects, getServices, updateProject } from './data'
import { projectList } from '../lib/demo-data'

vi.mock('./supabase', () => ({ supabase: null }))

describe('workspace data service', () => {
  it('falls back to demo data when Supabase is unavailable', async () => {
    const projects = await getProjects()
    const services = await getServices()

    expect(projects.length).toBeGreaterThan(0)
    expect(services.length).toBeGreaterThan(0)
    expect(projects[0].name).toBe('Northstar Studio')
  })

  it('creates, updates, and deletes a project in demo mode', async () => {
    const created = await createProject({ ...projectList[0], id: 'crud-test-project' })
    const updated = await updateProject({ ...created, name: 'Updated test project' })

    expect(updated.name).toBe('Updated test project')

    await deleteProject(updated.id)
    const projects = await getProjects()

    expect(projects.some((project) => project.id === updated.id)).toBe(false)
  })
})
