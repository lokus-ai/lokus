import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Eye, EyeOff, Lock, ChevronDown, ChevronRight, Layers, Zap } from 'lucide-react';
import { useCalendarContext } from '../../contexts/CalendarContext.jsx';
import calendarService from '../../services/calendar.js';

/**
 * Calendar Settings Component
 * Compact settings panel for Google Calendar connection
 */
export default function CalendarSettings() {
  const {
    isAuthenticated,
    account,
    authLoading,
    authError,
    providers,
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

  // Check if Google specifically is connected (not just any provider)
  const isGoogleConnected = providers?.google ?? false;
  // Get only Google calendars for this settings panel
  const googleCalendars = calendars.filter(c => c.provider === 'Google');

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showCalendars, setShowCalendars] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar?')) return;
    try {
      setIsDisconnecting(true);
      await disconnect('google');
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleToggleVisibility = async (calendarId, currentVisible) => {
    try {
      await updateCalendarVisibility(calendarId, !currentVisible);
    } catch (error) {
      console.error('Failed to update calendar visibility:', error);
    }
  };

  // Not connected to Google
  if (!isGoogleConnected) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-app-text-secondary">
          Sync your events with Google Calendar
        </span>
        <button
          onClick={handleConnect}
          disabled={isConnecting || authLoading}
          className="px-3 py-1.5 text-sm bg-app-accent text-app-accent-fg rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          {isConnecting || authLoading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect'
          )}
        </button>
      </div>
    );
  }

  // Connected
  return (
    <div className="space-y-3">
      {/* Account row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm text-app-text">{account?.email}</span>
          {lastSync && (
            <span className="text-xs text-app-muted">
              · synced {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerSync}
            disabled={syncInProgress}
            className="p-1.5 hover:bg-app-panel rounded transition-colors"
            title="Sync now"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-app-muted ${syncInProgress ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-xs text-red-500 hover:underline disabled:opacity-50"
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>

      {/* Calendars toggle */}
      <button
        onClick={() => setShowCalendars(!showCalendars)}
        className="flex items-center gap-2 text-sm text-app-text-secondary hover:text-app-text transition-colors w-full"
      >
        {showCalendars ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>Calendars ({googleCalendars.filter(c => c.visible).length}/{googleCalendars.length} visible)</span>
        {calendarsLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </button>

      {/* Calendars list */}
      {showCalendars && (
        <div className="pl-5 space-y-1">
          {googleCalendars.length === 0 ? (
            <span className="text-xs text-app-muted">No calendars found</span>
          ) : (
            googleCalendars.map((calendar) => (
              <div key={calendar.id} className="flex items-center justify-between py-1 group">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: calendar.color || '#4285f4' }}
                  />
                  <span className="text-sm text-app-text truncate">{calendar.name}</span>
                  {calendar.is_primary && (
                    <span className="text-[10px] text-app-accent">Primary</span>
                  )}
                  {!calendar.is_writable && (
                    <Lock className="w-3 h-3 text-app-muted flex-shrink-0" title="Read-only" />
                  )}
                </div>
                <button
                  onClick={() => handleToggleVisibility(calendar.id, calendar.visible)}
                  className="p-1 hover:bg-app-panel rounded transition-colors opacity-0 group-hover:opacity-100"
                >
                  {calendar.visible ? (
                    <Eye className="w-3.5 h-3.5 text-app-accent" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-app-muted" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settings toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center gap-2 text-sm text-app-text-secondary hover:text-app-text transition-colors"
      >
        {showSettings ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>Settings</span>
      </button>

      {/* Settings */}
      {showSettings && (
        <div className="pl-5 space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-app-text">Auto-sync</span>
            <button
              onClick={() => updateSettings({ autoSync: !settings.autoSync })}
              className={`w-9 h-5 rounded-full transition-colors relative ${settings.autoSync ? 'bg-app-accent' : 'bg-app-muted'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.autoSync ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-app-text">Default view</span>
            <select
              value={settings.defaultView}
              onChange={(e) => updateSettings({ defaultView: e.target.value })}
              className="px-2 py-1 text-sm bg-app-bg border border-app-border rounded focus:outline-none"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm text-app-text">Week starts on</span>
            <select
              value={settings.firstDayOfWeek}
              onChange={(e) => updateSettings({ firstDayOfWeek: parseInt(e.target.value) })}
              className="px-2 py-1 text-sm bg-app-bg border border-app-border rounded focus:outline-none"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={6}>Saturday</option>
            </select>
          </label>
        </div>
      )}

      {/* Sync Settings - Shown when multiple providers are connected */}
      <SyncSettings />
    </div>
  );
}

/**
 * Sync Settings Component
 * Settings for intelligent bidirectional sync and deduplication
 */
function SyncSettings() {
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [syncConfig, setSyncConfig] = useState({
    enabled: true,
    deduplication_enabled: true,
    conflict_resolution: 'last_modified_wins',
    sync_pairs: [],
    auto_sync_interval_minutes: 15
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSyncConfig();
  }, []);

  const loadSyncConfig = async () => {
    try {
      setIsLoading(true);
      const config = await calendarService.sync.getConfig();
      setSyncConfig(config);
    } catch (error) {
      console.error('Failed to load sync config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSyncConfig = async (newConfig) => {
    try {
      setIsSaving(true);
      await calendarService.sync.setConfig(newConfig);
      setSyncConfig(newConfig);
    } catch (error) {
      console.error('Failed to save sync config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (updates) => {
    const newConfig = { ...syncConfig, ...updates };
    saveSyncConfig(newConfig);
  };

  const conflictResolutionOptions = [
    { value: 'last_modified_wins', label: 'Most recent wins' },
    { value: 'prefer_google', label: 'Prefer Google Calendar' },
    { value: 'prefer_caldav', label: 'Prefer CalDAV/iCloud' },
    { value: 'manual', label: 'Ask me each time' }
  ];

  return (
    <>
      {/* Sync toggle */}
      <button
        onClick={() => setShowSyncSettings(!showSyncSettings)}
        className="flex items-center gap-2 text-sm text-app-text-secondary hover:text-app-text transition-colors"
      >
        {showSyncSettings ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Layers className="w-3.5 h-3.5" />
        <span>Sync & Deduplication</span>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
      </button>

      {/* Sync Settings */}
      {showSyncSettings && (
        <div className="pl-5 space-y-3">
          {/* Deduplication toggle */}
          <label className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-app-text">Smart Deduplication</span>
              <span className="text-xs text-app-muted">Hide duplicate events across calendars</span>
            </div>
            <button
              onClick={() => updateConfig({ deduplication_enabled: !syncConfig.deduplication_enabled })}
              disabled={isSaving}
              className={`w-9 h-5 rounded-full transition-colors relative ${syncConfig.deduplication_enabled ? 'bg-app-accent' : 'bg-app-muted'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${syncConfig.deduplication_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>

          {/* Conflict resolution */}
          <label className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-app-text">Conflict Resolution</span>
              <span className="text-xs text-app-muted">When same event differs</span>
            </div>
            <select
              value={syncConfig.conflict_resolution}
              onChange={(e) => updateConfig({ conflict_resolution: e.target.value })}
              disabled={isSaving}
              className="px-2 py-1 text-sm bg-app-bg border border-app-border rounded focus:outline-none"
            >
              {conflictResolutionOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {/* Sync status info */}
          <SyncStatusInfo />
        </div>
      )}
    </>
  );
}

/**
 * Sync Status Info Component
 * Shows last sync time and sync status
 */
function SyncStatusInfo() {
  const [syncState, setSyncState] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadSyncState();
  }, []);

  const loadSyncState = async () => {
    try {
      setIsLoading(true);
      const state = await calendarService.sync.getState();
      setSyncState(state);
    } catch (error) {
      console.error('Failed to load sync state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFullSync = async () => {
    try {
      setIsSyncing(true);
      await calendarService.sync.fullSync();
      await loadSyncState();
    } catch (error) {
      console.error('Full sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatSyncTime = (isoString) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
           ' on ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return <div className="text-xs text-app-muted">Loading sync status...</div>;
  }

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex flex-col">
        <span className="text-xs text-app-muted">
          Last sync: {formatSyncTime(syncState?.last_full_sync)}
        </span>
        {syncState?.last_error && (
          <span className="text-xs text-red-500">{syncState.last_error}</span>
        )}
      </div>
      <button
        onClick={triggerFullSync}
        disabled={isSyncing}
        className="flex items-center gap-1 text-xs text-app-accent hover:underline disabled:opacity-50"
        title="Run full sync with deduplication"
      >
        <Zap className={`w-3 h-3 ${isSyncing ? 'animate-pulse' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Full Sync'}
      </button>
    </div>
  );
}

/**
 * Calendar Connection Status - small indicator dot for Google Calendar
 */
export function CalendarConnectionStatus() {
  const { providers, authLoading } = useCalendarContext();

  // Check Google specifically
  const isGoogleConnected = providers?.google ?? false;

  if (authLoading) {
    return <div className="w-2 h-2 rounded-full bg-app-muted animate-pulse" />;
  }

  return (
    <div
      className={`w-2 h-2 rounded-full ${isGoogleConnected ? 'bg-green-500' : 'bg-app-muted'}`}
      title={isGoogleConnected ? 'Connected' : 'Not connected'}
    />
  );
}
