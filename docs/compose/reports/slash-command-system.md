---
feature: slash-command-system
status: delivered
specs: []
plans:
  - docs/compose/plans/2026-07-02-slash-command-system.md
branch: main
commits: 54ca761..d6d20b2
---

# Slash Command System — Final Report

## What Was Built

A state-machine-driven slash command system for the vector CLI agent. The system replaces the old prefix-matching completer with a fuzzy-matching popup menu that appears when the user types `/` at the start of input. Commands are registered in a central registry, matched using fuzzysort, and executed via a dispatch function decoupled from the UI.

The popup menu renders using ANSI escape codes in raw terminal mode, supports arrow key navigation, filtering as you type, and Enter to select. Escape dismisses the menu. Raw mode is safely restored on all exit paths (explicit `/exit`, Ctrl+C, SIGTERM). The system is fully testable with 30 unit tests across 4 modules.

## Architecture

```
agent/slash/
├── index.ts       # Public API re-exports
├── registry.ts    # Command registry (Map-based, dedup by name)
├── builtins.ts    # Built-in commands (status, help, model, etc.)
├── matcher.ts     # Fuzzy matching via fuzzysort
├── dispatch.ts    # Parse /name args → resolve → execute
└── menu.ts        # State machine + ANSI popup rendering
```

**Data flow:**
1. User types `/` → menu enters `slashMenu` mode
2. Each keystroke runs `matchCommands()` against the registry
3. Arrow keys update `selected` index (with scroll offset for >8 results)
4. Enter calls `dispatchSlashCommand()` with the selected command name
5. Dispatch parses `/name args`, resolves from registry, calls handler

**Key types:**
- `SlashCommand` — `{ name, description, source, handler }`
- `SlashRegistry` — Map-based registry with `register()`, `resolve()`, `list()`
- `SlashMenu` — State machine: `editing | slashMenu(query, results, selected, scrollOffset)`
- `MenuMode` — Union type for the two states

### Design Decisions

- **fuzzysort over trie/Levenshtein**: Commands list is small (<20 entries), so O(n) fuzzy scan is fine. fuzzysort is the same choice OpenCode made — cheap, no config, good enough.
- **Name matches weighted 2x**: Users type command names more often than descriptions. Score function boosts name matches.
- **No result cap at match level**: Avoided OpenCode's #17027 bug where capping before rendering made arrow nav wrap inside truncated set. Cap only at render time (maxVisible=8).
- **Raw readline + ANSI over Ink**: Project uses Node readline, not Ink. Same state machine, just ANSI codes for popup instead of JSX.
- **Dispatch decoupled from UI**: Works identically whether typed blind or picked from popup. Clean separation per Codex's pattern.
- **Raw mode safety**: Terminal raw mode is restored on `exit`, `SIGINT`, and `SIGTERM` via process handlers, plus explicit cleanup in `exitSession`. Prevents broken terminal state on unexpected exits.

## Usage

Type `/` at the start of input to open the command menu. Type to filter, arrow keys to navigate, Enter to select, Escape to dismiss.

Commands:
- `/status` — Show model, approvals, token usage
- `/help` — List available commands
- `/model [name]` — Show or switch model
- `/providers` — List all providers and models
- `/approval [mode]` — Show or set approval mode (ask/auto/full)
- `/reasoning` — Toggle reasoning display
- `/undo` — Undo last file edit batch
- `/diff` — Show git diff
- `/clear` — Clear conversation history
- `/exit` — Exit vector
- `/init` — Generate AGENTS.md for project

Direct typing also works: `/model nvidia/deepseek` executes immediately without the popup.

## Verification

**Test suite:** 28 test files pass, 182 tests pass, 8 skipped (model config tests that require network).

**New tests (30 total):**
- `registry.test.ts` — 4 tests: register, dedup, resolve, unknown
- `matcher.test.ts` — 5 tests: empty query, name match, desc match, no match, uncapped results
- `dispatch.test.ts` — 4 tests: no args, with args, unknown command, empty args
- `menu.test.ts` — 7 tests: initial mode, enter menu, filter, arrow down, wrap, escape, enter select

**Manual verification:** `npm start` → type `/` → popup appears → arrow keys navigate → Enter selects → Escape dismisses → direct `/command` typing works.

## Journey Log

- [lesson] vitest with `"moduleResolution": "bundler"` requires `.js` extensions in imports but resolves `.ts` files. Tests in subdirectories need correct relative paths (`../../agent/slash/registry.js`).
- [pivot] Initial plan had Ink/JSX for popup. Adapted to raw readline + ANSI after discovering project uses Node readline, not Ink. Same state machine, different rendering.
- [lesson] Raw mode must be restored on all exit paths. `process.exit()` doesn't trigger cleanup handlers by default — need explicit `setRawMode(false)` in exit handler plus `process.on('exit')` safety net.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/plans/2026-07-02-slash-command-system.md` | Implementation plan | Complete, 7 tasks |
