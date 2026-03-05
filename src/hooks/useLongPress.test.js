import { renderHook, act } from '@testing-library/react';
import { useLongPress } from './useLongPress';

describe('useLongPress', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should call the callback after the specified delay', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useLongPress(callback, 500));

        // Simulate mouse down
        act(() => {
            result.current.onMouseDown({ target: {} });
        });

        // Fast-forward time
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call the callback if released early', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useLongPress(callback, 500));

        // Simulate mouse down
        act(() => {
            result.current.onMouseDown({ target: {} });
        });

        // Fast-forward time but not enough
        act(() => {
            vi.advanceTimersByTime(200);
        });

        // Simulate mouse up
        act(() => {
            result.current.onMouseUp();
        });

        // Fast-forward the rest of the time
        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should cancel the timer if moved', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useLongPress(callback, 500));

        // Simulate touch start
        act(() => {
            result.current.onTouchStart({ target: {} });
        });

        // Simulate touch move
        act(() => {
            result.current.onTouchMove();
        });

        // Fast-forward time
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(callback).not.toHaveBeenCalled();
    });
});
