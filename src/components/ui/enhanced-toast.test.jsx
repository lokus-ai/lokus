import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    ExpandableToastContent,
    showEnhancedToast,
    enhancedToast,
    demoAllToasts,
} from './enhanced-toast';
import { toast } from 'sonner';

// Mock sonner
vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
        custom: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        loading: vi.fn(),
        promise: vi.fn(),
        dismiss: vi.fn(),
    }),
}));

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
    confirm: vi.fn().mockResolvedValue(true),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
    open: vi.fn().mockResolvedValue(undefined),
}));

describe('ExpandableToastContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders title and message', () => {
        render(
            <ExpandableToastContent
                title="Test Title"
                message="Test Message"
            />
        );

        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test Message')).toBeInTheDocument();
    });

    it('renders variant icon for survey', () => {
        render(
            <ExpandableToastContent
                title="Survey"
                message="Take a survey"
                variant="survey"
            />
        );

        // ClipboardList icon should be present
        expect(screen.getByText('Survey')).toBeInTheDocument();
    });

    it('renders variant icon for announcement', () => {
        render(
            <ExpandableToastContent
                title="Announcement"
                message="New feature"
                variant="announcement"
            />
        );

        expect(screen.getByText('Announcement')).toBeInTheDocument();
    });

    it('renders variant icon for warning', () => {
        render(
            <ExpandableToastContent
                title="Warning"
                message="Be careful"
                variant="warning"
            />
        );

        expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('renders variant icon for update', () => {
        render(
            <ExpandableToastContent
                title="Update"
                message="New version"
                variant="update"
            />
        );

        expect(screen.getByText('Update')).toBeInTheDocument();
    });

    it('does not render icon for default variant', () => {
        const { container } = render(
            <ExpandableToastContent
                title="Default"
                message="No icon"
                variant="default"
            />
        );

        // Should not have any icon in the first flex container
        expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('shows "Show more" button when expandedContent is provided', () => {
        render(
            <ExpandableToastContent
                title="Title"
                message="Message"
                expandedContent="This is expanded content"
            />
        );

        expect(screen.getByText('Show more')).toBeInTheDocument();
    });

    it('expands content when "Show more" is clicked', () => {
        render(
            <ExpandableToastContent
                title="Title"
                message="Message"
                expandedContent="This is expanded content"
            />
        );

        // Initially expanded content is not visible
        expect(screen.queryByText('This is expanded content')).not.toBeInTheDocument();

        // Click "Show more"
        fireEvent.click(screen.getByText('Show more'));

        // Now it should be visible
        expect(screen.getByText('This is expanded content')).toBeInTheDocument();
        expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('collapses content when "Show less" is clicked', () => {
        render(
            <ExpandableToastContent
                title="Title"
                message="Message"
                expandedContent="This is expanded content"
            />
        );

        // Expand first
        fireEvent.click(screen.getByText('Show more'));
        expect(screen.getByText('This is expanded content')).toBeInTheDocument();

        // Now collapse
        fireEvent.click(screen.getByText('Show less'));
        expect(screen.queryByText('This is expanded content')).not.toBeInTheDocument();
    });

    it('renders link button when link is provided', () => {
        render(
            <ExpandableToastContent
                title="Title"
                message="Message"
                link={{ url: 'https://example.com', text: 'Click Here', external: true }}
            />
        );

        expect(screen.getByText('Click Here')).toBeInTheDocument();
    });

    it('does not render link button when link url or text is missing', () => {
        render(
            <ExpandableToastContent
                title="Title"
                message="Message"
                link={{ url: 'https://example.com' }} // Missing text
            />
        );

        expect(screen.queryByRole('button', { name: /click/i })).not.toBeInTheDocument();
    });

    it('handles link click in web environment', async () => {
        const mockWindowOpen = vi.fn();
        window.open = mockWindowOpen;
        window.__TAURI__ = undefined;

        render(
            <ExpandableToastContent
                title="Title"
                message="Message"
                link={{ url: 'https://example.com', text: 'Click Here' }}
            />
        );

        fireEvent.click(screen.getByText('Click Here'));

        // Should open in new tab
        expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    });

    it('renders without title (message only)', () => {
        render(
            <ExpandableToastContent
                message="Just a message"
            />
        );

        expect(screen.getByText('Just a message')).toBeInTheDocument();
    });

    it('renders without message (title only)', () => {
        render(
            <ExpandableToastContent
                title="Just a title"
            />
        );

        expect(screen.getByText('Just a title')).toBeInTheDocument();
    });
});

describe('showEnhancedToast', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null for empty toasts (no title and no message)', () => {
        const result = showEnhancedToast({});

        expect(result).toBeNull();
        expect(toast.custom).not.toHaveBeenCalled();
        expect(toast).not.toHaveBeenCalled();
    });

    it('returns null when only id is provided', () => {
        const result = showEnhancedToast({ id: 'test-id' });

        expect(result).toBeNull();
    });

    it('shows simple toast when only title and message provided', () => {
        showEnhancedToast({
            title: 'Simple Title',
            message: 'Simple Message',
        });

        expect(toast).toHaveBeenCalledWith('Simple Title', expect.objectContaining({
            description: 'Simple Message',
        }));
    });

    it('shows custom toast when variant is not default', () => {
        showEnhancedToast({
            title: 'Survey Title',
            message: 'Survey Message',
            variant: 'survey',
        });

        expect(toast.custom).toHaveBeenCalled();
    });

    it('shows custom toast when expandedContent is provided', () => {
        showEnhancedToast({
            title: 'Title',
            message: 'Message',
            expandedContent: 'More content here',
        });

        expect(toast.custom).toHaveBeenCalled();
    });

    it('shows custom toast when link is provided', () => {
        showEnhancedToast({
            title: 'Title',
            message: 'Message',
            link: { url: 'https://example.com', text: 'Click' },
        });

        expect(toast.custom).toHaveBeenCalled();
    });

    it('uses specified type function (success)', () => {
        showEnhancedToast({
            title: 'Success',
            message: 'Done',
            type: 'success',
        });

        expect(toast.success).toHaveBeenCalledWith('Success', expect.objectContaining({
            description: 'Done',
        }));
    });

    it('uses specified type function (error)', () => {
        showEnhancedToast({
            title: 'Error',
            message: 'Failed',
            type: 'error',
        });

        expect(toast.error).toHaveBeenCalledWith('Error', expect.objectContaining({
            description: 'Failed',
        }));
    });

    it('passes id to toast options', () => {
        showEnhancedToast({
            id: 'my-toast-id',
            title: 'Title',
            message: 'Message',
        });

        expect(toast).toHaveBeenCalledWith('Title', expect.objectContaining({
            id: 'my-toast-id',
        }));
    });

    it('sets duration to Infinity when persistent is true', () => {
        showEnhancedToast({
            title: 'Persistent',
            message: 'Message',
            persistent: true,
        });

        expect(toast).toHaveBeenCalledWith('Persistent', expect.objectContaining({
            duration: Infinity,
        }));
    });

    it('passes custom duration', () => {
        showEnhancedToast({
            title: 'Custom Duration',
            message: 'Message',
            duration: 5000,
        });

        expect(toast).toHaveBeenCalledWith('Custom Duration', expect.objectContaining({
            duration: 5000,
        }));
    });

    it('passes dismissible option', () => {
        showEnhancedToast({
            title: 'Non-dismissible',
            message: 'Message',
            dismissible: false,
        });

        expect(toast).toHaveBeenCalledWith('Non-dismissible', expect.objectContaining({
            dismissible: false,
        }));
    });

    it('passes action button for simple toasts', () => {
        const onClick = vi.fn();
        showEnhancedToast({
            title: 'With Action',
            message: 'Message',
            action: { label: 'Click Me', onClick },
        });

        expect(toast).toHaveBeenCalledWith('With Action', expect.objectContaining({
            action: { label: 'Click Me', onClick },
        }));
    });

    it('passes cancel button for simple toasts', () => {
        const onClick = vi.fn();
        showEnhancedToast({
            title: 'With Cancel',
            message: 'Message',
            cancel: { label: 'Cancel', onClick },
        });

        expect(toast).toHaveBeenCalledWith('With Cancel', expect.objectContaining({
            cancel: { label: 'Cancel', onClick },
        }));
    });

    it('passes onDismiss callback', () => {
        const onDismiss = vi.fn();
        showEnhancedToast({
            title: 'Title',
            message: 'Message',
            onDismiss,
        });

        expect(toast).toHaveBeenCalledWith('Title', expect.objectContaining({
            onDismiss,
        }));
    });

    it('passes onAutoClose callback', () => {
        const onAutoClose = vi.fn();
        showEnhancedToast({
            title: 'Title',
            message: 'Message',
            onAutoClose,
        });

        expect(toast).toHaveBeenCalledWith('Title', expect.objectContaining({
            onAutoClose,
        }));
    });
});

describe('enhancedToast convenience methods', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('enhancedToast.survey sets variant to survey', () => {
        enhancedToast.survey({
            title: 'Survey',
            message: 'Take survey',
        });

        expect(toast.custom).toHaveBeenCalled();
    });

    it('enhancedToast.announcement sets variant to announcement', () => {
        enhancedToast.announcement({
            title: 'Announcement',
            message: 'New feature',
        });

        expect(toast.custom).toHaveBeenCalled();
    });

    it('enhancedToast.warning sets variant and type to warning', () => {
        enhancedToast.warning({
            title: 'Warning',
            message: 'Be careful',
        });

        expect(toast.custom).toHaveBeenCalled();
    });

    it('enhancedToast.update sets variant to update', () => {
        enhancedToast.update({
            title: 'Update',
            message: 'New version',
        });

        expect(toast.custom).toHaveBeenCalled();
    });

    it('enhancedToast.success delegates to toast.success', () => {
        enhancedToast.success('Success!', { description: 'Done' });

        expect(toast.success).toHaveBeenCalledWith('Success!', { description: 'Done' });
    });

    it('enhancedToast.error delegates to toast.error', () => {
        enhancedToast.error('Error!', { description: 'Failed' });

        expect(toast.error).toHaveBeenCalledWith('Error!', { description: 'Failed' });
    });

    it('enhancedToast.info delegates to toast.info', () => {
        enhancedToast.info('Info!', { description: 'FYI' });

        expect(toast.info).toHaveBeenCalledWith('Info!', { description: 'FYI' });
    });

    it('enhancedToast.loading delegates to toast.loading', () => {
        enhancedToast.loading('Loading...', { description: 'Please wait' });

        expect(toast.loading).toHaveBeenCalledWith('Loading...', { description: 'Please wait' });
    });

    it('enhancedToast.promise delegates to toast.promise', () => {
        const promise = Promise.resolve();
        const options = { loading: 'Loading', success: 'Done', error: 'Failed' };

        enhancedToast.promise(promise, options);

        expect(toast.promise).toHaveBeenCalledWith(promise, options);
    });

    it('enhancedToast.dismiss delegates to toast.dismiss', () => {
        enhancedToast.dismiss('toast-id');

        expect(toast.dismiss).toHaveBeenCalledWith('toast-id');
    });

    it('enhancedToast.dismissAll calls toast.dismiss without id', () => {
        enhancedToast.dismissAll();

        expect(toast.dismiss).toHaveBeenCalledWith();
    });
});

describe('demoAllToasts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('calls multiple toast functions in sequence', () => {
        demoAllToasts();

        // Fast forward through all timeouts
        vi.advanceTimersByTime(15000);

        // Should have called various toast functions
        expect(toast).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
        expect(toast.warning).toHaveBeenCalled();
        expect(toast.info).toHaveBeenCalled();
        expect(toast.custom).toHaveBeenCalled();
        expect(toast.loading).toHaveBeenCalled();
        expect(toast.promise).toHaveBeenCalled();
    });

    it('is exposed on window object', () => {
        expect(window.demoToasts).toBe(demoAllToasts);
    });
});
