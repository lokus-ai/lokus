/**
 * Lokus LLM Summary Proxy — Supabase Edge Function
 *
 * Proxies meeting summary generation requests to OpenAI or Anthropic on
 * behalf of users on the Lokus-provided AI tier. Validates JWT, enforces
 * model access by tier, builds a structured prompt, and returns (or streams)
 * the summary.
 *
 * Supports optional SSE streaming when `stream: true` is passed in the body.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tier = "free" | "pro" | "power";
type Provider = "openai" | "anthropic";
type Template = "general" | "sales" | "1on1" | "standup";

interface RequestBody {
  transcript: string;
  userNotes?: string;
  template?: Template;
  provider?: Provider;
  model?: string;
  stream?: boolean;
}

interface UserContext {
  userId: string;
  tier: Tier;
  meetingsThisMonth: number;
}

// Bug 3 fix: honest return type for non-streaming LLM calls
interface LLMResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

// ---------------------------------------------------------------------------
// Model access matrix
// ---------------------------------------------------------------------------

/**
 * Free-tier users are restricted to small/cheap models.
 * Pro and Power users may use any model from either provider.
 */
const FREE_TIER_MODELS = new Set([
  "gpt-4o-mini",
  "claude-haiku-4-20250514",
  "claude-haiku-3-5",
]);

/** Default model per provider when none is specified. */
const DEFAULT_MODELS: Record<Provider, Record<Tier, string>> = {
  openai: {
    free: "gpt-4o-mini",
    pro: "gpt-4o",
    power: "gpt-4o",
  },
  anthropic: {
    free: "claude-haiku-4-20250514",
    pro: "claude-sonnet-4-20250514",
    power: "claude-sonnet-4-20250514",
  },
};

// ---------------------------------------------------------------------------
// Per-tier monthly meeting caps (mirrors transcribe)
// ---------------------------------------------------------------------------

/** Per-tier monthly meeting caps. Power tier has no hard cap. */
const TIER_LIMITS: Record<string, number> = {
  free: 5,
  pro: 30,
  power: Infinity,
};

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Client-Info",
};

function corsResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

function errorResponse(message: string, code: string, status: number): Response {
  return corsResponse(JSON.stringify({ error: message, code }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Supabase admin client
// ---------------------------------------------------------------------------

function buildAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// JWT validation & user resolution
// ---------------------------------------------------------------------------

// Bug 1 fix: resolveUserContext now queries meeting_usage and returns meetingsThisMonth
async function resolveUserContext(authHeader: string | null): Promise<UserContext> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(
      new Error("Missing or malformed Authorization header"),
      { status: 401, code: "UNAUTHORIZED" },
    );
  }

  const jwt = authHeader.slice(7);
  const supabase = buildAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    throw Object.assign(
      new Error("Invalid or expired token"),
      { status: 401, code: "INVALID_TOKEN" },
    );
  }

  const userId = user.id;

  const { data: tierRow } = await supabase
    .from("user_tiers")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();

  const tier = (tierRow?.tier as Tier) ?? "free";

  // Fetch usage for the current calendar month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: usageRow } = await supabase
    .from("meeting_usage")
    .select("meetings_this_month, last_reset_date")
    .eq("user_id", userId)
    .maybeSingle();

  let meetingsThisMonth = 0;

  if (usageRow) {
    // Reset counter if the stored month is before this month
    const lastReset = new Date(usageRow.last_reset_date ?? 0);
    const isStale = lastReset < new Date(monthStart);
    meetingsThisMonth = isStale ? 0 : (usageRow.meetings_this_month ?? 0);
  }

  return { userId, tier, meetingsThisMonth };
}

// ---------------------------------------------------------------------------
// Usage enforcement
// ---------------------------------------------------------------------------

// Bug 1 fix: assertWithinLimit enforces the monthly quota
function assertWithinLimit(ctx: UserContext): void {
  const limit = TIER_LIMITS[ctx.tier] ?? TIER_LIMITS.free;
  if (ctx.meetingsThisMonth >= limit) {
    throw Object.assign(
      new Error(
        `Monthly meeting limit reached (${limit} for ${ctx.tier} tier). ` +
          "Upgrade your plan or bring your own API key.",
      ),
      { status: 429, code: "USAGE_LIMIT_EXCEEDED" },
    );
  }
}

// ---------------------------------------------------------------------------
// Model access enforcement
// ---------------------------------------------------------------------------

function resolveModel(
  requestedModel: string | undefined,
  provider: Provider,
  tier: Tier,
): string {
  const defaultModel = DEFAULT_MODELS[provider][tier];

  if (!requestedModel) {
    return defaultModel;
  }

  // Free tier: restrict to approved small models
  if (tier === "free" && !FREE_TIER_MODELS.has(requestedModel)) {
    return defaultModel;
  }

  return requestedModel;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const TEMPLATE_INSTRUCTIONS: Record<Template, string> = {
  general: `You are a meeting notes assistant. Generate a structured summary of the meeting.`,

  sales: `You are a sales call analyst. Focus on: prospect pain points, objections raised,
next steps agreed, deal stage, and follow-up actions. Use a sales-oriented structure.`,

  "1on1": `You are a 1-on-1 meeting coach. Focus on: performance topics discussed,
feedback given and received, goals reviewed, blockers mentioned, and follow-up commitments.`,

  standup: `You are a standup meeting summariser. Extract: what each speaker completed
since last standup, what they plan to do next, and any blockers. Keep it concise.`,
};

function buildPrompt(
  transcript: string,
  userNotes: string,
  template: Template,
): string {
  const templateInstruction = TEMPLATE_INSTRUCTIONS[template] ?? TEMPLATE_INSTRUCTIONS.general;

  const notesSection = userNotes?.trim()
    ? `\n\n## Participant's Sparse Notes\n${userNotes.trim()}`
    : "";

  return `${templateInstruction}

## Instructions

Using the transcript and participant notes below, produce a meeting summary in Markdown using this exact structure:

### Summary
[2-3 sentence overview of the meeting's purpose and outcome]

### Key Decisions
- [Decision 1]
- [Decision 2]
(omit this section if no decisions were made)

### Action Items
- [ ] [Task description] — Owner: [Speaker or "TBD"]
(omit this section if no action items were identified)

### Notes
[Merge the participant's sparse notes with AI-extracted context. Preserve any direct quotes or specifics from the notes.]

### Open Questions
- [Unresolved item or question that needs follow-up]
(omit this section if none)

Keep the summary factual. Do not invent details not present in the transcript or notes.
If speaker attribution is unavailable, refer to speakers as "Speaker 1", "Speaker 2", etc.

---

## Transcript
${transcript.trim()}${notesSection}`;
}

// ---------------------------------------------------------------------------
// Token usage logging (fire-and-forget)
// ---------------------------------------------------------------------------

// Bug 2 fix: use increment_meeting_usage RPC to INCREMENT tokens_used rather
// than overwriting it. Falls back to a manual upsert with a select-then-write
// if the RPC is not yet deployed.
async function logTokenUsage(
  userId: string,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  try {
    const supabase = buildAdminClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const newTokens = promptTokens + completionTokens;

    const { error } = await supabase.rpc("increment_token_usage", {
      p_user_id: userId,
      p_month_start: monthStart,
      p_tokens: newTokens,
    });

    if (error) {
      // Fallback: read current value then write the incremented total so we
      // do not overwrite with only this call's tokens.
      const { data: usageRow } = await supabase
        .from("meeting_usage")
        .select("tokens_used, last_reset_date")
        .eq("user_id", userId)
        .maybeSingle();

      let existingTokens = 0;
      if (usageRow) {
        const lastReset = new Date(usageRow.last_reset_date ?? 0);
        const isStale = lastReset < new Date(monthStart);
        existingTokens = isStale ? 0 : (usageRow.tokens_used ?? 0);
      }

      await supabase.from("meeting_usage").upsert(
        {
          user_id: userId,
          tokens_used: existingTokens + newTokens,
          last_reset_date: monthStart,
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: false },
      );
    }
  } catch (err) {
    console.error("[llm-summary] Failed to log token usage:", err);
  }
}

// ---------------------------------------------------------------------------
// Type guard for LLMResult vs streaming Response
// ---------------------------------------------------------------------------

// Bug 3 fix: honest type guard so the handler can distinguish a streaming
// Response from a non-streaming LLMResult without unsafe casts.
function isLLMResult(value: Response | LLMResult): value is LLMResult {
  return typeof (value as LLMResult).content === "string";
}

// ---------------------------------------------------------------------------
// OpenAI integration
// ---------------------------------------------------------------------------

// Bug 3 fix: return type is now Promise<Response | LLMResult> instead of the
// lying Promise<Response> backed by `as unknown as Response`.
async function callOpenAI(
  model: string,
  prompt: string,
  stream: boolean,
): Promise<Response | LLMResult> {
  const apiKey = Deno.env.get("LOKUS_OPENAI_KEY");
  if (!apiKey) {
    throw Object.assign(
      new Error("OpenAI service not configured"),
      { status: 503, code: "SERVICE_UNAVAILABLE" },
    );
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
      stream,
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");
    console.error(`[llm-summary] OpenAI error ${openaiRes.status}:`, errText);

    if (openaiRes.status === 429) {
      throw Object.assign(
        new Error("AI service rate limit reached. Please try again shortly."),
        { status: 429, code: "UPSTREAM_RATE_LIMIT" },
      );
    }

    throw Object.assign(
      new Error("Summary generation failed"),
      { status: 502, code: "UPSTREAM_ERROR" },
    );
  }

  if (stream) {
    // Pass the SSE stream straight through to the client
    return new Response(openaiRes.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const data = await openaiRes.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;

  return { content, promptTokens, completionTokens };
}

// ---------------------------------------------------------------------------
// Anthropic integration
// ---------------------------------------------------------------------------

// Bug 3 fix: return type is now Promise<Response | LLMResult> instead of the
// lying Promise<Response> backed by `as unknown as Response`.
async function callAnthropic(
  model: string,
  prompt: string,
  stream: boolean,
): Promise<Response | LLMResult> {
  const apiKey = Deno.env.get("LOKUS_ANTHROPIC_KEY");
  if (!apiKey) {
    throw Object.assign(
      new Error("Anthropic service not configured"),
      { status: 503, code: "SERVICE_UNAVAILABLE" },
    );
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      ...(stream ? { stream: true } : {}),
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error(`[llm-summary] Anthropic error ${anthropicRes.status}:`, errText);

    if (anthropicRes.status === 429) {
      throw Object.assign(
        new Error("AI service rate limit reached. Please try again shortly."),
        { status: 429, code: "UPSTREAM_RATE_LIMIT" },
      );
    }

    throw Object.assign(
      new Error("Summary generation failed"),
      { status: 502, code: "UPSTREAM_ERROR" },
    );
  }

  if (stream) {
    // Anthropic uses SSE natively — pass through directly
    return new Response(anthropicRes.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const data = await anthropicRes.json();
  const content = data.content?.[0]?.text ?? "";
  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;

  return { content, promptTokens, completionTokens };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  // Validate JWT and load user context (now includes meetingsThisMonth)
  let userCtx: UserContext;
  try {
    userCtx = await resolveUserContext(req.headers.get("Authorization"));
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string };
    return errorResponse(e.message, e.code ?? "AUTH_ERROR", e.status ?? 401);
  }

  // Bug 1 fix: enforce monthly quota before allowing the LLM call
  try {
    assertWithinLimit(userCtx);
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string };
    return errorResponse(e.message, e.code ?? "LIMIT_ERROR", e.status ?? 429);
  }

  // Parse and validate request body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Request body must be valid JSON", "INVALID_BODY", 400);
  }

  if (!body.transcript?.trim()) {
    return errorResponse("Missing required field: transcript", "MISSING_TRANSCRIPT", 400);
  }

  if (body.transcript.length > 200_000) {
    return errorResponse(
      "Transcript exceeds maximum length (200,000 characters)",
      "TRANSCRIPT_TOO_LONG",
      400,
    );
  }

  const provider: Provider = body.provider === "anthropic" ? "anthropic" : "openai";
  const template: Template = (["general", "sales", "1on1", "standup"] as Template[]).includes(
    body.template as Template,
  )
    ? (body.template as Template)
    : "general";
  const stream = body.stream === true;
  const model = resolveModel(body.model, provider, userCtx.tier);

  const prompt = buildPrompt(
    body.transcript,
    body.userNotes ?? "",
    template,
  );

  // Call the appropriate provider
  let result: Response | LLMResult;
  try {
    if (provider === "anthropic") {
      result = await callAnthropic(model, prompt, stream);
    } else {
      result = await callOpenAI(model, prompt, stream);
    }
  } catch (err: unknown) {
    const e = err as { message: string; status?: number; code?: string };
    return errorResponse(e.message, e.code ?? "UPSTREAM_ERROR", e.status ?? 502);
  }

  // Bug 3 fix: use the type guard to distinguish streaming Response from
  // non-streaming LLMResult — no more unsafe casts in either branch.
  if (!isLLMResult(result)) {
    // Streaming: provider already built the Response, return it directly
    return result;
  }

  // Non-streaming: log usage and return JSON
  const { content, promptTokens, completionTokens } = result;

  logTokenUsage(userCtx.userId, promptTokens, completionTokens);

  return corsResponse(
    JSON.stringify({
      summary: content,
      model,
      provider,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
