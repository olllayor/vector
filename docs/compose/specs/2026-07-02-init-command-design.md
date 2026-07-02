# /init Command Design Spec

## [S1] Problem

New vector users have no AGENTS.md. They must manually write one from scratch, which means they miss conventions that are already encoded in their project config (package.json, tsconfig, test framework, etc.). An `/init` command should scan the repo and generate a starter AGENTS.md automatically.

## [S2] Solution Overview

Add a `/init` CLI command that:
1. Reads `package.json`, `tsconfig.json`, lock files, and directory structure
2. Infers project type, package manager, test framework, and available scripts
3. Generates a markdown file with sections matching the existing AGENTS.md format
4. Writes to `<project-root>/AGENTS.md` (overwrites if exists)
5. Prints what was generated

No AI model calls — pure static analysis.

## [S3] Detection Rules

| Signal | Inference |
|--------|-----------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |
| `tsconfig.json` | TypeScript |
| `type: "module"` in package.json | ESM |
| `vitest` in devDependencies | Vitest |
| `jest` in devDependencies | Jest |
| `mocha` in devDependencies | Mocha |
| `eslint` in devDependencies | ESLint |
| `prettier` in devDependencies | Prettier |
| Top-level directories | Architecture hints |

## [S4] Generated AGENTS.md Sections

```markdown
# Project Conventions

{description from package.json}

## Project Type

{language} ({module system}). {framework if detected}.

## Setup

```bash
{package-manager} install
```

## Commands

```bash
{list of scripts from package.json}
```

## Architecture

{directory listing with one-line descriptions}

## Key Conventions

{inferred from config: module system, test framework, linter, etc.}
```

## [S5] Behavior

- Overwrites existing AGENTS.md unconditionally
- No approval prompt — explicit action
- Prints summary of what was generated
- Writes to project root (Git root or cwd)

## [S6] Files

| File | Purpose |
|------|---------|
| Create: `agent/init-agents-md.ts` | Generator logic |
| Modify: `agent/cli.ts` | Add `/init` to dispatch |
| Create: `tests/init-agents-md.test.ts` | Unit tests |
