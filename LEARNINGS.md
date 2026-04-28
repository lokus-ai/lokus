# Learnings

<!-- Auto-maintained by Clean Agent. New entries are appended under the current date. -->

## 2026-04-28

- (synthesizer) [planning] Before spawning a team or starting work on an existing system component, clarify the intent (audit, feature addition, redesign, or replacement) rather than assuming scope from vague requests.
- (synthesizer) [codebase-discovery] When inheriting a codebase section with existing patterns (OAuth, hooks, contexts), inventory what's already built before planning work to avoid redundant effort.
- (synthesizer) [architecture] Multi-provider calendar backends (Google, CalDAV, iCloud, iCal) require separate sync/dedup engines per provider; merging them into a unified view requires an explicit aggregation layer, not implicit context consumption.
- (synthesizer) [architecture] Schedule blocks and calendar events are architecturally disjoint (separate backends, contexts, storage); any UI combining both requires explicit merge logic and risks data consistency issues if one side is cloud-synced and the other is device-local.
- (synthesizer) [pattern] Tauri command surfaces with 30+ commands benefit from grouping by domain (auth, sync, provider) to avoid command-discovery debt; 38 commands in a single file signals need for refactor.
- (synthesizer) [architecture] Multi-provider calendar backends (Google, CalDAV, iCloud, iCal) should have a unified event deduplication layer to prevent triple-consumption in views that need merged timelines.
- (synthesizer) [process] When spawning parallel reconnaissance agents, consolidate reports synchronously even if one stalls—architectural gaps and dead code patterns emerge only in cross-slice analysis, not individual module reads.
- (synthesizer) [architecture] Schedule blocks and calendar events occupying the same domain (timekeeping) but implemented in completely separate contexts and storage layers creates mandatory triple-consume in any unified view; merge them early or pay dearly.
- (synthesizer) [pattern] Context settings that live in-memory-only and are never persisted diverge from persisted config (like syncConfig) and create two inconsistent settings systems; always decide storage strategy upfront.
- (synthesizer) [architecture] Calendar and schedule-blocks are architecturally disjoint (separate contexts, storage, sync layers); unifying them requires a deliberate merging layer rather than connecting existing code.
- (synthesizer) [oauth] OAuth token storage must fall back gracefully: OS keyring in release builds, file-based in debug mode, with clear env var requirements (GOOGLE_CLIENT_ID/SECRET) and local callback server on fixed port (9080).
- (synthesizer) [sync] Multi-provider sync (Google + CalDAV + iCal + iCloud) requires explicit deduplication engine to prevent event duplication across sources; fingerprinting and dedup state are separate concerns from sync state.
- (synthesizer) [frontend-hygiene] Frontend context hooks (useCalendar, useCalendarEvents, useSyncConfig) should be validated against actual component consumption; dead hooks accumulate and signal incomplete refactors.
- (synthesizer) [architecture] Multi-provider calendar backends (Google, CalDAV, iCloud, iCal) should be unified at the query layer before reaching frontend contexts to avoid triple-consuming across disjoint timeline systems (events vs schedule blocks).
- (synthesizer) [state-management] Settings persistence must use a single system (context + persisted store, not context + separate service state) to prevent divergence between in-memory and persisted config.
- (synthesizer) [data-model] Schedule blocks (local time allocations) and calendar events (synced from providers) require explicit merge strategy at the view layer; leaving them disjoint causes downstream views to duplicate logic or miss data.
