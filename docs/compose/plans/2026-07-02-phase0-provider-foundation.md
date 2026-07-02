# Phase 0 — Provider Foundation and CLI Boot

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded NVIDIA wiring with a config-driven provider registry, add workspace safety guard, and build a minimal REPL CLI.

**Architecture:** `providers.json` is the single source of truth. `provider-registry.ts` loads and validates it. `client-factory.ts` creates OpenAI-compatible clients from config. `safety.ts` guards workspace paths. `cli.ts` is a minimal REPL that wires everything together. The old `model.config.ts` becomes a thin wrapper over the new system.

**Tech Stack:** TypeScript (ESM), OpenAI SDK, Zod (for validation), `dotenv`

---

### Task 1: Create `agent/providers.json`

**Covers:** §4 Provider registry, §4 Rules

**Files:**
- Create: `agent/providers.json`

- [ ] **Step 1: Create providers.json**

```json
{
  "providers": {
    "nvidia": {
      "baseURL": "https://integrate.api.nvidia.com/v1",
      "apiKeyEnv": "NVAPI_KEY",
      "models": [
        {
          "id": "minimaxai/minimax-m3",
          "supportsTools": true,
          "supportsParallelToolCalls": false,
          "supportsStreamingToolDeltas": false,
          "supportsReasoningTags": false,
          "contextWindow": 128000,
          "fallback": null
        },
        {
          "id": "qwen/qwen3.5-397b-a17b",
          "supportsTools": true,
          "supportsParallelToolCalls": false,
          "supportsStreamingToolDeltas": false,
          "supportsReasoningTags": false,
          "contextWindow": 128000,
          "fallback": null
        },
        {
          "id": "moonshotai/kimi-k2.6",
          "supportsTools": true,
          "supportsParallelToolCalls": false,
          "supportsStreamingToolDeltas": false,
          "supportsReasoningTags": false,
          "contextWindow": 128000,
          "fallback": null
        },
        {
          "id": "z-ai/glm-5.1",
          "supportsTools": true,
          "supportsParallelToolCalls": false,
          "supportsStreamingToolDeltas": false,
          "supportsReasoningTags": false,
          "contextWindow": 128000,
          "fallback": null
        },
        {
          "id": "deepseek-ai/deepseek-v4-flash",
          "supportsTools": true,
          "supportsParallelToolCalls": false,
          "supportsStreamingToolDeltas": false,
          "supportsReasoningTags": false,
          "contextWindow": 128000,
          "fallback": null
        }
      ]
    },
    "openrouter": {
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKeyEnv": "OPENROUTER_API_KEY",
      "models": []
    },
    "ollama": {
      "baseURL": "http://localhost:11434/v1",
      "apiKeyEnv": null,
      "models": []
    }
  },
  "default": "nvidia/minimaxai/minimax-m3"
}
```

- [ ] **Step 2: Add dependencies**

Run: `npm install zod`

- [ ] **Step 3: Commit**

```bash
git add agent/providers.json package.json package-lock.json
git commit -m "feat: add providers.json registry with 3 providers and 5 nvidia models"
```

---

### Task 2: Implement `agent/types.ts`

**Covers:** §3 Module layout, §4 Provider registry, §10 Tool schema

**Files:**
- Create: `agent/types.ts`

- [ ] **Step 1: Create types.ts with Zod schemas**

```typescript
import { z } from "zod"

export const ModelConfigSchema = z.object({
  id: z.string(),
  supportsTools: z.boolean().default(false),
  supportsParallelToolCalls: z.boolean().default(false),
  supportsStreamingToolDeltas: z.boolean().default(false),
  supportsReasoningTags: z.boolean().default(false),
  contextWindow: z.number().default(128000),
  fallback: z.string().nullable().default(null),
})

export const ProviderConfigSchema = z.object({
  baseURL: z.string().url(),
  apiKeyEnv: z.string().nullable(),
  models: z.array(ModelConfigSchema),
})

export const ProvidersSchema = z.object({
  providers: z.record(z.string(), ProviderConfigSchema),
  default: z.string(),
})

export type ModelConfig = z.infer<typeof ModelConfigSchema>
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>
export type ProvidersFile = z.infer<typeof ProvidersSchema>

export interface ResolvedModel {
  provider: string
  modelId: string
  config: ModelConfig
  providerConfig: ProviderConfig
  apiKey: string | null
}

export interface ToolSchema {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add agent/types.ts
git commit -m "feat: add Zod schemas for provider/model config and shared types"
```

---

### Task 3: Implement `agent/provider-registry.ts`

**Covers:** §4 Provider registry, §4 Rules, §14 Failure handling

**Files:**
- Create: `agent/provider-registry.ts`
- Test: `tests/provider-registry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { ProviderRegistry } from "../agent/provider-registry.js"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

function writeProviders(dir: string, data: Record<string, unknown>) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "providers.json"), JSON.stringify(data))
}

describe("ProviderRegistry", () => {
  const validConfig = {
    providers: {
      nvidia: {
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKeyEnv: "NVAPI_KEY",
        models: [
          {
            id: "minimaxai/minimax-m3",
            supportsTools: true,
            contextWindow: 128000,
          },
        ],
      },
      ollama: {
        baseURL: "http://localhost:11434/v1",
        apiKeyEnv: null,
        models: [],
      },
    },
    default: "nvidia/minimaxai/minimax-m3",
  }

  it("loads valid config", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(reg.getDefault()).toBe("nvidia/minimaxai/minimax-m3")
  })

  it("rejects invalid config", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, { providers: {}, default: "x/y" })
    expect(() => new ProviderRegistry(join(dir, "providers.json"))).toThrow()
  })

  it("parses provider/model-id correctly", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    const resolved = reg.resolve("nvidia/minimaxai/minimax-m3")
    expect(resolved.provider).toBe("nvidia")
    expect(resolved.modelId).toBe("minimaxai/minimax-m3")
  })

  it("throws on unknown provider", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(() => reg.resolve("unknown/model")).toThrow("Unknown provider: unknown")
  })

  it("throws on unknown model", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(() => reg.resolve("nvidia/unknown-model")).toThrow("Unknown model: unknown-model")
  })

  it("returns null apiKey when env not set", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    delete process.env.NVAPI_KEY
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    const resolved = reg.resolve("nvidia/minimaxai/minimax-m3")
    expect(resolved.apiKey).toBeNull()
  })

  it("resolves apiKey from env when set", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    process.env.NVAPI_KEY = "test-key-123"
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    const resolved = reg.resolve("nvidia/minimaxai/minimax-m3")
    expect(resolved.apiKey).toBe("test-key-123")
    delete process.env.NVAPI_KEY
  })

  it("lists all providers", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(reg.listProviders()).toEqual(["nvidia", "ollama"])
  })

  it("lists models for a provider", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(reg.listModels("nvidia")).toHaveLength(1)
    expect(reg.listModels("ollama")).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/provider-registry.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement provider-registry.ts**

```typescript
import { readFileSync } from "fs"
import { ProvidersSchema, type ResolvedModel, type ProvidersFile } from "./types.js"

export class ProviderRegistry {
  private data: ProvidersFile

  constructor(private configPath: string) {
    const raw = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(raw)
    const result = ProvidersSchema.safeParse(parsed)
    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")
      throw new Error(`Invalid providers.json:\n${issues}`)
    }
    this.data = result.data
    this.validateDefaults()
  }

  private validateDefaults() {
    const [provider, ...rest] = this.data.default.split("/")
    const modelId = rest.join("/")
    if (!this.data.providers[provider]) {
      throw new Error(`Default provider "${provider}" not found in providers.json`)
    }
    if (!this.data.providers[provider].models.find((m) => m.id === modelId)) {
      throw new Error(`Default model "${modelId}" not found in provider "${provider}"`)
    }
  }

  getDefault(): string {
    return this.data.default
  }

  resolve(ref: string): ResolvedModel {
    const slashIdx = ref.indexOf("/")
    if (slashIdx === -1) {
      throw new Error(`Invalid model reference "${ref}": expected "provider/model-id"`)
    }
    const provider = ref.slice(0, slashIdx)
    const modelId = ref.slice(slashIdx + 1)

    const providerConfig = this.data.providers[provider]
    if (!providerConfig) {
      throw new Error(`Unknown provider: "${provider}". Available: ${Object.keys(this.data.providers).join(", ")}`)
    }

    const config = providerConfig.models.find((m) => m.id === modelId)
    if (!config) {
      throw new Error(
        `Unknown model: "${modelId}" in provider "${provider}". Available: ${providerConfig.models.map((m) => m.id).join(", ") || "(none)"}`
      )
    }

    const apiKey = providerConfig.apiKeyEnv ? process.env[providerConfig.apiKeyEnv] ?? null : null

    return { provider, modelId, config, providerConfig, apiKey }
  }

  listProviders(): string[] {
    return Object.keys(this.data.providers)
  }

  listModels(provider: string): { id: string; supportsTools: boolean; contextWindow: number }[] {
    const p = this.data.providers[provider]
    if (!p) return []
    return p.models.map((m) => ({ id: m.id, supportsTools: m.supportsTools, contextWindow: m.contextWindow }))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/provider-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/provider-registry.ts agent/types.ts tests/provider-registry.test.ts
git commit -m "feat: add ProviderRegistry with Zod validation, model resolution, and env key loading"
```

---

### Task 4: Implement `agent/client-factory.ts`

**Covers:** §5 Client factory

**Files:**
- Create: `agent/client-factory.ts`
- Test: `tests/client-factory.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest"
import { createClient } from "../agent/client-factory.js"
import type { ResolvedModel } from "../agent/types.js"

function fakeResolved(overrides: Partial<ResolvedModel> = {}): ResolvedModel {
  return {
    provider: "nvidia",
    modelId: "minimaxai/minimax-m3",
    config: {
      id: "minimaxai/minimax-m3",
      supportsTools: true,
      supportsParallelToolCalls: false,
      supportsStreamingToolDeltas: false,
      supportsReasoningTags: false,
      contextWindow: 128000,
      fallback: null,
    },
    providerConfig: {
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKeyEnv: "NVAPI_KEY",
      models: [],
    },
    apiKey: "test-key",
    ...overrides,
  }
}

describe("createClient", () => {
  it("creates client with correct baseURL", () => {
    const client = createClient(fakeResolved())
    expect(client.baseURL).toBe("https://integrate.api.nvidia.com/v1")
  })

  it("creates client with API key", () => {
    const client = createClient(fakeResolved({ apiKey: "my-key" }))
    expect(client.apiKey).toBe("my-key")
  })

  it("creates client with null apiKey for local providers", () => {
    const client = createClient(fakeResolved({ apiKey: null }))
    expect(client.apiKey).toBeNull()
  })

  it("throws on missing apiKey for remote provider", () => {
    const model = fakeResolved({
      apiKey: null,
      providerConfig: {
        baseURL: "https://api.example.com/v1",
        apiKeyEnv: "SOME_KEY",
        models: [],
      },
    })
    expect(() => createClient(model)).toThrow("Missing API key")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/client-factory.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement client-factory.ts**

```typescript
import OpenAI from "openai"
import type { ResolvedModel } from "./types.js"

export function createClient(resolved: ResolvedModel): OpenAI {
  if (resolved.providerConfig.apiKeyEnv && !resolved.apiKey) {
    throw new Error(
      `Missing API key for provider "${resolved.provider}". ` +
        `Set environment variable ${resolved.providerConfig.apiKeyEnv}.`
    )
  }

  return new OpenAI({
    baseURL: resolved.providerConfig.baseURL,
    apiKey: resolved.apiKey,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/client-factory.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/client-factory.ts tests/client-factory.test.ts
git commit -m "feat: add createClient factory with lazy API key validation"
```

---

### Task 5: Implement `agent/safety.ts`

**Covers:** §8 Safety model — Workspace root

**Files:**
- Create: `agent/safety.ts`
- Test: `tests/safety.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest"
import { resolveWorkspaceRoot, isInsideWorkspace } from "../agent/safety.js"
import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { execSync } from "child_process"

describe("resolveWorkspaceRoot", () => {
  it("returns git root when inside a git repo", () => {
    const dir = join(tmpdir(), `test-ws-${Date.now()}`)
    mkdirSync(dir)
    execSync("git init", { cwd: dir })
    const root = resolveWorkspaceRoot(dir)
    expect(root).toBe(dir)
  })

  it("returns cwd when not in a git repo", () => {
    const dir = join(tmpdir(), `test-ws-nogit-${Date.now()}`)
    mkdirSync(dir)
    const root = resolveWorkspaceRoot(dir)
    expect(root).toBe(dir)
  })
})

describe("isInsideWorkspace", () => {
  const workspace = join(tmpdir(), `test-ws-guard-${Date.now()}`)
  mkdirSync(workspace)
  execSync("git init", { cwd: workspace })
  writeFileSync(join(workspace, "hello.txt"), "hi")

  it("allows paths inside workspace", () => {
    expect(isInsideWorkspace(join(workspace, "hello.txt"), workspace)).toBe(true)
  })

  it("rejects paths outside workspace", () => {
    expect(isInsideWorkspace("/etc/passwd", workspace)).toBe(false)
  })

  it("rejects parent directory traversal", () => {
    expect(isInsideWorkspace(join(workspace, "..", "etc", "passwd"), workspace)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/safety.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement safety.ts**

```typescript
import { execSync } from "child_process"
import { realpathSync } from "fs"
import { resolve, relative, isAbsolute } from "path"

export function resolveWorkspaceRoot(from?: string): string {
  const cwd = from ?? process.cwd()
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", { cwd, encoding: "utf-8" }).trim()
    return realpathSync(gitRoot)
  } catch {
    return realpathSync(cwd)
  }
}

export function isInsideWorkspace(targetPath: string, workspaceRoot: string): boolean {
  if (!isAbsolute(targetPath)) {
    targetPath = resolve(workspaceRoot, targetPath)
  }
  const realTarget = realpathSync(targetPath)
  const realRoot = realpathSync(workspaceRoot)
  const rel = relative(realRoot, realTarget)
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/safety.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/safety.ts tests/safety.test.ts
git commit -m "feat: add workspace root detection and path guard with symlink safety"
```

---

### Task 6: Refactor `agent/model.config.ts`

**Covers:** §4 Provider registry — replacing NVIDIA-centric wiring

**Files:**
- Modify: `agent/model.config.ts`

- [ ] **Step 1: Rewrite model.config.ts to use registry**

```typescript
import { resolve } from "path"
import { ProviderRegistry } from "./provider-registry.js"
import { createClient } from "./client-factory.js"
import type { ResolvedModel } from "./types.js"
import OpenAI from "openai"

const configPath = resolve(import.meta.dirname ?? ".", "providers.json")
const registry = new ProviderRegistry(configPath)

export { registry }
export type { ResolvedModel }

export function getClient(modelRef?: string): { client: OpenAI; resolved: ResolvedModel } {
  const ref = modelRef ?? registry.getDefault()
  const resolved = registry.resolve(ref)
  const client = createClient(resolved)
  return { client, resolved }
}

// Backward-compatible defaults
const defaultResolved = registry.resolve(registry.getDefault())
export const client = createClient(defaultResolved)
export const model = defaultResolved.modelId
```

- [ ] **Step 2: Update existing tests to pass**

The existing `tests/model.config.test.ts` and `tests/tools.test.ts` import from `model.config.js`. The `client` and `model` exports are preserved, so they should still work. Verify:

Run: `npx vitest run tests/tools.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add agent/model.config.ts
git commit -m "refactor: model.config.ts now delegates to provider registry"
```

---

### Task 7: Implement `agent/cli.ts` REPL

**Covers:** §6 CLI UX, §10 Engine loop

**Files:**
- Create: `agent/cli.ts`

- [ ] **Step 1: Create minimal REPL**

```typescript
import * as readline from "readline"
import { getClient } from "./model.config.js"
import { registry } from "./model.config.js"

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "vector> ",
})

let currentModel: string | undefined

function printHelp() {
  console.log(`
Commands:
  /help                 Show this help
  /model                Show current model
  /model <provider/id>  Switch model
  /providers            List all providers and models
  /diff                 Show git diff (coming soon)
  /clear                Clear conversation (coming soon)
  /exit                 Exit vector
`)
}

function printProviders() {
  for (const p of registry.listProviders()) {
    console.log(`\n  ${p}:`)
    const models = registry.listModels(p)
    if (models.length === 0) {
      console.log("    (no models configured)")
    } else {
      for (const m of models) {
        console.log(`    ${p}/${m.id}  [tools: ${m.supportsTools}, ctx: ${m.contextWindow}]`)
      }
    }
  }
  console.log()
}

function handleCommand(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed.startsWith("/")) return false

  const [cmd, ...args] = trimmed.split(/\s+/)

  switch (cmd) {
    case "/help":
      printHelp()
      break
    case "/model":
      if (args.length === 0) {
        console.log(`Current model: ${currentModel ?? registry.getDefault()}`)
      } else {
        try {
          const ref = args.join("/")
          registry.resolve(ref)
          currentModel = ref
          console.log(`Switched to: ${ref}`)
        } catch (e) {
          console.error(`Error: ${(e as Error).message}`)
        }
      }
      break
    case "/providers":
      printProviders()
      break
    case "/exit":
      console.log("Bye!")
      process.exit(0)
    default:
      console.log(`Unknown command: ${cmd}. Type /help for available commands.`)
  }
  return true
}

async function main() {
  console.log("vector — provider-agnostic coding agent (Phase 0)")
  console.log(`Default model: ${registry.getDefault()}`)
  console.log("Type /help for commands, /exit to quit.\n")

  const ask = () => {
    rl.question("You: ", async (input) => {
      if (!input.trim()) {
        ask()
        return
      }

      if (handleCommand(input)) {
        ask()
        return
      }

      try {
        const { client, resolved } = getClient(currentModel)
        const stream = await client.chat.completions.create({
          model: resolved.modelId,
          messages: [{ role: "user", content: input }],
          stream: true,
        })

        process.stdout.write("\nAssistant: ")
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) process.stdout.write(content)
        }
        console.log("\n")
      } catch (e) {
        const msg = (e as Error).message
        if (msg.includes("401") || msg.includes("Unauthorized")) {
          console.error("Error: Missing or invalid API key. Check your .env file.")
        } else if (msg.includes("404")) {
          console.error(`Error: Model not available. Current: ${currentModel ?? registry.getDefault()}`)
        } else {
          console.error(`Error: ${msg}`)
        }
        console.log()
      }

      ask()
    })
  }

  ask()
}

main()
```

- [ ] **Step 2: Add npm script**

Edit `package.json` to add:
```json
"scripts": {
  "start": "npx tsx agent/cli.ts",
  ...
}
```

- [ ] **Step 3: Commit**

```bash
git add agent/cli.ts package.json
git commit -m "feat: add minimal REPL CLI with /help, /model, /providers, /exit"
```

---

### Task 8: Add `.vector/` to `.gitignore`

**Covers:** §8 Safety model — File edit policy

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append to .gitignore**

Add `.vector/` to the existing `.gitignore`.

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .vector/ to gitignore"
```

---

### Task 9: Run all tests

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Manual smoke test**

Run: `npx tsx agent/cli.ts`
Expected: REPL starts, shows default model, accepts input, streams response

---

### Checkpoint: Phase 0 Exit Criteria

- [ ] CLI starts with `npx tsx agent/cli.ts`
- [ ] Provider config loads from `providers.json`
- [ ] Default model resolves
- [ ] Missing key/model/provider errors are human-readable
- [ ] One prompt can be sent to the configured default model
- [ ] All tests pass
