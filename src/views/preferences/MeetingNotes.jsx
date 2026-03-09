import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Mic,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  NotebookPen,
  Download,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEETING_SETTINGS_KEY = 'lokus-meeting-settings';

const DEFAULT_MEETING_SETTINGS = {
  detectAdHocCalls: true,
  autoInsertSummary: true,
  summaryTemplate: 'general',
  selectedDeviceId: '',
};

const SUMMARY_TEMPLATES = [
  { id: 'general', label: 'General' },
  { id: 'sales', label: 'Sales Call' },
  { id: '1on1', label: '1:1' },
  { id: 'standup', label: 'Standup' },
];

// STT model download states
const STT_STATUS_LOADING   = 'loading';
const STT_STATUS_READY     = 'ready';
const STT_STATUS_MISSING   = 'missing';
const STT_STATUS_ERROR     = 'error';

const DOWNLOAD_IDLE        = 'idle';
const DOWNLOAD_IN_PROGRESS = 'downloading';
const DOWNLOAD_ERROR       = 'error';

// ---------------------------------------------------------------------------
// Small reusable primitives
// ---------------------------------------------------------------------------

/**
 * Styled <select> consistent with the rest of Preferences.jsx.
 */
function Select({ value, onChange, children, disabled }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="h-9 pl-3 pr-8 w-full rounded-md bg-app-panel border border-app-border text-app-text text-sm outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-app-accent/50"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-muted" />
    </div>
  );
}

/**
 * Toggle switch — same visual style as the Updates section toggle.
 */
function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-app-accent rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-app-accent" />
    </label>
  );
}

/**
 * Section header — matches "text-sm uppercase tracking-wide text-app-muted" pattern.
 */
function SectionHeading({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="w-4 h-4 text-app-muted" />}
      <h2 className="text-sm uppercase tracking-wide text-app-muted">{children}</h2>
    </div>
  );
}

/**
 * Card wrapper consistent with bg-app-panel rounded-lg border border-app-border.
 */
function Card({ children, className = '' }) {
  return (
    <div className={`bg-app-panel rounded-lg p-4 border border-app-border ${className}`}>
      {children}
    </div>
  );
}

/**
 * Row inside a card: label on left, control on right.
 */
function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-app-text">{label}</p>
        {description && (
          <p className="text-xs text-app-muted mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MeetingNotes() {
  // --- Meeting-specific settings state ---
  const [meetingSettings, setMeetingSettings] = useState(DEFAULT_MEETING_SETTINGS);

  // --- Audio devices ---
  const [audioDevices, setAudioDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState('');

  // --- Loading ---
  const [configLoading, setConfigLoading] = useState(true);

  // --- STT model status ---
  const [sttStatus, setSttStatus] = useState(STT_STATUS_LOADING);

  // --- Model download ---
  const [downloadState, setDownloadState] = useState(DOWNLOAD_IDLE);
  const [downloadProgress, setDownloadProgress] = useState(0); // 0-100
  const [downloadError, setDownloadError] = useState('');

  const downloadUnlistenRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Load config on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Load meeting settings from localStorage
      try {
        const raw = localStorage.getItem(MEETING_SETTINGS_KEY);
        if (raw && !cancelled) {
          setMeetingSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
        }
      } catch {
        // ignore parse errors
      }

      // Fetch audio devices
      try {
        const devices = await invoke('get_audio_devices');
        if (!cancelled) {
          setAudioDevices(Array.isArray(devices) ? devices : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDevicesError('Could not retrieve audio devices.');
          console.error('[MeetingNotes] get_audio_devices failed:', err);
        }
      } finally {
        if (!cancelled) setDevicesLoading(false);
      }

      // Check STT model status
      try {
        const status = await invoke('get_stt_model_status');
        if (!cancelled) {
          const ready = status?.vadDownloaded && status?.whisperDownloaded;
          setSttStatus(ready ? STT_STATUS_READY : STT_STATUS_MISSING);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[MeetingNotes] get_stt_model_status failed:', err);
          setSttStatus(STT_STATUS_ERROR);
        }
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Tear down the download progress listener on unmount
  useEffect(() => {
    return () => {
      if (downloadUnlistenRef.current) {
        downloadUnlistenRef.current();
        downloadUnlistenRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Persist meeting settings to localStorage immediately on change
  // ---------------------------------------------------------------------------

  const saveMeetingSettings = useCallback((next) => {
    try {
      localStorage.setItem(MEETING_SETTINGS_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('[MeetingNotes] Failed to save meeting settings:', err);
    }
  }, []);

  /** Update a key in meetingSettings and immediately persist to localStorage. */
  const updateMeetingSettings = useCallback((patch) => {
    setMeetingSettings((prev) => {
      const next = { ...prev, ...patch };
      saveMeetingSettings(next);
      return next;
    });
  }, [saveMeetingSettings]);

  // ---------------------------------------------------------------------------
  // STT model download
  // ---------------------------------------------------------------------------

  const handleDownloadModel = useCallback(async () => {
    if (downloadState === DOWNLOAD_IN_PROGRESS) return;

    setDownloadState(DOWNLOAD_IN_PROGRESS);
    setDownloadProgress(0);
    setDownloadError('');

    // Subscribe to progress events before triggering the download
    try {
      const unlisten = await listen('lokus:model-download-progress', ({ payload }) => {
        const pct = typeof payload?.percent === 'number' ? payload.percent : 0;
        setDownloadProgress(Math.min(100, Math.max(0, pct)));
      });
      downloadUnlistenRef.current = unlisten;
    } catch (err) {
      console.error('[MeetingNotes] Failed to subscribe to download progress:', err);
    }

    try {
      await invoke('download_stt_model');
      setSttStatus(STT_STATUS_READY);
      setDownloadState(DOWNLOAD_IDLE);
      setDownloadProgress(100);
    } catch (err) {
      console.error('[MeetingNotes] download_stt_model failed:', err);
      setDownloadState(DOWNLOAD_ERROR);
      setDownloadError(err?.message ?? String(err));
    } finally {
      if (downloadUnlistenRef.current) {
        downloadUnlistenRef.current();
        downloadUnlistenRef.current = null;
      }
    }
  }, [downloadState]);

  // ---------------------------------------------------------------------------
  // Default device selection when devices load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (audioDevices.length > 0 && !meetingSettings.selectedDeviceId) {
      const defaultDevice = audioDevices.find((d) => d.is_default) ?? audioDevices[0];
      if (defaultDevice) {
        updateMeetingSettings({ selectedDeviceId: defaultDevice.id });
      }
    }
  }, [audioDevices]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-app-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-app-text mb-1">Meeting Notes</h1>
        <p className="text-sm text-app-muted">
          Configure transcription, summarisation, and meeting detection.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Transcription Engine                                     */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading icon={Mic}>Transcription</SectionHeading>

        <Card className="space-y-4">
          <SettingRow
            label="Local speech-to-text"
            description="Whisper base.en — runs entirely on your device, no API keys needed."
          >
            {sttStatus === STT_STATUS_LOADING && (
              <Loader2 className="w-4 h-4 animate-spin text-app-muted" />
            )}

            {sttStatus === STT_STATUS_READY && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Ready</span>
              </div>
            )}

            {sttStatus === STT_STATUS_MISSING && downloadState === DOWNLOAD_IDLE && (
              <button
                type="button"
                onClick={handleDownloadModel}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-app-border bg-app-panel text-sm text-app-text hover:bg-app-bg transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download (74 MB)</span>
              </button>
            )}

            {sttStatus === STT_STATUS_ERROR && downloadState === DOWNLOAD_IDLE && (
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">Status unavailable</span>
              </div>
            )}

            {downloadState === DOWNLOAD_IN_PROGRESS && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-app-accent" />
                <span className="text-sm text-app-muted">{Math.round(downloadProgress)}%</span>
              </div>
            )}

            {downloadState === DOWNLOAD_ERROR && (
              <button
                type="button"
                onClick={handleDownloadModel}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-red-400 bg-app-panel text-sm text-red-600 hover:bg-app-bg transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </SettingRow>

          {/* Download progress bar */}
          {downloadState === DOWNLOAD_IN_PROGRESS && (
            <div className="w-full bg-app-bg rounded-full h-1.5">
              <div
                className="bg-app-accent h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}

          {/* Download error message */}
          {downloadState === DOWNLOAD_ERROR && downloadError && (
            <p className="text-xs text-red-600 dark:text-red-400">{downloadError}</p>
          )}
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Microphone                                               */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading icon={Mic}>Microphone</SectionHeading>

        <Card>
          {devicesLoading ? (
            <div className="flex items-center gap-2 text-sm text-app-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading audio devices...</span>
            </div>
          ) : devicesError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{devicesError}</p>
          ) : audioDevices.length === 0 ? (
            <p className="text-sm text-app-muted">No devices found.</p>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
                Input Device
              </label>
              <Select
                value={meetingSettings.selectedDeviceId}
                onChange={(e) =>
                  updateMeetingSettings({ selectedDeviceId: e.target.value })
                }
              >
                {audioDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                    {device.is_default ? ' (default)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Meeting Detection                                        */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading icon={Mic}>Meeting Detection</SectionHeading>

        <Card className="space-y-4">
          <SettingRow
            label="Auto-detect meetings"
            description="Detects when a meeting app is using your mic and prompts to start recording."
          >
            <Toggle
              checked={meetingSettings.detectAdHocCalls}
              onChange={(e) =>
                updateMeetingSettings({ detectAdHocCalls: e.target.checked })
              }
            />
          </SettingRow>
          <p className="text-xs text-app-muted">
            Works with Zoom, Teams, Google Meet, FaceTime, Slack, Webex, and browser-based calls.
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Summary                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading icon={NotebookPen}>Summary</SectionHeading>

        <Card className="space-y-4">
          <SettingRow
            label="Auto-insert summary in daily note"
            description="After a meeting ends, append the AI-generated summary to today's daily note."
          >
            <Toggle
              checked={meetingSettings.autoInsertSummary}
              onChange={(e) =>
                updateMeetingSettings({ autoInsertSummary: e.target.checked })
              }
            />
          </SettingRow>

          <div className="border-t border-app-border/50" />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
              Summary Template
            </label>
            <Select
              value={meetingSettings.summaryTemplate}
              onChange={(e) =>
                updateMeetingSettings({ summaryTemplate: e.target.value })
              }
            >
              {SUMMARY_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-app-muted">
              Determines the structure of the AI-generated summary inserted into your notes.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
