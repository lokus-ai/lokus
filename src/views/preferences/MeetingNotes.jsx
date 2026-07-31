import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as P from './primitives.jsx';
import {
  loadProviderConfig,
  saveProviderConfig,
  validateApiKey,
  getAvailableModels,
} from '../../services/ai-provider.js';

/**
 * Props: none. All state lives here — provider config comes from
 * `services/ai-provider.js`, meeting settings from localStorage.
 */

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
  { id: 'sales', label: 'Sales call' },
  { id: '1on1', label: '1:1' },
  { id: 'standup', label: 'Standup' },
];

const PROVIDER_NAMES = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

// ---------------------------------------------------------------------------
// API key field — masked by default, revealed only on request
// ---------------------------------------------------------------------------

const TEST_IDLE = 'idle';
const TEST_LOADING = 'loading';
const TEST_OK = 'ok';
const TEST_FAIL = 'fail';

/**
 * The value is a credential, so it renders as a password field in mono and is
 * only ever shown in the clear when the person explicitly asks for it.
 */
function ApiKeyField({ id, placeholder, value, onChange, onTest, testState, testError }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <P.TextField
          id={id}
          mono
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0"
        />
        <P.Button tone="ghost" onClick={() => setVisible((v) => !v)}>
          {visible ? 'Hide' : 'Show'}
        </P.Button>
        <P.Button onClick={onTest} disabled={!value || testState === TEST_LOADING}>
          {testState === TEST_LOADING ? 'Checking…' : 'Check'}
        </P.Button>
      </div>

      {testState === TEST_OK && <P.Note tone="success">The key works.</P.Note>}
      {testState === TEST_FAIL && testError && <P.Note tone="danger">{testError}</P.Note>}
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

  const modeId = P.useFieldId('meeting-mode');
  const deepgramId = P.useFieldId('meeting-deepgram');
  const llmProviderId = P.useFieldId('meeting-llm-provider');
  const llmKeyId = P.useFieldId('meeting-llm-key');
  const llmModelId = P.useFieldId('meeting-llm-model');
  const deviceId = P.useFieldId('meeting-device');
  const templateId = P.useFieldId('meeting-template');

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
          setDevicesError('Could not read the list of audio devices.');
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
      if (!result.valid) setDeepgramTestError(result.error ?? 'Deepgram rejected that key. Check it and try again.');
    } catch (err) {
      setDeepgramTestState(TEST_FAIL);
      setDeepgramTestError(err.message ?? 'The check could not reach Deepgram. Try again.');
    }
  }, [providerConfig.deepgramApiKey]);

  const handleTestLlm = useCallback(async () => {
    setLlmTestState(TEST_LOADING);
    setLlmTestError('');
    try {
      const result = await validateApiKey(providerConfig.llmProvider, providerConfig.llmApiKey);
      setLlmTestState(result.valid ? TEST_OK : TEST_FAIL);
      if (!result.valid) setLlmTestError(result.error ?? 'The provider rejected that key. Check it and try again.');
    } catch (err) {
      setLlmTestState(TEST_FAIL);
      setLlmTestError(err.message ?? 'The check could not reach the provider. Try again.');
    }
  }, [providerConfig.llmProvider, providerConfig.llmApiKey]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const isBYOK = providerConfig.mode === 'byok';
  const availableModels = getAvailableModels(providerConfig.llmProvider);
  const llmProviderName = PROVIDER_NAMES[providerConfig.llmProvider] ?? providerConfig.llmProvider;

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

  const lede = 'Lokus listens to a call, transcribes it, and writes the summary into your notes.';

  if (configLoading) {
    return (
      <P.Page title="Meeting notes" lede={lede}>
        <P.Empty>Loading your settings…</P.Empty>
      </P.Page>
    );
  }

  return (
    <P.Page title="Meeting notes" lede={lede}>
      {/* ------------------------------------------------------------------ */}
      {/* Provider                                                            */}
      {/* ------------------------------------------------------------------ */}
      <P.Group label="Provider">
        <P.Row
          label="Who runs the AI"
          hint="Lokus AI is a managed service. Your own keys bill straight to your Deepgram and model accounts."
          htmlFor={modeId}
        >
          <P.Select
            id={modeId}
            value={isBYOK ? 'byok' : 'lokus'}
            onChange={handleModeChange}
          >
            <option value="lokus">Lokus AI</option>
            <option value="byok">Your own keys</option>
          </P.Select>
        </P.Row>

        {!isBYOK && (
          <P.Note>
            Lokus AI is not open yet. Switch to your own keys to record meetings today.
          </P.Note>
        )}
      </P.Group>

      {/* ------------------------------------------------------------------ */}
      {/* Keys — BYOK only                                                    */}
      {/* ------------------------------------------------------------------ */}
      {isBYOK && (
        <P.Group
          label="Keys"
          hint="Keys are held in this machine's secure store, never in a note or a sync payload."
        >
          <P.Row
            stacked
            label="Deepgram key"
            hint="Turns the call audio into a transcript."
            htmlFor={deepgramId}
          >
            <ApiKeyField
              id={deepgramId}
              placeholder="dg_…"
              value={providerConfig.deepgramApiKey}
              onChange={(v) => {
                setDeepgramTestState(TEST_IDLE);
                setDeepgramTestError('');
                updateProviderConfig({ deepgramApiKey: v }, true);
              }}
              onTest={handleTestDeepgram}
              testState={deepgramTestState}
              testError={deepgramTestError}
            />
          </P.Row>

          <P.Row label="Model provider" hint="Writes the summary from the transcript." htmlFor={llmProviderId}>
            <P.Select
              id={llmProviderId}
              value={providerConfig.llmProvider}
              onChange={handleLlmProviderChange}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </P.Select>
          </P.Row>

          <P.Row stacked label={`${llmProviderName} key`} htmlFor={llmKeyId}>
            <ApiKeyField
              id={llmKeyId}
              placeholder={providerConfig.llmProvider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
              value={providerConfig.llmApiKey}
              onChange={(v) => {
                setLlmTestState(TEST_IDLE);
                setLlmTestError('');
                updateProviderConfig({ llmApiKey: v }, true);
              }}
              onTest={handleTestLlm}
              testState={llmTestState}
              testError={llmTestError}
            />
          </P.Row>

          {availableModels.length > 0 && (
            <P.Row label="Model" htmlFor={llmModelId}>
              <P.Select
                id={llmModelId}
                value={providerConfig.llmModel}
                onChange={(v) => updateProviderConfig({ llmModel: v })}
                className="font-mono text-[12px]"
              >
                {availableModels.map((model) => {
                  const id = typeof model === 'string' ? model : model.id;
                  const name = typeof model === 'string' ? model : (model.name ?? model.id);
                  return (
                    <option key={id} value={id}>{name}</option>
                  );
                })}
              </P.Select>
            </P.Row>
          )}
        </P.Group>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Microphone                                                          */}
      {/* ------------------------------------------------------------------ */}
      <P.Group label="Microphone">
        {devicesLoading ? (
          <P.Empty>Looking for input devices…</P.Empty>
        ) : devicesError ? (
          <P.Note tone="danger">{devicesError} Reopen settings to look again.</P.Note>
        ) : audioDevices.length === 0 ? (
          <P.Empty>No input devices are connected. Plug a microphone in and reopen settings.</P.Empty>
        ) : (
          <P.Row label="Input device" htmlFor={deviceId}>
            <P.Select
              id={deviceId}
              value={meetingSettings.selectedDeviceId}
              onChange={(v) => updateMeetingSettings({ selectedDeviceId: v })}
            >
              {audioDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                  {device.is_default ? ' (default)' : ''}
                </option>
              ))}
            </P.Select>
          </P.Row>
        )}
      </P.Group>

      {/* ------------------------------------------------------------------ */}
      {/* Detection                                                           */}
      {/* ------------------------------------------------------------------ */}
      <P.Group label="When to start">
        <P.Row label="At the start of a calendar event">
          <P.Toggle
            label="Start recording at the start of a calendar event"
            checked={meetingSettings.autoDetectCalendar}
            onChange={(next) => updateMeetingSettings({ autoDetectCalendar: next })}
          />
        </P.Row>

        <P.Row
          label="When the microphone picks up a call"
          hint="Offers to take notes after sustained speech, with nothing on the calendar."
        >
          <P.Toggle
            label="Offer to record when the microphone picks up a call"
            checked={meetingSettings.detectAdHocCalls}
            onChange={(next) => updateMeetingSettings({ detectAdHocCalls: next })}
          />
        </P.Row>
      </P.Group>

      {/* ------------------------------------------------------------------ */}
      {/* Summary                                                             */}
      {/* ------------------------------------------------------------------ */}
      <P.Group label="Summary">
        <P.Row
          label="Append to today's daily note"
          hint="Otherwise the summary stays with the meeting and you place it yourself."
        >
          <P.Toggle
            label="Append the summary to today's daily note"
            checked={meetingSettings.autoInsertSummary}
            onChange={(next) => updateMeetingSettings({ autoInsertSummary: next })}
          />
        </P.Row>

        <P.Row label="Shape" hint="Decides the headings the summary is written into." htmlFor={templateId}>
          <P.Select
            id={templateId}
            value={meetingSettings.summaryTemplate}
            onChange={(v) => updateMeetingSettings({ summaryTemplate: v })}
          >
            {SUMMARY_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </P.Select>
        </P.Row>
      </P.Group>
    </P.Page>
  );
}
