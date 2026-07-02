# Status Visibility Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/status-visibility.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/status` command that displays model, approval mode, token usage, and session stats so users can trust what's happening.

**Architecture:** New `agent/status.ts` module tracks cumulative token usage from API responses and the most recent prompt size for context window calculation. `cli.ts` calls `recordUsage()` after each completion and adds `/status` to the command handler. Session persists token data across restarts.

**Tech Stack:** TypeScript, OpenAI SDK (`ChatCompletion`, `CompletionUsage`), vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `agent/status.ts` | Create | Token tracking state, pure status formatting |
| `agent/session.ts` | Modify | Add `tokenUsage` to Session interface |
| `agent/cli.ts` | Modify | Capture usage, add `/status` command |
| `tests/status.test.ts` | Create | Unit tests for status module |

---

### Task 1: Create status module with token tracking + session interface

**Covers:** Core token tracking, session persistence for token data

**Files:**
- Create: `agent/status.ts`
- Modify: `agent/session.ts:11-19`
- Create: `tests/status.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/status.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { recordUsage, getStatus, resetStatus, formatStatus, StatusState } from "../agent/status.js"

describe("status", () => {
  beforeEach(() => {
    resetStatus()
  })

  it("starts with zero tokens", () => {
    const status = getStatus()
    expect(status.totalPromptTokens).toBe(0)
    expect(status.totalCompletionTokens).toBe(0)
    expect(status.totalTokens).toBe(0)
    expect(status.latestPromptTokens).toBe(0)
    expect(status.turnCount).toBe(0)
  })

  it("accumulates token usage across turns", () => {
    recordUsage({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })
    recordUsage({ prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 })

    const status = getStatus()
    expect(status.totalPromptTokens).toBe(300)
    expect(status.totalCompletionTokens).toBe(130)
    expect(status.totalTokens).toBe(430)
    expect(status.latestPromptTokens).toBe(200)
    expect(status.turnCount).toBe(2)
  })

  it("tracks latestPromptTokens from most recent call", () => {
    recordUsage({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })
    recordUsage({ prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 })
    recordUsage({ prompt_tokens: 300, completion_tokens: 80, total_tokens: 380 })

    const status = getStatus()
    expect(status.latestPromptTokens).toBe(300)
  })

  it("handles null/undefined usage gracefully", () => {
    recordUsage(undefined)
    recordUsage(null as any)

    const status = getStatus()
    expect(status.totalTokens).toBe(0)
    expect(status.turnCount).toBe(0)
  })

  it("formatStatus is a pure function", () => {
    const state: StatusState = {
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      totalTokens: 1500,
      latestPromptTokens: 800,
      turnCount: 5,
    }

    const output = formatStatus(state, {
      model: "nvidia/nvidia/nemotron-3-nano-30b-a3b",
      approvalMode: "ask",
      reasoningEnabled: true,
      contextWindow: 1000000,
      messageCount: 8,
      toolCallCount: 3,
    })

    expect(output).toContain("nvidia/nvidia/nemotron-3-nano-30b-a3b")
    expect(output).toContain("ask")
    expect(output).toContain("ON")
    expect(output).toContain("1,000 prompt")
    expect(output).toContain("500 completion")
    expect(output).toContain("1,500")
    expect(output).toContain("Messages: 8")
    expect(output).toContain("Tool calls: 3")
  })

  it("formatStatus uses latestPromptTokens for context percentage", () => {
    const state: StatusState = {
      totalPromptTokens: 50000,
      totalCompletionTokens: 10000,
      totalTokens: 60000,
      latestPromptTokens: 8000,
      turnCount: 20,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "auto",
      reasoningEnabled: false,
      contextWindow: 128000,
      messageCount: 20,
      toolCallCount: 10,
    })

    // 8000 / 128000 = 6.25% ≈ 6%
    expect(output).toContain("6%")
    expect(output).toContain("128,000")
  })

  it("formatStatus handles undefined contextWindow", () => {
    const state: StatusState = {
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      totalTokens: 1500,
      latestPromptTokens: 800,
      turnCount: 5,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "ask",
      reasoningEnabled: true,
      contextWindow: undefined,
      messageCount: 8,
      toolCallCount: 3,
    })

    expect(output).toContain("Unknown context window")
    expect(output).not.toContain("NaN")
  })

  it("formatStatus handles zero contextWindow", () => {
    const state: StatusState = {
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      totalTokens: 1500,
      latestPromptTokens: 800,
      turnCount: 5,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "ask",
      reasoningEnabled: true,
      contextWindow: 0,
      messageCount: 8,
      toolCallCount: 3,
    })

    expect(output).toContain("Unknown context window")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/status.test.ts`
Expected: FAIL with "Cannot find module '../agent/status.js'"

- [ ] **Step 3: Write implementation**

```typescript
// agent/status.ts
export interface StatusState {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  latestPromptTokens: number
  turnCount: number
}

let state: StatusState = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  latestPromptTokens: 0,
  turnCount: 0,
}

export function recordUsage(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined | null): void {
  if (!usage) return
  state.totalPromptTokens += usage.prompt_tokens ?? 0
  state.totalCompletionTokens += usage.completion_tokens ?? 0
  state.totalTokens += usage.total_tokens ?? 0
  state.latestPromptTokens = usage.prompt_tokens ?? 0
  state.turnCount++
}

export function getStatus(): StatusState {
  return { ...state }
}

export function resetStatus(): void {
  state = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    latestPromptTokens: 0,
    turnCount: 0,
  }
}

export function getStateForPersist(): StatusState {
  return { ...state }
}

export function loadStateFromPersist(saved: Partial<StatusState>): void {
  state = {
    totalPromptTokens: saved.totalPromptTokens ?? 0,
    totalCompletionTokens: saved.totalCompletionTokens ?? 0,
    totalTokens: saved.totalTokens ?? 0,
    latestPromptTokens: saved.latestPromptTokens ?? 0,
    turnCount: saved.turnCount ?? 0,
  }
}

export function formatStatus(
  statusState: StatusState,
  opts: {
    model: string
    approvalMode: string
    reasoningEnabled: boolean
    contextWindow: number | undefined
    messageCount: number
    toolCallCount: number
  }
): string {
  const lines: string[] = []
  lines.push("")
  lines.push("vector status")
  lines.push(`  Model: ${opts.model}`)
  lines.push(`  Approval: ${opts.approvalMode}`)
  lines.push(`  Reasoning: ${opts.reasoningEnabled ? "ON" : "OFF"}`)
  lines.push(
    `  Tokens: ${statusState.totalPromptTokens.toLocaleString()} prompt / ${statusState.totalCompletionTokens.toLocaleString()} completion (total: ${statusState.totalTokens.toLocaleString()})`
  )

  if (opts.contextWindow && opts.contextWindow > 0) {
    const contextPct = Math.round((statusState.latestPromptTokens / opts.contextWindow) * 100)
    lines.push(`  Context: ${contextPct}% of ${opts.contextWindow.toLocaleString()} window`)
  } else {
    lines.push(`  Context: Unknown context window`)
  }

  lines.push(`  Messages: ${opts.messageCount} | Tool calls: ${opts.toolCallCount}`)
  lines.push("")

  return lines.join("\n")
}
```

- [ ] **Step 4: Update Session interface**

```typescript
// agent/session.ts — add tokenUsage to Session interface (line 11-19)
export interface Session {
  version: number
  workspace: string
  provider: string
  model: string
  approvalMode: ApprovalMode
  messages: SessionMessage[]
  tokenUsage?: {
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    latestPromptTokens: number
    turnCount: number
  }
  updatedAt: string
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/status.test.ts`
Expected: PASS

- [ ] **Step 6: Verify existing session tests still pass**

Run: `pnpm vitest run tests/session.test.ts`
Expected: PASS (optional field doesn't break existing code)

- [ ] **Step 7: Commit**

```bash
git add agent/status.ts agent/session.ts tests/status.test.ts
git commit -m "feat: add status module with token tracking and session persistence"
```

---

### Task 2: Integrate status into CLI

**Covers:** Capture usage after API calls, add `/status` command

**Files:**
- Modify: `agent/cli.ts:1-13` (imports)
- Modify: `agent/cli.ts:24-27` (state variables)
- Modify: `agent/cli.ts:62-77` (help text)
- Modify: `agent/cli.ts:196-274` (handleCommand)
- Modify: `agent/cli.ts:276-283` (main startup)
- Modify: `agent/cli.ts:329-353` (non-streaming response handling)
- Modify: `agent/cli.ts:382-404` (follow-up response handling)

- [ ] **Step 1: Add imports**

Add to top of `agent/cli.ts` after existing imports:

```typescript
import { recordUsage, getStatus, getStateForPersist, loadStateFromPersist, formatStatus } from "./status.js"
import type { ChatCompletion } from "openai/resources/chat/completions"
```

- [ ] **Step 2: Add tool call counter**

Add after `let reasoningEnabled = true` (line 26):

```typescript
let toolCallCount = 0
```

- [ ] **Step 3: Update loadOrCreateSession to restore token state**

In `loadOrCreateSession()` function, after `setApprovalMode(session.approvalMode)` (line 36), add:

```typescript
if (session.tokenUsage) {
  loadStateFromPersist(session.tokenUsage)
}
```

- [ ] **Step 4: Update persistSession to save token state**

In `persistSession()` function, add `tokenUsage` to the saved session object:

```typescript
function persistSession(): void {
  const ref = currentModel ?? registry.getDefault()
  const resolved = registry.resolve(ref)
  saveSession(workspaceRoot, {
    workspace: workspaceRoot,
    provider: resolved.provider,
    model: resolved.modelId,
    approvalMode: getApprovalMode(),
    messages,
    tokenUsage: getStateForPersist(),
  })
}
```

- [ ] **Step 5: Capture usage after non-streaming response**

In the non-streaming path (around line 330-353), after `const choice = response.choices[0]`, add:

```typescript
recordUsage((response as ChatCompletion).usage)
```

- [ ] **Step 6: Capture usage after follow-up response**

In the follow-up response handling (around line 382-404), after `const followUp = await client.chat.completions.create(...)`, add:

```typescript
recordUsage((followUp as ChatCompletion).usage)
```

- [ ] **Step 7: Increment tool call counter**

In the tool calls loop (around line 359-379), after `console.log(output)` (line 377), add:

```typescript
toolCallCount++
```

- [ ] **Step 8: Update help text**

Update `printHelp()` function to include `/status`:

```typescript
function printHelp() {
  console.log(`
Commands:
  /status               Show model, approvals, and token usage
  /help                 Show this help
  /model                Show current model
  /model <provider/id>  Switch model
  /providers            List all providers and models
  /approval             Show current approval mode
  /approval <mode>      Set approval mode (ask/auto/full)
  /reasoning            Toggle reasoning (<think> tags)
  /undo                 Undo last file edit batch
  /diff                 Show git diff
  /clear                Clear conversation history
  /exit                 Exit vector
`)
}
```

- [ ] **Step 9: Add /status command handler**

Add new case in `handleCommand()` switch statement (after `/help` case):

```typescript
case "/status": {
  const ref = currentModel ?? registry.getDefault()
  const resolved = registry.resolve(ref)
  const statusOutput = formatStatus(getStatus(), {
    model: `${resolved.provider}/${resolved.modelId}`,
    approvalMode: getApprovalMode(),
    reasoningEnabled,
    contextWindow: resolved.config.contextWindow,
    messageCount: messages.length,
    toolCallCount,
  })
  console.log(statusOutput)
  break
}
```

- [ ] **Step 10: Update startup display**

Update the startup console.log in `main()` to show `/status` hint:

```typescript
console.log("  Type /status for details, /help for commands, /exit to quit.\n")
```

- [ ] **Step 11: Verify existing tests pass**

Run: `pnpm vitest run`
Expected: All existing tests PASS

- [ ] **Step 12: Commit**

```bash
git add agent/cli.ts
git commit -m "feat: add /status command with token usage tracking"
```

---

### Task 3: Integration test for /status command

**Covers:** End-to-end status display and persistence edge cases

**Files:**
- Create: `tests/status-integration.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
// tests/status-integration.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { recordUsage, getStatus, resetStatus, formatStatus, getStateForPersist, loadStateFromPersist, StatusState } from "../agent/status.js"

describe("status integration", () => {
  beforeEach(() => {
    resetStatus()
  })

  it("persists and restores token state", () => {
    recordUsage({ prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 })
    recordUsage({ prompt_tokens: 300, completion_tokens: 100, total_tokens: 400 })

    const saved = getStateForPersist()
    resetStatus()

    expect(getStatus().totalTokens).toBe(0)

    loadStateFromPersist(saved)
    const restored = getStatus()
    expect(restored.totalPromptTokens).toBe(800)
    expect(restored.totalCompletionTokens).toBe(300)
    expect(restored.totalTokens).toBe(1100)
    expect(restored.latestPromptTokens).toBe(300)
    expect(restored.turnCount).toBe(2)
  })

  it("handles loadStateFromPersist with missing fields (old session)", () => {
    const oldSession = {
      totalPromptTokens: 500,
      totalCompletionTokens: 200,
      totalTokens: 700,
      // latestPromptTokens and turnCount missing from old session
    }

    loadStateFromPersist(oldSession)
    const restored = getStatus()
    expect(restored.totalPromptTokens).toBe(500)
    expect(restored.totalCompletionTokens).toBe(200)
    expect(restored.totalTokens).toBe(700)
    expect(restored.latestPromptTokens).toBe(0)
    expect(restored.turnCount).toBe(0)
  })

  it("formats complete status output with context window", () => {
    const state: StatusState = {
      totalPromptTokens: 12345,
      totalCompletionTokens: 6789,
      totalTokens: 19134,
      latestPromptTokens: 50000,
      turnCount: 10,
    }

    const output = formatStatus(state, {
      model: "nvidia/nvidia/nemotron-3-nano-30b-a3b",
      approvalMode: "auto",
      reasoningEnabled: false,
      contextWindow: 1000000,
      messageCount: 15,
      toolCallCount: 7,
    })

    expect(output).toContain("vector status")
    expect(output).toContain("Model: nvidia/nvidia/nemotron-3-nano-30b-a3b")
    expect(output).toContain("Approval: auto")
    expect(output).toContain("Reasoning: OFF")
    expect(output).toContain("12,345 prompt")
    expect(output).toContain("6,789 completion")
    expect(output).toContain("19,134")
    expect(output).toContain("Messages: 15")
    expect(output).toContain("Tool calls: 7")
    expect(output).toContain("Context:")
    expect(output).toContain("1,000,000")
    // 50000 / 1000000 = 5%
    expect(output).toContain("5%")
  })

  it("formats status with unknown context window", () => {
    const state: StatusState = {
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      totalTokens: 1500,
      latestPromptTokens: 800,
      turnCount: 5,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "full",
      reasoningEnabled: true,
      contextWindow: undefined,
      messageCount: 8,
      toolCallCount: 3,
    })

    expect(output).toContain("Unknown context window")
    expect(output).not.toContain("NaN")
    expect(output).not.toContain("0%")
  })
})
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run tests/status-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/status-integration.test.ts
git commit -m "test: add status integration tests with edge cases"
```

---

### Task 4: Manual verification

**Covers:** End-to-end smoke test

- [ ] **Step 1: Start CLI and verify /status displays**

Run: `pnpm tsx agent/cli.ts`

Type: `/status`

Expected output:
```
vector status
  Model: nvidia/nvidia/nemotron-3-nano-30b-a3b
  Approval: ask
  Reasoning: ON
  Tokens: 0 prompt / 0 completion (total: 0)
  Context: 0% of 1,000,000 window
  Messages: 1 | Tool calls: 0
```

- [ ] **Step 2: Send a message and verify tokens update**

Type: `hello`

Type: `/status`

Expected: Token counts > 0, latestPromptTokens reflects current conversation size

- [ ] **Step 3: Exit and resume to verify persistence**

Type: `/exit`

Start again: `pnpm tsx agent/cli.ts`

Type: `/status`

Expected: Previous token counts restored from session

- [ ] **Step 4: Run full test suite**

Run: `pnpm test:all`
Expected: All tests PASS

---

## Self-Review

1. **Spec coverage:** `/status` displays model, approvals, token usage — covered by Task 2 step 9.
2. **Placeholder scan:** No TBD/TODO found. All code blocks are complete.
3. **Type consistency:** `StatusState` interface consistent across status.ts, session.ts, and tests. `formatStatus` is now a pure function taking state as first argument.
4. **Context window fix:** Uses `latestPromptTokens` (most recent API call's prompt_tokens) instead of cumulative `totalTokens` for accurate context percentage.
5. **Type safety:** Uses `ChatCompletion` type import instead of `as any` for response.usage.
6. **Edge cases:** Handles `undefined`/`0` contextWindow, old sessions without `latestPromptTokens` field.
