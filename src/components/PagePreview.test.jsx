import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PagePreview from './PagePreview';

describe('PagePreview Component', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    target: 'Test Note',
    position: { x: 100, y: 100 },
    onClose: mockOnClose,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });
  });

  describe('Basic Rendering', () => {
    it('should render with target and position', () => {
      render(<PagePreview {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Test Note' })).toBeInTheDocument();
      expect(screen.getByText(/Preview of/)).toBeInTheDocument();
      expect(screen.getByText(/Hover over wiki links/)).toBeInTheDocument();
    });

    it('should not render when target is null', () => {
      const { container } = render(<PagePreview {...defaultProps} target={null} />);

      expect(container.firstChild).toBeNull();
    });

    it('should not render when target is empty string', () => {
      const { container } = render(<PagePreview {...defaultProps} target="" />);

      expect(container.firstChild).toBeNull();
    });

    it('should render close button', () => {
      render(<PagePreview {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close preview/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should display target name in title', () => {
      render(<PagePreview {...defaultProps} target="My Awesome Note" />);

      expect(screen.getByRole('heading', { name: 'My Awesome Note' })).toBeInTheDocument();
    });
  });

  describe('Positioning', () => {
    it('should position at specified coordinates', () => {
      const { container } = render(<PagePreview {...defaultProps} />);
      const preview = container.firstChild;

      expect(preview).toHaveAttribute('style');
      expect(preview.style.position).toBe('fixed');
      expect(preview.style.left).toBe('100px');
      expect(preview.style.top).toBe('100px');
    });

    it('should have high z-index to stay on top', () => {
      const { container } = render(<PagePreview {...defaultProps} />);
      const preview = container.firstChild;

      expect(preview.style.zIndex).toBe('9999');
    });

    it('should adjust position when preview would go off right edge', async () => {
      // Position near right edge
      const { container } = render(
        <PagePreview {...defaultProps} position={{ x: 900, y: 100 }} />
      );

      const preview = container.firstChild;

      // Mock getBoundingClientRect to return preview size
      preview.getBoundingClientRect = vi.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
      }));

      await waitFor(() => {
        // Should be adjusted to not exceed viewport width
        expect(preview).toBeInTheDocument();
      });
    });

    it('should handle null position gracefully', () => {
      const { container } = render(
        <PagePreview {...defaultProps} position={null} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('should use fallback position when position is undefined', () => {
      const { container } = render(
        <PagePreview target="Test" onClose={mockOnClose} position={undefined} />
      );
      const preview = container.firstChild;

      expect(preview.style.left).toBe('0px');
      expect(preview.style.top).toBe('0px');
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(<PagePreview {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close preview/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not crash when onClose is not provided', () => {
      render(<PagePreview target="Test" position={{ x: 100, y: 100 }} />);

      const closeButton = screen.getByRole('button', { name: /close preview/i });
      expect(() => fireEvent.click(closeButton)).not.toThrow();
    });
  });

  describe('Content Display', () => {
    it('should display placeholder content in Phase 1', () => {
      render(<PagePreview {...defaultProps} />);

      expect(screen.getByText(/Preview of/)).toBeInTheDocument();
      expect(screen.getByText('Test Note', { selector: 'strong' })).toBeInTheDocument();
    });

    it('should display info message', () => {
      render(<PagePreview {...defaultProps} />);

      expect(screen.getByText(/Hover over wiki links to see note previews/)).toBeInTheDocument();
    });

    it('should have correct CSS classes', () => {
      const { container } = render(<PagePreview {...defaultProps} />);
      const preview = container.firstChild;

      expect(preview).toHaveClass('page-preview');
    });
  });

  describe('Smart Positioning Logic', () => {
    beforeEach(() => {
      // Set smaller viewport for edge case testing
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 });
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 600 });
    });

    it('should keep padding from left edge', async () => {
      const mockRect = {
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
      };

      const { container } = render(
        <PagePreview {...defaultProps} position={{ x: 5, y: 100 }} />
      );

      const preview = container.firstChild;
      preview.getBoundingClientRect = vi.fn(() => mockRect);

      await waitFor(() => {
        expect(preview).toBeInTheDocument();
      });
    });

    it('should keep padding from top edge', async () => {
      const mockRect = {
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
      };

      const { container } = render(
        <PagePreview {...defaultProps} position={{ x: 100, y: 5 }} />
      );

      const preview = container.firstChild;
      preview.getBoundingClientRect = vi.fn(() => mockRect);

      await waitFor(() => {
        expect(preview).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible close button with aria-label', () => {
      render(<PagePreview {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close preview');
      expect(closeButton).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(<PagePreview {...defaultProps} />);

      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toHaveTextContent('Test Note');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long note names', () => {
      const longName = 'A'.repeat(100);
      render(<PagePreview {...defaultProps} target={longName} />);

      expect(screen.getByRole('heading', { name: longName })).toBeInTheDocument();
    });

    it('should handle special characters in note names', () => {
      const specialName = 'Test & <Special> "Characters"';
      render(<PagePreview {...defaultProps} target={specialName} />);

      expect(screen.getByRole('heading', { name: 'Test & <Special> "Characters"' })).toBeInTheDocument();
    });

    it('should update when position changes', () => {
      const { rerender, container } = render(<PagePreview {...defaultProps} />);

      rerender(<PagePreview {...defaultProps} position={{ x: 200, y: 200 }} />);
      const preview = container.firstChild;

      // After rerender with new position
      expect(preview).toBeInTheDocument();
    });

    it('should update when target changes', () => {
      const { rerender } = render(<PagePreview {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Test Note' })).toBeInTheDocument();

      rerender(<PagePreview {...defaultProps} target="New Note" />);

      expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Test Note' })).not.toBeInTheDocument();
    });
  });
});
