# Lokus Monetization PRD — Subscription & Credits

**Doc 3 of 3** · Companion to `LOKUS_DIFFERENTIATION.md` (vision/moat) and `LOKUS_AI_PRD.md` (AI integration). · **Date:** May 2026 · **Status:** Draft for execution.

> **Model (one line):** A Pro subscription ($12/mo) that grants metered **credits** for cloud AI (Cmd-K, agent runs, meeting summaries) while high-frequency local features (ambient links, ghost text, local search, local meeting STT) run on-device at **$0 / 0 credits** — credits are invisible to ~90% of usage; BYOK is the privacy/whale escape hatch.

---

## 1. What a credit is

> **1 Lokus credit = 10,000 normalized AI tokens**, internal cost-basis ~**$0.001/credit**, retail value ~**$0.01/credit** (~10× ceiling — headroom to absorb output-heavy and cache-miss calls).

Normalized tokens blend input + output with **output weighted 5×** (the ~5:1 Claude price ratio), so **1 credit ≈ 10K input-equivalent tokens OR ~2K output tokens.**

**Users never see tokens.** They see a whole-number balance and a *"this will use ~N credits"* label before each cloud action (Notion/Gamma pattern). Whole numbers only (1, 10, 15, 30, 80). The credit hides four cost-variance sources — model, input-vs-output, cache-hit ratio, STT minutes — behind one predictable integer. **"Tokens make AI billable; credits make AI buyable."**

**Marketing rule (neutralizes Granola/Raycast "unlimited"):** market local features as **explicitly unlimited** ("unlimited local AI + unlimited meeting transcription") and scope the credit counter *only* to cloud synthesis/agent/Cmd-K — invisible to ~90% of usage.

## 2. The tiers

Margins stated two ways — AI-COGS-only (optimistic internal) and **post-Stripe + refund-reserve blended** (quote externally). **Stop quoting 85%; quote ~78–80% on Pro.**

| | **Free (Local-First)** | **Pro** | **Pro+** | **Team / Practice** |
|---|---|---|---|---|
| **Price** | $0 | $12/mo ($120/yr) | $32/mo ($320/yr) | $30/seat/mo ($300/seat/yr) |
| **Credits/mo** | 150 | 4,000 | 12,000 | 12,000/seat (pooled) |
| **Rollover** | none | up to 2× (8K cap) | up to 2× (24K cap) | up to 2× pooled |
| **What's covered** | ALL local AI unlimited & free: ambient, ghost text, local search, local indexing, **unlimited local-STT meetings.** 150 credits = cloud trial (~15 meeting summaries OR 150 rewrites OR ~10 Cmd-K OR ~1.9 agent runs). Hard block at 0. | Everything local stays free. 4,000 cloud credits = realistic heavy individual (~40 meeting summaries OR ~120 Cmd-K OR ~25 agent runs OR 4,000 rewrites). Soft overage, alerts 75/90/100%. | Margin-positive whale tier. 12,000 credits. Routed *to* before whales hit loss-making top-ups. | Per-seat 12K pooled, SSO, shared workspace, audit log + immutable ledger, admin spend caps, model-training opt-out, zero-retention proxy. Default local STT + embeddings → audio/notes never leave device — a privacy *promise*, **not** a HIPAA/SOC2 guarantee (see differentiation doc §1.3). |
| **AI-COGS (modeled burn)** | ~$0.07–0.18 (50% redeem) | ~$1.80 (45% burn) | ~$5.40 (45% burn) | ~$5.40/seat (45% burn) |
| **GM, AI-only** | 100% | 85% | 83% | 82% |
| **GM, post-Stripe + refund (quote this)** | — | **~79%** | **~80%** | **~80%** |
| **GM at 100% burn (stress)** | — | 67% AI-only / **61% post-Stripe** (clears 60% floor) | 60% floor | 60% floor |
| **BYOK** | Full BYOK → unlimited cloud at $0 credits | Per-provider BYOK → 0 credits; ≈100% margin, can't churn | same | **Recommended** for privacy-sensitive teams; BYOK seats ≈ $0 COGS |

**Pricing context (verified May-2026):** Pro at $12 undercuts **Obsidian Copilot ($11.67) + Sync ($10.99) = $22.66**, **Notion Business ($20)**, and bundles local-STT meetings **Granola charges $14 flat for** — while Granola eats cloud-STT on *every* minute and Lokus does not.

## 3. Per-feature economics

Cost-basis assumes prompt-caching on (~75% hit) — **but credit prices are set off realized P50; the no-cache column shows margins are a *cache bet*, not a guarantee** (§5).

| Feature | Model | In / Out tok | COGS (cache-on) | COGS (no-cache) | Credits | Retail | GM (cache-on) |
|---|---|---|---|---|---|---|---|
| Inline rewrite | Haiku 4.5 | 1,500 / 400 | $0.0025 | ~$0.0036 | 1 | $0.01 | ~75% |
| Meeting summary (local STT) | Haiku 4.5 | 8,000 / 600 | $0.0056 | ~$0.011 | 10 | $0.10 | ~94% |
| Cmd-K chained action | Sonnet 4.6 | 4,000 / 1,200 | $0.022 | ~$0.033 | 15 | $0.15 | ~85% |
| Heavy synthesis | Sonnet 4.6 | 5,000 / 2,000 | $0.045 | ~$0.065 | 30 | $0.30 | ~85% |
| Agent run (~6 turns) | Sonnet 4.6 | 25,000 / 6,000 | $0.114 | **$0.165** | 80 | $0.80 | ~86% / **~79% no-cache** |
| Cloud-STT meeting (1 hr) | Deepgram Nova-3 + Haiku | 60 min + 8K/600 | **$0.468** | $0.468 | **80** | $0.80 | ~42% |

> Uses realized PAYG Deepgram rate ($0.0077/min), not the $0.0048 Growth rate (Growth needs ~$4K/yr prepay we won't hit at launch).

## 4. Overage + rollover + BYOK escape hatch

- **Overage:** Hard block on Free (no bill shock, drives upgrade). Soft overage on Pro/Pro+/Team — auto-charge **$10 per 3,000-credit top-up** (repriced from $10/5,000 — old pack was loss-making under cache-miss). Top-ups don't expire 12 months. Alerts 75/90/100%.
- **Rollover:** up to **2× monthly grant** (Gamma norm). None on Free.
- **Annual:** 20% off + one-time 2-months-credits bonus. *Push annual* — cuts Stripe drag 6.1%→3.9% and reduces chargeback surface.
- **BYOK (every tier, incl. Free):** user's own Anthropic/OpenAI/Google/Deepgram key (`src/services/ai-provider.js` already has `mode: 'lokus' | 'byok'`). BYOK bypasses the metered proxy = **0 Lokus credits.** Casual → buy credits; privacy-conscious/whale → BYOK (zero COGS, zero churn); enterprise → custom.

## 5. Heavy-user & abuse analysis — fixes APPLIED

**Base tier survives a power user.** Worst realistic Pro user w/o BYOK (60 summaries=600cr + 80 Cmd-K=1,200cr + 25 agent runs=2,000cr + 300 rewrites=300cr ≈ 4,100cr) ≈ $4.10 COGS on $12 = 66% AI-only / **61% post-Stripe — clears the floor.** The three highest-frequency features + meeting STT are local = **$0 regardless of volume.** A user can transcribe 200 hrs/mo at $0; only the optional cloud summary (10cr) is metered.

**Fixes (launch decisions, not deferred risks):**

1. **[LAUNCH BLOCKER] Build the credit ledger before pricing goes live.** *Verified gap:* `supabase/functions/llm-summary/index.ts` enforces only a meeting **count** cap (`TIER_LIMITS = { free: 5, pro: 30, power: Infinity }`, ~lines 79–81), **no balance check/deduction/daily cap.** `tokens_used` is logged to `meeting_usage` but nothing reads it to block spend. Today a `power: Infinity` account burns uncapped Sonnet. → Build `credit_grants` + `credit_transactions` (append-only, `idempotency_key UNIQUE`) + `deduct_credits()` RPC; wrap **both** edge functions in check-balance → deduct → call → reconcile; replace `power: Infinity` with a real gate.
2. **Hard per-account daily spend cap** (3× tier daily avg, Pro ≈ 400cr/day) in the edge function — stops a compromised account draining a month overnight.
3. **Re-price two below-cost items:** cloud-STT **40 → 80 cr/hr** (Deepgram PAYG $0.0077/min → 60-min meeting = $0.468); top-ups **$10/5,000 → $10/3,000**.
4. **Price off realized P50 + guardrail:** store raw in/out/cached tokens AND realized $ in `credit_transactions`; if any feature's realized $/credit > 1.5× basis for 7 days, auto-raise its credit cost.
5. **Enforce model routing in code:** summaries + non-reasoning agent steps default to **Haiku 4.5**. Audit `DEFAULT_MODELS` (currently pro→`gpt-4o` / `claude-sonnet-4`).
6. **Fix free-tier farming (vaporware in code):** `on_auth_user_created` grants a free row on raw `auth.users` INSERT (migration `20260221000000_meeting_usage.sql`, ~lines 97–114) with no email-verify/workspace gate. → Move grant to post-email-verify + first-workspace; disposable-email blocklist; per-IP + per-user rate limits (Upstash Redis, ~$0 at small scale).
7. **Add Pro+ ($32 / 12K) BEFORE whales arrive;** nudge BYOK when a user exceeds ~2× tier credits two months running.

**Breakeven:** a Pro seat breaks even on AI COGS at ~12,000 cr/mo (full $12). Realistic burn 1,400–1,800 (35–45%) → ~79% post-Stripe. Low-burn majority subsidizes whales; whales overflow to repriced overage or BYOK. **Only failure mode:** a cohort where *every* user maxes agent mode without BYOK at <70% cache — mitigated by Haiku routing, 90%-off prefix caching, 50%-off batch API, the daily cap, and per-cohort burn monitoring (throttle any channel whose P75 burn >70%).

## 6. Billing + proxy + metering stack

Built on the **existing** Supabase + Deepgram-proxy precedent; **keys stay server-side.**

- **Billing:** Stripe Billing + Meter API (mandatory since API `2025-03-31.basil`). Subscriptions for base plans, Meters for top-ups. Waitlist **Stripe LLM Token Billing** (auto-syncs provider prices + markup); until GA, self-report meter events post-call.
- **Credit ledger:** Supabase/Postgres. `credit_grants` (renewals/top-ups/promos) + `credit_transactions` (immutable, append-only, `idempotency_key UNIQUE`, `ON CONFLICT DO NOTHING`). Balance = SUM(grants) − SUM(deductions), FIFO by expiry. **Reuse the `ManifestManager` `update_manifest()` optimistic-concurrency pattern for `deduct_credits()`.**
- **AI proxy:** Supabase Edge Functions (already deployed: `llm-summary` + `transcribe`). Per call: (1) validate JWT; (2) `check_and_deduct_credits()` RPC (atomic); (3) call provider with server-side env key; (4) return; (5) async reconcile actual tokens. Provider keys live **ONLY** in edge-function env vars — never in the Tauri binary/React bundle (closes the desktop key-extraction vector).
- **Client:** fetch balance on load + after each action; block at 0 client-side (UX) AND in the edge function (authority).
- **>~$50K MRR:** consider LiteLLM self-hosted gateway (Fly.io/Railway, ~$20–50/mo).

## 7. Legal reality (plainly stated)

**Permitted (our model):** a product that (a) adds substantial value (editor, sync, transcription, search, graph), (b) uses Lokus's **own commercial** key server-side for paying subscribers, (c) charges for the product/subscription (not raw API access), (d) meters internally. Anthropic Commercial Terms grant this explicitly; same for OpenAI/Google paid tiers. **Exactly what Notion AI, Cursor, Granola do — and what Lokus already ships for Deepgram.**

**Prohibited (we don't):** (1) raw API-key resale; (2) naked passthrough proxy with no added value; (3) *consumer* OAuth tokens (Claude Free/Pro/Max) in third-party tools — the actual target of Anthropic's Feb-2026 enforcement (The Register, 2026-02-20); (4) training competing models on outputs.

**Bottom line:** commercial/paid tiers, real value, keys server-side, never resell keys, never use consumer OAuth. **Legally sound under all three providers (May 2026).**

## 8. Monetization rollout (when paid turns ON)

**Not until P2.** Everything before is free/local and builds the moat. The ledger (P0.6) is a hard gate before *any* metered call. (Full engineering phases in `LOKUS_AI_PRD.md` §8.)

| Phase | Monetization state |
|---|---|
| P0 / P0.5 | OFF (engine + provider rewrite) |
| **P0.6 — Credit ledger [BLOCKER]** | infra only — ledger, balance gate, daily cap, farming-gate fix |
| P1 (ambient) / P1.5 (diff) | OFF (free/local) |
| **P2 — Slash + Cmd-K** | **PAID ON** — Stripe + tiers + top-ups go live |
| P3 — Agent loop | Pro+ live |
| P4 — Generative ambient + local models | Team/Practice GTM |

## 9. Revenue metrics

| Metric | Target |
|---|---|
| Free → Paid (within 60 days) | **5–8%** (credit-trial-driven) |
| Credit burn (Pro median) / 4,000 | **35–45%** (margin-healthy band) |
| Gross margin (Pro, blended post-Stripe) | **≥ 78%** (floor 60% at full burn) |
| Cache-hit ratio | **≥ 75%** (alarm <60%) |
| Net revenue retention (incl. Pro→Pro+/Team) | **≥ 110%** |
| Beachhead paying teams (consultant/researcher + privacy-preferring) | **First 10** by end of P4 |
| Per-channel P75 burn (guardrail) | **<70%** (throttle channel if exceeded) |

## 10. Open questions

1. Team: seats + pooled credits, or seats + per-seat credits? (Pooling smooths burn, complicates admin caps.)
2. Stripe LLM Token Billing GA date — build self-report metering now, or wait?
3. Does the consultant/researcher beachhead pay for *"local"* — or only the outcome + integrations? Validate (landing page + ~10 interviews) **before** committing. (See `LOKUS_DIFFERENTIATION.md` risk #6.)

---

*Source basis: Anthropic Commercial Terms, The Register 2026-02-20, Stripe token-billing docs, Gamma/Notion/Cursor credit-model docs, Granola TechCrunch 2026-03-25 ($1.5B), May-2026 provider price sheets (Anthropic/OpenAI/Google/Deepgram). Credit prices set off realized P50 with caching instrumented per call.*
