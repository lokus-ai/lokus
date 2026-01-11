import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteAnnouncement } from '../components/RemoteAnnouncement';
import { useRemoteConfig } from '../hooks/useRemoteConfig';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('../hooks/useRemoteConfig');
vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
        custom: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        dismiss: vi.fn(),
    }),
}));

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

describe('RemoteAnnouncement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        // Default mock implementations
        useRemoteConfig.mockReturnValue({
            loading: false,
            config: {
                announcement: {
                    id: 'test-id',
                    title: 'Test Title',
                    message: 'Test Message',
                    action_label: 'Test Action',
                    action_url: 'https://example.com'
                }
            }
        });
    });

    it('should show toast when announcement is present and not dismissed', () => {
        render(<RemoteAnnouncement />);

        // With new enhanced toast, it uses toast.custom for rich content
        expect(toast.custom).toHaveBeenCalled();
    });

    it('should NOT show toast if already dismissed', () => {
        localStorage.setItem('lokus_dismissed_announcements', JSON.stringify(['test-id']));
        render(<RemoteAnnouncement />);

        expect(toast.custom).not.toHaveBeenCalled();
        expect(toast).not.toHaveBeenCalled();
    });

    it('should NOT show toast if start_date is in the future', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        useRemoteConfig.mockReturnValue({
            loading: false,
            config: {
                announcement: {
                    id: 'test-id',
                    title: 'Test',
                    message: 'Test',
                    start_date: futureDate.toISOString()
                }
            }
        });

        render(<RemoteAnnouncement />);
        expect(toast.custom).not.toHaveBeenCalled();
    });

    it('should NOT show toast if end_date is in the past', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        useRemoteConfig.mockReturnValue({
            loading: false,
            config: {
                announcement: {
                    id: 'test-id',
                    title: 'Test',
                    message: 'Test',
                    end_date: pastDate.toISOString()
                }
            }
        });

        render(<RemoteAnnouncement />);
        expect(toast.custom).not.toHaveBeenCalled();
    });

    it('should NOT show toast if expiresAt is in the past', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        useRemoteConfig.mockReturnValue({
            loading: false,
            config: {
                announcement: {
                    id: 'test-id',
                    title: 'Test',
                    message: 'Test',
                    expiresAt: pastDate.toISOString()
                }
            }
        });

        render(<RemoteAnnouncement />);
        expect(toast.custom).not.toHaveBeenCalled();
    });

    it('should show toast with enhanced features (variant, expandedContent, link)', () => {
        useRemoteConfig.mockReturnValue({
            loading: false,
            config: {
                announcement: {
                    id: 'survey-2025',
                    title: 'Quick Survey',
                    message: 'Help us improve Lokus',
                    variant: 'survey',
                    expandedContent: 'We are planning our 2025 roadmap...',
                    link: {
                        url: 'https://survey.example.com',
                        text: 'Take Survey',
                        external: true
                    },
                    showOnce: true,
                    persistent: false,
                    duration: 15000
                }
            }
        });

        render(<RemoteAnnouncement />);
        expect(toast.custom).toHaveBeenCalled();
    });

    it('should show toast repeatedly if showOnce is false', () => {
        localStorage.setItem('lokus_dismissed_announcements', JSON.stringify(['repeating-id']));

        useRemoteConfig.mockReturnValue({
            loading: false,
            config: {
                announcement: {
                    id: 'repeating-id',
                    title: 'Repeating Announcement',
                    message: 'This should show every time',
                    showOnce: false,
                    variant: 'announcement' // Need variant to trigger toast.custom
                }
            }
        });

        render(<RemoteAnnouncement />);
        // With showOnce: false, toast should still show even if ID is in dismissed list
        expect(toast.custom).toHaveBeenCalled();
    });
});
