# Provider-Agnostic Coding Agent — v1 (MVP) Deep Dive Plan

## 1) Product intent

Build a **local-first coding CLI** (working name: `vector`) that feels like a lightweight Codex/Claude-style assistant and can switch providers/models without code changes.

Core job:

> “Help me inspect, modify, and run code in my current repo with explicit user control.”

Non-negotiable architecture rule:

> Provider selection is a **config concern**, not a code concern.

---

## 2) MVP boundaries (anti-feature-creep contract)

### In scope (Must Have)

1. Interactive CLI chat loop in terminal.
2. Provider/model registry from config file (not hardcoded in TypeScript).
3. Model selection via `provider/model` format.
4. OpenAI-compatible client factory shared by all providers.
5. Safe file read/write tools (workspace-scoped).
6. Safe shell execution tool (approval required per command).
7. Git-aware output: changed files + diff summary.
8. Session persistence (local JSON) with provider/model stored separately.
9. Clear fallback behavior when provider/model is unavailable.
10. Tests for tool-calling compatibility across NVIDIA + one secondary provider.

### Explicitly out of scope (v2+)

1. Desktop app (macOS GUI).
2. IDE plugins.
3. Multi-agent orchestration.
4. Browser automation/computer-use.
5. Remote sync/team collaboration.
6. Full provider abstraction framework (LiteLLM) for v1.

---

## 3) Core technical correction to current repo

Current problem: `agent/model.config.ts` is NVIDIA-centric (client + model list hardcoded), which creates vendor lock-in and future refactor cost.

v1 correction:

1. Move provider/model metadata to JSON config (`agent/providers.json`).
2. Load providers at startup with schema validation.
3. Replace provider-specific wiring with a single OpenAI-compatible client factory.
4. Normalize runtime model IDs to `provider/model`.

---

## 4) Target architecture (v1)

## 4.1 Proposed module layout

- `agent/cli.ts` — interactive REPL and slash commands.
- `agent/engine.ts` — turn execution loop and tool orchestration.
- `agent/session.ts` — local session persistence.
- `agent/provider-registry.ts` — load/validate `providers.json`, resolve model.
- `agent/client-factory.ts` — `createClient(baseURL, apiKey?)`.
- `agent/tools/*` — list/read/write/run-command/git-diff.
- `agent/safety.ts` — approvals, workspace path guard, command policy.
- `agent/types.ts` — shared types/schemas.
- `agent/providers.json` — provider/model registry.

## 4.2 Provider registry contract

Example (`agent/providers.json`):

```json
{
  "providers": {
    "nvidia": {
      "baseURL": "https://integrate.api.nvidia.com/v1",
      "apiKeyEnv": "NVIDIA_API_KEY",
      "models": [
        { "id": "minimaxai/minimax-m3", "supportsTools": true, "contextWindow": 128000, "fallback": "openrouter/qwen/qwen-2.5-coder-32b-instruct" }
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

Implementation notes:

1. `apiKeyEnv: null` is valid for local providers.
2. Runtime resolver parses `provider/model-id` (first slash splits provider; remainder is model id).
3. Missing/invalid provider config fails fast with clear startup error.

## 4.3 Client factory rule

Use one path only:

`createClient({ baseURL, apiKey }) -> new OpenAI({ baseURL, apiKey })`

No `if provider === "nvidia"` branches in engine/tool code.

## 4.4 Session schema (v1)

Store provider/model separately for graceful degradation:

```json
{
  "version": 1,
  "workspace": "/abs/path",
  "provider": "nvidia",
  "model": "minimaxai/minimax-m3",
  "messages": [],
  "updatedAt": "ISO-8601"
}
```

If provider/model is unavailable on load:

1. show explicit message,
2. list valid configured models,
3. prompt user to switch model,
4. do not crash.

---

## 5) CLI UX (v1)

Required command surface:

1. `/help`
2. `/model` (show current + available)
3. `/model <provider/model-id>` (switch)
4. `/providers` (list providers and model counts)
5. `/diff`
6. `/clear`
7. `/exit`

UX rules:

1. Always display fully qualified model as `provider/model-id`.
2. Approval required for every shell command execution.
3. Errors should be translated to actionable CLI messages (not raw SDK dumps).

---

## 6) Tooling design for coding workflows

Required tools:

1. `list_files(path, depth)`
2. `read_file(path, startLine?, endLine?)`
3. `write_file(path, content)`
4. `run_command(command, cwd?)`
5. `git_diff()`

Safety:

1. Workspace-only file access via resolved absolute path checks.
2. Command timeout + approval prompt.
3. High-risk command denylist in v1.
4. Explicit error propagation (no silent fallbacks).

---

## 7) Provider compatibility strategy (v1)

Because OpenAI-compatible providers still differ subtly on tool calling:

1. Keep shared OpenAI protocol adapter.
2. Add per-model capability metadata in config (`supportsTools`, optional `supportsParallelToolCalls`, optional `supportsStreamingToolDeltas`).
3. In engine, gate behavior by capability flags rather than provider name.
4. If a model lacks required capability, provide a clear message and recommend alternatives.

Minimum tested matrix before v1 release:

1. All NVIDIA configured models.
2. At least one OpenRouter model.
3. One local model path (Ollama) if available in dev environment.

---

## 8) Implementation phases

## Phase 0 — Foundation + Provider Abstraction (Day 1)

Deliverables:

1. Create `agent/providers.json`.
2. Implement `provider-registry.ts` with validation + resolver.
3. Implement `client-factory.ts` (single OpenAI-compatible constructor path).
4. Replace `model.config.ts` hardcoding with config-driven lookup.
5. Convert empty CLI placeholder to `agent/cli.ts`.
6. Add scripts for running CLI.

Exit criteria:

- CLI starts, loads provider config, and can run one prompt using configured default model.

## Phase 1 — Core tools (Day 2-3)

Deliverables:

1. Replace demo weather/docs tools with repo tools.
2. Tool schemas + dispatcher.
3. Workspace guards and line-range file reads.

Exit criteria:

- Agent can inspect and modify repo files via tool calls.

## Phase 2 — Safety + execution policy (Day 3-4)

Deliverables:

1. `run_command` approval prompt and timeout.
2. Command policy checks.
3. Human-readable approval and denial logs.

Exit criteria:

- Agent can run tests/build commands safely with explicit user consent.

## Phase 3 — Sessions + resilience (Day 4)

Deliverables:

1. Persist provider + model separately in session.
2. Graceful model-unavailable handling + configured fallback support.
3. `/model`, `/providers`, and `/diff` finalized.

Exit criteria:

- Restarting CLI resumes session or gracefully recovers from missing provider/model.

## Phase 4 — Compatibility hardening + docs (Day 5)

Deliverables:

1. Tool-calling compatibility tests across NVIDIA + second provider.
2. Unit tests for provider registry + env-key loading behavior.
3. README section: “Adding a new provider” (JSON edit + env var only).

Exit criteria:

- New provider/model can be added without touching `engine.ts`.

---

## 9) Testing strategy

Use existing stack (`vitest`) only.

Unit tests:

1. Provider config parsing and validation.
2. `provider/model` parsing.
3. Lazy API key resolution (only selected provider required).
4. Session load fallback when provider/model missing.
5. Path traversal and safety policy checks.

Integration tests:

1. Prompt -> tool call -> final response.
2. Switch models with `/model`.
3. Model-unavailable flow with fallback suggestion.
4. File edit + diff flow in temp repo.

---

## 10) Failure handling requirements (must implement)

1. If selected model 404s/deprecated: show “model unavailable” + alternatives from config.
2. If provider key missing: show exact env var needed.
3. If provider endpoint unreachable: show provider name + endpoint + retry guidance.
4. Never print unwrapped raw stack traces to normal UX path.

---

## 11) Success metrics for MVP

1. >=70% completion rate on common coding tasks.
2. <=6 turns average per completed task.
3. 0 critical safety incidents.
4. Provider switch success in <=30 seconds (no code changes).
5. Add-a-provider task completed via docs only (JSON + env var).

---

## 12) Open-source leverage policy (v1)

Use OSS references for patterns, not heavyweight platform dependency:

1. Reference CLI ergonomics from OpenCode/Aider.
2. Keep internal OpenAI-compatible adapter (~small internal layer).
3. **Do not add LiteLLM in v1.**

LiteLLM trigger for v2:

- only when a required provider is not OpenAI-compatible (native Anthropic/Gemini/Bedrock path), or when enterprise routing/observability needs exceed internal adapter scope.

---

## 13) MVP release checklist

1. CLI runs from fresh clone with one configured provider.
2. `providers.json` is the single source of provider/model truth.
3. `engine.ts` has no provider-specific branching.
4. README includes:
   - quickstart
   - command reference
   - safety model
   - adding a new provider (3-line workflow)
5. Compatibility tests pass for NVIDIA + one secondary provider.
6. Version tagged `v1.0.0-mvp`.

---

## 14) Post-MVP roadmap (guarded)

1. v1.1: patch-based editing and partial writes.
2. v1.2: better large-repo context retrieval.
3. v1.3: non-interactive CI mode.
4. v2: desktop wrapper reusing same provider-agnostic engine.

No v2 starts before v1 metrics and provider-switch reliability are validated.
