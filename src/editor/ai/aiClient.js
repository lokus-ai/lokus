/**
 * aiClient — thin surfaces-side adapter over the providers `aiProvider` contract.
 *
 * The providers stream owns `src/services/ai-provider.js` and publishes (board
 * `### providers`, FROZEN):
 *
 *   aiProvider.complete(messages, options) → async generator of StreamEvent
 *     messages : Message[]   ({ role, content: string | ContentBlock[] })
 *     options  : { system?, tools?: Tool[], model?, maxTokens?, signal?,
 *                  surface?, fallbackToCloud? }
 *     yields   : { type:'text_delta', text }
 *              | { type:'tool_use',   id, name, input }
 *              | { type:'done',  usage, credits? }
 *              | { type:'error', code, message, retryable }
 *     Terminal frame is ALWAYS exactly one 'done' OR one 'error'. Absence of
 *     'done' on a closed stream = failure.
 *
 * This module does NOT import ai-provider.js statically: providers may still be
 * landing the `aiProvider` export, and the surfaces must compile/test without it.
 * We resolve it lazily (dynamic import) and, if the real provider isn't present
 * yet, throw a typed PROVIDER_UNAVAILABLE error that the UI renders gracefully.
 * Swapping to the real export is automatic once ai-provider.js exports it — no
 * code change here.
 *
 * The adapter adds the surface-level helpers the editor surfaces need on top of
 * the raw generator:
 *   - streamText(...)   collect text deltas into a string (Cmd-K single-shot,
 *                       selection transforms, ghost text)
 *   - runToolLoop(...)  the CLIENT-SIDE ReAct loop (PRD §6.3): complete →
 *                       tool_use → execute locally via actionRegistry →
 *                       tool_result → re-complete, ≤ maxSteps.
 *
 * See LOKUS_AI_PRD.md §6 (agent loop) / §8.4 (provider) and board `### providers`.
 */

/** Typed error so surfaces can distinguish "no provider yet" from real failures. */
export class AIClientError extends Error {
  constructor(code, message, { retryable = false } = {}) {
    super(message ?? code);
    this.name = 'AIClientError';
    this.code = code;
    this.retryable = retryable;
  }
}

// Cached provider singleton once resolved.
let _provider;

/**
 * Allow tests (and a future explicit wiring) to inject a provider implementing
 * `complete(messages, options)`. Pass null to reset.
 * @param {{ complete: Function, embed?: Function }|null} provider
 */
export function setProvider(provider) {
  _provider = provider ?? undefined;
}

/**
 * Resolve the providers `aiProvider` singleton lazily. Returns the injected
 * provider if set; otherwise dynamically imports ai-provider.js. Throws
 * AIClientError('PROVIDER_UNAVAILABLE') if neither yields a `complete`.
 * @returns {Promise<{ complete: Function, embed?: Function }>}
 */
export async function getProvider() {
  if (_provider?.complete) return _provider;
  try {
    const mod = await import('../../services/ai-provider.js');
    const provider = mod.aiProvider ?? mod.default;
    if (provider?.complete) {
      _provider = provider;
      return _provider;
    }
  } catch {
    // ai-provider.js missing the export / not yet landed.
  }
  throw new AIClientError(
    'PROVIDER_UNAVAILABLE',
    'AI provider is not available yet (ai-provider.js has not published complete()).',
    { retryable: true },
  );
}

/**
 * Normalize a caller's prompt into the Message[] shape. Accepts a plain string
 * (→ single user message) or an already-built Message[].
 * @param {string|Array} input
 * @returns {Array}
 */
function toMessages(input) {
  if (typeof input === 'string') return [{ role: 'user', content: input }];
  if (Array.isArray(input)) return input;
  throw new AIClientError('BAD_REQUEST', 'aiClient: expected a string or Message[]');
}

/**
 * Run one `complete()` turn and return its terminal outcome + collected text +
 * any tool_use blocks. Centralizes the "absence of done = failure" rule and
 * the error-frame handling so every surface treats the stream identically.
 *
 * @param {Array} messages
 * @param {object} options - { system, tools, model, maxTokens, signal, surface, fallbackToCloud }
 * @param {(delta: string, full: string) => void} [onDelta] - streaming text callback
 * @returns {Promise<{ text: string, toolUses: Array, usage: any, credits: any }>}
 * @throws {AIClientError} on error frame, missing terminal done, or abort.
 */
export async function completeTurn(messages, options = {}, onDelta) {
  const provider = await getProvider();
  let text = '';
  const toolUses = [];
  let done = null;

  let stream;
  try {
    stream = provider.complete(messages, options);
  } catch (err) {
    throw new AIClientError('PROVIDER_ERROR', err?.message ?? 'provider.complete threw');
  }

  for await (const event of stream) {
    switch (event?.type) {
      case 'text_delta': {
        text += event.text ?? '';
        if (onDelta) {
          try { onDelta(event.text ?? '', text); } catch { /* UI callback never breaks the stream */ }
        }
        break;
      }
      case 'tool_use':
        toolUses.push({ id: event.id, name: event.name, input: event.input });
        break;
      case 'done':
        done = event;
        break;
      case 'error':
        throw new AIClientError(event.code ?? 'STREAM_ERROR', event.message, {
          retryable: !!event.retryable,
        });
      default:
        // ignore unknown frames (usage/message_stop are consumed by the provider)
        break;
    }
  }

  if (!done) {
    // Stream closed without a terminal 'done' frame → failure (board contract).
    throw new AIClientError('NO_TERMINAL_FRAME', 'Stream closed without a done frame', {
      retryable: true,
    });
  }

  return { text, toolUses, usage: done.usage ?? null, credits: done.credits ?? null };
}

/**
 * Stream a single-shot completion and resolve to the full text. The high-level
 * helper for Cmd-K single-shot, selection transforms, and ghost text.
 *
 * @param {string|Array} prompt - string or Message[]
 * @param {object} [options] - see completeTurn options
 * @param {(delta: string, full: string) => void} [onDelta]
 * @returns {Promise<string>}
 */
export async function streamText(prompt, options = {}, onDelta) {
  const { text } = await completeTurn(toMessages(prompt), options, onDelta);
  return text;
}

/**
 * Convert an engine tool name back to a registry action id. The engine emits
 * tool names with `.`/`-` collapsed to `_` (vault.search → vault_search); the
 * loop must map back to execute the action. We try the verbatim id first (some
 * ids have no dots), then the underscore→dot form.
 * @param {string} toolName
 * @param {{ exists: (id: string) => boolean }} registry
 * @returns {string}
 */
export function toolNameToActionId(toolName, registry) {
  if (registry?.exists?.(toolName)) return toolName;
  const dotted = toolName.replace(/_/g, '.');
  if (registry?.exists?.(dotted)) return dotted;
  // Fall back to the first dot-split heuristic (e.g. note_create → note.create).
  const idx = toolName.indexOf('_');
  if (idx > 0) {
    const candidate = `${toolName.slice(0, idx)}.${toolName.slice(idx + 1)}`;
    if (registry?.exists?.(candidate)) return candidate;
  }
  return dotted;
}

/**
 * Client-side ReAct loop (PRD §6.3). The proxy is stateless; the loop, local
 * tool execution, and the write buffer live here. Each step is ONE complete()
 * call; tool_use blocks are executed locally via `registry.execute(...)` and the
 * result fed back as a `tool_result` ContentBlock, then complete() is re-called.
 *
 * Read-only/transform tools run inline; any action that returns a write op
 * (type 'diff'|'insert'|'replace') is buffered (not applied) — the caller shows
 * ONE diff at the end via DiffPreview.previewWriteBuffer.
 *
 * @param {object} params
 * @param {string|Array} params.query
 * @param {object} params.options - completeTurn options (system, tools, surface, signal, model, maxTokens)
 * @param {{ execute: Function, exists: Function }} params.registry - actionRegistry
 * @param {object} params.context - ActionContext passed to registry.execute
 * @param {object} [params.ui] - { onThought, onToolCall, onToolResult }
 * @param {number} [params.maxSteps=10]
 * @returns {Promise<{ answer: string, writeBuffer: Array, steps: number, usage: any }>}
 */
export async function runToolLoop({
  query,
  options = {},
  registry,
  context = {},
  ui = {},
  maxSteps = 10,
}) {
  const messages = toMessages(query);
  const writeBuffer = [];
  let answer = '';
  let lastUsage = null;
  let step = 0;

  for (step = 1; step <= maxSteps; step += 1) {
    if (options.signal?.aborted) {
      throw new AIClientError('ABORTED', 'Agent loop aborted by user', { retryable: false });
    }

    const turn = await completeTurn(messages, options, ui.onThought);
    lastUsage = turn.usage;

    // Record the assistant turn (text + tool_use blocks) for the next call.
    const assistantContent = [];
    if (turn.text) assistantContent.push({ type: 'text', text: turn.text });
    for (const t of turn.toolUses) {
      assistantContent.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // No tool calls → the model produced a final answer.
    if (turn.toolUses.length === 0) {
      answer = turn.text;
      break;
    }

    // Execute each tool locally and feed results back.
    const toolResults = [];
    for (const t of turn.toolUses) {
      try { ui.onToolCall?.(t); } catch { /* ignore UI errors */ }

      // `finalize` is a client-only sentinel: flush the write buffer + answer.
      if (t.name === 'finalize' || t.name === 'finalize_answer') {
        if (Array.isArray(t.input?.writes)) writeBuffer.push(...t.input.writes);
        answer = t.input?.answer ?? turn.text ?? answer;
        return { answer, writeBuffer, steps: step, usage: lastUsage };
      }

      let result;
      try {
        const actionId = toolNameToActionId(t.name, registry);
        result = await registry.execute(actionId, t.input ?? {}, context);
      } catch (err) {
        result = { type: 'error', content: err?.message ?? 'tool execution failed', isError: true };
      }

      // Buffer writes instead of applying them — caller shows one diff at the end.
      if (result && (result.type === 'diff' || result.type === 'insert' || result.type === 'replace')) {
        writeBuffer.push(result);
      }
      try { ui.onToolResult?.({ ...t, result, step }); } catch { /* ignore UI errors */ }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: t.id,
        content: typeof result === 'string' ? result : JSON.stringify(result?.content ?? result ?? ''),
        ...(result?.isError ? { is_error: true } : {}),
      });
    }

    messages.push({ role: 'tool', content: toolResults });

    // Nudge the model to finalize on the last allowed step.
    if (step === maxSteps - 1) {
      messages.push({ role: 'user', content: '1 step left. Provide your final answer now.' });
    }
  }

  return { answer, writeBuffer, steps: step, usage: lastUsage };
}

export default {
  AIClientError,
  setProvider,
  getProvider,
  completeTurn,
  streamText,
  runToolLoop,
  toolNameToActionId,
};
