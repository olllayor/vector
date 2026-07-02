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
