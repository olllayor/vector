# Slash Command System Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/slash-command-system.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current prefix-matching completer with a state-machine-driven slash command system featuring fuzzy matching, a popup menu, and dispatch separation.

**Architecture:** Single registry (static builtins + dynamic file scan), input state machine (`editing | slashMenu`), fuzzy matching via `fuzzysort`, popup rendered via ANSI escape codes (raw readline stack), dispatch function decoupled from UI.

**Tech Stack:** TypeScript, Node.js readline, `fuzzysort`, ANSI escape codes for popup rendering.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `agent/slash/registry.ts` | Command registry: static builtins + dynamic scan, dedup by name |
| `agent/slash/matcher.ts` | Fuzzy matching over registry using `fuzzysort` |
| `agent/slash/dispatch.ts` | Parse `/name args...`, resolve to command, execute |
| `agent/slash/menu.ts` | Popup state machine + ANSI rendering |
| `agent/slash/index.ts` | Public API: re-exports registry, dispatch, menu |
| `agent/cli.ts` | Wire menu into readline loop (replace old completer) |
| `agent/completer.ts` | DELETE — replaced by slash/menu.ts |
| `tests/slash/registry.test.ts` | Registry tests |
| `tests/slash/matcher.test.ts` | Matcher tests |
| `tests/slash/dispatch.test.ts` | Dispatch tests |
| `tests/slash/menu.test.ts` | Menu state machine tests |

---

### Task 1: Install fuzzysort + scaffold registry

**Covers:** Registry architecture (step 1 from research)

**Files:**
- Create: `agent/slash/registry.ts`
- Create: `tests/slash/registry.test.ts`

- [ ] **Step 1: Install fuzzysort**

```bash
npm install fuzzysort
```

- [ ] **Step 2: Write failing test for registry**

```typescript
// tests/slash/registry.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { SlashRegistry } from "../agent/slash/registry.js"

describe("SlashRegistry", () => {
  let registry: SlashRegistry

  beforeEach(() => {
    registry = new SlashRegistry()
    registry.register({
      name: "test",
      description: "Test command",
      source: "builtin",
      handler: async () => {},
    })
  })

  it("returns registered commands", () => {
    const commands = registry.list()
    expect(commands).toHaveLength(1)
    expect(commands[0].name).toBe("test")
  })

  it("deduplicates by name, last wins", () => {
    registry.register({
      name: "test",
      description: "Overridden",
      source: "user",
      handler: async () => {},
    })
    const commands = registry.list()
    expect(commands).toHaveLength(1)
    expect(commands[0].description).toBe("Overridden")
    expect(commands[0].source).toBe("user")
  })

  it("resolves command by name", () => {
    const cmd = registry.resolve("test")
    expect(cmd?.name).toBe("test")
  })

  it("returns undefined for unknown command", () => {
    const cmd = registry.resolve("unknown")
    expect(cmd).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/slash/registry.test.ts
```
Expected: FAIL — `SlashRegistry` not found

- [ ] **Step 4: Implement registry**

```typescript
// agent/slash/registry.ts
export interface SlashCommand {
  name: string
  description: string
  source: "builtin" | "project" | "user"
  handler: (args: string) => Promise<void>
}

export class SlashRegistry {
  private commands = new Map<string, SlashCommand>()

  register(cmd: SlashCommand): void {
    this.commands.set(cmd.name, cmd)
  }

  resolve(name: string): SlashCommand | undefined {
    return this.commands.get(name)
  }

  list(): SlashCommand[] {
    return [...this.commands.values()]
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/slash/registry.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/slash/registry.ts tests/slash/registry.test.ts package.json package-lock.json
git commit -m "feat: add slash command registry with dedup"
```

---

### Task 2: Build-in commands into registry

**Covers:** Registry architecture (step 1 — migrate existing commands)

**Files:**
- Create: `agent/slash/builtins.ts`
- Modify: `agent/slash/registry.ts` (add `loadBuiltins`)

- [ ] **Step 1: Create builtins module**

```typescript
// agent/slash/builtins.ts
import type { SlashCommand } from "./registry.js"

export interface BuiltinDeps {
  getStatus: () => string
  getCurrentModel: () => string
  listProviders: () => string[]
  listModels: (provider: string) => { id: string; supportsTools: boolean; contextWindow: number }[]
  getApprovalMode: () => string
  setApprovalMode: (mode: string) => void
  reasoningEnabled: () => boolean
  toggleReasoning: () => void
  undoLastBatch: () => { restored: string[]; errors: string[] }
  gitDiff: (args: Record<string, unknown>) => string
  clearSession: () => void
  exitSession: () => void
}

export function createBuiltins(deps: BuiltinDeps): SlashCommand[] {
  return [
    {
      name: "status",
      description: "Show model, approvals, and token usage",
      source: "builtin",
      handler: async () => console.log(deps.getStatus()),
    },
    {
      name: "help",
      description: "Show available commands",
      source: "builtin",
      handler: async () => {
        console.log("\nCommands:")
        console.log("  /status     Show model, approvals, and token usage")
        console.log("  /help       Show this help")
        console.log("  /model      Show or switch model")
        console.log("  /providers  List all providers and models")
        console.log("  /approval   Show or set approval mode")
        console.log("  /reasoning  Toggle reasoning display")
        console.log("  /undo       Undo last file edit batch")
        console.log("  /diff       Show git diff")
        console.log("  /clear      Clear conversation history")
        console.log("  /exit       Exit vector\n")
      },
    },
    {
      name: "model",
      description: "Show or switch model",
      source: "builtin",
      handler: async (args) => {
        if (!args) {
          console.log(`  Current model: ${deps.getCurrentModel()}`)
        } else {
          console.log(`  Switched to: ${args}`)
        }
      },
    },
    {
      name: "providers",
      description: "List all providers and models",
      source: "builtin",
      handler: async () => {
        for (const p of deps.listProviders()) {
          console.log(`\n  ${p}:`)
          const models = deps.listModels(p)
          for (const m of models) {
            console.log(`    ${p}/${m.id}  [tools: ${m.supportsTools}, ctx: ${m.contextWindow}]`)
          }
        }
        console.log()
      },
    },
    {
      name: "approval",
      description: "Show or set approval mode (ask/auto/full)",
      source: "builtin",
      handler: async (args) => {
        if (!args) {
          console.log(`  Current mode: ${deps.getApprovalMode()}`)
          console.log("  Modes: ask (default), auto, full")
        } else if (["ask", "auto", "full"].includes(args)) {
          deps.setApprovalMode(args)
          console.log(`  Approval mode: ${args}`)
        } else {
          console.error("  Invalid mode. Use: ask, auto, or full")
        }
      },
    },
    {
      name: "reasoning",
      description: "Toggle reasoning (<think> tags)",
      source: "builtin",
      handler: async () => {
        deps.toggleReasoning()
        console.log(`  Reasoning: ${deps.reasoningEnabled() ? "ON" : "OFF"}`)
      },
    },
    {
      name: "undo",
      description: "Undo last file edit batch",
      source: "builtin",
      handler: async () => {
        const result = deps.undoLastBatch()
        if (result.restored.length > 0) {
          console.log("  Undone:")
          result.restored.forEach((r) => console.log(`    ${r}`))
        }
        if (result.errors.length > 0) {
          result.errors.forEach((e) => console.error(`    ${e}`))
        }
      },
    },
    {
      name: "diff",
      description: "Show git diff",
      source: "builtin",
      handler: async () => {
        console.log(deps.gitDiff({}))
      },
    },
    {
      name: "clear",
      description: "Clear conversation history",
      source: "builtin",
      handler: async () => {
        deps.clearSession()
        console.log("  Conversation cleared.")
      },
    },
    {
      name: "exit",
      description: "Exit vector",
      source: "builtin",
      handler: async () => {
        deps.exitSession()
      },
    },
  ]
}
```

- [ ] **Step 2: Add `loadBuiltins` to registry**

```typescript
// agent/slash/registry.ts — add after class
import { createBuiltins, type BuiltinDeps } from "./builtins.js"

export function loadBuiltins(deps: BuiltinDeps): SlashRegistry {
  const registry = new SlashRegistry()
  for (const cmd of createBuiltins(deps)) {
    registry.register(cmd)
  }
  return registry
}
```

- [ ] **Step 3: Run existing tests to verify nothing breaks**

```bash
npx vitest run tests/slash/registry.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add agent/slash/builtins.ts agent/slash/registry.ts
git commit -m "feat: add built-in slash commands to registry"
```

---

### Task 3: Fuzzy matcher

**Covers:** Matcher architecture (step 5 from research)

**Files:**
- Create: `agent/slash/matcher.ts`
- Create: `tests/slash/matcher.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/slash/matcher.test.ts
import { describe, it, expect } from "vitest"
import { matchCommands } from "../agent/slash/matcher.js"
import type { SlashCommand } from "../agent/slash/registry.js"

const commands: SlashCommand[] = [
  { name: "status", description: "Show status", source: "builtin", handler: async () => {} },
  { name: "model", description: "Switch model", source: "builtin", handler: async () => {} },
  { name: "providers", description: "List providers", source: "builtin", handler: async () => {} },
  { name: "approval", description: "Set approval mode", source: "builtin", handler: async () => {} },
]

describe("matchCommands", () => {
  it("returns all commands for empty query", () => {
    const results = matchCommands(commands, "")
    expect(results).toHaveLength(commands.length)
  })

  it("fuzzy matches by name", () => {
    const results = matchCommands(commands, "mod")
    expect(results[0].name).toBe("model")
  })

  it("fuzzy matches by description", () => {
    const results = matchCommands(commands, "switch")
    expect(results[0].name).toBe("model")
  })

  it("returns empty for no matches", () => {
    const results = matchCommands(commands, "xyz")
    expect(results).toHaveLength(0)
  })

  it("does not cap results", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      name: `cmd${i}`,
      description: `Command ${i}`,
      source: "builtin" as const,
      handler: async () => {},
    }))
    const results = matchCommands(many, "cmd")
    expect(results).toHaveLength(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/slash/matcher.test.ts
```
Expected: FAIL — `matchCommands` not found

- [ ] **Step 3: Implement matcher**

```typescript
// agent/slash/matcher.ts
import fuzzysort from "fuzzysort"
import type { SlashCommand } from "./registry.js"

export function matchCommands(
  commands: SlashCommand[],
  query: string,
): SlashCommand[] {
  if (!query) return commands

  const results = fuzzysort.go(query, commands, {
    keys: ["name", "description"],
    limit: Infinity,
    scoreFn: (a) => {
      const nameScore = a[0]?.score ?? -Infinity
      const descScore = a[1]?.score ?? -Infinity
      // Weight name matches higher
      return nameScore * 2 + descScore
    },
  })

  return results.map((r) => r.obj)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/slash/matcher.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/slash/matcher.ts tests/slash/matcher.test.ts
git commit -m "feat: add fuzzy matcher for slash commands"
```

---

### Task 4: Dispatch (parse + execute)

**Covers:** Dispatch separation (step 7 from research)

**Files:**
- Create: `agent/slash/dispatch.ts`
- Create: `tests/slash/dispatch.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/slash/dispatch.test.ts
import { describe, it, expect, vi } from "vitest"
import { dispatchSlashCommand } from "../agent/slash/dispatch.js"
import { SlashRegistry } from "../agent/slash/registry.js"

describe("dispatchSlashCommand", () => {
  it("parses /name and calls handler with empty args", async () => {
    const handler = vi.fn()
    const registry = new SlashRegistry()
    registry.register({ name: "test", description: "", source: "builtin", handler })

    await dispatchSlashCommand("/test", registry)
    expect(handler).toHaveBeenCalledWith("")
  })

  it("parses /name args and passes args string", async () => {
    const handler = vi.fn()
    const registry = new SlashRegistry()
    registry.register({ name: "model", description: "", source: "builtin", handler })

    await dispatchSlashCommand("/model nvidia/deepseek", registry)
    expect(handler).toHaveBeenCalledWith("nvidia/deepseek")
  })

  it("prints error for unknown command", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const registry = new SlashRegistry()

    await dispatchSlashCommand("/unknown", registry)
    expect(consoleSpy).toHaveBeenCalledWith("  Unknown command: /unknown")
    consoleSpy.mockRestore()
  })

  it("handles commands with no args", async () => {
    const handler = vi.fn()
    const registry = new SlashRegistry()
    registry.register({ name: "help", description: "", source: "builtin", handler })

    await dispatchSlashCommand("/help", registry)
    expect(handler).toHaveBeenCalledWith("")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/slash/dispatch.test.ts
```
Expected: FAIL — `dispatchSlashCommand` not found

- [ ] **Step 3: Implement dispatch**

```typescript
// agent/slash/dispatch.ts
import type { SlashRegistry } from "./registry.js"

export async function dispatchSlashCommand(
  raw: string,
  registry: SlashRegistry,
): Promise<void> {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/")) return

  const spaceIdx = trimmed.indexOf(" ")
  const name = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1)

  const cmd = registry.resolve(name)
  if (!cmd) {
    console.error(`  Unknown command: ${trimmed}`)
    return
  }

  await cmd.handler(args)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/slash/dispatch.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/slash/dispatch.ts tests/slash/dispatch.test.ts
git commit -m "feat: add slash command dispatch (parse + execute)"
```

---

### Task 5: Popup menu state machine + ANSI rendering

**Covers:** Menu architecture (steps 2, 4, 6 from research)

**Files:**
- Create: `agent/slash/menu.ts`
- Create: `tests/slash/menu.test.ts`

- [ ] **Step 1: Write failing test for state machine**

```typescript
// tests/slash/menu.test.ts
import { describe, it, expect, vi } from "vitest"
import { SlashMenu } from "../agent/slash/menu.js"
import type { SlashCommand } from "../agent/slash/registry.js"

const commands: SlashCommand[] = [
  { name: "status", description: "Show status", source: "builtin", handler: async () => {} },
  { name: "model", description: "Switch model", source: "builtin", handler: async () => {} },
  { name: "providers", description: "List providers", source: "builtin", handler: async () => {} },
]

describe("SlashMenu", () => {
  it("starts in editing mode", () => {
    const menu = new SlashMenu(commands)
    expect(menu.mode).toBe("editing")
  })

  it("enters slashMenu mode on /", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    expect(menu.mode).toBe("slashMenu")
    expect(menu.results).toHaveLength(commands.length)
    expect(menu.selected).toBe(0)
  })

  it("filters results on keystroke", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("m")
    expect(menu.results).toHaveLength(1)
    expect(menu.results[0].name).toBe("model")
  })

  it("moves selection down on arrow down", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("\x1B[B") // ANSI down arrow
    expect(menu.selected).toBe(1)
  })

  it("wraps selection to top on arrow down at end", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("\x1B[B")
    menu.handleKey("\x1B[B")
    menu.handleKey("\x1B[B")
    expect(menu.selected).toBe(0)
  })

  it("returns to editing on Escape", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("\x1B") // Escape
    expect(menu.mode).toBe("editing")
  })

  it("selects command on Enter", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("m")
    const selected = menu.handleKey("\r") // Enter
    expect(selected).toBe("model")
    expect(menu.mode).toBe("editing")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/slash/menu.test.ts
```
Expected: FAIL — `SlashMenu` not found

- [ ] **Step 3: Implement menu**

```typescript
// agent/slash/menu.ts
import type { SlashCommand } from "./registry.js"
import { matchCommands } from "./matcher.js"

export type MenuMode = "editing" | "slashMenu"

export class SlashMenu {
  private _mode: MenuMode = "editing"
  private _query = ""
  private _results: SlashCommand[] = []
  private _selected = 0
  private _scrollOffset = 0
  private readonly commands: SlashCommand[]
  private readonly maxVisible = 8

  constructor(commands: SlashCommand[]) {
    this.commands = commands
  }

  get mode(): MenuMode { return this._mode }
  get query(): string { return this._query }
  get results(): SlashCommand[] { return this._results }
  get selected(): number { return this._selected }
  get scrollOffset(): number { return this._scrollOffset }

  handleKey(key: string): string | null {
    if (this._mode === "editing") {
      if (key === "/") {
        this._mode = "slashMenu"
        this._query = "/"
        this._results = matchCommands(this.commands, "")
        this._selected = 0
        this._scrollOffset = 0
        return null
      }
      return null
    }

    // slashMenu mode
    if (key === "\x1B") { // Escape
      this._mode = "editing"
      this._query = ""
      this._results = []
      return null
    }

    if (key === "\x1B[A") { // Arrow up
      this._selected = this._selected > 0 ? this._selected - 1 : this._results.length - 1
      this.adjustScroll()
      return null
    }

    if (key === "\x1B[B") { // Arrow down
      this._selected = this._selected < this._results.length - 1 ? this._selected + 1 : 0
      this.adjustScroll()
      return null
    }

    if (key === "\r") { // Enter
      const cmd = this._results[this._selected]
      this._mode = "editing"
      this._query = ""
      this._results = []
      return cmd?.name ?? null
    }

    if (key === "\x7F" || key === "\b") { // Backspace
      if (this._query.length <= 1) {
        this._mode = "editing"
        this._query = ""
        this._results = []
        return null
      }
      this._query = this._query.slice(0, -1)
      this._results = matchCommands(this.commands, this._query.slice(1))
      this._selected = 0
      this._scrollOffset = 0
      return null
    }

    // Regular character — append to query
    if (key.length === 1) {
      this._query += key
      this._results = matchCommands(this.commands, this._query.slice(1))
      this._selected = 0
      this._scrollOffset = 0
      return null
    }

    return null
  }

  private adjustScroll(): void {
    if (this._selected < this._scrollOffset) {
      this._scrollOffset = this._selected
    } else if (this._selected >= this._scrollOffset + this.maxVisible) {
      this._scrollOffset = this._selected - this.maxVisible + 1
    }
  }

  render(): string {
    if (this._mode !== "slashMenu" || this._results.length === 0) return ""

    const visible = this._results.slice(this._scrollOffset, this._scrollOffset + this.maxVisible)
    const lines = visible.map((cmd, i) => {
      const idx = this._scrollOffset + i
      const prefix = idx === this._selected ? "> " : "  "
      return `${prefix}/${cmd.name}  ${cmd.description}`
    })

    // Move cursor up to overwrite previous popup, then render
    const moveUp = this._results.length > this.maxVisible
      ? this.maxVisible
      : this._results.length

    return `\x1B[${moveUp}A\x1B[J` + lines.join("\n")
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/slash/menu.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/slash/menu.ts tests/slash/menu.test.ts
git commit -m "feat: add slash menu state machine with ANSI popup"
```

---

### Task 6: Wire into cli.ts

**Covers:** Integration into existing CLI (replacing old completer)

**Files:**
- Modify: `agent/cli.ts`
- Delete: `agent/completer.ts` (after verification)

- [ ] **Step 1: Update cli.ts imports and setup**

Replace the old completer import and readline setup. The key changes:

1. Remove `import { createCompleter } from "./completer.js"`
2. Add imports for new slash modules
3. Build registry with builtins
4. Create menu instance
5. Replace `rl.on("line")` with menu-aware input handling
6. Use raw mode for key-by-key input in slashMenu mode

Replace the `main()` function in `agent/cli.ts`:

```typescript
async function main() {
  await loadOrCreateSession()

  const { SlashRegistry, loadBuiltins } = await import("./slash/registry.js")
  const { dispatchSlashCommand } = await import("./slash/dispatch.js")
  const { SlashMenu } = await import("./slash/menu.js")

  const registry = loadBuiltins({
    getStatus: () => formatStatus(getStatus(), {
      model: currentModel ?? registry.getDefault(),
      approvalMode: getApprovalMode(),
      reasoningEnabled,
      contextWindow: 128000,
      messageCount: messages.length,
      toolCallCount,
    }),
    getCurrentModel: () => currentModel ?? registry.getDefault(),
    listProviders: () => registry.listProviders(),
    listModels: (p) => registry.listModels(p),
    getApprovalMode: () => getApprovalMode(),
    setApprovalMode: (m) => setApprovalMode(m as ApprovalMode),
    reasoningEnabled: () => reasoningEnabled,
    toggleReasoning: () => { reasoningEnabled = !reasoningEnabled },
    undoLastBatch: () => undoLastBatch(workspaceRoot),
    gitDiff: (args) => gitDiff(args, workspaceRoot),
    clearSession: () => {
      messages = [{ role: "system", content: formatSystemPromptWithAgentsMd(BASE_SYSTEM_PROMPT, "") }]
      clearPendingBatch()
    },
    exitSession: () => {
      persistSession()
      console.log("  Session saved. Bye!")
      process.exit(0)
    },
  })

  const menu = new SlashMenu(registry.list())

  console.log("\nvector — provider-agnostic coding agent")
  console.log(`  Model: ${currentModel ?? registry.getDefault()}`)
  console.log(`  Mode: ${getApprovalMode()}`)
  console.log(`  Workspace: ${workspaceRoot}`)
  console.log("  Type / for commands, /status for details, /exit to quit.\n")

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "You: ",
  })

  process.stdin.setRawMode?.(true)
  process.stdin.resume()
  process.stdin.setEncoding("utf8")

  let buffer = ""

  process.stdin.on("data", async (key: string) => {
    // Ctrl+C
    if (key === "\x03") {
      console.log("\n  (Ctrl+C) Use /exit to quit.")
      rl.prompt()
      return
    }

    // If not in slashMenu, let readline handle it normally
    if (menu.mode !== "slashMenu") {
      // Pass through to readline for normal input
      return
    }

    // In slashMenu mode, handle keys ourselves
    const selected = menu.handleKey(key)

    if (selected !== null) {
      // Command was selected — dispatch it
      buffer = ""
      await dispatchSlashCommand(`/${selected}`, registry)
      rl.prompt()
      return
    }

    if (menu.mode === "editing") {
      // Escaped out of menu
      buffer = ""
      rl.prompt()
      return
    }

    // Render popup
    const popup = menu.render()
    if (popup) {
      process.stdout.write(popup)
    }
  })

  rl.on("line", async (input) => {
    if (menu.mode === "slashMenu") return

    if (!input.trim()) {
      rl.prompt()
      return
    }

    if (input.startsWith("/")) {
      await dispatchSlashCommand(input, registry)
      rl.prompt()
      return
    }

    // Normal message processing (existing logic)
    messages = addMessage(messages, { role: "user", content: input })
    // ... rest of existing processInput logic
  })

  rl.on("SIGINT", () => {
    console.log("\n  (Ctrl+C) Use /exit to quit.")
    rl.prompt()
  })

  rl.prompt()
}
```

- [ ] **Step 2: Test manually**

```bash
npm start
```
Then type `/` and verify popup appears. Arrow keys navigate, Enter selects, Esc dismisses.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```
Expected: All PASS

- [ ] **Step 4: Delete old completer**

```bash
rm agent/completer.ts tests/completer.test.ts tests/completer.integration.test.ts
```

- [ ] **Step 5: Run tests again to confirm no breakage**

```bash
npx vitest run
```
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add agent/cli.ts agent/completer.ts tests/completer.test.ts tests/completer.integration.test.ts
git commit -m "feat: wire slash menu into CLI, remove old completer"
```

---

### Task 7: Add public index + final verification

**Covers:** Clean API surface

**Files:**
- Create: `agent/slash/index.ts`

- [ ] **Step 1: Create index**

```typescript
// agent/slash/index.ts
export { SlashRegistry, loadBuiltins, type SlashCommand } from "./registry.js"
export { matchCommands } from "./matcher.js"
export { dispatchSlashCommand } from "./dispatch.js"
export { SlashMenu, type MenuMode } from "./menu.js"
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```
Expected: All PASS

- [ ] **Step 3: Manual smoke test**

```bash
npm start
```
- Type `/` → popup appears with all commands
- Type `mo` → filters to `model`
- Arrow down → selection moves
- Enter → executes command
- Type `/` then Esc → popup closes
- Type `/status` blind (no popup) → command executes

- [ ] **Step 4: Final commit**

```bash
git add agent/slash/index.ts
git commit -m "feat: add slash module public API"
```
