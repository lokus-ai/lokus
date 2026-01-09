import { toast } from "sonner";
import { EventEmitter } from "../../utils/EventEmitter";
import { startProgress, updateProgress, endProgress } from "../../hooks/usePluginProgress";

class UIManager extends EventEmitter {
    constructor() {
        super();
        this.dialogs = new Map();

        // Setup progress event listeners
        this.setupProgressListeners();
    }

    /**
     * Setup listeners for progress events from plugin API
     */
    setupProgressListeners() {
        this.on('progress-start', (data) => {
            startProgress(data.id, {
                title: data.title,
                message: data.message,
                percentage: data.percentage,
                cancellable: data.cancellable,
                location: data.location,
                onCancel: data.onCancel
            });
        });

        this.on('progress-update', (data) => {
            updateProgress(data.id, {
                message: data.message,
                percentage: data.percentage
            });
        });

        this.on('progress-end', (data) => {
            endProgress(data.id);
        });
    }

    /**
     * Show a notification
     * @param {string} message
     * @param {string} type 'info' | 'warning' | 'error' | 'success'
     */
    showNotification(message, type = 'info') {
        const title = type.charAt(0).toUpperCase() + type.slice(1);
        const toastFn = toast[type] || toast.info;
        toastFn(title, { description: message });
    }

    /**
     * Show a dialog
     * @param {object} dialog 
     */
    showDialog(dialog) {
        this.emit('show-dialog', dialog);
    }

    /**
     * Dismiss a dialog
     * @param {string} id
     */
    dismissDialog(id) {
        this.emit('dismiss-dialog', id);
    }

    /**
     * Start a progress indicator
     * @param {object} data - Progress data
     */
    startProgress(data) {
        this.emit('progress-start', data);
    }

    /**
     * Update a progress indicator
     * @param {object} data - Progress update data
     */
    updateProgress(data) {
        this.emit('progress-update', data);
    }

    /**
     * End a progress indicator
     * @param {object} data - Progress end data
     */
    endProgress(data) {
        this.emit('progress-end', data);
    }
}

export const uiManager = new UIManager();
