import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DiffPreview primitive so the bar can be tested in isolation.
vi.mock('./DiffPreview.js', () => ({
  acceptPreview: vi.fn(),
  rejectPreview: vi.fn(),
}));

import { acceptPreview, rejectPreview } from './DiffPreview.js';
import AIWritePreviewBar from './AIWritePreviewBar.jsx';

describe('AIWritePreviewBar', () => {
  beforeEach(() => {
    acceptPreview.mockClear();
    rejectPreview.mockClear();
  });

  const view = { __isView: true };

  it('renders the label and Accept/Reject controls', () => {
    render(<AIWritePreviewBar view={view} label="Rewrite" />);
    expect(screen.getByText('Rewrite')).toBeInTheDocument();
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('Accept calls acceptPreview and onResolved', () => {
    const onResolved = vi.fn();
    render(<AIWritePreviewBar view={view} onResolved={onResolved} />);
    fireEvent.click(screen.getByText('Accept'));
    expect(acceptPreview).toHaveBeenCalledWith(view);
    expect(onResolved).toHaveBeenCalledWith('accepted');
  });

  it('Reject calls rejectPreview and onResolved', () => {
    const onResolved = vi.fn();
    render(<AIWritePreviewBar view={view} onResolved={onResolved} />);
    fireEvent.click(screen.getByText('Reject'));
    expect(rejectPreview).toHaveBeenCalledWith(view);
    expect(onResolved).toHaveBeenCalledWith('rejected');
  });

  it('disables Accept while streaming', () => {
    render(<AIWritePreviewBar view={view} streaming label="AI edit" />);
    expect(screen.getByText('Accept').closest('button')).toBeDisabled();
  });
});
