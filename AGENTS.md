# Free Models

Access free frontier models via multiple providers (NVIDIA NIM, OpenRouter, Ollama, etc.). Provider-agnostic coding agent (nvcoder) in progress.

## Project Type

ESM TypeScript (`"type": "module"`). Uses `openai` SDK pointed at `https://integrate.api.nvidia.com/v1`.

## Setup

```bash
cp .env.example .env   # add NVAPI_KEY from build.nvidia.com
pnpm install
```

## Commands

```bash
pnpm test:models    # verify all 5 models connect (hits real API, 60s timeout each)
pnpm test:agent     # test tool-use flow
pnpm test:tools     # unit tests for config
pnpm test:all       # run everything
```

`pnpm test` runs vitest in watch mode.

## Architecture

- `agent/model.config.ts` — OpenAI client, model list, `FREE_MODELS` array
- `agent/tools.ts` — demo agent loop with tool-calling (weather/docs)
- `agent/cli/` — empty (planned REPL for nvcoder)
- `tests/` — integration tests that make real API calls

## Key Conventions

- Model IDs use `provider/model` format: `minimaxai/minimax-m3`, `qwen/qwen3.5-397b-a17b`, etc.
- `FREE_MODELS` is `as const` — typed as `FreeModelId`
- Tests have 60s timeouts (network calls)
- No linter or formatter configured yet
- No CI pipeline yet

## Planned Work

See `FINAL_MVP_V1_PLAN.md` for the nvcoder roadmap. Phase 0 targets:
- `agent/providers.json` for config-driven model selection
- `agent/provider-registry.ts`, `agent/client-factory.ts`
- Replace hardcoded NVIDIA wiring with provider abstraction
