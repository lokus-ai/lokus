import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Mic,
  Key,
  Brain,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  NotebookPen,
  Calendar,
} from 'lucide-react';
import {
  loadProviderConfig,
  saveProviderConfig,
  validateApiKey,
  getAvailableModels,
} from '../../services/ai-provider.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEETING_SETTINGS_KEY = 'lokus-meeting-settings';

const DEFAULT_MEETING_SETTINGS = {
  autoDetectCalendar: true,
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
// API key input with show/hide and Test button
// ---------------------------------------------------------------------------

const TEST_IDLE = 'idle';
const TEST_LOADING = 'loading';
const TEST_OK = 'ok';
const TEST_FAIL = 'fail';

function ApiKeyInput({ label, placeholder, value, onChange, onTest, testState, testError }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="h-9 w-full pl-3 pr-9 rounded-md bg-app-panel border border-app-border text-app-text text-sm outline-none focus:ring-2 focus:ring-app-accent/50 placeholder:text-app-muted/60"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-text transition-colors"
            tabIndex={-1}
            aria-label={visible ? 'Hide key' : 'Show key'}
          >
            {visible ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onTest}
          disabled={!value || testState === TEST_LOADING}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-app-border bg-app-panel text-sm text-app-text hover:bg-app-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          aria-label={`Test ${label}`}
        >
          {testState === TEST_LOADING && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {testState === TEST_OK && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
          {testState === TEST_FAIL && <XCircle className="w-3.5 h-3.5 text-red-500" />}
          {testState === TEST_IDLE && <Key className="w-3.5 h-3.5" />}
          <span>Test</span>
        </button>
      </div>

      {testState === TEST_OK && (
        <p className="text-xs text-green-600 dark:text-green-400">Key is valid.</p>
      )}
      {testState === TEST_FAIL && testError && (
        <p className="text-xs text-red-600 dark:text-red-400">{testError}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MeetingNotes() {
  // --- AI provider config state ---
  const [providerConfig, setProviderConfig] = useState({
    mode: 'lokus',
    llmProvider: 'anthropic',
    llmApiKey: '',
    llmModel: 'claude-sonnet-4-20250514',
    deepgramApiKey: '',
    supabaseUrl: '',
    supabaseToken: '',
  });

  // --- Meeting-specific settings state ---
  const [meetingSettings, setMeetingSettings] = useState(DEFAULT_MEETING_SETTINGS);

  // --- Audio devices ---
  const [audioDevices, setAudioDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState('');

  // --- Loading / error ---
  const [configLoading, setConfigLoading] = useState(true);

  // --- API key test states ---
  const [deepgramTestState, setDeepgramTestState] = useState(TEST_IDLE);
  const [deepgramTestError, setDeepgramTestError] = useState('');
  const [llmTestState, setLlmTestState] = useState(TEST_IDLE);
  const [llmTestError, setLlmTestError] = useState('');

  // ---------------------------------------------------------------------------
  // Debounce helper for text inputs
  // ---------------------------------------------------------------------------

  const debounceRef = useRef(null);

  const debouncedSaveProviderConfig = useCallback((config) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveProviderConfig(config).catch((err) => {
        console.error('[MeetingNotes] Failed to save provider config:', err);
      });
    }, 300);
  }, []);

  // ---------------------------------------------------------------------------
  // Load config on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Load AI provider config
      try {
        const config = await loadProviderConfig();
        if (!cancelled) setProviderConfig(config);
      } catch (err) {
        console.error('[MeetingNotes] Failed to load provider config:', err);
      } finally {
        if (!cancelled) setConfigLoading(false);
      }

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
    }

    init();
    return () => { cancelled = true; };
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

  // ---------------------------------------------------------------------------
  // Provider config updaters
  // ---------------------------------------------------------------------------

  /** Update a key in providerConfig and immediately persist to Tauri/localStorage. */
  const updateProviderConfig = useCallback((patch, debounce = false) => {
    setProviderConfig((prev) => {
      const next = { ...prev, ...patch };
      if (debounce) {
        debouncedSaveProviderConfig(next);
      } else {
        saveProviderConfig(next).catch((err) => {
          console.error('[MeetingNotes] Failed to save provider config:', err);
        });
      }
      return next;
    });
  }, [debouncedSaveProviderConfig]);

  /** Update a key in meetingSettings and immediately persist to localStorage. */
  const updateMeetingSettings = useCallback((patch) => {
    setMeetingSettings((prev) => {
      const next = { ...prev, ...patch };
      saveMeetingSettings(next);
      return next;
    });
  }, [saveMeetingSettings]);

  // ---------------------------------------------------------------------------
  // Mode toggle handler — clear test states on switch
  // ---------------------------------------------------------------------------

  const handleModeChange = useCallback((newMode) => {
    setDeepgramTestState(TEST_IDLE);
    setDeepgramTestError('');
    setLlmTestState(TEST_IDLE);
    setLlmTestError('');
    updateProviderConfig({ mode: newMode });
  }, [updateProviderConfig]);

  // ---------------------------------------------------------------------------
  // LLM provider change — reset model to first available
  // ---------------------------------------------------------------------------

  const handleLlmProviderChange = useCallback((newProvider) => {
    const models = getAvailableModels(newProvider);
    const defaultModel = models[0]?.id ?? models[0] ?? '';
    setLlmTestState(TEST_IDLE);
    setLlmTestError('');
    updateProviderConfig({ llmProvider: newProvider, llmModel: defaultModel });
  }, [updateProviderConfig]);

  // ---------------------------------------------------------------------------
  // API key test handlers
  // ---------------------------------------------------------------------------

  const handleTestDeepgram = useCallback(async () => {
    setDeepgramTestState(TEST_LOADING);
    setDeepgramTestError('');
    try {
      const result = await validateApiKey('deepgram', providerConfig.deepgramApiKey);
      setDeepgramTestState(result.valid ? TEST_OK : TEST_FAIL);
      if (!result.valid) setDeepgramTestError(result.error ?? 'Invalid key.');
    } catch (err) {
      setDeepgramTestState(TEST_FAIL);
      setDeepgramTestError(err.message ?? 'Validation failed.');
    }
  }, [providerConfig.deepgramApiKey]);

  const handleTestLlm = useCallback(async () => {
    setLlmTestState(TEST_LOADING);
    setLlmTestError('');
    try {
      const result = await validateApiKey(providerConfig.llmProvider, providerConfig.llmApiKey);
      setLlmTestState(result.valid ? TEST_OK : TEST_FAIL);
      if (!result.valid) setLlmTestError(result.error ?? 'Invalid key.');
    } catch (err) {
      setLlmTestState(TEST_FAIL);
      setLlmTestError(err.message ?? 'Validation failed.');
    }
  }, [providerConfig.llmProvider, providerConfig.llmApiKey]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const isBYOK = providerConfig.mode === 'byok';
  const availableModels = getAvailableModels(providerConfig.llmProvider);

  // Default device selection when devices load
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
          Configure AI transcription, summarisation, and meeting detection.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: AI Provider Mode                                         */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading icon={Brain}>AI Provider</SectionHeading>

        <Card>
          <SettingRow
            label="Use Lokus AI"
            description="Let Lokus handle AI infrastructure. Bring your own keys for full control."
          >
            {/* Two-state toggle: left = Lokus AI (unchecked), right = BYOK (checked) */}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${!isBYOK ? 'text-app-text font-medium' : 'text-app-muted'}`}>
                Lokus AI
              </span>
              <Toggle
                checked={isBYOK}
                onChange={(e) => handleModeChange(e.target.checked ? 'byok' : 'lokus')}
              />
              <span className={`text-xs ${isBYOK ? 'text-app-text font-medium' : 'text-app-muted'}`}>
                BYOK
              </span>
            </div>
          </SettingRow>

          {/* Lokus AI placeholder */}
          {!isBYOK && (
            <div className="mt-4 pt-4 border-t border-app-border/50">
              <p className="text-sm text-app-muted italic">
                Coming soon — subscription tiers will appear here.
              </p>
            </div>
          )}
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: BYOK Settings                                            */}
      {/* ------------------------------------------------------------------ */}
      {isBYOK && (
        <section>
          <SectionHeading icon={Key}>API Keys</SectionHeading>

          <Card className="space-y-5">
            {/* Deepgram */}
            <ApiKeyInput
              label="Deepgram API Key"
              placeholder="dg_••••••••••••••••••••••••••••••••••••••••"
              value={providerConfig.deepgramApiKey}
              onChange={(e) => {
                setDeepgramTestState(TEST_IDLE);
                setDeepgramTestError('');
                updateProviderConfig({ deepgramApiKey: e.target.value }, true);
              }}
              onTest={handleTestDeepgram}
              testState={deepgramTestState}
              testError={deepgramTestError}
            />

            {/* Divider */}
            <div className="border-t border-app-border/50" />

            {/* LLM Provider */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
                LLM Provider
              </label>
              <Select
                value={providerConfig.llmProvider}
                onChange={(e) => handleLlmProviderChange(e.target.value)}
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </Select>
            </div>

            {/* LLM API Key */}
            <ApiKeyInput
              label={`${providerConfig.llmProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key`}
              placeholder={
                providerConfig.llmProvider === 'anthropic'
                  ? 'sk-ant-••••••••••••••••••••••••••••••••'
                  : 'sk-••••••••••••••••••••••••••••••••'
              }
              value={providerConfig.llmApiKey}
              onChange={(e) => {
                setLlmTestState(TEST_IDLE);
                setLlmTestError('');
                updateProviderConfig({ llmApiKey: e.target.value }, true);
              }}
              onTest={handleTestLlm}
              testState={llmTestState}
              testError={llmTestError}
            />

            {/* LLM Model */}
            {availableModels.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
                  Model
                </label>
                <Select
                  value={providerConfig.llmModel}
                  onChange={(e) =>
                    updateProviderConfig({ llmModel: e.target.value })
                  }
                >
                  {availableModels.map((model) => {
                    const id = typeof model === 'string' ? model : model.id;
                    const name = typeof model === 'string' ? model : (model.name ?? model.id);
                    return (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    );
                  })}
                </Select>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Microphone                                               */}
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
      {/* Section 4: Meeting Detection                                        */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading icon={Calendar}>Meeting Detection</SectionHeading>

        <Card className="space-y-4">
          <SettingRow
            label="Auto-detect calendar meetings"
            description="Start recording automatically when a calendar event begins."
          >
            <Toggle
              checked={meetingSettings.autoDetectCalendar}
              onChange={(e) =>
                updateMeetingSettings({ autoDetectCalendar: e.target.checked })
              }
            />
          </SettingRow>

          <div className="border-t border-app-border/50" />

          <SettingRow
            label="Detect ad-hoc calls via microphone activity"
            description="Prompt to start a meeting note when sustained audio is detected."
          >
            <Toggle
              checked={meetingSettings.detectAdHocCalls}
              onChange={(e) =>
                updateMeetingSettings({ detectAdHocCalls: e.target.checked })
              }
            />
          </SettingRow>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Summary                                                  */}
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
