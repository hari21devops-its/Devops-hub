import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, vi } from 'vitest'
import App from './App'

vi.mock('./services/supabase', () => ({ supabase: null }))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('App', () => {
  it('renders the DevOps Hub dashboard in demo mode', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    render(<App />)

    expect(screen.getByText(/devops hub/i)).toBeInTheDocument()
    expect(screen.getByText(/demo data only/i)).toBeInTheDocument()
  })

  it('navigates from the global dashboard to an isolated project page', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Projects' }))
    await user.click(await screen.findByRole('link', { name: /Northstar Studio/ }))

    expect(await screen.findByText('Project overview')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Main dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText('Visitors this month')).toBeInTheDocument()
  })
})
