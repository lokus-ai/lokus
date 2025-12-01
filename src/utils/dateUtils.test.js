import { describe, it, expect, vi } from 'vitest';
import { formatDistanceToNow, parseISO, format } from './dateUtils';

describe('dateUtils', () => {
    describe('formatDistanceToNow', () => {
        it('should return "Just now" for recent dates', () => {
            const now = new Date();
            expect(formatDistanceToNow(now)).toBe('Just now');
        });

        it('should return minutes ago', () => {
            const date = new Date();
            date.setMinutes(date.getMinutes() - 5);
            expect(formatDistanceToNow(date)).toBe('5 minutes ago');
        });

        it('should return hours ago', () => {
            const date = new Date();
            date.setHours(date.getHours() - 2);
            expect(formatDistanceToNow(date)).toBe('2 hours ago');
        });

        it('should return days ago', () => {
            const date = new Date();
            date.setDate(date.getDate() - 3);
            expect(formatDistanceToNow(date)).toBe('3 days ago');
        });
    });

    describe('parseISO', () => {
        it('should parse ISO string', () => {
            const date = parseISO('2023-01-01T12:00:00Z');
            expect(date).toBeInstanceOf(Date);
            expect(date.toISOString()).toContain('2023-01-01');
        });
    });

    describe('format', () => {
        it('should format date with PPP p pattern', () => {
            const date = new Date('2023-01-01T12:00:00');
            const formatted = format(date, 'PPP p');
            expect(formatted).toContain('January 1, 2023');
            expect(formatted).toContain('12:00 PM');
        });

        it('should use default locale string for unknown pattern', () => {
            const date = new Date('2023-01-01T12:00:00');
            expect(format(date, 'unknown')).toBe(date.toLocaleString());
        });
    });
});
