# CLI Autocompletions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tab autocompletion for all CLI commands and their arguments.

**Architecture:** Create a `completer.ts` module that returns a function compatible with Node.js `readline`'s `completer` option. The completer filters commands by prefix and provides argument completion for `/model` and `/approval` commands.

**Tech Stack:** Node.js readline, TypeScript, Vitest

---

### Task 1: Create completer module

**Files:**
- Create: `agent/completer.ts`
- Test: `tests/completer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest"
import { createCompleter } from "../agent/completer.js"

describe("createCompleter", () => {
  it("completes command prefixes", () => {
    const completer = createCompleter({
      listProviders: () => ["nvidia"],
      listModels: () => [{ id: "deepseek-r1", supportsTools: true, contextWindow: 128000 }],
    })

    const [completions, original] = completer("/mo")
    expect(completions).toContain("/model")
    expect(original).toBe("/mo")
  })

  it("shows all commands when input is empty", () => {
    const completer = createCompleter({
      listProviders: () => ["nvidia"],
      listModels: () => [],
    })

    const [completions] = completer("/")
    expect(completions.length).toBeGreaterThan(10)
  })

  it("completes approval modes", () => {
    const completer = createCompleter({
      listProviders: () => [],
      listModels: () => [],
    })

    const [completions] = completer("/approval a")
    expect(completions).toContain("/approval ask")
    expect(completions).toContain("/approval auto")
  })

  it("completes model names from registry", () => {
    const completer = createCompleter({
      listProviders: () => ["nvidia"],
      listModels: () => [{ id: "nvidia/deepseek-r1", supportsTools: true, contextWindow: 128000 }],
    })

    const [completions] = completer("/model nvidia/nvidia/d")
    expect(completions).toContain("/model nvidia/nvidia/deepseek-r1")
  })

  it("returns original when no matches", () => {
    const completer = createCompleter({
      listProviders: () => [],
      listModels: () => [],
    })

    const [completions, original] = completer("/xyz")
    expect(completions).toEqual([])
    expect(original).toBe("/xyz")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/completer.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { ProviderRegistry } from "./provider-registry.js"

const COMMANDS = [
  "/status",
  "/help",
  "/init",
  "/model",
  "/providers",
  "/approval",
  "/reasoning",
  "/undo",
  "/diff",
  "/clear",
  "/exit",
]

const APPROVAL_MODES = ["ask", "auto", "full"]

interface CompleterDeps {
  listProviders: () => string[]
  listModels: (provider: string) => { id: string; supportsTools: boolean; contextWindow: number }[]
}

export function createCompleter(deps: CompleterDeps) {
  return function completer(line: string): [string[], string] {
    if (line.startsWith("/")) {
      const parts = line.split(" ")
      const cmd = parts[0]
      const arg = parts.slice(1).join(" ")

      if (cmd === "/approval" && arg) {
        const matches = APPROVAL_MODES
          .filter((m) => m.startsWith(arg))
          .map((m) => `/approval ${m}`)
        return [matches, line]
      }

      if (cmd === "/model" && arg) {
        const allModels: string[] = []
        for (const provider of deps.listProviders()) {
          for (const model of deps.listModels(provider)) {
            allModels.push(`${provider}/${model.id}`)
          }
        }
        const matches = allModels.filter((m) => m.startsWith(arg)).map((m) => `/model ${m}`)
        return [matches, line]
      }

      const matches = COMMANDS.filter((c) => c.startsWith(cmd))
      return [matches, line]
    }

    return [[], line]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/completer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/completer.ts tests/completer.test.ts
git commit -m "feat: add CLI command autocompletion"
```

---

### Task 2: Integrate completer into CLI

**Files:**
- Modify: `agent/cli.ts:336-340`

- [ ] **Step 1: Update readline.createInterface**

```typescript
import { createCompleter } from "./completer.js"

// ... existing code ...

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "You: ",
  completer: createCompleter({
    listProviders: () => registry.listProviders(),
    listModels: (provider) => registry.listModels(provider),
  }),
})
```

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add agent/cli.ts
git commit -m "feat: integrate autocompletion into CLI"
```

---

### Task 3: Add integration test

**Files:**
- Test: `tests/completer.integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect } from "vitest"
import { createCompleter } from "../agent/completer.js"

describe("completer integration with registry", () => {
  it("completes real model IDs from providers.json", async () => {
    const { ProviderRegistry } = await import("../agent/provider-registry.js")
    const { resolve } = await import("path")

    const configPath = resolve(import.meta.dirname, "..", "agent", "providers.json")
    const registry = new ProviderRegistry(configPath)

    const completer = createCompleter({
      listProviders: () => registry.listProviders(),
      listModels: (p) => registry.listModels(p),
    })

    const [completions] = completer("/model n")
    expect(completions.length).toBeGreaterThan(0)
    expect(completions[0]).toMatch(/^\/model \w+\/\w+\/[\w-]+$/)
  })
})
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/completer.integration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/completer.integration.test.ts
git commit -m "test: add autocompletion integration test"
```
