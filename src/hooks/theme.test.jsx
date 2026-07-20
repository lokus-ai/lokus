import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => { }),
}))

import { emit } from '@tauri-apps/api/event'
import { ThemeProvider, useTheme } from './theme.jsx'
import { writeConfig } from '../core/config/store.js'

function Probe() {
  const { theme, setTheme, isThemeLoaded } = useTheme()
  return (
    <div>
      <span data-testid="loaded">{String(isThemeLoaded)}</span>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('dracula')}>set-theme</button>
    </div>
  )
}

async function renderAndWaitForLoad() {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  )
  await waitFor(() => expect(screen.getByTestId('loaded').textContent).toBe('true'))
}

describe('ThemeProvider boot behavior', () => {
  beforeEach(async () => {
    localStorage.clear()
    await writeConfig({})
  })

  it('does NOT broadcast theme:apply on boot, even with a configured theme', async () => {
    // With a configured theme the old boot path re-applied it via
    // setGlobalActiveTheme, which wrote config and emitted theme:apply.
    await writeConfig({ theme: 'dracula' })

    await renderAndWaitForLoad()

    expect(screen.getByTestId('theme').textContent).toBe('dracula')
    expect(emit).not.toHaveBeenCalled()
  })

  it('emits theme:apply exactly once on an explicit setTheme', async () => {
    await renderAndWaitForLoad()
    expect(emit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('set-theme'))

    await waitFor(() => {
      expect(emit).toHaveBeenCalledTimes(1)
    })
    expect(emit).toHaveBeenCalledWith('theme:apply', expect.objectContaining({
      visuals: expect.objectContaining({ theme: 'dracula' }),
    }))
    expect(screen.getByTestId('theme').textContent).toBe('dracula')
  })
})
