# Provider-Agnostic Coding Agent — Final MVP v1 Plan

## 0) Final scope decision

Build `nvcoder`: a **local-first, provider-agnostic coding CLI** that can inspect, edit, and run code inside the current repository with explicit user control.

The original plan is strong. After reviewing the suggestion docs in `conclusion/`, the final v1 plan keeps the same product boundary but upgrades several items from “nice-to-have” to **MVP-critical** because they directly affect data safety, tool reliability, and real-world usability.

## 1) Non-negotiable v1 principles

1. **Provider selection is config, not code.**
   - New providers/models are added through `agent/providers.json`.
   - `engine.ts` must not branch on provider names.

2. **Workspace safety is mandatory.**
   - File tools cannot access paths outside the workspace root.
   - Approval behavior is configurable by mode, but workspace realpath guards are never disabled.
   - File edits and shell commands follow the selected approval mode.

3. **No fragile full-file overwrite as the primary editing path.**
   - Primary edit tool is search/replace, not full overwrite.
   - Full overwrite is allowed only for clearly safe cases such as creating new files or explicit user-approved replacement.

4. **Tool output must be bounded.**
   - Large command output, file output, search results, and file lists must be truncated before being sent back to the model or saved to session.

5. **Provider/model failures must be recoverable.**
   - Missing keys, unavailable models, unreachable providers, rate limits, and context-window pressure produce clear CLI messages.
   - The CLI should not crash into raw SDK stack traces during normal UX paths.

6. **Secrets must not be sent back to cloud models by accident.**
   - Tool outputs must be scrubbed for common secret patterns before they are returned to the model or persisted to disk.

---

## 2) Final v1 scope

### Must Have

1. Interactive terminal chat loop.
2. Provider/model registry from `agent/providers.json`.
3. Model selection via `provider/model-id`.
4. Shared OpenAI-compatible client factory.
5. Provider capability flags for tool-calling behavior.
6. Workspace-scoped file tools.
7. Search-based code discovery tool.
8. Search/replace edit tool with exact-match validation.
9. Safe file creation/full overwrite with diff preview and approval.
10. Shell command execution with approval, timeout, closed stdin, output truncation, and ANSI stripping.
11. Git-aware output: changed files and diff summary.
12. Local session persistence with provider/model stored separately.
13. Session persistence that avoids storing huge raw tool outputs.
14. Graceful fallback flow when selected provider/model is unavailable.
15. Tests for provider registry, safety rules, edit tools, and tool-calling compatibility across NVIDIA plus one secondary provider.
16. Sliding-window history compaction before API calls.
17. Secret scrubbing for file/search/command tool outputs.
18. Binary-file detection for file read/search tools.
19. Configurable approval modes: `ask`, `auto`, and `full`.

### Explicitly Out of Scope for v1

1. Desktop app.
2. IDE plugin.
3. Multi-agent orchestration.
4. Browser automation/computer-use.
5. Remote sync/team collaboration.
6. Full provider abstraction framework such as LiteLLM.
7. Autonomous git commits or pushes.
8. Advanced patch engine beyond exact search/replace.
9. Long-term semantic indexing/RAG.
10. Full undo history across sessions.
11. Git-stash/git-commit based undo automation.
12. Windows shell support.

---

## 3) Final module layout

```txt
agent/
  cli.ts                    # REPL, slash commands, user prompts
  engine.ts                 # model turn loop, tool orchestration, loop guard
  session.ts                # local session load/save/compact
  provider-registry.ts      # providers.json validation and model resolver
  client-factory.ts         # shared OpenAI-compatible client constructor
  safety.ts                 # workspace guard, command policy, approvals
  context.ts                # lightweight repo context for prompts
  types.ts                  # shared types/schemas
  tool-schemas.ts           # Zod tool schemas + generated JSON schemas
  providers.json            # provider/model registry
  tools/
    list-files.ts
    search-code.ts
    read-file.ts
    str-replace.ts
    write-file.ts
    run-command.ts
    git-diff.ts
  utils/
    truncate.ts
    strip-ansi.ts
    format-tool-output.ts
    scrub-secrets.ts
    estimate-tokens.ts
    binary-file.ts
```

---

## 4) Provider registry

### `agent/providers.json`

```json
{
  "providers": {
    "nvidia": {
      "baseURL": "https://integrate.api.nvidia.com/v1",
      "apiKeyEnv": "NVIDIA_API_KEY",
      "models": [
        {
          "id": "qwen/qwen2.5-coder-32b-instruct",
          "supportsTools": true,
          "supportsParallelToolCalls": false,
          "supportsStreamingToolDeltas": false,
          "supportsReasoningTags": false,
          "contextWindow": 128000,
          "fallback": "openrouter/qwen/qwen-2.5-coder-32b-instruct"
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
  "default": "nvidia/qwen/qwen2.5-coder-32b-instruct"
}
```

### Rules

1. `provider/model-id` is parsed by splitting on the first `/`.
   - Example: `nvidia/qwen/qwen2.5-coder-32b-instruct`
   - Provider: `nvidia`
   - Model ID: `qwen/qwen2.5-coder-32b-instruct`

2. `apiKeyEnv: null` is valid for local providers.

3. API keys are resolved lazily.
   - Only the selected provider must have its key present.

4. Missing or invalid config fails fast with a clear startup error.

5. Before adding NVIDIA model IDs to the default registry, verify them with a trivial tool-call compatibility spike.

6. The compatibility spike should update or verify capability flags instead of blindly trusting hand-written metadata.

7. Add `supportsReasoningTags` for models that emit `<think>...</think>` blocks, and strip those tags before final display or tool-call handling.

---

## 5) Client factory

Use one constructor path only:

```ts
createClient({ baseURL, apiKey }) -> new OpenAI({ baseURL, apiKey })
```

Rules:

1. No `if provider === "nvidia"` logic in `engine.ts` or tools.
2. Provider differences are handled by config metadata and capability flags.
3. Error mapping is centralized so raw SDK errors do not leak into the normal CLI UX.
4. `429` rate-limit responses should use bounded exponential backoff/retry.
5. Retry/backoff waits must be interruptible with Ctrl+C.

---

## 6) CLI UX

### Required commands

1. `/help`
2. `/model`
3. `/model <provider/model-id>`
4. `/providers`
5. `/approval`
6. `/approval ask|auto|full`
7. `/diff`
8. `/clear`
9. `/exit`

### Strongly recommended v1 command

- `/undo`

`/undo` is recommended because developer trust is core to a coding agent. Keep it minimal:

- before the first file modification to a path, copy the original file to `.nvcoder/backups/`;
- `/undo` restores the last modified file batch;
- no complex history UI in v1.

If `/undo` risks delaying launch, the minimum acceptable replacement is: **diff preview + approval for every edit + git diff visibility**.

### Approval modes

Approval mode is a runtime/session setting stored in `.nvcoder/session.json`. The CLI should show the active mode at startup and when it changes.

#### 1. `ask` — ask for approval

Default and safest mode.

Behavior:

- Read-only workspace tools auto-run:
  - `list_files`
  - `search_code`
  - `read_file`
  - `git_diff`
- File edits require approval:
  - show diff preview;
  - ask yes/no before applying.
- Shell commands require approval:
  - show command and cwd;
  - ask yes/no before executing.
- Internet/network access requires approval if added to v1 tooling.
- External-file edits outside the workspace are not allowed in v1.

Best for sensitive repos and testing agent behavior.

#### 2. `auto` — approve for me, ask for unsafe

Fast coding mode.

Behavior:

- Read-only workspace tools auto-run.
- File edits auto-apply after internal safety checks:
  - workspace guard;
  - binary-file rejection;
  - stale-file hash check;
  - suspicious full-write size check;
  - backup before write if `/undo` is enabled.
- Shell commands still require approval.
- Potentially unsafe actions still require approval or denial:
  - shell commands;
  - secret-exposure attempts;
  - suspicious full-file overwrite;
  - stale-file edit override;
  - future internet/network tool calls;
  - any attempted external-file access outside the workspace.

Best for rapid prototyping when the repo is backed by git and `/undo` is available.

#### 3. `full` — full access inside this workspace

YOLO mode for disposable/sandboxed workspaces.

Behavior:

- Read-only workspace tools auto-run.
- File edits auto-apply.
- Shell commands auto-execute.
- Approval prompts are skipped for normal in-workspace actions.

Important v1 caveat:

- `full` does **not** mean unrestricted access to any file on the computer in v1.
- `full` means unrestricted auto-approval for actions that still pass the workspace and command-policy guardrails.
- `full` does **not** disable workspace realpath guards.
- `full` does **not** disable secret scrubbing.
- `full` should still hard-deny actions that violate non-negotiable safety rules, such as path traversal outside the workspace.

Best for disposable Docker containers, throwaway clones, or safe sandboxes.

### UX rules

1. Always display the selected model as `provider/model-id`.
2. Translate provider errors into actionable messages:
   - missing API key;
   - unavailable model;
   - unreachable endpoint;
   - rate limited;
   - malformed tool response.
3. Never print unwrapped stack traces in the normal user path.
4. Ctrl+C must be handled cleanly:
   - during model stream: abort request and return to prompt;
   - during command: kill child process and return to prompt;
   - during rate-limit backoff: cancel retry and return to prompt;
   - at idle prompt: ask/exit cleanly.
5. v1 targets macOS/Linux shells only; Windows shell behavior is explicitly out of scope.
6. v1 has no general-purpose internet/browser tool. If a network tool is later added, it must respect the selected approval mode and secret-scrubbing policy.

---

## 7) Required tools

### 7.1 `list_files(path, depth)`

Purpose: list workspace files without flooding context.

Rules:

1. Workspace-scoped.
2. Default depth should be shallow.
3. Large results are truncated.
4. Prefer git-tracked files when inside a git repo.
5. Mark likely binary files instead of previewing or reading them.

### 7.2 `search_code(query, caseSensitive?)`

Purpose: let the agent locate relevant code before reading files.

Implementation:

- Use `ripgrep` if available, otherwise fall back to platform grep or Node-based search.
- Return file path, line number, and short line snippet.
- Skip binary files.
- Scrub common secret patterns from snippets before returning them to the model.
- Truncate results.

### 7.3 `read_file(path, startLine?, endLine?)`

Purpose: read bounded file ranges.

Rules:

1. Workspace-scoped.
2. Return line numbers with content.
3. If a file is large and no range is provided, return a bounded preview plus a message asking for a line range.
4. Do not dump huge files into context.
5. Reject or summarize binary files instead of returning raw bytes.
6. Scrub common secret patterns before returning content to the model.

### 7.4 `str_replace(path, oldText, newText)`

Purpose: primary code-editing tool.

Rules:

1. Workspace-scoped.
2. Prefer exact-match replacement first.
3. Normalize CRLF/LF line endings for matching safety.
4. If exact match fails, allow one conservative fallback: trim trailing whitespace and compare normalized lines. Apply only if exactly one normalized match is found.
5. If no match remains, return a precise error mentioning possible line-ending or trailing-whitespace mismatch.
6. If the match appears multiple times, return an ambiguity error and ask the model to provide more context.
7. Protect against stale edits: store a file hash when `read_file` returns content, and reject `str_replace` if the file changed since the relevant read unless the user explicitly approves continuing.
8. In `ask` mode, show diff preview and require user approval before applying.
9. In `auto` and `full` modes, file edits may auto-apply after all safety checks pass.
10. For approval fatigue in `ask` mode, allow `approve all file edits in this batch` only after showing the full file-edit list; never apply this shortcut to shell commands.
11. Backup original file before first modification in a session if `/undo` is implemented.

### 7.5 `write_file(path, content)`

Purpose: create new files or explicit full replacement.

Rules:

1. Workspace-scoped.
2. New files are allowed after preview/approval.
3. Existing files require diff preview and approval.
4. Size-sanity check required:
   - if replacement content is much shorter than the original, force a stronger warning;
   - default threshold: new content under 50% of original size.
5. Prefer `str_replace` for edits to existing files.

### 7.6 `run_command(command, cwd?)`

Purpose: run tests/builds/inspection commands safely.

Rules:

1. In `ask` and `auto` modes, approval is required for every shell command.
2. In `full` mode, shell commands auto-execute only after workspace/cwd and command-policy checks pass.
3. Show exact command and cwd before running unless `full` mode is active; in `full` mode, log it visibly before execution.
4. Default `cwd` to the workspace root.
5. If a tool call passes `cwd`, validate it with the same workspace guard used for file paths.
6. Close stdin or pipe from null to prevent interactive hangs.
7. Timeout required.
8. Strip ANSI before sending output to the model.
9. Scrub common secret patterns before sending output to the model.
10. Truncate output before sending output to the model.
11. Log approved/denied/auto-approved commands to `.nvcoder/audit.log`.
12. Warn or block obvious secret-exposure commands such as:
   - `cat .env`
   - `env`
   - `printenv`
   - commands targeting files with names like `.env`, `.npmrc`, `.pypirc`, or private key patterns.

### 7.7 `git_diff(filePath?)`

Purpose: summarize changes.

Rules:

1. Read-only.
2. Can show all changed files or one file.
3. Used by `/diff` and final turn summaries.

---

## 8) Safety model

### Workspace root

On startup:

1. Try `git rev-parse --show-toplevel`.
2. If that succeeds, use the git root as workspace root.
3. Otherwise use the current working directory.
4. All file paths must resolve inside the workspace root.
5. Use `fs.realpathSync.native` or equivalent on both workspace root and target paths before the final prefix check, so symlinks inside the repo cannot escape the workspace.

### Approval policy

Approval behavior is controlled by an explicit mode:

1. `ask`: ask before file edits and shell commands.
2. `auto`: auto-approve file edits; ask before shell commands and unsafe actions.
3. `full`: auto-approve file edits and shell commands inside the workspace.

Rules that never change by mode:

1. Workspace realpath guard remains enforced.
2. Binary text-tool rejection remains enforced.
3. Secret scrubbing remains enforced.
4. Tool output truncation remains enforced.
5. Audit logging remains enforced for shell commands.
6. Hard-denied actions are not allowed even in `full` mode.

### Command policy

Use layered safety:

1. User confirmation gate according to approval mode.
2. Timeout for every command.
3. Closed stdin for every command.
4. High-risk destructive command warnings/denials.
5. Secret-exposure warnings/denials.
6. Audit log for approved/denied/auto-approved commands.

Do not rely on a denylist alone.

### File edit policy

1. `str_replace` is default.
2. Existing-file `write_file` follows the selected approval mode, but suspicious full replacement always requires explicit approval outside `full` mode.
3. Large/suspicious replacements require stronger warning.
4. `.nvcoder/` must be gitignored.
5. Binary files are not editable through text tools in v1.
6. `/undo` semantics must be documented clearly: v1 undo restores the previous approved edit batch, including deleting newly-created files if they were created in that batch.

---

## 9) Tool output and session bloat controls

### Output truncation

Implement a shared utility:

```ts
truncateOutput(text, {
  maxChars: 10000,
  headLines: 50,
  tailLines: 150
})
```

Rules:

1. Preserve beginning and end of long outputs.
2. Insert an explicit marker:

```txt
[Output truncated: kept first 50 lines and last 150 lines]
```

3. Apply to:
   - command output;
   - search results;
   - file list results;
   - large file reads;
   - tool outputs stored in sessions.

### Secret scrubbing

Before returning tool output to the model or writing it to session storage, run a lightweight scrubber for common secret patterns, including but not limited to:

- OpenAI-style keys: `sk-...`
- NVIDIA keys: `nvapi-...`
- GitHub tokens: `ghp_...`, `github_pat_...`
- AWS access keys: `AKIA...`
- generic `KEY=...`, `TOKEN=...`, `SECRET=...` style values

Replace detected values with `[REDACTED_SECRET]`. This applies to `read_file`, `search_code`, and `run_command` outputs.

### Tool output formatting

Wrap tool outputs in a consistent structured envelope before feeding them back to the model, for example:

```xml
<tool_output name="read_file" status="ok">
...
</tool_output>
```

This improves parsing reliability for OpenAI-compatible open models.

### Session persistence

Session schema:

```json
{
  "version": 1,
  "workspace": "/abs/path",
  "provider": "nvidia",
  "model": "qwen/qwen2.5-coder-32b-instruct",
  "approvalMode": "ask",
  "messages": [],
  "updatedAt": "ISO-8601"
}
```

Rules:

1. Store provider and model separately.
2. Do not persist huge raw tool outputs.
3. Persist text messages and compact tool summaries.
4. Keep `.nvcoder/` out of git.
5. If loaded provider/model is unavailable:
   - show the problem;
   - list valid configured models;
   - suggest fallback if configured;
   - prompt for model switch;
   - do not crash.

### Sliding-window history compaction

Before every model request:

1. Estimate request size using `js-tiktoken` if already acceptable as a dependency, otherwise use a simple character/word-count heuristic.
2. Compare against the selected model's `contextWindow` from `providers.json`.
3. If estimated usage exceeds 70–80% of the context window:
   - keep the system/developer prompt and repo context;
   - keep the last 3 user/assistant turns;
   - compact or drop the oldest middle history;
   - optionally insert one short summary message describing prior actions.
4. Never wait until the provider returns a context-length 400 to recover.

---

## 10) Engine loop

The engine turn loop:

```txt
user input
  -> model request
  -> optional tool call
  -> tool result
  -> model request
  -> ...
  -> final answer
```

Rules:

1. Hard cap tool calls per user turn.
   - Default: 25.
2. If the cap is reached, stop and ask whether to continue.
3. Gate tool behavior by model capability flags:
   - `supportsTools`
   - `supportsParallelToolCalls`
   - `supportsStreamingToolDeltas`
   - `supportsReasoningTags`
4. If selected model cannot use required tools, show a clear message and recommend compatible models.
5. Streaming should be implemented for normal text output where supported.
6. For v1, buffer tool calls until complete JSON arguments are available. Do not execute partially streamed tool-call deltas.
7. Strip `<think>...</think>` reasoning tags before tool-call handling or final user display for models configured with `supportsReasoningTags`.
8. Validate tool-call arguments before dispatching.

### Tool schema and argument validation

1. Define tool parameter schemas once with Zod.
2. Generate OpenAI JSON schemas from the Zod definitions with `zod-to-json-schema` or equivalent.
3. Validate model-provided tool arguments with the same Zod schema at runtime.
4. If `JSON.parse` fails for tool arguments, optionally try a conservative lenient parser such as JSON5 for common LLM JSON mistakes.
5. If parsing still fails, return a tool error asking the model to correct the JSON instead of crashing the CLI.

---

## 11) Lightweight repo context

To reduce blind tool calls, inject a small repo context block into the system/developer prompt.

Include:

1. workspace root;
2. current git branch;
3. compact git status summary;
4. shallow directory tree or `git ls-files` summary;
5. current selected model.

Rules:

1. Keep this small.
2. Truncate aggressively.
3. Do not include file contents.
4. Do not include secrets.
5. Include only macOS/Linux shell assumptions in v1 docs.

---

## 12) Implementation phases

## Phase 0 — Provider foundation and CLI boot

### Deliverables

1. Create `agent/providers.json`.
2. Implement `provider-registry.ts` with validation.
3. Implement `client-factory.ts` using one OpenAI-compatible constructor path.
4. Replace NVIDIA-centric `model.config.ts` wiring with config-driven lookup.
5. Implement minimal `agent/cli.ts` REPL.
6. Add approval-mode state with default `ask`.
7. Add run script in `package.json`.
8. Add `.nvcoder/` to `.gitignore`.
9. Add a quick provider/model compatibility spike script or test for configured defaults.
10. Use the compatibility spike to verify/populate capability flags such as tool support, parallel tool calls, streaming behavior, and reasoning-tag behavior.

### Exit criteria

- CLI starts.
- Provider config loads.
- Default model resolves.
- Missing key/model/provider errors are human-readable.
- One prompt can be sent to the configured default model.

---

## Phase 1 — Real coding tools

### Deliverables

1. Implement workspace path guard using realpath checks to prevent symlink escape.
2. Implement binary-file detection for read/search/edit tools.
3. Implement `list_files` with depth, binary marking, and truncation.
4. Implement `search_code` with binary skipping and secret scrubbing.
5. Implement `read_file` with line numbers, range support, binary rejection, secret scrubbing, and file-hash capture.
6. Implement `str_replace` with exact-match, conservative normalized fallback, ambiguity checks, stale-file hash checks, and approval batching for file edits.
7. Keep `write_file`, but restrict it to new files or explicit full replacement governed by approval mode and safety checks.
8. Apply approval-mode behavior to file edit tools.
9. Implement `git_diff`.
10. Add shared `truncateOutput` utility.
11. Add ANSI stripping.
12. Add secret scrubbing.
13. Add structured tool-output formatting.
14. Add Zod tool schemas and runtime argument validation.

### Exit criteria

- Agent can find relevant code, read bounded ranges, and apply search/replace edits safely.
- Large outputs do not flood the model context.
- File edits follow the configured approval mode.

---

## Phase 2 — Shell execution and safety hardening

### Deliverables

1. Implement `run_command` approval behavior for `ask`, `auto`, and `full` modes.
2. Enforce command timeout.
3. Close stdin for child processes.
4. Strip ANSI and truncate stdout/stderr.
5. Add command audit log at `.nvcoder/audit.log`.
6. Add destructive-command warning/deny rules.
7. Add secret-exposure warning/deny rules.
8. Implement Ctrl+C handling for model streams, child processes, and rate-limit backoff waits.
9. Validate `run_command.cwd` with the workspace guard.
10. Document macOS/Linux shell support only for v1.

### Exit criteria

- Agent can run tests/build commands safely according to the configured approval mode.
- Interactive or hanging commands do not freeze the CLI indefinitely.
- Potential secret exposure is warned or blocked.
- Approved/denied commands are auditable.

---

## Phase 3 — Sessions, model switching, and resilience

### Deliverables

1. Persist session JSON under `.nvcoder/`.
2. Store provider/model separately.
3. Save compact tool summaries instead of huge raw outputs.
4. Implement `/model` and `/providers`.
5. Implement `/approval` and `/approval ask|auto|full`.
6. Implement `/diff`.
7. Implement `/clear` and `/exit`.
8. Implement graceful unavailable-model flow.
9. Implement configured fallback suggestion.
10. Add bounded retry/backoff for rate limits.
11. Add sliding-window `compactHistory()` before provider requests.
12. Optional but recommended: minimal `/undo` for last file modification batch, with documented behavior for modified and newly-created files.

### Exit criteria

- Restarting CLI resumes safely.
- Missing/deprecated model does not crash the CLI.
- User can switch providers/models and approval modes without code changes.
- Session files remain bounded.

---

## Phase 4 — Compatibility tests and docs

### Deliverables

1. Unit tests for provider config parsing.
2. Unit tests for `provider/model-id` parsing.
3. Unit tests for lazy API key resolution.
4. Unit tests for workspace path traversal prevention.
5. Unit tests for `str_replace` success, normalized fallback, no-match, ambiguous-match, and stale-file hash cases.
6. Unit tests for output truncation.
7. Unit tests for secret scrubbing.
8. Unit tests for binary-file detection.
9. Unit tests for sliding-window history compaction.
10. Unit tests for Zod tool argument validation and malformed JSON recovery.
11. Integration test: prompt → tool call → final response.
12. Integration test: file edit → diff flow in temp repo.
13. Compatibility test for NVIDIA default model plus one secondary provider.
14. README updates:
    - quickstart;
    - command reference;
    - safety model;
    - adding a provider;
    - v1 does not commit/push code;
    - `.nvcoder/` privacy note;
    - macOS/Linux-only v1 shell support;
    - `/undo` semantics.

### Exit criteria

- New provider/model can be added by editing JSON and setting env vars only.
- `engine.ts` has no provider-specific branching.
- Tool-calling works for the tested provider matrix.
- README is enough for a fresh clone user to run the MVP.

---

## 13) Testing strategy

Use `vitest` only.

### Unit tests

1. Provider config validation.
2. `provider/model-id` resolver.
3. Lazy env-key loading.
4. Missing provider/model fallback behavior.
5. Workspace path guard.
6. Secret-risk command detection.
7. Command timeout/truncation helpers.
8. `str_replace` exact-match behavior.
9. `write_file` suspicious-size detection.
10. Session compaction.
11. Sliding-window context compaction.
12. Secret output scrubbing.
13. Binary-file detection.
14. Symlink workspace-escape prevention.
15. Zod tool schema validation.
16. Malformed tool-argument recovery.

### Integration tests

1. Prompt → tool call → final answer.
2. `/model` switch flow.
3. `/approval` mode switch flow.
4. Model unavailable → fallback suggestion.
5. File edit behavior in `ask`, `auto`, and `full` modes.
6. Shell command behavior in `ask`, `auto`, and `full` modes.
7. Temp repo command execution with truncated output.

### Manual smoke tests

1. Start from repo root.
2. Start from a subdirectory and confirm workspace resolves to git root.
3. Try reading outside workspace and confirm denial.
4. Try `cat .env` and confirm warning/denial.
5. Try a command that waits for stdin and confirm it does not hang.
6. Ctrl+C during model stream.
7. Ctrl+C during command execution.
8. Ctrl+C during rate-limit backoff.
9. Try reading a symlink that points outside the workspace and confirm denial.
10. Try reading a binary file and confirm it is rejected/summarized.
11. Try tool output containing a fake secret and confirm it is redacted.

---

## 14) Failure handling requirements

1. Selected model returns 404/deprecated:
   - show `Model unavailable`;
   - show selected model;
   - list configured alternatives;
   - suggest configured fallback if present.

2. API key missing:
   - show exact env var name;
   - show provider name;
   - do not require keys for unselected providers.

3. Provider endpoint unreachable:
   - show provider name;
   - show endpoint;
   - suggest checking network/baseURL.

4. Rate limit:
   - retry with bounded backoff;
   - if still failing, show wait/retry guidance.

5. Tool call malformed:
   - validate with Zod before dispatch;
   - attempt conservative malformed-JSON recovery if useful;
   - show compact model/tool error;
   - ask model to retry if recoverable;
   - stop after loop cap.

6. File edit failed:
   - no partial write;
   - explain exact reason: no match, multiple matches, outside workspace, denied by user, etc.

---

## 15) MVP release checklist

1. CLI runs from fresh clone with one configured provider.
2. `providers.json` is the single source of provider/model truth.
3. `engine.ts` has no provider-specific branching.
4. `str_replace` is the primary edit tool.
5. Existing-file writes require diff preview and approval.
6. Shell commands require approval, timeout, closed stdin, truncation, and audit logging.
7. Tool outputs are bounded and secret-scrubbed before model/session storage.
8. Conversation history is compacted before context-window failure.
9. Symlink escape, binary files, stale file edits, and malformed tool arguments are covered.
10. `.nvcoder/` is gitignored.
11. Sessions recover gracefully from missing/unavailable models.
12. `/model`, `/providers`, `/approval`, `/diff`, `/clear`, `/exit`, and `/help` work.
13. Compatibility tests pass for NVIDIA plus one secondary provider.
14. README includes quickstart, commands, approval modes, safety model, adding-provider workflow, macOS/Linux support note, and `/undo` semantics.
15. Version can be tagged `v1.0.0-mvp`.

---

## 16) Post-MVP roadmap

Only start these after v1 safety and provider-switch reliability are validated.

1. v1.1: richer patch/diff application engine.
2. v1.2: better large-repo retrieval and ranking.
3. v1.3: non-interactive CI mode.
4. v1.4: richer undo/history UX.
5. v2: desktop wrapper reusing the same provider-agnostic engine.
6. v2+: LiteLLM or native non-OpenAI provider adapters if OpenAI-compatible APIs become insufficient.

---

## 17) Final recommendation

The final MVP should not expand into a larger product. It should remain a small local CLI.

The only changes promoted into v1 are the ones that prevent the MVP from being fragile:

1. replace primary full-file overwrite with `str_replace`;
2. add `search_code`;
3. bound all tool outputs;
4. require edit previews and approvals;
5. protect command execution from hangs, secret leaks, and runaway output;
6. cap the tool-call loop;
7. compact session storage;
8. validate provider/model compatibility before advertising models;
9. add sliding-window history compaction;
10. scrub secrets from all tool outputs;
11. prevent symlink workspace escapes;
12. reject binary files in text tools;
13. validate tool arguments from a single Zod schema source.

These are not feature creep. They are the minimum needed for a coding agent that can safely work in a real repository.
