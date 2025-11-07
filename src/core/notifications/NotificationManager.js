/**
 * Notification Manager
 * Handles displaying toast notifications in the UI
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

class NotificationManager extends EventEmitter {
  constructor() {
    super();
    this.notifications = new Map();
    this.nextId = 1;
  }

  /**
   * Show a notification
   *
   * @param {Object} notification - Notification configuration
   * @param {string} notification.type - Type: 'info', 'success', 'warning', 'error', 'loading', 'progress'
   * @param {string} notification.message - Notification message
   * @param {string} notification.title - Optional title
   * @param {number} notification.duration - Duration in ms (0 for persistent)
   * @param {boolean} notification.persistent - If true, won't auto-dismiss
   * @param {number} notification.progress - Progress percentage (0-100) for progress type
   * @returns {string} - Notification ID
   */
  show(notification) {
    const id = notification.id || `notification_${this.nextId++}`;

    const notif = {
      id,
      type: notification.type || 'info',
      message: notification.message,
      title: notification.title,
      duration: notification.duration ?? 4000, // Default 4 seconds
      persistent: notification.persistent || false,
      progress: notification.progress,
      createdAt: Date.now(),
      ...notification
    };

    this.notifications.set(id, notif);
    this.emit('notification-added', notif);

    // Auto-dismiss after duration (unless persistent or loading)
    if (!notif.persistent && notif.type !== 'loading' && notif.duration > 0) {
      setTimeout(() => {
        this.hide(id);
      }, notif.duration);
    }

    return id;
  }

  /**
   * Update an existing notification
   *
   * @param {string} id - Notification ID
   * @param {Object} updates - Properties to update
   * @returns {boolean} - Success status
   */
  update(id, updates) {
    const notification = this.notifications.get(id);
    if (!notification) {
      return false;
    }

    Object.assign(notification, updates);
    this.emit('notification-updated', notification);

    // If the notification was loading and is now complete, auto-dismiss
    if (updates.type && updates.type !== 'loading' && !notification.persistent) {
      const duration = updates.duration ?? notification.duration ?? 3000;
      setTimeout(() => {
        this.hide(id);
      }, duration);
    }

    return true;
  }

  /**
   * Hide a notification
   *
   * @param {string} id - Notification ID
   * @returns {boolean} - Success status
   */
  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) {
      return false;
    }

    this.notifications.delete(id);
    this.emit('notification-removed', { id, notification });
    return true;
  }

  /**
   * Hide all notifications
   */
  hideAll() {
    const ids = Array.from(this.notifications.keys());
    ids.forEach(id => this.hide(id));
  }

  /**
   * Get all active notifications
   *
   * @returns {Array} - Array of notifications
   */
  getAll() {
    return Array.from(this.notifications.values());
  }

  /**
   * Get a specific notification
   *
   * @param {string} id - Notification ID
   * @returns {Object|null} - Notification object or null
   */
  get(id) {
    return this.notifications.get(id) || null;
  }

  // === Convenience Methods ===

  /**
   * Show an info notification
   */
  info(message, title, duration) {
    return this.show({
      type: 'info',
      message,
      title,
      duration
    });
  }

  /**
   * Show a success notification
   */
  success(message, title, duration) {
    return this.show({
      type: 'success',
      message,
      title,
      duration
    });
  }

  /**
   * Show a warning notification
   */
  warning(message, title, duration) {
    return this.show({
      type: 'warning',
      message,
      title,
      duration: duration ?? 5000
    });
  }

  /**
   * Show an error notification
   */
  error(message, title, duration) {
    return this.show({
      type: 'error',
      message,
      title,
      duration: duration ?? 6000 // Errors stay longer
    });
  }

  /**
   * Show a loading notification
   */
  loading(message, title) {
    return this.show({
      type: 'loading',
      message,
      title,
      persistent: true
    });
  }

  /**
   * Show a progress notification
   */
  progress(message, progressValue, title) {
    return this.show({
      type: 'progress',
      message,
      title,
      progress: progressValue,
      persistent: true
    });
  }
}

// Export singleton instance
export const notificationManager = new NotificationManager();

export default notificationManager;
