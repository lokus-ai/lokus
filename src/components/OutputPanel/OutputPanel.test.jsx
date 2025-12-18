/**
 * Output Panel Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import OutputPanel from './OutputPanel';
import outputChannelManager from '../../plugins/managers/OutputChannelManager.js';

describe('OutputPanel', () => {
  beforeEach(() => {
    // Clear all channels before each test
    const channels = outputChannelManager.getChannels();
    channels.forEach(ch => outputChannelManager.dispose(ch.name));
  });

  it('renders when isOpen is true', () => {
    render(<OutputPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Select channel...')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<OutputPanel isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays available channels in dropdown', () => {
    // Create test channels
    outputChannelManager.createChannel('Test Plugin 1', 'plugin1');
    outputChannelManager.createChannel('Test Plugin 2', 'plugin2');

    render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3); // Including "Select channel..."
    expect(options[1]).toHaveTextContent('Test Plugin 1');
    expect(options[2]).toHaveTextContent('Test Plugin 2');
  });

  it('displays channel output when selected', async () => {
    const channel = outputChannelManager.createChannel('Test Plugin', 'plugin1');
    channel.appendLine('Test output line 1');
    channel.appendLine('Test output line 2');

    render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Test Plugin' } });

    await waitFor(() => {
      expect(screen.getByText(/Test output line 1/)).toBeInTheDocument();
      expect(screen.getByText(/Test output line 2/)).toBeInTheDocument();
    });
  });

  it('updates content when channel is updated', async () => {
    const channel = outputChannelManager.createChannel('Test Plugin', 'plugin1');
    channel.appendLine('Initial output');

    render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Test Plugin' } });

    await waitFor(() => {
      expect(screen.getByText(/Initial output/)).toBeInTheDocument();
    });

    // Add more output
    channel.appendLine('New output');

    await waitFor(() => {
      expect(screen.getByText(/New output/)).toBeInTheDocument();
    });
  });

  it('clears channel content when Clear button is clicked', async () => {
    const channel = outputChannelManager.createChannel('Test Plugin', 'plugin1');
    channel.appendLine('Test output');

    render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Test Plugin' } });

    await waitFor(() => {
      expect(screen.getByText(/Test output/)).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText(/Test output/)).not.toBeInTheDocument();
      expect(screen.getByText('No output')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<OutputPanel isOpen={true} onClose={handleClose} />);

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows "No output" when channel has no content', () => {
    outputChannelManager.createChannel('Empty Plugin', 'plugin1');

    render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Empty Plugin' } });

    expect(screen.getByText('No output')).toBeInTheDocument();
  });

  it('disables Clear button when no channel is selected', () => {
    render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeDisabled();
  });

  it('enables Clear button when a channel is selected', () => {
    outputChannelManager.createChannel('Test Plugin', 'plugin1');

    render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Test Plugin' } });

    const clearButton = screen.getByText('Clear');
    expect(clearButton).not.toBeDisabled();
  });

  it('handles channel disposal', async () => {
    const channel = outputChannelManager.createChannel('Test Plugin', 'plugin1');
    channel.appendLine('Test output');

    render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Test Plugin' } });

    await waitFor(() => {
      expect(screen.getByText(/Test output/)).toBeInTheDocument();
    });

    // Dispose the channel
    outputChannelManager.dispose('Test Plugin');

    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1); // Only "Select channel..."
    });
  });

  it('auto-scrolls to bottom when new content is added', async () => {
    const channel = outputChannelManager.createChannel('Test Plugin', 'plugin1');

    const { container } = render(<OutputPanel isOpen={true} onClose={() => {}} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Test Plugin' } });

    // Add multiple lines
    for (let i = 0; i < 20; i++) {
      channel.appendLine(`Line ${i}`);
    }

    await waitFor(() => {
      const outputContent = container.querySelector('.output-content');
      expect(outputContent).toBeTruthy();

      // Check that scrollTop is at or near the bottom
      // (scrollTop + clientHeight should equal scrollHeight)
      const isAtBottom =
        Math.abs(
          outputContent.scrollTop + outputContent.clientHeight - outputContent.scrollHeight
        ) < 10; // Allow 10px tolerance

      expect(isAtBottom).toBe(true);
    });
  });
});
