import { describe, expect, it } from 'vitest'

import type { Project } from '../types'
import { buildProjectSummary, normalizeProjectDraft } from './project-utils'

const projects: Project[] = [
  {
    id: '1',
    name: 'Alpha',
    description: 'Marketing site',
    websiteUrl: 'https://alpha.dev',
    repositoryUrl: 'https://github.com/acme/alpha',
    environment: 'Production',
    category: 'Marketing',
    status: 'Healthy',
    createdAt: '2025-05-01',
    notes: 'Live',
    tags: ['marketing', 'public'],
    monthlyVisitors: 12000,
  },
  {
    id: '2',
    name: 'Beta',
    description: 'Admin app',
    websiteUrl: 'https://beta.dev',
    repositoryUrl: 'https://github.com/acme/beta',
    environment: 'Development',
    category: 'SaaS',
    status: 'Warning',
    createdAt: '2025-06-15',
    notes: 'Needs review',
    tags: ['internal'],
    monthlyVisitors: 5400,
  },
]

describe('project utilities', () => {
  it('builds project summary counts from projects', () => {
    const summary = buildProjectSummary(projects)

    expect(summary.totalProjects).toBe(2)
    expect(summary.totalMonthlyVisitors).toBe(17400)
    expect(summary.byEnvironment.Production).toBe(1)
    expect(summary.byEnvironment.Development).toBe(1)
  })

  it('normalizes draft values and trims tags', () => {
    const normalized = normalizeProjectDraft({
      name: ' Demo Portal ',
      websiteUrl: 'https://demo.example.com',
      repositoryUrl: ' https://github.com/acme/demo ',
      description: 'Launch-ready portal',
      tags: [' launch ', 'ops', ''],
    })

    expect(normalized.name).toBe('Demo Portal')
    expect(normalized.websiteUrl).toBe('https://demo.example.com')
    expect(normalized.repositoryUrl).toBe('https://github.com/acme/demo')
    expect(normalized.tags).toEqual(['launch', 'ops'])
  })
})
