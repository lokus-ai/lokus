import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  RemoteConfigProvider,
  useFeatureFlags,
  useAdvancedFeatures,
  ADVANCED_FEATURE_FLAGS,
  applyInternalDevFlags,
  detectExistingUser,
} from './RemoteConfigContext.jsx';

// Deterministic: no real remote config fetch.
beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
});
afterEach(() => {
  vi.restoreAllMocks();
});

function Flags() {
  const ff = useFeatureFlags();
  const { advancedFeatures, setAdvancedFeatures } = useAdvancedFeatures();
  return (
    <div>
      <span data-testid="graph">{String(ff.enable_graph)}</span>
      <span data-testid="canvas">{String(ff.enable_canvas)}</span>
      <span data-testid="kanban">{String(ff.enable_kanban)}</span>
      <span data-testid="sync">{String(ff.enable_sync)}</span>
      <span data-testid="backlinks">{String(ff.enable_backlinks)}</span>
      <span data-testid="daily">{String(ff.enable_daily_notes)}</span>
      <span data-testid="import">{String(ff.enable_import_export)}</span>
      <span data-testid="adv">{String(advancedFeatures)}</span>
      <button onClick={() => setAdvancedFeatures(true)}>enable-advanced</button>
      <button onClick={() => setAdvancedFeatures(false)}>disable-advanced</button>
    </div>
  );
}

const renderFlags = () =>
  render(
    <RemoteConfigProvider>
      <Flags />
    </RemoteConfigProvider>
  );

describe('Simple feature-flag default', () => {
  it('hides every advanced flag and keeps the core writing flags on by default', async () => {
    renderFlags();
    await waitFor(() => expect(screen.getByTestId('adv').textContent).toBe('false'));

    // Advanced panels are OFF for a fresh user
    expect(screen.getByTestId('graph').textContent).toBe('false');
    expect(screen.getByTestId('canvas').textContent).toBe('false');
    expect(screen.getByTestId('kanban').textContent).toBe('false');
    expect(screen.getByTestId('sync').textContent).toBe('false');

    // Core "Simple" flags stay ON
    expect(screen.getByTestId('backlinks').textContent).toBe('true');
    expect(screen.getByTestId('daily').textContent).toBe('true');
    expect(screen.getByTestId('import').textContent).toBe('true');
  });

  it('turning on Advanced features reveals the advanced flags and persists the choice', async () => {
    renderFlags();
    await waitFor(() => expect(screen.getByTestId('graph').textContent).toBe('false'));

    fireEvent.click(screen.getByText('enable-advanced'));

    await waitFor(() => expect(screen.getByTestId('graph').textContent).toBe('true'));
    expect(screen.getByTestId('canvas').textContent).toBe('true');
    expect(screen.getByTestId('sync').textContent).toBe('true');
    expect(localStorage.getItem('lokus-advanced-features')).toBe('true');
  });

  it('respects a persisted Advanced preference on load', async () => {
    localStorage.setItem('lokus-advanced-features', 'true');
    renderFlags();
    await waitFor(() => expect(screen.getByTestId('adv').textContent).toBe('true'));
    expect(screen.getByTestId('graph').textContent).toBe('true');
  });

  it('ADVANCED_FEATURE_FLAGS lists exactly the 10 hidden flags', () => {
    expect(ADVANCED_FEATURE_FLAGS).toHaveLength(10);
    expect(ADVANCED_FEATURE_FLAGS).not.toContain('enable_daily_notes');
    expect(ADVANCED_FEATURE_FLAGS).not.toContain('enable_backlinks');
    expect(ADVANCED_FEATURE_FLAGS).not.toContain('enable_import_export');
  });

  it('detectExistingUser returns false outside Tauri (fresh browser/test env → Simple)', async () => {
    await expect(detectExistingUser()).resolves.toBe(false);
  });

  it('enables the internal Team Notes foundation in interactive dev builds only', () => {
    const flags = {
      enable_note_engine_foundation: false,
      enable_team_notes_foundation: false,
    };
    expect(applyInternalDevFlags(flags, {
      dev: true,
      mode: 'development',
    })).toEqual({
      enable_note_engine_foundation: true,
      enable_team_notes_foundation: true,
    });
    expect(applyInternalDevFlags(flags, {
      dev: true,
      mode: 'test',
    })).toEqual(flags);
    expect(applyInternalDevFlags(flags, {
      dev: false,
      mode: 'production',
    })).toEqual(flags);
  });
});
