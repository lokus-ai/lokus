import { toast } from "../../hooks/use-toast";
import { EventEmitter } from "../../utils/EventEmitter";

class UIManager extends EventEmitter {
    constructor() {
        super();
        this.dialogs = new Map();
    }

    /**
     * Show a notification
     * @param {string} message 
     * @param {string} type 'info' | 'warning' | 'error'
     */
    showNotification(message, type = 'info') {
        toast({
            title: type.charAt(0).toUpperCase() + type.slice(1),
            description: message,
            variant: type === 'error' ? 'destructive' : 'default',
        });
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
}

export const uiManager = new UIManager();
