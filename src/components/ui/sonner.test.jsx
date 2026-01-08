import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toaster } from './sonner';

// Mock Sonner to avoid rendering issues in test environment
vi.mock('sonner', () => ({
    Toaster: vi.fn(({ theme, position, expand, visibleToasts, richColors, closeButton, gap, offset, toastOptions, style, className, ...rest }) => (
        <div
            data-testid="sonner-toaster"
            data-theme={theme}
            data-position={position}
            data-expand={String(expand)}
            data-visible-toasts={visibleToasts}
            data-rich-colors={String(richColors)}
            data-close-button={String(closeButton)}
            data-gap={gap}
            data-offset={offset}
            className={className}
            style={style}
            {...rest}
        />
    )),
}));

describe('Toaster', () => {
    it('renders with correct default configuration', () => {
        const { getByTestId } = render(<Toaster />);
        const toaster = getByTestId('sonner-toaster');

        expect(toaster).toBeInTheDocument();
        expect(toaster).toHaveAttribute('data-theme', 'dark');
        expect(toaster).toHaveAttribute('data-position', 'top-right');
        expect(toaster).toHaveAttribute('data-expand', 'false');
        expect(toaster).toHaveAttribute('data-visible-toasts', '4');
        expect(toaster).toHaveAttribute('data-rich-colors', 'true');
        expect(toaster).toHaveAttribute('data-close-button', 'true');
        expect(toaster).toHaveAttribute('data-gap', '8');
        expect(toaster).toHaveAttribute('data-offset', '16');
        expect(toaster).toHaveClass('toaster', 'group');
    });

    it('applies custom offset style', () => {
        const { getByTestId } = render(<Toaster />);
        const toaster = getByTestId('sonner-toaster');

        // CSS variables aren't fully supported in jsdom, so we check the style attribute
        expect(toaster.style.getPropertyValue('--offset')).toBe('16px');
    });

    it('passes additional props through to Sonner', () => {
        const { getByTestId } = render(<Toaster data-custom="test-value" />);
        const toaster = getByTestId('sonner-toaster');

        expect(toaster).toHaveAttribute('data-custom', 'test-value');
    });

    it('exports Toaster component', () => {
        expect(Toaster).toBeDefined();
        expect(typeof Toaster).toBe('function');
    });
});
