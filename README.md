# vector

A local-first, provider-agnostic coding agent. Inspect, edit, and run code inside your repository with explicit user control.

## Quickstart

```bash
git clone <repo-url> && cd nvidia-free-models
npm install
cp .env.example .env   # add your API key
npx tsx agent/cli.ts
```

Get a free API key at [build.nvidia.com](https://build.nvidia.com).

## Available Models

| Model | Tool Calling | Reasoning | Context |
|-------|:---:|:---:|--------|
| `nvidia/nemotron-3-nano-30b-a3b` (default) | ✅ | ✅ | 1M |
| `minimaxai/minimax-m3` | ❌ | ✅ | 128k |
| `moonshotai/kimi-k2.6` | ✅ | ✅ | 128k |
| `deepseek-ai/deepseek-v4-flash` | ✅ | ✅ | 1M |

Default: `nvidia/nemotron-3-nano-30b-a3b` — reasoning + tool calling with 1M context.

## Supported Providers

| Provider | Base URL | API Key Env Var |
|----------|----------|-----------------|
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `NVAPI_KEY` |
| OpenRouter | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` |
| Ollama (local) | `http://localhost:11434/v1` | none |

Default model: `nvidia/minimaxai/minimax-m3` (free, 128k context).

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/model` | Show current model |
| `/model <provider/id>` | Switch model (e.g. `/model nvidia/qwen/qwen3.5-397b-a17b`) |
| `/providers` | List all providers and models |
| `/approval` | Show current approval mode |
| `/approval <mode>` | Set mode: `ask`, `auto`, or `full` |
| `/undo` | Undo last file edit batch |
| `/diff` | Show git diff of changes |
| `/clear` | Clear conversation history |
| `/exit` | Save session and quit |

## Approval Modes

| Mode | File Edits | Shell Commands | Best For |
|------|-----------|----------------|----------|
| `ask` (default) | Ask before each edit | Ask before each command | Sensitive repos, testing |
| `auto` | Auto-approve after safety checks | Ask before each command | Rapid prototyping with git backup |
| `full` | Auto-approve | Auto-approve | Sandboxed/disposable workspaces |

All modes enforce: workspace path guards, binary file rejection, secret scrubbing, output truncation, and audit logging.

## Tools

The agent has 7 built-in tools:

- **`list_files`** — List workspace files with depth control
- **`search_code`** — Search codebase via ripgrep/grep with secret scrubbing
- **`read_file`** — Read files with line ranges, binary detection, secret scrubbing
- **`str_replace`** — Search-and-replace with exact match, normalized fallback, stale-file detection, diff preview
- **`write_file`** — Create or overwrite files with size-sanity checks
- **`run_command`** — Execute shell commands with approval, timeout, ANSI stripping, audit logging
- **`git_diff`** — Show git status and diff

## Adding a Provider

Edit `agent/providers.json`:

```json
{
  "providers": {
    "my-provider": {
      "baseURL": "https://api.example.com/v1",
      "apiKeyEnv": "MY_PROVIDER_KEY",
      "models": [
        {
          "id": "my-model-id",
          "supportsTools": true,
          "contextWindow": 128000
        }
      ]
    }
  }
}
```

Then set the env var and switch: `/model my-provider/my-model-id`.

## Safety Model

- **Workspace guard**: All file operations are restricted to the workspace root (git root or cwd). Symlink escapes are blocked via `realpath`.
- **Binary detection**: Binary files are rejected by text tools.
- **Secret scrubbing**: API keys, tokens, and secrets are redacted from all tool outputs before reaching the model.
- **Output truncation**: Large outputs are capped at 10k chars / 50 head + 150 tail lines.
- **Stale-file detection**: SHA-256 hashes track file state; edits to changed files require approval.
- **Command policy**: Shell commands require approval (mode-dependent), have timeouts, closed stdin, and audit logging.
- **Audit log**: All approved/denied commands are logged to `.vector/audit.log`.

## Privacy

- `.vector/` is gitignored and stays local.
- Session data (conversations, backups) never leaves your machine.
- Secrets are scrubbed from tool outputs before being sent to any cloud provider.
- No telemetry, no analytics, no external calls beyond the configured LLM provider.

## Testing

```bash
npm test              # watch mode
npm run test:all      # run all tests
```

116 unit tests covering: provider registry, client factory, workspace safety, all 7 tools, approval system, session persistence, undo, history compaction, secret scrubbing, ANSI stripping, binary detection, and output truncation.

## Architecture

```
agent/
  cli.ts                 # REPL with slash commands
  engine.ts              # (planned) model turn loop
  session.ts             # session save/load/compact
  provider-registry.ts   # providers.json validation and model resolver
  client-factory.ts      # shared OpenAI-compatible client constructor
  approval.ts            # ask/auto/full approval mode system
  safety.ts              # workspace guard, path validation
  undo.ts                # backup tracking and batch undo
  compact.ts             # sliding-window history compaction
  file-hashes.ts         # stale-file detection via SHA-256
  tool-schemas.ts        # Zod schemas for all tool arguments
  types.ts               # shared types
  providers.json         # provider/model registry
  tools/
    read-file.ts         # bounded file reading
    list-files.ts        # directory listing
    search-code.ts       # code search
    str-replace.ts       # search-and-replace
    write-file.ts        # file creation/overwrite
    run-command.ts       # shell execution
    git-diff.ts          # git diff
  utils/
    truncate.ts          # output truncation
    scrub-secrets.ts     # secret redaction
    strip-ansi.ts        # ANSI escape removal
    binary-file.ts       # binary file detection
    format-tool-output.ts # XML envelope wrapper
```

## License

MIT
