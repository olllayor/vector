---
feature: status-visibility
status: delivered
specs: []
plans:
  - docs/compose/plans/2026-07-02-status-visibility.md
branch: dev
commits: e100506..1fbac63
---

# Status Visibility — Final Report

## What Was Built

Added a `/status` command to the vector CLI that displays the current model, approval mode, reasoning state, cumulative token usage, context window utilization, message count, and tool call count. This gives users a single command to see what's happening in their session.

Token usage is captured from OpenAI API responses after each completion (both initial and follow-up after tool calls). The context window percentage uses the most recent prompt size rather than cumulative tokens, so it accurately reflects how full the current conversation is. All token data persists across session restarts via the `.vector/session.json` file.

## Architecture

### Components

- **`agent/status.ts`** — Token tracking state and pure formatting function. Exports `recordUsage()`, `getStatus()`, `formatStatus()`, `resetStatus()`, `getStateForPersist()`, `loadStateFromPersist()`.
- **`agent/session.ts`** — `Session` interface extended with optional `tokenUsage` field containing `StatusState` shape.
- **`agent/cli.ts`** — Captures `response.usage` after each API call, increments tool call counter, adds `/status` command handler.

### Data Flow

```
API response → recordUsage(response.usage) → state accumulator
                                                    ↓
/cli.ts → formatStatus(getStatus(), opts) → CLI output
                                                    ↓
persistSession() → getStateForPersist() → session.json
```

### Design Decisions

- **`formatStatus` is a pure function** — Takes `StatusState` as first argument instead of reading module state. This makes it testable without mutation and composable with any state source.
- **`latestPromptTokens` for context %** — The prompt_tokens from the most recent API call represents the full conversation sent to the model. Using cumulative tokens would show >100% after a few turns.
- **`Partial<StatusState>` for persistence** — `loadStateFromPersist` accepts partial objects so old session files without the new fields don't crash on load.
- **Type-safe usage capture** — Uses `ChatCompletion` type import instead of `as any` for response.usage access.

## Usage

```
vector status
  Model: nvidia/nvidia/nemotron-3-nano-30b-a3b
  Approval: ask
  Reasoning: ON
  Tokens: 12,450 prompt / 3,200 completion (total: 15,650)
  Context: 15% of 1,000,000 window
  Messages: 8 | Tool calls: 5
```

Type `/status` at any prompt to see current session state. Token counts accumulate across the session and persist on exit/resume.

## Verification

- 8 unit tests in `tests/status.test.ts` covering: zero state, accumulation, latestPromptTokens tracking, null handling, pure formatting, context percentage calculation, undefined/zero contextWindow edge cases.
- 4 integration tests in `tests/status-integration.test.ts` covering: persist/restore cycle, old session compatibility, full output formatting, unknown context window display.
- Full test suite: 162 passed, 8 skipped (pre-existing), 0 failed.

## Journey Log

- [design] Context window calculation initially used cumulative `totalTokens`, which would show >100% after multiple turns. Fixed by tracking `latestPromptTokens` from the most recent API call.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/plans/2026-07-02-status-visibility.md` | Implementation plan | Complete, 4 tasks |
