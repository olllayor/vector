---
feature: agents-md
status: delivered
specs: []
plans:
  - docs/compose/plans/2026-07-02-agents-md.md
branch: main
commits: none (uncommitted)
---

# AGENTS.md Project Context Loading — Final Report

## What Was Built

nvcoder now reads `AGENTS.md` files at session start and injects their content into the system prompt. This lets developers encode project conventions (test commands, style rules, "don't touch" folders) in markdown files that the agent automatically discovers and respects.

The system follows Codex's two-tier model: global instructions (`~/.nvcoder/AGENTS.md`) apply everywhere, while project-level files (walking from Git root to cwd) add or override with directory-specific rules. Override files (`AGENTS.override.md`) always win at each level.

## Architecture

### Files

| File | Purpose |
|------|---------|
| `agent/agents-md.ts` | Core loader: discovery, async reading, concatenation, byte-limit truncation |
| `agent/cli.ts` | Integration: loads AGENTS.md on session start and `/clear` |
| `tests/agents-md.test.ts` | 11 unit tests covering all discovery rules |

### Discovery Rules

1. **Global scope** — `~/.nvcoder/AGENTS.override.md` (preferred) or `~/.nvcoder/AGENTS.md`
2. **Project scope** — Walk from Git root → cwd. Each directory: `AGENTS.override.md` → `AGENTS.md`
3. **Concatenation** — Root-down order. Later files appear later in the system prompt (natural override).
4. **Truncation** — Capped at 32 KiB. Excess content is dropped with a warning comment.

### System Prompt Format

```
You are a coding agent...

<project_instructions>
{content from AGENTS.md files}
</project_instructions>
```

### Key Interfaces

```typescript
// Load AGENTS.md content
export async function loadAgentsMd(opts?: AgentsMdOptions): Promise<string>

// Wrap base prompt with project instructions
export function formatSystemPromptWithAgentsMd(basePrompt: string, agentsMd: string): string

// Options for overriding defaults (useful for testing)
interface AgentsMdOptions {
  projectRoot?: string  // defaults to Git root
  cwd?: string          // defaults to process.cwd()
  maxBytes?: number     // defaults to 32768
  globalDir?: string    // defaults to ~/.nvcoder
}
```

### Design Decisions

- **Async file reads** — Multiple files across directories could block startup. `fs/promises` keeps CLI responsive.
- **`os.homedir()` for global path** — Cross-platform. `~` is not resolved on Windows.
- **Truncation with warning comment** — Prevents silent context loss. LLM sees `<!-- WARNING: ... -->` and knows instructions are incomplete.
- **XML tags for separation** — `<project_instructions>` gives the LLM a clear boundary between core identity and project rules.
- **Reuse `resolveWorkspaceRoot()`** — Already finds Git root for workspace safety. Same logic for AGENTS.md discovery.

## Usage

1. Create `AGENTS.md` in your project root:

```markdown
# Project Conventions

- Use pnpm for package management
- Run `pnpm test` before committing
- Never modify files in `vendor/`
- Prefer `str_replace` over `write_file` for edits
```

2. Optionally create `~/.nvcoder/AGENTS.md` for global preferences:

```markdown
# Global Preferences

- Always run tests after modifying code
- Ask before adding new production dependencies
```

3. Start nvcoder — instructions are loaded automatically:

```
nvcoder
# Output: "Loaded project instructions from AGENTS.md"
```

4. Use `/clear` to reload instructions if you change the files mid-session.

## Verification

- **135 tests pass** (2 skipped — API integration tests that hit real endpoints)
- **TypeScript typecheck clean** — no errors
- **11 new tests** for AGENTS.md cover: empty state, override precedence, global scope, directory walking, empty file skipping, byte-limit truncation, and prompt formatting
