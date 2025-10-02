import { invoke } from '@tauri-apps/api/core';

/**
 * Gmail Service Module
 * 
 * Provides a clean wrapper around Gmail Tauri commands with error handling,
 * logging, and consistent API interface.
 */

// Gmail authentication operations
export const gmailAuth = {
  /**
   * Initiate Gmail OAuth authentication flow
   * @returns {Promise<string>} - Auth URL to open in browser
   */
  async initiateAuth() {
    try {
      const authUrl = await invoke('gmail_initiate_auth');
      return authUrl;
    } catch (error) {
      console.error('❌ Gmail: Failed to initiate auth:', error);
      throw new Error(`Gmail authentication initiation failed: ${error.message}`);
    }
  },

  /**
   * Complete Gmail OAuth authentication with authorization code
   * @param {string} code - Authorization code from OAuth callback
   * @param {string} state - State parameter for CSRF protection
   * @returns {Promise<Object>} - User profile information
   */
  async completeAuth(code, state) {
    try {
      const profile = await invoke('gmail_complete_auth', { code, state });
      return profile;
    } catch (error) {
      console.error('❌ Gmail: Failed to complete auth:', error);
      throw new Error(`Gmail authentication completion failed: ${error.message}`);
    }
  },

  /**
   * Check if user is authenticated with Gmail
   * @returns {Promise<boolean>} - Authentication status
   */
  async isAuthenticated() {
    try {
      const isAuth = await invoke('gmail_is_authenticated');
      return isAuth;
    } catch (error) {
      console.error('❌ Gmail: Failed to check auth status:', error);
      return false;
    }
  },

  /**
   * Logout from Gmail
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await invoke('gmail_logout');
    } catch (error) {
      console.error('❌ Gmail: Failed to logout:', error);
      throw new Error(`Gmail logout failed: ${error.message}`);
    }
  },

  /**
   * Get Gmail user profile
   * @returns {Promise<Object>} - User profile data
   */
  async getUserProfile() {
    try {
      const profile = await invoke('gmail_get_profile');
      return profile;
    } catch (error) {
      console.error('❌ Gmail: Failed to get profile:', error);
      throw new Error(`Gmail profile fetch failed: ${error.message}`);
    }
  },

  /**
   * Get Gmail user profile (alias for getUserProfile)
   * @returns {Promise<Object>} - User profile data
   */
  async getProfile() {
    return this.getUserProfile();
  }
};

// Gmail email operations
export const gmailEmails = {
  /**
   * List emails with pagination and filtering
   * @param {Object} options - Query options
   * @param {string} options.query - Gmail search query
   * @param {number} options.maxResults - Maximum number of results (default: 50)
   * @param {string} options.pageToken - Page token for pagination
   * @param {Array<string>} options.labelIds - Label IDs to filter by
   * @returns {Promise<Object>} - Email list with pagination info
   */
  async listEmails(options = {}) {
    try {
      const {
        query = '',
        maxResults = 50,
        pageToken = null,
        labelIds = []
      } = options;

      const emails = await invoke('gmail_list_emails', 
        maxResults,
        pageToken,
        labelIds,
        false // include_spam_trash
      );
      const result = { emails };
      return result;
    } catch (error) {
      console.error('❌ Gmail: Failed to list emails:', error);
      throw new Error(`Gmail email listing failed: ${error.message}`);
    }
  },

  /**
   * Search emails using Gmail's advanced search syntax
   * @param {string} query - Gmail search query
   * @param {Object} options - Additional search options
   * @returns {Promise<Object>} - Search results
   */
  async searchEmails(query, options = {}) {
    try {
      const { maxResults = 50, pageToken = null, includeSpamTrash = false } = options;
      const emails = await invoke('gmail_search_emails', 
        query,
        maxResults,
        pageToken,
        includeSpamTrash
      );
      const result = { emails };
      return result;
    } catch (error) {
      console.error('❌ Gmail: Failed to search emails:', error);
      throw new Error(`Gmail email search failed: ${error.message}`);
    }
  },

  /**
   * Get full email details by ID
   * @param {string} messageId - Gmail message ID
   * @param {string} format - Response format (full, metadata, minimal, raw)
   * @returns {Promise<Object>} - Full email data
   */
  async getEmail(messageId, format = 'full') {
    try {
      const email = await invoke('gmail_get_email', messageId);
      return email;
    } catch (error) {
      console.error('❌ Gmail: Failed to get email:', error);
      throw new Error(`Gmail email fetch failed: ${error.message}`);
    }
  },

  /**
   * Send a new email
   * @param {Object} emailData - Email composition data
   * @param {Array<string>} emailData.to - Recipient addresses
   * @param {Array<string>} emailData.cc - CC addresses
   * @param {Array<string>} emailData.bcc - BCC addresses
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.body - Email body (HTML or plain text)
   * @param {Array<Object>} emailData.attachments - File attachments
   * @returns {Promise<Object>} - Sent email data
   */
  async sendEmail(emailData) {
    try {
      
      // Convert email addresses to proper format for Rust backend
      const toAddresses = Array.isArray(emailData.to) ? emailData.to.map(email => ({ email })) : [{ email: emailData.to }];
      const ccAddresses = emailData.cc ? emailData.cc.map(email => ({ email })) : null;
      const bccAddresses = emailData.bcc ? emailData.bcc.map(email => ({ email })) : null;
      
      const emailPayload = {
        to: toAddresses,
        subject: emailData.subject || '',
        body_text: emailData.body || '',  // Changed from null to empty string
        body_html: null, // TODO: Support HTML body
        cc: ccAddresses,
        bcc: bccAddresses
      };

      const result = await invoke('gmail_send_email', {
        to: emailPayload.to,
        subject: emailPayload.subject,
        bodyText: emailPayload.body_text,  // Changed from body_text to bodyText
        bodyHtml: emailPayload.body_html,  // Changed from body_html to bodyHtml
        cc: emailPayload.cc && emailPayload.cc.length > 0 ? emailPayload.cc : null,
        bcc: emailPayload.bcc && emailPayload.bcc.length > 0 ? emailPayload.bcc : null
      });
      
      return result;
    } catch (error) {
      console.error('❌ Gmail: Failed to send email:', error);
      throw new Error(`Gmail email sending failed: ${error.message}`);
    }
  },

  /**
   * Reply to an email
   * @param {string} messageId - Original message ID
   * @param {Object} replyData - Reply composition data
   * @returns {Promise<Object>} - Reply email data
   */
  async replyEmail(messageId, replyData) {
    try {
      const result = await invoke('gmail_reply_email', { messageId, ...replyData });
      return result;
    } catch (error) {
      console.error('❌ Gmail: Failed to reply to email:', error);
      throw new Error(`Gmail email reply failed: ${error.message}`);
    }
  },

  /**
   * Forward an email
   * @param {string} messageId - Original message ID
   * @param {Object} forwardData - Forward composition data
   * @returns {Promise<Object>} - Forwarded email data
   */
  async forwardEmail(messageId, forwardData) {
    try {
      const result = await invoke('gmail_forward_email', { messageId, ...forwardData });
      return result;
    } catch (error) {
      console.error('❌ Gmail: Failed to forward email:', error);
      throw new Error(`Gmail email forwarding failed: ${error.message}`);
    }
  },

  // Convenience methods for common email operations
  
  /**
   * Get inbox emails
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of inbox emails
   */
  async getInbox(options = {}) {
    const result = await this.listEmails({ 
      ...options, 
      labelIds: ['INBOX'] 
    });
    return result.emails || [];
  },

  /**
   * Get sent emails
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sent emails
   */
  async getSentEmails(options = {}) {
    const result = await this.listEmails({ 
      ...options, 
      labelIds: ['SENT'] 
    });
    return result.emails || [];
  },

  /**
   * Get draft emails
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of draft emails
   */
  async getDrafts(options = {}) {
    const result = await this.listEmails({ 
      ...options, 
      labelIds: ['DRAFT'] 
    });
    return result.emails || [];
  },

  /**
   * Get starred emails
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of starred emails
   */
  async getStarredEmails(options = {}) {
    const result = await this.listEmails({ 
      ...options, 
      labelIds: ['STARRED'] 
    });
    return result.emails || [];
  },

  /**
   * Get emails by label
   * @param {string} labelName - Label name or ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of emails with label
   */
  async getEmailsByLabel(labelName, options = {}) {
    const result = await this.listEmails({ 
      ...options, 
      labelIds: [labelName.toUpperCase()] 
    });
    return result.emails || [];
  },

  // Single email action methods (compatible with existing Gmail.jsx calls)
  
  /**
   * Mark a single email as read
   * @param {string} messageId - Message ID
   * @returns {Promise<void>}
   */
  async markAsRead(messageId) {
    return gmailActions.markAsRead([messageId]);
  },

  /**
   * Mark multiple emails as read
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async markEmailsAsRead(messageIds) {
    return gmailActions.markAsRead(messageIds);
  },

  /**
   * Mark multiple emails as unread
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async markEmailsAsUnread(messageIds) {
    return gmailActions.markAsUnread(messageIds);
  },

  /**
   * Archive multiple emails
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async archiveEmails(messageIds) {
    return gmailActions.archiveEmails(messageIds);
  },

  /**
   * Delete multiple emails
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async deleteEmails(messageIds) {
    return gmailActions.deleteEmails(messageIds);
  }
};

// Gmail email management operations
export const gmailActions = {
  /**
   * Mark emails as read
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async markAsRead(messageIds) {
    try {
      await invoke('gmail_mark_as_read', { messageIds });
    } catch (error) {
      console.error('❌ Gmail: Failed to mark emails as read:', error);
      throw new Error(`Gmail mark as read failed: ${error.message}`);
    }
  },

  /**
   * Mark emails as unread
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async markAsUnread(messageIds) {
    try {
      await invoke('gmail_mark_as_unread', { messageIds });
    } catch (error) {
      console.error('❌ Gmail: Failed to mark emails as unread:', error);
      throw new Error(`Gmail mark as unread failed: ${error.message}`);
    }
  },

  /**
   * Star emails
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async starEmails(messageIds) {
    try {
      await invoke('gmail_star_emails', { messageIds });
    } catch (error) {
      console.error('❌ Gmail: Failed to star emails:', error);
      throw new Error(`Gmail star emails failed: ${error.message}`);
    }
  },

  /**
   * Unstar emails
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async unstarEmails(messageIds) {
    try {
      await invoke('gmail_unstar_emails', { messageIds });
    } catch (error) {
      console.error('❌ Gmail: Failed to unstar emails:', error);
      throw new Error(`Gmail unstar emails failed: ${error.message}`);
    }
  },

  /**
   * Archive emails
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async archiveEmails(messageIds) {
    try {
      await invoke('gmail_archive_emails', { messageIds });
    } catch (error) {
      console.error('❌ Gmail: Failed to archive emails:', error);
      throw new Error(`Gmail archive emails failed: ${error.message}`);
    }
  },

  /**
   * Delete emails
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  async deleteEmails(messageIds) {
    try {
      await invoke('gmail_delete_emails', { messageIds });
    } catch (error) {
      console.error('❌ Gmail: Failed to delete emails:', error);
      throw new Error(`Gmail delete emails failed: ${error.message}`);
    }
  }
};

// Gmail labels and organization
export const gmailLabels = {
  /**
   * Get all Gmail labels
   * @returns {Promise<Array>} - Array of label objects
   */
  async getLabels() {
    try {
      const labels = await invoke('gmail_get_labels');
      return labels;
    } catch (error) {
      console.error('❌ Gmail: Failed to get labels:', error);
      throw new Error(`Gmail get labels failed: ${error.message}`);
    }
  }
};

// Gmail offline queue management
export const gmailQueue = {
  /**
   * Get queue statistics
   * @returns {Promise<Object>} - Queue stats (pending, failed, etc.)
   */
  async getQueueStats() {
    try {
      const stats = await invoke('gmail_get_queue_stats');
      return stats;
    } catch (error) {
      console.error('❌ Gmail: Failed to get queue stats:', error);
      throw new Error(`Gmail queue stats failed: ${error.message}`);
    }
  },

  /**
   * Force process the offline queue
   * @returns {Promise<Object>} - Processing results
   */
  async forceProcessQueue() {
    try {
      const result = await invoke('gmail_force_process_queue');
      return result;
    } catch (error) {
      console.error('❌ Gmail: Failed to process queue:', error);
      throw new Error(`Gmail queue processing failed: ${error.message}`);
    }
  },

  /**
   * Clear the offline queue
   * @returns {Promise<void>}
   */
  async clearQueue() {
    try {
      await invoke('gmail_clear_queue');
    } catch (error) {
      console.error('❌ Gmail: Failed to clear queue:', error);
      throw new Error(`Gmail queue clearing failed: ${error.message}`);
    }
  }
};

// Combined Gmail service object
export const gmailService = {
  auth: gmailAuth,
  emails: gmailEmails,
  actions: gmailActions,
  labels: gmailLabels,
  queue: gmailQueue
};

// Default export
export default gmailService;

// Type definitions for TypeScript-like documentation
/**
 * @typedef {Object} GmailProfile
 * @property {string} id - User ID
 * @property {string} email - Email address
 * @property {string} name - Display name
 * @property {string} picture - Profile picture URL
 */

/**
 * @typedef {Object} GmailEmail
 * @property {string} id - Message ID
 * @property {string} threadId - Thread ID
 * @property {Array<string>} labelIds - Applied label IDs
 * @property {string} snippet - Email snippet
 * @property {Object} payload - Email payload with headers and body
 * @property {number} internalDate - Internal date timestamp
 * @property {number} historyId - History ID
 */

/**
 * @typedef {Object} GmailLabel
 * @property {string} id - Label ID
 * @property {string} name - Label name
 * @property {string} type - Label type (system, user)
 * @property {number} messagesTotal - Total messages
 * @property {number} messagesUnread - Unread messages
 */

/**
 * @typedef {Object} GmailQueueStats
 * @property {number} pending - Pending operations
 * @property {number} failed - Failed operations
 * @property {number} completed - Completed operations
 * @property {Date} lastProcessed - Last processing time
 */