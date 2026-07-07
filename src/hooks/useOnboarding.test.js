import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOnboarding } from './useOnboarding.js';

// store.js persists the global config to localStorage['lokus:config'] outside Tauri.
const CONFIG_KEY = 'lokus:config';

beforeEach(() => {
  localStorage.clear();
});

describe('useOnboarding — first-run gate', () => {
  it('shows the wizard for a brand-new user (no config, no existing vault)', async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.phase).toBe('wizard');
  });

  it('does NOT show the wizard once onboarding is complete', async () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ hasCompletedOnboarding: true }));
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.phase).toBe(null);
  });

  it('completeWizard persists completion and moves to the walkthrough', async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.phase).toBe('wizard'));

    await result.current.completeWizard();
    await waitFor(() => expect(result.current.phase).toBe('walkthrough'));

    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
    expect(saved.hasCompletedOnboarding).toBe(true);
  });

  it('skipAll marks onboarding complete and closes it', async () => {
    const { result } = renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.phase).toBe('wizard'));

    await result.current.skipAll();
    await waitFor(() => expect(result.current.phase).toBe(null));
    expect(JSON.parse(localStorage.getItem(CONFIG_KEY)).hasCompletedOnboarding).toBe(true);
  });
});
