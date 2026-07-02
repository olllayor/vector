import OpenAI from "openai"
import type { ResolvedModel } from "./types.js"

export function createClient(resolved: ResolvedModel): OpenAI {
  if (resolved.providerConfig.apiKeyEnv && !resolved.apiKey) {
    throw new Error(
      `Missing API key for provider "${resolved.provider}". ` +
        `Set environment variable ${resolved.providerConfig.apiKeyEnv}.`
    )
  }

  return new OpenAI({
    baseURL: resolved.providerConfig.baseURL,
    apiKey: resolved.apiKey ?? undefined,
  })
}
