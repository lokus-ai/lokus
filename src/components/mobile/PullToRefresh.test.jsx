import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PullToRefresh, PULL_THRESHOLD, MAX_PULL_DISTANCE } from './PullToRefresh';

vi.mock('../../platform', () => ({
  isMobile: vi.fn()
}));

import { isMobile } from '../../platform';

describe('PullToRefresh Component', () => {
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnRefresh.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop behavior', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(false);
    });

    it('should return children directly without wrapper on desktop', () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div data-testid="child-content">File Tree Content</div>
        </PullToRefresh>
      );
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.queryByTestId('pull-to-refresh-container')).not.toBeInTheDocument();
    });

    it('should not respond to touch events on desktop', () => {
      const { container } = render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      fireEvent.touchStart(container.firstChild, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container.firstChild, { touches: [{ clientY: 200 }] });
      fireEvent.touchEnd(container.firstChild);
      expect(mockOnRefresh).not.toHaveBeenCalled();
    });
  });

  describe('Mobile behavior', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should render wrapper with indicator on mobile', () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div data-testid="child-content">File Tree Content</div>
        </PullToRefresh>
      );
      expect(screen.getByTestId('pull-to-refresh-container')).toBeInTheDocument();
      expect(screen.getByTestId('pull-to-refresh-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('pull-to-refresh-content')).toBeInTheDocument();
    });

    it('should show "Pull to refresh" text initially', () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      expect(screen.getByText('Pull to refresh')).toBeInTheDocument();
    });
  });

  describe('Pull gesture - happy path', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should trigger refresh when pulled past threshold', async () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      await act(async () => {
        fireEvent.touchEnd(container);
      });

      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalledTimes(1);
      });
    });

    it('should show "Release to refresh" when past threshold', () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      expect(screen.getByText('Release to refresh')).toBeInTheDocument();
    });

    it('should show "Refreshing..." during async refresh', async () => {
      let resolveRefresh;
      mockOnRefresh.mockImplementation(() => new Promise(resolve => {
        resolveRefresh = resolve;
      }));

      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      await act(async () => {
        fireEvent.touchEnd(container);
      });

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
      await act(async () => { resolveRefresh(); });
      await waitFor(() => {
        expect(screen.getByText('Pull to refresh')).toBeInTheDocument();
      });
    });

    it('should apply animate-spin class during refresh', async () => {
      let resolveRefresh;
      mockOnRefresh.mockImplementation(() => new Promise(resolve => {
        resolveRefresh = resolve;
      }));

      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      await act(async () => {
        fireEvent.touchEnd(container);
      });

      const icon = screen.getByTestId('pull-to-refresh-icon');
      expect(icon).toHaveClass('animate-spin');
      await act(async () => { resolveRefresh(); });
    });
  });

  describe('Pull gesture - cancel behavior', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should NOT trigger refresh when released before threshold', async () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 150 }] });
      await act(async () => {
        fireEvent.touchEnd(container);
      });

      expect(mockOnRefresh).not.toHaveBeenCalled();
    });

    it('should reset pull distance after cancel', async () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      const content = screen.getByTestId('pull-to-refresh-content');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 150 }] });
      await act(async () => {
        fireEvent.touchEnd(container);
      });

      await waitFor(() => {
        expect(content.style.transform).toBe('translateY(0px)');
      });
    });
  });

  describe('Scroll position handling', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should NOT trigger when scroll is not at top', async () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 100, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      await act(async () => {
        fireEvent.touchEnd(container);
      });

      expect(mockOnRefresh).not.toHaveBeenCalled();
    });
  });

  describe('Disabled state', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should not respond when disabled', async () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh} disabled={true}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      await act(async () => {
        fireEvent.touchEnd(container);
      });

      expect(mockOnRefresh).not.toHaveBeenCalled();
    });
  });

  describe('Multiple rapid pulls', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should ignore pulls while refreshing', async () => {
      let resolveRefresh;
      mockOnRefresh.mockImplementation(() => new Promise(resolve => {
        resolveRefresh = resolve;
      }));

      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      await act(async () => { fireEvent.touchEnd(container); });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      await act(async () => { fireEvent.touchEnd(container); });

      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
      await act(async () => { resolveRefresh(); });
    });
  });

  describe('Rubber band effect', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should limit pull distance', () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      const content = screen.getByTestId('pull-to-refresh-content');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 300 }] });

      const transform = content.style.transform;
      const translateY = parseInt(transform.match(/translateY\((\d+)px\)/)?.[1] || '0');
      expect(translateY).toBeLessThanOrEqual(MAX_PULL_DISTANCE);
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should handle refresh error gracefully', async () => {
      mockOnRefresh.mockRejectedValue(new Error('Network error'));

      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 200 }] });
      await act(async () => { fireEvent.touchEnd(container); });

      await waitFor(() => {
        expect(screen.getByText('Pull to refresh')).toBeInTheDocument();
      });
    });
  });

  describe('Invalid pull direction', () => {
    beforeEach(() => {
      isMobile.mockReturnValue(true);
    });

    it('should ignore upward pulls', async () => {
      render(
        <PullToRefresh onRefresh={mockOnRefresh}>
          <div>Content</div>
        </PullToRefresh>
      );
      const container = screen.getByTestId('pull-to-refresh-container');
      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 200 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 100 }] });
      await act(async () => { fireEvent.touchEnd(container); });

      expect(mockOnRefresh).not.toHaveBeenCalled();
    });
  });

  describe('Constants', () => {
    it('should export PULL_THRESHOLD as 80', () => {
      expect(PULL_THRESHOLD).toBe(80);
    });

    it('should export MAX_PULL_DISTANCE as 120', () => {
      expect(MAX_PULL_DISTANCE).toBe(120);
    });
  });
});
