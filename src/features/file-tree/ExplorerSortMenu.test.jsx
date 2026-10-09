import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExplorerSortMenu } from './ExplorerSortMenu';
import { useExplorerSortStore } from '../../stores/explorerSort';
import { DEFAULT_SORT_PREFERENCES, SORT_OPTIONS } from './sorting';

beforeEach(() => {
  useExplorerSortStore.setState({ sortPreferences: DEFAULT_SORT_PREFERENCES });
});

describe('Explorer sort menu', () => {
  it('shows all sort options and marks the selected order', async () => {
    const user = userEvent.setup();
    render(<ExplorerSortMenu />);
    await user.click(screen.getByRole('button', { name: 'Sort files: Name (A to Z)' }));
    for (const option of SORT_OPTIONS) {
      expect(screen.getByRole('menuitemradio', { name: option.label })).toBeInTheDocument();
    }
    expect(screen.getByRole('menuitemradio', { name: 'Name (A to Z)' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: 'Date modified (newest first)' }));
    expect(useExplorerSortStore.getState().sortPreferences).toEqual({ sortBy: 'modified', direction: 'desc', foldersFirst: true });
    expect(screen.getByRole('button', { name: 'Sort files: Date modified (newest first)' })).toBeInTheDocument();
  });

  it('toggles folders first repeatedly and retains the setting when reopened', async () => {
    const user = userEvent.setup();
    render(<ExplorerSortMenu />);
    for (const checked of [false, true]) {
      await user.click(screen.getByRole('button', { name: /Sort files/ }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: 'Folders first' }));
      expect(useExplorerSortStore.getState().sortPreferences.foldersFirst).toBe(checked);
    }
    await user.click(screen.getByRole('button', { name: /Sort files/ }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Folders first' })).toHaveAttribute('aria-checked', 'true');
  });

  it('supports keyboard opening and Escape without changing the preference', async () => {
    const user = userEvent.setup();
    render(<ExplorerSortMenu />);
    const trigger = screen.getByRole('button', { name: /Sort files/ });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(useExplorerSortStore.getState().sortPreferences).toEqual(DEFAULT_SORT_PREFERENCES);
  });
});
