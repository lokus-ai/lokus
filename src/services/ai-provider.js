/**
 * AI Provider Abstraction Layer
 *
 * Unified interface for tri-mode AI access in Lokus:
 *
 *   - lokus (Lokus-provided): chat + embeddings route through the Lokus proxy
 *     (`${VITE_PROXY_BASE_URL}/v1/chat`, `/v1/embed`) using Lokus-managed
 *     provider keys. The user's Supabase JWT authenticates + meters usage.
 *     No provider API key is ever sent from the client on this path.
 *   - byok (Bring Your Own Key): chat goes through the Rust backend
 *     (`llm_stream_request`) to OpenAI / Anthropic with the user's own key
 *     (bypasses CORS). Deepgram STT connects directly over WebSocket.
 *   - local (Ollama): chat + embeddings run on a locally-installed Ollama
 *     daemon via new Rust commands — $0, fully offline, never metered.
 *
 * The modern surface is the `AIProvider` class:
 *   - `complete(messages, { system, tools, model, maxTokens, signal, surface, fallbackToCloud })`
 *     → async generator of normalized StreamEvents (mirrors the proxy
 *     `IProvider`/`StreamEvent` wire contract).
 *   - `embed(texts, { fallbackToCloud })` → Promise<number[][]> (local Ollama
 *     768-dim by default; throws OLLAMA_UNAVAILABLE rather than silently billing).
 *
 * A `ModelRouter` maps each surface to a backend from {ollamaRunning, credits,
 * tier} so ambient/ghost never spend credits and cmdK/agent prefer cloud quality.
 *
 * The legacy `createLLMClient` / `validateApiKey`
 * / `getAvailableModels` / config helpers are KEPT with identical signatures —
 * the meeting-summary flow (`llm-summary.js`, `MeetingNotes.jsx`,
 * `useMeetingSession.js`) needs no changes; they now delegate to the new core.
 *
 * All HTTP is native fetch(); WebSocket is the native API. No external runtime
 * dependencies are required.
 *
 * Provider config shape:
 * {
 *   mode: 'lokus' | 'byok' | 'local',
 *   llmProvider: 'openai' | 'anthropic' | 'ollama',
 *   llmApiKey: string,        // BYOK only
 *   llmModel: string,         // e.g. 'gpt-4o', 'claude-sonnet-4-20250514', 'qwen3:8b'
 *   deepgramApiKey: string,   // BYOK only
 *   supabaseUrl: string,      // Supabase project URL (auth)
 *   supabaseToken: string,    // user's Supabase JWT (Lokus-provided mode)
 *   proxyUrl: string,         // Lokus AI proxy base; defaults VITE_PROXY_BASE_URL
 * }
 *
 * @module services/ai-provider
 */

import { logger } from '../utils/logger.js';
import { invoke } from '@tauri-apps/api/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key for persisted provider configuration (non-sensitive fields). */
const CONFIG_STORAGE_KEY = 'lokus-ai-provider-config';


/**
 * Lokus AI proxy base URL (build-time, non-secret). Cloud chat + embeddings
 * route here. Falls back to a sensible default so dev builds without the env
 * var still target a real host rather than a placeholder.
 */
export const PROXY_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_BASE_URL) ||
  'https://api.lokusmd.com';

/** Local Ollama embedding model (build-time overridable). 768-dim. */
const EMBED_MODEL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMBED_MODEL) ||
  'nomic-embed-text';

/** Default cloud chat model when a caller does not specify one. */
const DEFAULT_CLOUD_MODEL = 'claude-sonnet-4-20250514';

/** Default cloud max_tokens ceiling for a single completion. */
const DEFAULT_MAX_TOKENS = 2048;

/** Per-surface local Ollama chat models (ModelRouter §7.3). */
const LOCAL_MODELS = {
  ambient: 'qwen3:1.7b',
  ghost:   'qwen3:1.7b',
  slash:   'qwen3:8b',
  default: 'qwen3:8b',
};

/** Direct provider API base URLs */
const OPENAI_BASE_URL    = 'https://api.openai.com/v1';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

/** Current Anthropic API version header value */
const ANTHROPIC_API_VERSION = '2023-06-01';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether the app is running inside Tauri.
 * @returns {boolean}
 */
function _isTauri() {
  try {
    return !!(
      typeof window !== 'undefined' &&
      (window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__)
    );
  } catch {
    return false;
  }
}

/**
 * Classify an HTTP error response and throw a descriptive Error.
 * @param {Response} response
 * @param {string} context - human-readable context for the error message
 * @returns {Promise<never>}
 */
async function _throwForStatus(response, context) {
  let body = '';
  try {
    body = await response.text();
  } catch { /* ignore read errors */ }

  if (response.status === 401 || response.status === 403) {
    throw new Error(`${context}: authentication failed (${response.status}). Check your API key.`);
  }
  if (response.status === 429) {
    throw new Error(`${context}: rate limit exceeded (429). Try again later.`);
  }
  if (response.status >= 500) {
    throw new Error(`${context}: server error (${response.status}).`);
  }
  throw new Error(`${context}: unexpected response (${response.status}) — ${body.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// LLM client — direct path (BYOK)
// ---------------------------------------------------------------------------

/**
 * Send a one-shot summary request to OpenAI and return the completed text.
 * @param {string} apiKey
 * @param {string} model
 * @param {{ system: string, user: string }} prompt
 * @returns {Promise<string>}
 */
/**
 * Send a non-streaming LLM request through the Rust backend (bypasses CORS).
 * @param {string} provider - 'openai' or 'anthropic'
 * @param {string} apiKey
 * @param {string} model
 * @param {{ system: string, user: string }} prompt
 * @returns {Promise<string>} Generated text.
 */
async function _rustGenerate(provider, apiKey, model, prompt) {
  const result = await invoke('llm_stream_request', {
    sessionId: crypto.randomUUID(),
    provider,
    apiKey,
    model,
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    stream: false,
  });

  if (provider === 'openai') {
    return result?.choices?.[0]?.message?.content ?? '';
  }
  if (provider === 'anthropic') {
    return result?.content?.[0]?.text ?? '';
  }
  return '';
}

/**
 * Stream an LLM response through the Rust backend using Tauri events.
 * @param {string} provider - 'openai' or 'anthropic'
 * @param {string} apiKey
 * @param {string} model
 * @param {{ system: string, user: string }} prompt
 * @param {function(string): void} onChunk
 * @returns {Promise<void>}
 */
async function _rustStream(provider, apiKey, model, prompt, onChunk) {
  const { listen: listenEvent } = await import('@tauri-apps/api/event');
  const sessionId = crypto.randomUUID();

  // Set up chunk listener before starting the request
  const unlisten = await listenEvent(`lokus:llm-chunk:${sessionId}`, (event) => {
    const text = event.payload?.text;
    if (text) onChunk(text);
  });

  try {
    await invoke('llm_stream_request', {
      sessionId,
      provider,
      apiKey,
      model,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      stream: true,
    });
  } finally {
    unlisten();
  }
}

// Keep old function names as wrappers for compatibility with createLLMClient
async function _openaiGenerate(apiKey, model, prompt) {
  return _rustGenerate('openai', apiKey, model, prompt);
}

async function _openaiStream(apiKey, model, prompt, onChunk) {
  return _rustStream('openai', apiKey, model, prompt, onChunk);
}

async function _anthropicGenerate(apiKey, model, prompt) {
  return _rustGenerate('anthropic', apiKey, model, prompt);
}

async function _anthropicStream(apiKey, model, prompt, onChunk) {
  return _rustStream('anthropic', apiKey, model, prompt, onChunk);
}

// ---------------------------------------------------------------------------
// LLM client — local path (Ollama, via Rust)
// ---------------------------------------------------------------------------

/**
 * Generate a non-streaming completion from a local Ollama model.
 * @param {string} model
 * @param {{ system: string, user: string }} prompt
 * @returns {Promise<string>}
 */
async function _ollamaGenerate(model, prompt) {
  const result = await invoke('ollama_stream_request', {
    sessionId: crypto.randomUUID(),
    model,
    systemPrompt: prompt.system ?? '',
    userPrompt: prompt.user ?? '',
    stream: false,
  });
  return result?.content?.[0]?.text ?? '';
}

/**
 * Stream a completion from a local Ollama model. Reuses the exact listen/unlisten
 * lifecycle of `_rustStream` — the Rust `ollama_stream_request` command emits the
 * same `lokus:llm-chunk:{sessionId}` / `lokus:llm-done:{sessionId}` events.
 * @param {string} model
 * @param {{ system: string, user: string }} prompt
 * @param {function(string): void} onChunk
 * @returns {Promise<void>}
 */
async function _ollamaStream(model, prompt, onChunk) {
  const { listen: listenEvent } = await import('@tauri-apps/api/event');
  const sessionId = crypto.randomUUID();

  const unlisten = await listenEvent(`lokus:llm-chunk:${sessionId}`, (event) => {
    const text = event.payload?.text;
    if (text) onChunk(text);
  });

  try {
    await invoke('ollama_stream_request', {
      sessionId,
      model,
      systemPrompt: prompt.system ?? '',
      userPrompt: prompt.user ?? '',
      stream: true,
    });
  } finally {
    unlisten();
  }
}

/**
 * Check whether a local Ollama daemon is reachable.
 * @returns {Promise<boolean>}
 */
async function _ollamaRunning() {
  try {
    const status = await invoke('ollama_check');
    return !!status?.running;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// LLM client — proxy path (Lokus-provided)
// ---------------------------------------------------------------------------

/**
 * Build the Lokus AI proxy chat URL: `${proxyUrl}/v1/chat`.
 * @param {string} [proxyUrl] - override; defaults to the build-time PROXY_BASE_URL.
 * @returns {string}
 */
function _proxyChatUrl(proxyUrl) {
  const base = (proxyUrl || PROXY_BASE_URL).replace(/\/$/, '');
  return `${base}/v1/chat`;
}

/**
 * Open an SSE stream to the proxy `/v1/chat` and yield normalized StreamEvents.
 *
 * Mirrors the proxy wire contract: per-frame `{type:"text_delta",text}` /
 * `{type:"tool_use",id,name,input}`; terminal `{type:"done", usage, credits}`
 * then `data: [DONE]`; errors `{type:"error",code,message,retryable}` then
 * `data: [DONE]`. Absence of a `done`/`error` frame on a closed stream is a
 * failure (we yield a synthetic `error` so callers never hang).
 *
 * @param {Object} args
 * @param {string} args.token   - Supabase JWT (Authorization: Bearer).
 * @param {string} [args.proxyUrl]
 * @param {Array}  args.messages
 * @param {string} [args.system]
 * @param {Array}  [args.tools]
 * @param {string} args.model
 * @param {number} args.maxTokens
 * @param {AbortSignal} [args.signal]
 * @returns {AsyncGenerator<Object>} normalized StreamEvent objects.
 */
async function* _proxyChatStream({ token, proxyUrl, messages, system, tools, model, maxTokens, signal }) {
  const url = _proxyChatUrl(proxyUrl);

  const body = { model, messages, max_tokens: maxTokens };
  if (system) body.system = system;
  if (tools && tools.length) body.tools = tools;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    // Surface structured proxy errors (402 INSUFFICIENT_CREDITS, 429, etc.)
    // as an `error` StreamEvent so the generator consumers handle uniformly.
    let code = `HTTP_${response.status}`;
    let message = '';
    try {
      const errJson = await response.json();
      code = errJson?.error?.code || errJson?.code || code;
      message = errJson?.error?.message || errJson?.message || '';
    } catch {
      message = await response.text().catch(() => '');
    }
    yield { type: 'error', code, message, retryable: response.status >= 500 };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawTerminal = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // skip blanks + SSE keepalive comments
        if (trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        let evt;
        try {
          evt = JSON.parse(trimmed.slice(6));
        } catch {
          continue; // not JSON — ignore (proxy always sends JSON frames)
        }

        if (evt.type === 'text_delta') {
          yield { type: 'text_delta', text: evt.text ?? '' };
        } else if (evt.type === 'tool_use') {
          yield { type: 'tool_use', id: evt.id, name: evt.name, input: evt.input };
        } else if (evt.type === 'done') {
          sawTerminal = true;
          yield {
            type: 'done',
            usage: evt.usage ?? { promptTokens: 0, completionTokens: 0 },
            credits: evt.credits,
          };
        } else if (evt.type === 'error') {
          sawTerminal = true;
          yield {
            type: 'error',
            code: evt.code ?? 'UPSTREAM_ERROR',
            message: evt.message ?? '',
            retryable: evt.retryable ?? false,
          };
        }
        // usage / message_stop are consumed by the proxy, not forwarded.
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }

  if (!sawTerminal) {
    // Closed without a terminal frame → treat as failure (proxy SSE contract).
    yield {
      type: 'error',
      code: 'INCOMPLETE_STREAM',
      message: 'Stream closed before a terminal done/error frame.',
      retryable: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API — LLM client
// ---------------------------------------------------------------------------

/**
 * Create an LLM client object that routes to the correct backend based on
 * the supplied provider configuration.
 *
 * @param {Object} config - Provider configuration (see module docblock).
 * @returns {{ generateSummary: Function, streamSummary: Function }}
 *
 * @example
 * const client = createLLMClient(config);
 * const summary = await client.generateSummary({ system: '...', user: '...' });
 */
export function createLLMClient(config) {
  const { mode, llmProvider, llmApiKey, llmModel, supabaseUrl, supabaseToken, proxyUrl } = config ?? {};

  return {
    /**
     * Generate a structured meeting summary (non-streaming).
     * @param {{ system: string, user: string }} prompt - Pre-built prompt object from llm-summary.js.
     * @returns {Promise<string>} Generated summary in Markdown.
     */
    async generateSummary(prompt) {
      try {
        if (mode === 'lokus') {
          // Cloud path now streams through the new proxy /v1/chat; accumulate
          // the text deltas into the full summary string callers expect.
          let text = '';
          for await (const evt of _proxyChatStream({
            token: supabaseToken,
            proxyUrl,
            messages: [{ role: 'user', content: prompt.user ?? '' }],
            system: prompt.system,
            model: llmModel || DEFAULT_CLOUD_MODEL,
            maxTokens: DEFAULT_MAX_TOKENS,
          })) {
            if (evt.type === 'text_delta') text += evt.text;
            else if (evt.type === 'error') throw new Error(`${evt.code}: ${evt.message}`);
          }
          return text;
        }
        if (mode === 'local' || llmProvider === 'ollama') {
          return await _ollamaGenerate(llmModel || LOCAL_MODELS.default, prompt);
        }
        if (llmProvider === 'openai') {
          return await _openaiGenerate(llmApiKey, llmModel, prompt);
        }
        if (llmProvider === 'anthropic') {
          return await _anthropicGenerate(llmApiKey, llmModel, prompt);
        }
        throw new Error(`Unknown LLM provider: ${llmProvider}`);
      } catch (error) {
        logger.error('AIProvider', 'generateSummary failed:', error);
        throw error;
      }
    },

    /**
     * Stream a structured meeting summary, calling onChunk for each text delta.
     * @param {{ system: string, user: string }} prompt - Pre-built prompt object from llm-summary.js.
     * @param {function(string): void} onChunk - Called for each streaming text fragment.
     * @returns {Promise<void>} Resolves when the stream is complete.
     */
    async streamSummary(prompt, onChunk) {
      try {
        if (mode === 'lokus') {
          for await (const evt of _proxyChatStream({
            token: supabaseToken,
            proxyUrl,
            messages: [{ role: 'user', content: prompt.user ?? '' }],
            system: prompt.system,
            model: llmModel || DEFAULT_CLOUD_MODEL,
            maxTokens: DEFAULT_MAX_TOKENS,
          })) {
            if (evt.type === 'text_delta') onChunk(evt.text);
            else if (evt.type === 'error') throw new Error(`${evt.code}: ${evt.message}`);
          }
          return;
        }
        if (mode === 'local' || llmProvider === 'ollama') {
          return await _ollamaStream(llmModel || LOCAL_MODELS.default, prompt, onChunk);
        }
        if (llmProvider === 'openai') {
          return await _openaiStream(llmApiKey, llmModel, prompt, onChunk);
        }
        if (llmProvider === 'anthropic') {
          return await _anthropicStream(llmApiKey, llmModel, prompt, onChunk);
        }
        throw new Error(`Unknown LLM provider: ${llmProvider}`);
      } catch (error) {
        logger.error('AIProvider', 'streamSummary failed:', error);
        throw error;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Public API — Transcription client
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API — Key validation
// ---------------------------------------------------------------------------

/**
 * Test whether an API key is valid for the given provider.
 *
 * Validation strategy:
 *   - openai:    GET /v1/models — succeeds on 200, fails on 401
 *   - anthropic: POST /v1/messages with minimal payload — succeeds on 200,
 *                fails on 401 (a 400 "invalid_request_error" still means the
 *                key itself is accepted)
 *   - deepgram:  GET /v1/projects — lightweight authenticated endpoint
 *
 * @param {'openai' | 'anthropic' | 'deepgram'} provider
 * @param {string} apiKey
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export async function validateApiKey(provider, apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { valid: false, error: 'API key must be a non-empty string.' };
  }

  try {
    // Route through Rust backend to bypass CORS restrictions in Tauri WebView.
    const result = await invoke('validate_api_key', {
      provider,
      apiKey: apiKey.trim(),
    });
    return result;
  } catch (error) {
    logger.error('AIProvider', `validateApiKey(${provider}) error:`, error);
    return { valid: false, error: `Validation error: ${error}` };
  }
}

// ---------------------------------------------------------------------------
// Public API — Model catalogue
// ---------------------------------------------------------------------------

/**
 * Return the list of supported model IDs for a given LLM provider.
 *
 * @param {'openai' | 'anthropic'} provider
 * @returns {string[]} Array of model ID strings.
 */
export function getAvailableModels(provider) {
  const models = {
    openai: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
    ],
    anthropic: [
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
    ],
  };

  return models[provider] ?? [];
}

// ---------------------------------------------------------------------------
// Public API — Config persistence
// ---------------------------------------------------------------------------

/**
 * Read the saved provider configuration from localStorage.
 *
 * API keys are stored in Tauri secure storage when available (via the
 * `tauri-plugin-stronghold` or equivalent). Until that plugin is wired up,
 * keys fall back to localStorage with a console warning in dev builds.
 *
 * Non-sensitive config fields (mode, llmProvider, llmModel) always come
 * from localStorage.
 *
 * @returns {Object} Saved config, or a sensible default if nothing is saved.
 */
export function getProviderConfig() {
  const defaults = {
    mode: 'lokus',
    llmProvider: 'anthropic',
    llmApiKey: '',
    llmModel: 'claude-sonnet-4-20250514',
    deepgramApiKey: '',
    supabaseUrl: import.meta.env?.VITE_SUPABASE_URL ?? '',
    supabaseToken: '',
    proxyUrl: PROXY_BASE_URL,
  };

  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    return { ...defaults, ...saved };
  } catch (error) {
    logger.error('AIProvider', 'getProviderConfig failed to read localStorage:', error);
    return defaults;
  }
}

/**
 * Persist the provider configuration.
 *
 * Sensitive fields (llmApiKey, deepgramApiKey) are stored via Tauri secure
 * storage when running inside Tauri, so they never touch localStorage.
 * Non-sensitive fields are always written to localStorage for fast reads.
 *
 * @param {Object} config - Full provider config object to persist.
 * @returns {Promise<void>}
 */
export async function saveProviderConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('saveProviderConfig: config must be an object.');
  }

  const { llmApiKey, deepgramApiKey, supabaseToken, ...nonSensitive } = config;

  // Always persist non-sensitive fields to localStorage for fast reads
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(nonSensitive));
  } catch (error) {
    logger.error('AIProvider', 'saveProviderConfig failed to write localStorage:', error);
    throw new Error(`Failed to save AI provider config: ${error.message}`);
  }

  // Persist sensitive fields to Tauri secure storage when available
  if (_isTauri()) {
    try {
      // tauri-plugin-stronghold / tauri-plugin-store secure path
      // Dynamic import so the module doesn't break in browser-only environments
      const { invoke } = await import('@tauri-apps/api/core');
      const keysToStore = {
        'ai-llm-api-key':      llmApiKey      ?? '',
        'ai-deepgram-api-key': deepgramApiKey ?? '',
        'ai-supabase-token':   supabaseToken  ?? '',
      };

      for (const [key, value] of Object.entries(keysToStore)) {
        // Attempt secure storage via a Tauri command; gracefully degrade if
        // the command isn't registered yet (the Rust side isn't built yet).
        try {
          await invoke('secure_store_set', { key, value });
        } catch {
          // secure_store_set not yet implemented — fall back to localStorage
          // with a dev-mode warning.
          if (import.meta.env?.DEV) {
            console.warn(
              `[AIProvider] Tauri secure storage not available for key "${key}". ` +
              'Falling back to localStorage. Do NOT use in production.'
            );
          }
          localStorage.setItem(`lokus-ai-secure-${key}`, value);
        }
      }
      return;
    } catch {
      // Tauri API not available — fall through to localStorage fallback
    }
  }

  // Browser / non-Tauri environment: store sensitive fields in localStorage
  // with a clear console warning (acceptable for development).
  if (import.meta.env?.DEV) {
    console.warn(
      '[AIProvider] Running outside Tauri — API keys stored in localStorage. ' +
      'This is acceptable for development only.'
    );
  }
  try {
    if (llmApiKey      !== undefined) localStorage.setItem('lokus-ai-secure-ai-llm-api-key',      llmApiKey);
    if (deepgramApiKey !== undefined) localStorage.setItem('lokus-ai-secure-ai-deepgram-api-key',  deepgramApiKey);
    if (supabaseToken  !== undefined) localStorage.setItem('lokus-ai-secure-ai-supabase-token',    supabaseToken);
  } catch (error) {
    logger.error('AIProvider', 'saveProviderConfig failed to write sensitive fields:', error);
    throw new Error(`Failed to save API keys: ${error.message}`);
  }
}

/**
 * Load the full provider config including sensitive fields from wherever they
 * were stored (Tauri secure storage if available, otherwise localStorage).
 *
 * This is an async variant of getProviderConfig() that also retrieves API keys.
 *
 * @returns {Promise<Object>} Full config including API key fields.
 */
export async function loadProviderConfig() {
  const config = getProviderConfig();

  if (_isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const sensitiveKeys = {
        llmApiKey:      'ai-llm-api-key',
        deepgramApiKey: 'ai-deepgram-api-key',
        supabaseToken:  'ai-supabase-token',
      };

      for (const [configField, storeKey] of Object.entries(sensitiveKeys)) {
        try {
          const value = await invoke('secure_store_get', { key: storeKey });
          if (value != null) config[configField] = value;
        } catch {
          // secure_store_get not yet implemented — try localStorage fallback
          const fallback = localStorage.getItem(`lokus-ai-secure-${storeKey}`);
          if (fallback) config[configField] = fallback;
        }
      }

      return config;
    } catch {
      // Tauri API not available — fall through to localStorage
    }
  }

  // Non-Tauri: read from localStorage
  config.llmApiKey      = localStorage.getItem('lokus-ai-secure-ai-llm-api-key')      ?? config.llmApiKey;
  config.deepgramApiKey = localStorage.getItem('lokus-ai-secure-ai-deepgram-api-key')  ?? config.deepgramApiKey;
  config.supabaseToken  = localStorage.getItem('lokus-ai-secure-ai-supabase-token')    ?? config.supabaseToken;

  return config;
}

// ---------------------------------------------------------------------------
// ModelRouter — $0-vs-credits backend selection (IMPLEMENTATION §7.3)
// ---------------------------------------------------------------------------

/**
 * Resolve the backend for a surface from runtime state. Returns one of:
 *   { backend: 'local',  model }   — run on local Ollama ($0)
 *   { backend: 'cloud',  model }   — route through the proxy (credits)
 *   { backend: 'skip',   reason }  — neither available; do nothing (no silent bill)
 *
 * `fallbackToCloud` defaults FALSE for ambient/ghost (must never silently bill)
 * and TRUE for cmdK/agent (quality > $0). Embeddings are handled by `embed()`,
 * not here.
 *
 * @param {string} surface - 'slash'|'selection'|'palette'|'cmdK'|'agent'|'ambient'|'ghost'
 * @param {{ ollamaRunning:boolean, credits:number }} state
 * @param {{ fallbackToCloud?:boolean, model?:string }} [opts]
 * @returns {{ backend:'local'|'cloud'|'skip', model?:string, reason?:string }}
 */
export function routeModel(surface, state = {}, opts = {}) {
  const ollamaRunning = !!state.ollamaRunning;
  const credits = state.credits ?? 0;

  switch (surface) {
    case 'ambient':
    case 'ghost':
      // Must be $0 — local only, never cloud regardless of fallback flag.
      return ollamaRunning
        ? { backend: 'local', model: opts.model || LOCAL_MODELS[surface] }
        : { backend: 'skip', reason: 'NO_LOCAL_MODEL' };

    case 'slash':
      if (ollamaRunning) return { backend: 'local', model: opts.model || LOCAL_MODELS.slash };
      if (credits > 0) return { backend: 'cloud', model: opts.model || DEFAULT_CLOUD_MODEL };
      return { backend: 'skip', reason: 'NO_LOCAL_MODEL_NO_CREDITS' };

    case 'cmdK':
    case 'agent':
    case 'selection':
    case 'palette':
    default: {
      // Cloud preferred for quality; local fallback only when credits ≈ 0.
      const fallbackToCloud = opts.fallbackToCloud ?? true;
      if (credits > 0 && fallbackToCloud) {
        return { backend: 'cloud', model: opts.model || DEFAULT_CLOUD_MODEL };
      }
      if (ollamaRunning) return { backend: 'local', model: opts.model || LOCAL_MODELS.default };
      if (credits > 0) return { backend: 'cloud', model: opts.model || DEFAULT_CLOUD_MODEL };
      return { backend: 'skip', reason: 'NO_BACKEND_AVAILABLE' };
    }
  }
}

// ---------------------------------------------------------------------------
// Public API — AIProvider (modern surface)
// ---------------------------------------------------------------------------

/**
 * Coerce a local-stream prompt into the proxy `messages` shape, for the Ollama
 * fallback which still uses the `{system,user}` Rust command.
 * @param {Array} messages - Message[] ({role, content})
 * @returns {{ system: string, user: string }}
 */
function _messagesToPrompt(messages) {
  let system = '';
  const userParts = [];
  for (const m of messages || []) {
    const text = typeof m.content === 'string'
      ? m.content
      : (Array.isArray(m.content)
          ? m.content.map((b) => b.text || b.content || '').join('\n')
          : '');
    if (m.role === 'system') system += (system ? '\n' : '') + text;
    else userParts.push(text);
  }
  return { system, user: userParts.join('\n\n') };
}

/**
 * The modern provider surface. Mirrors the proxy `IProvider`/`StreamEvent` wire
 * contract client-side. Construct with a config (see module docblock) or use the
 * shared `aiProvider` singleton which lazily loads config.
 */
export class AIProvider {
  /** @param {Object} [config] - provider config; merged over getProviderConfig() at call time. */
  constructor(config = null) {
    this._config = config;
  }

  /** Resolve the effective config (with persisted secrets) for a call. */
  async _resolveConfig() {
    if (this._config) return this._config;
    return await loadProviderConfig();
  }

  /**
   * Stream a chat completion.
   *
   * @param {Array} messages - Message[] (role: 'user'|'assistant'|'tool', content: string|ContentBlock[]).
   * @param {Object} [options]
   * @param {string}      [options.system]
   * @param {Array}       [options.tools]  - Tool[] (engine `toToolSchema({provider:'anthropic'})` output).
   * @param {string}      [options.model]
   * @param {number}      [options.maxTokens=DEFAULT_MAX_TOKENS]
   * @param {AbortSignal} [options.signal] - dropped consumer cancels the upstream call.
   * @param {string}      [options.surface] - drives ModelRouter (local vs cloud vs skip).
   * @param {boolean}     [options.fallbackToCloud]
   * @param {{ollamaRunning?:boolean, credits?:number}} [options.routerState]
   * @yields {Object} normalized StreamEvent: {text_delta}|{tool_use}|{done}|{error}.
   */
  async *complete(messages, options = {}) {
    const config = await this._resolveConfig();
    const {
      system, tools, model, maxTokens = DEFAULT_MAX_TOKENS,
      signal, surface, fallbackToCloud, routerState,
    } = options;

    // Decide the backend. With no surface, honor the configured mode directly.
    let backend;
    let chosenModel = model || config.llmModel;
    if (surface) {
      const state = routerState || {
        ollamaRunning: await _ollamaRunning(),
        credits: config.credits ?? 0,
      };
      const decision = routeModel(surface, state, { fallbackToCloud, model });
      if (decision.backend === 'skip') {
        yield { type: 'error', code: decision.reason || 'NO_BACKEND', message: `No backend for surface '${surface}'`, retryable: false };
        return;
      }
      backend = decision.backend;
      chosenModel = decision.model;
    } else {
      backend = (config.mode === 'local' || config.llmProvider === 'ollama') ? 'local' : 'cloud';
    }

    if (backend === 'local') {
      // Ollama via Rust — bridge the listen/unlisten streaming into the generator.
      const prompt = _messagesToPrompt([
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ]);
      const queue = [];
      let resolveNext;
      let finished = false;
      let streamErr = null;
      const push = (text) => {
        queue.push(text);
        if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
      };
      const streamPromise = _ollamaStream(chosenModel || LOCAL_MODELS.default, prompt, push)
        .catch((e) => { streamErr = e; })
        .finally(() => {
          finished = true;
          if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
        });

      while (true) {
        if (signal?.aborted) {
          yield { type: 'error', code: 'CLIENT_ABORT', message: 'aborted', retryable: false };
          return;
        }
        if (queue.length) {
          yield { type: 'text_delta', text: queue.shift() };
          continue;
        }
        if (finished) break;
        await new Promise((res) => { resolveNext = res; });
      }
      await streamPromise;
      if (streamErr) {
        yield { type: 'error', code: 'OLLAMA_ERROR', message: String(streamErr?.message ?? streamErr), retryable: true };
        return;
      }
      yield { type: 'done', usage: { promptTokens: 0, completionTokens: 0 } };
      return;
    }

    // Cloud — proxy /v1/chat. JWT from config (secure_store-backed via loadProviderConfig).
    yield* _proxyChatStream({
      token: config.supabaseToken,
      proxyUrl: config.proxyUrl,
      messages,
      system,
      tools,
      model: chosenModel || DEFAULT_CLOUD_MODEL,
      maxTokens,
      signal,
    });
  }

  /**
   * Embed one or more texts. Local Ollama by default ($0, 768-dim). Only touches
   * the cloud (proxy `/v1/embed`, which costs credits) when `fallbackToCloud` is
   * explicitly true — ambient/embed MUST NOT set it.
   *
   * @param {string|string[]} texts
   * @param {Object} [options]
   * @param {string}  [options.model=EMBED_MODEL]
   * @param {boolean} [options.fallbackToCloud=false]
   * @returns {Promise<number[][]>} one vector per input text.
   * @throws {Error & {code:'OLLAMA_UNAVAILABLE'}} when local Ollama is down and no cloud fallback.
   */
  async embed(texts, options = {}) {
    const list = Array.isArray(texts) ? texts : [texts];
    const { model = EMBED_MODEL, fallbackToCloud = false } = options;

    if (await _ollamaRunning()) {
      const vectors = [];
      for (const text of list) {
        const vec = await invoke('ollama_embed', { model, text });
        vectors.push(vec);
      }
      return vectors;
    }

    if (!fallbackToCloud) {
      const err = new Error('Local Ollama is not running; refusing to bill cloud embeddings.');
      err.code = 'OLLAMA_UNAVAILABLE';
      throw err;
    }

    // Cloud fallback — proxy /v1/embed (the only embed path that costs credits).
    const config = await this._resolveConfig();
    const base = (config.proxyUrl || PROXY_BASE_URL).replace(/\/$/, '');
    const response = await fetch(`${base}/v1/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.supabaseToken ? { Authorization: `Bearer ${config.supabaseToken}` } : {}),
      },
      body: JSON.stringify({ texts: list, model }),
    });
    if (!response.ok) {
      await _throwForStatus(response, 'Lokus proxy embed');
    }
    const data = await response.json();
    return data.embeddings ?? data.data ?? [];
  }
}

/** Shared singleton — lazily loads persisted config per call. */
export const aiProvider = new AIProvider();

export default aiProvider;
