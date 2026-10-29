import type { Project } from '../types'

export type ProjectSummary = {
  totalProjects: number
  totalMonthlyVisitors: number
  byEnvironment: Record<Project['environment'], number>
}

export function buildProjectSummary(projects: Project[]): ProjectSummary {
  const byEnvironment: Record<Project['environment'], number> = {
    Development: 0,
    Staging: 0,
    Production: 0,
  }

  for (const project of projects) {
    byEnvironment[project.environment] += 1
  }

  return {
    totalProjects: projects.length,
    totalMonthlyVisitors: projects.reduce((sum, project) => sum + project.monthlyVisitors, 0),
    byEnvironment,
  }
}

export function normalizeProjectDraft(input: Partial<Project>) {
  const name = String(input.name ?? '').trim()
  const description = String(input.description ?? '').trim()
  const websiteUrl = String(input.websiteUrl ?? '').trim()
  const repositoryUrl = String(input.repositoryUrl ?? '').trim()
  const category = String(input.category ?? 'General').trim() || 'General'
  const clientName = String(input.clientName ?? '').trim()
  const notes = String(input.notes ?? '').trim()
  const tags = Array.from(
    new Set(
      (input.tags ?? [])
        .map((tag) => String(tag).trim())
        .filter((tag) => tag.length > 0),
    ),
  )

  return {
    name,
    description,
    websiteUrl,
    repositoryUrl,
    environment: (input.environment ?? 'Development') as Project['environment'],
    category,
    clientName,
    status: (input.status ?? 'Healthy') as Project['status'],
    notes,
    tags,
  }
}
