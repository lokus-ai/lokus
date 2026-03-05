import { useCallback, useRef } from 'react';

/**
 * useLongPress - Detects long-press gestures as an alternative to right-click.
 * 
 * @param {Function} callback - Called when a long-press is detected
 * @param {number} delay - How long the press must be held in ms (default: 500)
 * @returns {Object} Event handlers to spread onto an element
 */
export function useLongPress(callback, delay = 500) {
    // Stores the timer ID so we can cancel it if needed
    const timeoutRef = useRef(null);

    // Stores the element that was initially pressed
    const targetRef = useRef(null);

    // Called when finger/mouse goes down
    const start = useCallback((e) => {
        // Remember which element was pressed
        targetRef.current = e.target;

        // Start timer: after `delay` ms the callback fires
        timeoutRef.current = setTimeout(() => {
            callback(e);
        }, delay);
    }, [callback, delay]);

    // Cancels the timer (e.g. when finger is released or moved)
    const clear = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // Called when finger moves → cancel long-press
    const move = useCallback(() => {
        clear();
    }, [clear]);

    // Returns event handlers to spread onto an element via {...handlers}
    return {
        // Touch events (mobile)
        onTouchStart: start,
        onTouchEnd: clear,
        onTouchMove: move,

        // Mouse events (desktop, useful for testing)
        onMouseDown: start,
        onMouseUp: clear,
        onMouseLeave: clear,
    };
}
