import { resolve } from "path"
import { ProviderRegistry } from "./provider-registry.js"
import { createClient } from "./client-factory.js"
import type { ResolvedModel } from "./types.js"
import OpenAI from "openai"

const configPath = resolve(import.meta.dirname ?? ".", "providers.json")
const registry = new ProviderRegistry(configPath)

export { registry }
export type { ResolvedModel }

const defaultRef = registry.getDefault()
const defaultResolved = registry.resolve(defaultRef)

let _client: OpenAI | null = null

export function getClient(modelRef?: string): { client: OpenAI; resolved: ResolvedModel } {
  const ref = modelRef ?? defaultRef
  const resolved = registry.resolve(ref)
  const c = createClient(resolved)
  return { client: c, resolved }
}

export function getDefaultClient(): OpenAI {
  if (!_client) _client = createClient(defaultResolved)
  return _client
}

export const model = defaultResolved.modelId

export const FREE_MODELS = [
  { id: "nvidia/nemotron-3-nano-30b-a3b", name: "Nemotron Nano 30B", desc: "reasoning + tool calling, 1M context" },
  { id: "minimaxai/minimax-m3", name: "MiniMax M3", desc: "text-only coding assistant" },
  { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6", desc: "agentic workflows" },
  { id: "deepseek-ai/deepseek-v4-flash", name: "DeepSeek V4 Flash", desc: "fast inference, 1M context" },
] as const

export type FreeModelId = (typeof FREE_MODELS)[number]["id"]
