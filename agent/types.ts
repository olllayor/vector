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
