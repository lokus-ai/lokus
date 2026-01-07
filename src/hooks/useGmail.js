import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import gmailService from '../services/gmail.js';

/**
 * Gmail Authentication Hook
 * 
 * Manages Gmail authentication state, login/logout operations
 * and provides authentication status monitoring.
 */
export function useGmailAuth() {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    profile: null,
    isLoading: true,
    error: null
  });

  const checkAuthStatus = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const isAuth = await gmailService.auth.isAuthenticated();

      if (isAuth) {
        const profile = await gmailService.auth.getProfile();
        setAuthState({
          isAuthenticated: true,
          profile,
          isLoading: false,
          error: null
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          profile: null,
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        profile: null,
        isLoading: false,
        error: error.message
      });
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Listen for auth events
  useEffect(() => {
    let unsubscribe = null;

    const setupListener = async () => {
      try {
        unsubscribe = await listen('gmail-auth-changed', () => {
          checkAuthStatus();
        });
      } catch (err) {
        console.error('useGmailAuth: Failed to set up auth listener', err);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [checkAuthStatus]);

  const login = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const authUrl = await gmailService.auth.initiateAuth();

      // Open auth URL (handled by Tauri)
      // Note: The actual OAuth flow completion will be handled by deep links
      // and will trigger the 'gmail-auth-changed' event

      return authUrl;
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      await gmailService.auth.logout();

      setAuthState({
        isAuthenticated: false,
        profile: null,
        isLoading: false,
        error: null
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const completeAuth = useCallback(async (code, state) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const profile = await gmailService.auth.completeAuth(code, state);

      setAuthState({
        isAuthenticated: true,
        profile,
        isLoading: false,
        error: null
      });

      return profile;
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  return {
    ...authState,
    login,
    logout,
    completeAuth,
    refreshAuth: checkAuthStatus
  };
}

/**
 * Gmail Emails Hook
 * 
 * Manages email listing, searching, pagination, and email fetching.
 * Provides loading states and error handling for email operations.
 */
export function useGmailEmails(initialOptions = {}) {
  const [emailState, setEmailState] = useState({
    emails: [],
    totalEmails: 0,
    nextPageToken: null,
    isLoading: false,
    error: null,
    hasNextPage: false
  });

  const [searchQuery, setSearchQuery] = useState(initialOptions.query || '');
  const [currentOptions, setCurrentOptions] = useState(initialOptions);
  const abortControllerRef = useRef(null);

  const loadEmails = useCallback(async (options = {}, append = false) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      setEmailState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const mergedOptions = { ...currentOptions, ...options };

      const result = await gmailService.emails.listEmails(mergedOptions);

      setEmailState(prev => ({
        ...prev,
        emails: append ? [...prev.emails, ...result.emails] : result.emails,
        totalEmails: result.resultSizeEstimate || 0,
        nextPageToken: result.nextPageToken || null,
        hasNextPage: !!result.nextPageToken,
        isLoading: false,
        error: null
      }));

      return result;
    } catch (error) {
      if (error.name === 'AbortError') return;

      setEmailState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, [currentOptions]);

  const searchEmails = useCallback(async (query, options = {}) => {
    try {
      setEmailState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      setSearchQuery(query);

      const result = await gmailService.emails.searchEmails(query, options);

      setEmailState(prev => ({
        ...prev,
        emails: result.emails || [],
        totalEmails: result.resultSizeEstimate || 0,
        nextPageToken: result.nextPageToken || null,
        hasNextPage: !!result.nextPageToken,
        isLoading: false,
        error: null
      }));

      return result;
    } catch (error) {
      setEmailState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const loadNextPage = useCallback(async () => {
    if (!emailState.hasNextPage || emailState.isLoading) return;

    return loadEmails({
      pageToken: emailState.nextPageToken,
      query: searchQuery
    }, true);
  }, [emailState.hasNextPage, emailState.isLoading, emailState.nextPageToken, loadEmails, searchQuery]);

  const refreshEmails = useCallback(() => {
    return loadEmails({ query: searchQuery });
  }, [loadEmails, searchQuery]);

  const getEmail = useCallback(async (messageId, format = 'full') => {
    try {
      return await gmailService.emails.getEmail(messageId, format);
    } catch (error) {
      throw error;
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadEmails();
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...emailState,
    searchQuery,
    loadEmails,
    searchEmails,
    loadNextPage,
    refreshEmails,
    getEmail,
    setOptions: setCurrentOptions
  };
}

/**
 * Gmail Composer Hook
 * 
 * Manages email composition, sending, replying, and forwarding.
 * Provides draft management and sending status.
 */
export function useGmailComposer() {
  const [composerState, setComposerState] = useState({
    isSending: false,
    error: null,
    lastSentEmail: null
  });

  const sendEmail = useCallback(async (emailData) => {
    try {
      setComposerState(prev => ({
        ...prev,
        isSending: true,
        error: null
      }));

      const result = await gmailService.emails.sendEmail(emailData);

      setComposerState({
        isSending: false,
        error: null,
        lastSentEmail: result
      });

      return result;
    } catch (error) {
      setComposerState({
        isSending: false,
        error: error.message,
        lastSentEmail: null
      });
      throw error;
    }
  }, []);

  const replyToEmail = useCallback(async (messageId, replyData) => {
    try {
      setComposerState(prev => ({
        ...prev,
        isSending: true,
        error: null
      }));

      const result = await gmailService.emails.replyEmail(messageId, replyData);

      setComposerState({
        isSending: false,
        error: null,
        lastSentEmail: result
      });

      return result;
    } catch (error) {
      setComposerState({
        isSending: false,
        error: error.message,
        lastSentEmail: null
      });
      throw error;
    }
  }, []);

  const forwardEmail = useCallback(async (messageId, forwardData) => {
    try {
      setComposerState(prev => ({
        ...prev,
        isSending: true,
        error: null
      }));

      const result = await gmailService.emails.forwardEmail(messageId, forwardData);

      setComposerState({
        isSending: false,
        error: null,
        lastSentEmail: result
      });

      return result;
    } catch (error) {
      setComposerState({
        isSending: false,
        error: error.message,
        lastSentEmail: null
      });
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setComposerState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...composerState,
    sendEmail,
    replyToEmail,
    forwardEmail,
    clearError
  };
}

/**
 * Gmail Actions Hook
 * 
 * Manages email actions like read/unread, star/unstar, archive, delete.
 * Provides batch operations and optimistic updates.
 */
export function useGmailActions() {
  const [actionsState, setActionsState] = useState({
    isProcessing: false,
    error: null,
    lastAction: null
  });

  const performAction = useCallback(async (actionFn, messageIds, actionName) => {
    try {
      setActionsState(prev => ({
        ...prev,
        isProcessing: true,
        error: null
      }));

      await actionFn(messageIds);

      setActionsState({
        isProcessing: false,
        error: null,
        lastAction: { action: actionName, messageIds, timestamp: Date.now() }
      });
    } catch (error) {
      setActionsState({
        isProcessing: false,
        error: error.message,
        lastAction: null
      });
      throw error;
    }
  }, []);

  const markAsRead = useCallback((messageIds) => {
    return performAction(gmailService.actions.markAsRead, messageIds, 'markAsRead');
  }, [performAction]);

  const markAsUnread = useCallback((messageIds) => {
    return performAction(gmailService.actions.markAsUnread, messageIds, 'markAsUnread');
  }, [performAction]);

  const starEmails = useCallback((messageIds) => {
    return performAction(gmailService.actions.starEmails, messageIds, 'starEmails');
  }, [performAction]);

  const unstarEmails = useCallback((messageIds) => {
    return performAction(gmailService.actions.unstarEmails, messageIds, 'unstarEmails');
  }, [performAction]);

  const archiveEmails = useCallback((messageIds) => {
    return performAction(gmailService.actions.archiveEmails, messageIds, 'archiveEmails');
  }, [performAction]);

  const deleteEmails = useCallback((messageIds) => {
    return performAction(gmailService.actions.deleteEmails, messageIds, 'deleteEmails');
  }, [performAction]);

  const clearError = useCallback(() => {
    setActionsState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...actionsState,
    markAsRead,
    markAsUnread,
    starEmails,
    unstarEmails,
    archiveEmails,
    deleteEmails,
    clearError
  };
}

/**
 * Gmail Labels Hook
 * 
 * Manages Gmail labels, provides label information and filtering.
 */
export function useGmailLabels() {
  const [labelsState, setLabelsState] = useState({
    labels: [],
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  const loadLabels = useCallback(async () => {
    try {
      setLabelsState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const labels = await gmailService.labels.getLabels();

      setLabelsState({
        labels,
        isLoading: false,
        error: null,
        lastUpdated: Date.now()
      });

      return labels;
    } catch (error) {
      setLabelsState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const getLabel = useCallback((labelId) => {
    return labelsState.labels.find(label => label.id === labelId);
  }, [labelsState.labels]);

  const getSystemLabels = useCallback(() => {
    return labelsState.labels.filter(label => label.type === 'system');
  }, [labelsState.labels]);

  const getUserLabels = useCallback(() => {
    return labelsState.labels.filter(label => label.type === 'user');
  }, [labelsState.labels]);

  // Initial load
  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  return {
    ...labelsState,
    loadLabels,
    getLabel,
    getSystemLabels,
    getUserLabels,
    refreshLabels: loadLabels
  };
}

/**
 * Gmail Queue Hook
 * 
 * Monitors offline queue status, provides queue management capabilities.
 */
export function useGmailQueue() {
  const [queueState, setQueueState] = useState({
    stats: {
      pending: 0,
      failed: 0,
      completed: 0,
      lastProcessed: null
    },
    isLoading: false,
    isProcessing: false,
    error: null
  });

  const loadQueueStats = useCallback(async () => {
    try {
      setQueueState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const stats = await gmailService.queue.getQueueStats();

      setQueueState(prev => ({
        ...prev,
        stats,
        isLoading: false,
        error: null
      }));

      return stats;
    } catch (error) {
      setQueueState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const processQueue = useCallback(async () => {
    try {
      setQueueState(prev => ({
        ...prev,
        isProcessing: true,
        error: null
      }));

      const result = await gmailService.queue.forceProcessQueue();

      // Refresh stats after processing
      await loadQueueStats();

      setQueueState(prev => ({
        ...prev,
        isProcessing: false,
        error: null
      }));

      return result;
    } catch (error) {
      setQueueState(prev => ({
        ...prev,
        isProcessing: false,
        error: error.message
      }));
      throw error;
    }
  }, [loadQueueStats]);

  const clearQueue = useCallback(async () => {
    try {
      setQueueState(prev => ({
        ...prev,
        isProcessing: true,
        error: null
      }));

      await gmailService.queue.clearQueue();

      // Refresh stats after clearing
      await loadQueueStats();

      setQueueState(prev => ({
        ...prev,
        isProcessing: false,
        error: null
      }));
    } catch (error) {
      setQueueState(prev => ({
        ...prev,
        isProcessing: false,
        error: error.message
      }));
      throw error;
    }
  }, [loadQueueStats]);

  // Periodic queue stats refresh
  useEffect(() => {
    loadQueueStats();

    const interval = setInterval(loadQueueStats, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loadQueueStats]);

  // Listen for queue events
  useEffect(() => {
    let unsubscribe = null;

    const setupListener = async () => {
      try {
        unsubscribe = await listen('gmail-queue-changed', () => {
          loadQueueStats();
        });
      } catch (err) {
        console.error('useGmailQueue: Failed to set up queue listener', err);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadQueueStats]);

  return {
    ...queueState,
    loadQueueStats,
    processQueue,
    clearQueue,
    refreshStats: loadQueueStats
  };
}