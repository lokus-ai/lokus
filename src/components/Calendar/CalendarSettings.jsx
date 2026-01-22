import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Check,
  X,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Settings,
  AlertCircle,
  HelpCircle,
  Lock
} from 'lucide-react';
import { useCalendarContext } from '../../contexts/CalendarContext.jsx';

// Helper to determine why a calendar is read-only
const getReadOnlyReason = (calendar) => {
  const id = calendar.id || '';
  if (id.includes('#holiday@group')) {
    return { type: 'holiday', message: 'Holiday calendars are always read-only' };
  }
  if (id.includes('@import.calendar.google.com')) {
    return { type: 'imported', message: 'Imported calendars are read-only via API. To edit: export events from this calendar, delete it, then import events into your primary calendar instead.' };
  }
  if (id.includes('@group.v.calendar.google.com')) {
    return { type: 'subscribed', message: 'Subscribed calendars are read-only' };
  }
  // Shared calendar from another user
  return { type: 'shared', message: 'Ask the calendar owner to give you "Make changes to events" permission in Google Calendar sharing settings' };
};

/**
 * Calendar Settings Component
 *
 * Settings panel for managing calendar connections and preferences.
 * Can be used in Preferences view or as a standalone settings modal.
 */
export default function CalendarSettings() {
  const {
    isAuthenticated,
    account,
    authLoading,
    authError,
    connectGoogle,
    disconnect,
    calendars,
    calendarsLoading,
    refreshCalendars,
    updateCalendarVisibility,
    syncInProgress,
    triggerSync,
    lastSync,
    settings,
    updateSettings
  } = useCalendarContext();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Handle Google Calendar connection
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await connectGoogle();
    } catch (error) {
      console.error('Failed to connect Google Calendar:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar? Your events will no longer sync.')) {
      return;
    }

    try {
      setIsDisconnecting(true);
      await disconnect('google');
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Toggle calendar visibility
  const handleToggleVisibility = async (calendarId, currentVisible) => {
    try {
      await updateCalendarVisibility(calendarId, !currentVisible);
    } catch (error) {
      console.error('Failed to update calendar visibility:', error);
    }
  };

  // Not connected state
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        {/* Connection Card */}
        <div className="bg-app-panel border border-app-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-app-text">Google Calendar</h3>
              <p className="text-sm text-app-text-secondary mt-1">
                Connect your Google Calendar to view and manage events directly in Lokus.
                Your events will sync automatically.
              </p>

              {authError && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{authError}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={isConnecting || authLoading}
                className="mt-4 px-4 py-2 bg-app-accent text-app-accent-fg rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {isConnecting || authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Connect Google Calendar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="bg-app-panel border border-app-border rounded-xl p-6">
          <h4 className="font-medium text-app-text mb-4">What you can do:</h4>
          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-sm text-app-text-secondary">
              <Check className="w-4 h-4 text-green-500" />
              View all your calendars and events
            </li>
            <li className="flex items-center gap-3 text-sm text-app-text-secondary">
              <Check className="w-4 h-4 text-green-500" />
              See upcoming events in the sidebar
            </li>
            <li className="flex items-center gap-3 text-sm text-app-text-secondary">
              <Check className="w-4 h-4 text-green-500" />
              Create and edit events directly
            </li>
            <li className="flex items-center gap-3 text-sm text-app-text-secondary">
              <Check className="w-4 h-4 text-green-500" />
              Automatic background sync
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="space-y-6">
      {/* Connected Account */}
      <div className="bg-app-panel border border-app-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-app-text">Google Calendar</h3>
              <p className="text-sm text-app-text-secondary">{account?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-500">Connected</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="px-3 py-1.5 text-sm text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Disconnecting...
              </>
            ) : (
              <>
                <X className="w-3 h-3" />
                Disconnect
              </>
            )}
          </button>
        </div>

        {/* Sync Status */}
        <div className="mt-4 pt-4 border-t border-app-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-app-text-secondary">
              {lastSync ? (
                <>Last synced: {new Date(lastSync).toLocaleString()}</>
              ) : (
                'Not synced yet'
              )}
            </div>
            <button
              onClick={triggerSync}
              disabled={syncInProgress}
              className="flex items-center gap-2 text-sm text-app-accent hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${syncInProgress ? 'animate-spin' : ''}`} />
              {syncInProgress ? 'Syncing...' : 'Sync now'}
            </button>
          </div>
        </div>
      </div>

      {/* Calendars List */}
      <div className="bg-app-panel border border-app-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-app-text">Your Calendars</h4>
          <button
            onClick={refreshCalendars}
            disabled={calendarsLoading}
            className="p-1.5 hover:bg-app-bg rounded transition-colors"
            title="Refresh calendars"
          >
            <RefreshCw className={`w-4 h-4 text-app-muted ${calendarsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {calendarsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-app-muted" />
          </div>
        ) : calendars.length === 0 ? (
          <div className="text-sm text-app-text-secondary text-center py-8">
            No calendars found
          </div>
        ) : (
          <div className="space-y-2">
            {calendars.map((calendar) => {
              const readOnlyInfo = !calendar.is_writable ? getReadOnlyReason(calendar) : null;
              return (
                <div
                  key={calendar.id}
                  className="p-3 rounded-lg hover:bg-app-bg transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: calendar.color || '#4285f4' }}
                      />
                      <div>
                        <div className="text-sm font-medium text-app-text flex items-center gap-2">
                          {calendar.name}
                          {calendar.is_primary && (
                            <span className="text-xs text-app-accent">(Primary)</span>
                          )}
                          {!calendar.is_writable && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Read-only
                            </span>
                          )}
                        </div>
                        {calendar.description && (
                          <div className="text-xs text-app-text-secondary truncate max-w-[200px]">
                            {calendar.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleVisibility(calendar.id, calendar.visible)}
                      className="p-2 hover:bg-app-panel rounded transition-colors"
                      title={calendar.visible ? 'Hide calendar' : 'Show calendar'}
                    >
                      {calendar.visible ? (
                        <Eye className="w-4 h-4 text-app-accent" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-app-muted" />
                      )}
                    </button>
                  </div>

                  {/* Show reason why calendar is read-only */}
                  {readOnlyInfo && (
                    <div className="mt-2 ml-6 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
                      {readOnlyInfo.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-app-panel border border-app-border rounded-xl p-6">
        <h4 className="font-medium text-app-text mb-4">Calendar Settings</h4>

        <div className="space-y-4">
          {/* Auto-sync toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-app-text">Auto-sync</div>
              <div className="text-xs text-app-text-secondary">
                Automatically sync events in the background
              </div>
            </div>
            <button
              onClick={() => updateSettings({ autoSync: !settings.autoSync })}
              className={`
                w-11 h-6 rounded-full transition-colors relative
                ${settings.autoSync ? 'bg-app-accent' : 'bg-app-muted'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                  ${settings.autoSync ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {/* Default view */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-app-text">Default View</div>
              <div className="text-xs text-app-text-secondary">
                Calendar view when opening
              </div>
            </div>
            <select
              value={settings.defaultView}
              onChange={(e) => updateSettings({ defaultView: e.target.value })}
              className="px-3 py-1.5 text-sm bg-app-bg border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </div>

          {/* First day of week */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-app-text">Week starts on</div>
              <div className="text-xs text-app-text-secondary">
                First day of the week
              </div>
            </div>
            <select
              value={settings.firstDayOfWeek}
              onChange={(e) => updateSettings({ firstDayOfWeek: parseInt(e.target.value) })}
              className="px-3 py-1.5 text-sm bg-app-bg border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={6}>Saturday</option>
            </select>
          </div>
        </div>
      </div>

      {/* Help */}
      <div className="bg-app-panel border border-app-border rounded-xl p-6">
        <h4 className="font-medium text-app-text mb-3">Need help?</h4>
        <div className="space-y-2 text-sm text-app-text-secondary">
          <p>
            Calendars marked with <span className="text-amber-500">Read-only</span> cannot be edited. See the message under each calendar for how to get edit access.
          </p>
          <p>
            If you're getting permission errors on your own calendar, try disconnecting and reconnecting above.
          </p>
        </div>
      </div>

      {/* Open in Google Calendar */}
      <a
        href="https://calendar.google.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-app-accent border border-app-accent/30 rounded-lg hover:bg-app-accent/10 transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        Open Google Calendar
      </a>
    </div>
  );
}

/**
 * Calendar Connection Status Component
 *
 * Small status indicator for use in connection grids
 */
export function CalendarConnectionStatus() {
  const { isAuthenticated, authLoading } = useCalendarContext();

  if (authLoading) {
    return (
      <div className="w-3 h-3 rounded-full bg-app-muted animate-pulse" />
    );
  }

  return (
    <div
      className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-app-muted'}`}
      title={isAuthenticated ? 'Connected' : 'Not connected'}
    />
  );
}
