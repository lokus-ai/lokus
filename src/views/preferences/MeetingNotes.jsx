import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Mic,
  Key,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  NotebookPen,
  Eye,
  EyeOff,
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

const LLM_PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic (Claude)' },
];

// ---------------------------------------------------------------------------
// Small reusable primitives
// ---------------------------------------------------------------------------

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

function SectionHeading({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="w-4 h-4 text-app-muted" />}
      <h2 className="text-sm uppercase tracking-wide text-app-muted">{children}</h2>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-app-panel rounded-lg p-4 border border-app-border ${className}`}>
      {children}
    </div>
  );
}

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

/**
 * API key input with show/hide toggle and validation button.
 */
function ApiKeyInput({ value, onChange, onValidate, validationState, placeholder }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 pl-3 pr-9 w-full rounded-md bg-app-panel border border-app-border text-app-text text-sm outline-none font-mono focus:ring-2 focus:ring-app-accent/50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-text"
        >
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {onValidate && (
        <button
          type="button"
          onClick={onValidate}
          disabled={!value || validationState === 'validating'}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-app-border bg-app-panel text-sm text-app-text hover:bg-app-bg transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {validationState === 'validating' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {validationState === 'valid' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
          {validationState === 'invalid' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
          {(!validationState || validationState === 'idle') && <span>Verify</span>}
          {validationState === 'validating' && <span>Checking</span>}
          {validationState === 'valid' && <span>Valid</span>}
          {validationState === 'invalid' && <span>Invalid</span>}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MeetingNotes() {
  // --- Meeting-specific settings state ---
  const [meetingSettings, setMeetingSettings] = useState(DEFAULT_MEETING_SETTINGS);

  // --- AI provider config ---
  const [deepgramKey, setDeepgramKey] = useState('');
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');

  // --- Validation states ---
  const [deepgramValidation, setDeepgramValidation] = useState('idle');
  const [llmValidation, setLlmValidation] = useState('idle');
  const [validationError, setValidationError] = useState('');

  // --- Audio devices ---
  const [audioDevices, setAudioDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState('');

  // --- Loading ---
  const [configLoading, setConfigLoading] = useState(true);

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

      // Load AI provider config
      try {
        const config = await loadProviderConfig();
        if (!cancelled) {
          setDeepgramKey(config.deepgramApiKey || '');
          setLlmProvider(config.llmProvider || 'openai');
          setLlmApiKey(config.llmApiKey || '');
          setLlmModel(config.llmModel || 'gpt-4o-mini');
        }
      } catch (err) {
        console.error('[MeetingNotes] loadProviderConfig failed:', err);
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

      if (!cancelled) setConfigLoading(false);
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

  const updateMeetingSettings = useCallback((patch) => {
    setMeetingSettings((prev) => {
      const next = { ...prev, ...patch };
      saveMeetingSettings(next);
      return next;
    });
  }, [saveMeetingSettings]);

  // ---------------------------------------------------------------------------
  // Save AI config whenever keys/provider/model change
  // ---------------------------------------------------------------------------

  const saveAiConfig = useCallback(async (overrides = {}) => {
    const config = {
      mode: 'byok',
      llmProvider: overrides.llmProvider ?? llmProvider,
      llmApiKey: overrides.llmApiKey ?? llmApiKey,
      llmModel: overrides.llmModel ?? llmModel,
      deepgramApiKey: overrides.deepgramApiKey ?? deepgramKey,
    };
    try {
      await saveProviderConfig(config);
    } catch (err) {
      console.error('[MeetingNotes] saveProviderConfig failed:', err);
    }
  }, [llmProvider, llmApiKey, llmModel, deepgramKey]);

  // ---------------------------------------------------------------------------
  // API key validation
  // ---------------------------------------------------------------------------

  const handleValidateDeepgram = useCallback(async () => {
    if (!deepgramKey) return;
    setDeepgramValidation('validating');
    setValidationError('');
    try {
      const result = await validateApiKey('deepgram', deepgramKey);
      setDeepgramValidation(result.valid ? 'valid' : 'invalid');
      if (!result.valid) setValidationError(result.error || 'Invalid key');
    } catch (err) {
      setDeepgramValidation('invalid');
      setValidationError(err.message);
    }
  }, [deepgramKey]);

  const handleValidateLlm = useCallback(async () => {
    if (!llmApiKey) return;
    setLlmValidation('validating');
    setValidationError('');
    try {
      const result = await validateApiKey(llmProvider, llmApiKey);
      setLlmValidation(result.valid ? 'valid' : 'invalid');
      if (!result.valid) setValidationError(result.error || 'Invalid key');
    } catch (err) {
      setLlmValidation('invalid');
      setValidationError(err.message);
    }
  }, [llmApiKey, llmProvider]);

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

  const availableModels = getAvailableModels(llmProvider);

  return (
    <div className="space-y-8 max-w-xl">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-app-text mb-1">Meeting Notes</h1>
        <p className="text-sm text-app-muted">
          Configure transcription, AI summarisation, and meeting detection.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: API Keys                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionHeading icon={Key}>API Keys</SectionHeading>

        <Card className="space-y-5">
          {/* Deepgram key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
              Deepgram API Key
            </label>
            <ApiKeyInput
              value={deepgramKey}
              onChange={(val) => {
                setDeepgramKey(val);
                setDeepgramValidation('idle');
                saveAiConfig({ deepgramApiKey: val });
              }}
              onValidate={handleValidateDeepgram}
              validationState={deepgramValidation}
              placeholder="Enter your Deepgram API key"
            />
            <p className="text-xs text-app-muted">
              Used for real-time speech-to-text transcription.{' '}
              <a
                href="https://console.deepgram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-app-accent hover:underline"
              >
                Get a key
              </a>
            </p>
          </div>

          <div className="border-t border-app-border/50" />

          {/* LLM Provider */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
              AI Summary Provider
            </label>
            <Select
              value={llmProvider}
              onChange={(e) => {
                const provider = e.target.value;
                const models = getAvailableModels(provider);
                const defaultModel = models[0] || '';
                setLlmProvider(provider);
                setLlmModel(defaultModel);
                setLlmValidation('idle');
                saveAiConfig({ llmProvider: provider, llmModel: defaultModel });
              }}
            >
              {LLM_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {/* LLM API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
              {llmProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
            </label>
            <ApiKeyInput
              value={llmApiKey}
              onChange={(val) => {
                setLlmApiKey(val);
                setLlmValidation('idle');
                saveAiConfig({ llmApiKey: val });
              }}
              onValidate={handleValidateLlm}
              validationState={llmValidation}
              placeholder={`Enter your ${llmProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key`}
            />
            <p className="text-xs text-app-muted">
              Used to generate AI meeting summaries.
            </p>
          </div>

          {/* LLM Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-app-muted uppercase tracking-wide">
              Model
            </label>
            <Select
              value={llmModel}
              onChange={(e) => {
                setLlmModel(e.target.value);
                saveAiConfig({ llmModel: e.target.value });
              }}
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>

          {/* Validation error */}
          {validationError && (
            <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
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
