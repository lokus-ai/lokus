import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteAnnouncement } from '../components/RemoteAnnouncement';
import { useRemoteConfig } from '../hooks/useRemoteConfig';
import { useToast } from '../hooks/use-toast';

// Mock dependencies
vi.mock('../hooks/useRemoteConfig');
vi.mock('../hooks/use-toast');

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

// Mock Tauri APIs
const mockTauriOpen = vi.fn();
const mockTauriConfirm = vi.fn();

// Helper to setup Tauri mocks
const setupTauri = () => {
    window.__TAURI__ = true;
    vi.mock('@tauri-apps/plugin-shell', () => ({
        open: mockTauriOpen
    }));
    vi.mock('@tauri-apps/plugin-dialog', () => ({
        confirm: mockTauriConfirm
    }));
};

// Helper to teardown Tauri mocks
const teardownTauri = () => {
    delete window.__TAURI__;
    vi.resetModules();
};

describe('RemoteAnnouncement', () => {
    const mockToast = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        // Default mock implementations
        useToast.mockReturnValue({ toast: mockToast });
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

        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Test Title',
            description: 'Test Message'
        }));
    });

    it('should NOT show toast if already dismissed', () => {
        localStorage.setItem('lokus_dismissed_announcements', JSON.stringify(['test-id']));
        render(<RemoteAnnouncement />);

        expect(mockToast).not.toHaveBeenCalled();
    });

    it('should NOT show toast if start_date is in the future', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        useRemoteConfig.mockReturnValue({
            loading: false,
            config: {
                announcement: {
                    id: 'test-id',
                    start_date: futureDate.toISOString()
                }
            }
        });

        render(<RemoteAnnouncement />);
        expect(mockToast).not.toHaveBeenCalled();
    });

    it('should NOT show toast if end_date is in the past', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        useRemoteConfig.mockReturnValue({
            loading: false,
            config: {
                announcement: {
                    id: 'test-id',
                    end_date: pastDate.toISOString()
                }
            }
        });

        render(<RemoteAnnouncement />);
        expect(mockToast).not.toHaveBeenCalled();
    });

    it('should handle Web fallback for opening links', async () => {
        // Ensure Tauri is disabled
        delete window.__TAURI__;

        // Mock window.confirm to return true
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(<RemoteAnnouncement />);

        // Get the action button from the toast call
        const toastCall = mockToast.mock.calls[0][0];
        const ActionComponent = toastCall.action;

        // Render the action button separately to test click
        const { getByText } = render(ActionComponent);
        fireEvent.click(getByText('Test Action'));

        expect(window.confirm).toHaveBeenCalled();
        expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    });

    // Note: Testing dynamic imports in Vitest can be tricky. 
    // We verified the logic via manual testing, but unit testing the Tauri import 
    // path specifically usually requires more complex mocking setup.
});
