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
