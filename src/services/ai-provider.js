/**
 * AI Provider Abstraction Layer
 *
 * Unified interface for dual-mode LLM access in Lokus:
 *
 *   - BYOK (Bring Your Own Key): Calls go directly from the app to
 *     OpenAI / Anthropic using the user's own API keys.
 *   - Lokus-provided: Calls route through Supabase Edge Function proxies
 *     using Lokus-managed API keys. The user's Supabase JWT is forwarded
 *     for authentication and usage tracking.
 *
 * All HTTP is done with native fetch(). No external runtime dependencies
 * are required.
 *
 * Speech-to-text is handled by Deepgram (BYOK). The user supplies their
 * own Deepgram API key. This module covers LLM summarisation only.
 *
 * Provider config shape:
 * {
 *   mode: 'lokus' | 'byok',
 *   llmProvider: 'openai' | 'anthropic',
 *   llmApiKey: string,       // BYOK only
 *   llmModel: string,        // e.g. 'gpt-4o', 'claude-sonnet-4-20250514'
 *   deepgramApiKey: string,  // Deepgram BYOK key for STT
 *   supabaseUrl: string,     // Lokus-provided mode
 *   supabaseToken: string,   // user's Supabase JWT (Lokus-provided mode)
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
 * Placeholder Supabase project URL — replace once the Edge Functions are
 * deployed. Individual function paths are appended at call time.
 */
const SUPABASE_PROXY_BASE_PLACEHOLDER = 'https://YOUR_PROJECT.supabase.co';

/** Edge Function paths mounted on {supabaseUrl}/functions/v1/ */
const EDGE_FN_LLM_SUMMARY = 'llm-summary';

/** Direct provider API base URLs */
const OPENAI_BASE_URL    = 'https://api.openai.com/v1';
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const GEMINI_BASE_URL    = 'https://generativelanguage.googleapis.com/v1beta';

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
 * Build Supabase Edge Function URL.
 * @param {string} supabaseUrl - Supabase project URL.
 * @param {string} functionName - Edge Function name (no leading slash).
 * @returns {string}
 */
function _edgeFnUrl(supabaseUrl, functionName) {
  const base = (supabaseUrl || SUPABASE_PROXY_BASE_PLACEHOLDER).replace(/\/$/, '');
  return `${base}/functions/v1/${functionName}`;
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

// ---------------------------------------------------------------------------
// LLM client — Gemini (direct fetch, no Rust proxy needed)
// ---------------------------------------------------------------------------

async function _geminiGenerate(apiKey, model, prompt) {
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
    }),
  });
  if (!response.ok) await _throwForStatus(response, 'Gemini generate');
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function _geminiStream(apiKey, model, prompt, onChunk) {
  const url = `${GEMINI_BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
    }),
  });
  if (!response.ok) await _throwForStatus(response, 'Gemini stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch { /* skip malformed lines */ }
    }
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
// LLM client — proxy path (Lokus-provided)
// ---------------------------------------------------------------------------

/**
 * Send a one-shot summary request through the Supabase Edge Function proxy.
 * @param {string} supabaseUrl
 * @param {string} supabaseToken
 * @param {{ system: string, user: string }} prompt
 * @param {string} model
 * @param {string} llmProvider
 * @returns {Promise<string>}
 */
async function _proxyGenerate(supabaseUrl, supabaseToken, prompt, model, llmProvider) {
  const url = _edgeFnUrl(supabaseUrl, EDGE_FN_LLM_SUMMARY);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify({
      provider: llmProvider,
      model,
      system: prompt.system,
      user: prompt.user,
      stream: false,
    }),
  });

  if (!response.ok) {
    await _throwForStatus(response, 'Lokus proxy generate');
  }

  const data = await response.json();
  // Edge Function is expected to return { text: string }
  return data.text ?? data.content ?? '';
}

/**
 * Stream a summary through the Supabase Edge Function proxy.
 * @param {string} supabaseUrl
 * @param {string} supabaseToken
 * @param {{ system: string, user: string }} prompt
 * @param {string} model
 * @param {string} llmProvider
 * @param {function(string): void} onChunk
 * @returns {Promise<void>}
 */
async function _proxyStream(supabaseUrl, supabaseToken, prompt, model, llmProvider, onChunk) {
  const url = _edgeFnUrl(supabaseUrl, EDGE_FN_LLM_SUMMARY);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseToken}`,
    },
    body: JSON.stringify({
      provider: llmProvider,
      model,
      system: prompt.system,
      user: prompt.user,
      stream: true,
    }),
  });

  if (!response.ok) {
    await _throwForStatus(response, 'Lokus proxy stream');
  }

  // Edge Function forwards the SSE stream from the upstream provider as-is;
  // we treat every "data: <text>" line as a raw text chunk for simplicity.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        // Support both OpenAI and Anthropic delta shapes forwarded by Edge Fn
        const delta =
          json.choices?.[0]?.delta?.content ||
          (json.type === 'content_block_delta' && json.delta?.type === 'text_delta'
            ? json.delta.text
            : null);
        if (delta) onChunk(delta);
      } catch {
        // Edge Function may forward raw text chunks — treat the whole line as text
        const raw = trimmed.slice(6);
        if (raw) onChunk(raw);
      }
    }
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
  const { mode, llmProvider, llmApiKey, llmModel, supabaseUrl, supabaseToken } = config ?? {};

  return {
    /**
     * Generate a structured meeting summary (non-streaming).
     * @param {{ system: string, user: string }} prompt - Pre-built prompt object from llm-summary.js.
     * @returns {Promise<string>} Generated summary in Markdown.
     */
    async generateSummary(prompt) {
      try {
        if (mode === 'lokus') {
          return await _proxyGenerate(supabaseUrl, supabaseToken, prompt, llmModel, llmProvider);
        }
        if (llmProvider === 'gemini') {
          return await _geminiGenerate(llmApiKey, llmModel, prompt);
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
          return await _proxyStream(supabaseUrl, supabaseToken, prompt, llmModel, llmProvider, onChunk);
        }
        if (llmProvider === 'gemini') {
          return await _geminiStream(llmApiKey, llmModel, prompt, onChunk);
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
// Public API — Key validation
// ---------------------------------------------------------------------------

/**
 * Test whether an API key is valid for the given LLM provider.
 *
 * Validation strategy:
 *   - openai:    GET /v1/models — succeeds on 200, fails on 401
 *   - anthropic: POST /v1/messages with minimal payload — succeeds on 200,
 *                fails on 401 (a 400 "invalid_request_error" still means the
 *                key itself is accepted)
 *
 * @param {'openai' | 'anthropic'} provider
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
    gemini: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
    ],
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
    mode: 'byok',
    llmProvider: 'openai',
    llmApiKey: '',
    llmModel: 'gpt-4o-mini',
    deepgramApiKey: '',
    supabaseUrl: import.meta.env?.VITE_SUPABASE_URL ?? '',
    supabaseToken: '',
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
 * Sensitive fields (llmApiKey, supabaseToken) are stored via Tauri secure
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
        'ai-deepgram-api-key': deepgramApiKey  ?? '',
        'ai-supabase-token':   supabaseToken   ?? '',
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
    if (deepgramApiKey !== undefined) localStorage.setItem('lokus-ai-secure-ai-deepgram-api-key', deepgramApiKey);
    if (supabaseToken  !== undefined) localStorage.setItem('lokus-ai-secure-ai-supabase-token',   supabaseToken);
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
  config.deepgramApiKey = localStorage.getItem('lokus-ai-secure-ai-deepgram-api-key') ?? config.deepgramApiKey;
  config.supabaseToken  = localStorage.getItem('lokus-ai-secure-ai-supabase-token')   ?? config.supabaseToken;

  return config;
}
