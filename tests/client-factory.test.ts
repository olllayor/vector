import { describe, it, expect } from "vitest"
import { createClient } from "../agent/client-factory.js"
import type { ResolvedModel } from "../agent/types.js"

function fakeResolved(overrides: Partial<ResolvedModel> = {}): ResolvedModel {
  return {
    provider: "nvidia",
    modelId: "minimaxai/minimax-m3",
    config: {
      id: "minimaxai/minimax-m3",
      supportsTools: true,
      supportsParallelToolCalls: false,
      supportsStreamingToolDeltas: false,
      supportsReasoningTags: false,
      contextWindow: 128000,
      fallback: null,
    },
    providerConfig: {
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKeyEnv: "NVAPI_KEY",
      models: [],
    },
    apiKey: "test-key",
    ...overrides,
  }
}

describe("createClient", () => {
  it("creates client with correct baseURL", () => {
    const client = createClient(fakeResolved())
    expect(client.baseURL).toBe("https://integrate.api.nvidia.com/v1")
  })

  it("creates client with API key", () => {
    const client = createClient(fakeResolved({ apiKey: "my-key" }))
    expect(client.apiKey).toBe("my-key")
  })

  it("creates client with null apiKey for local providers", () => {
    const client = createClient(fakeResolved({ apiKey: null, providerConfig: { baseURL: "http://localhost:11434/v1", apiKeyEnv: null, models: [] } }))
    expect(client.baseURL).toBe("http://localhost:11434/v1")
  })

  it("throws on missing apiKey for remote provider", () => {
    const model = fakeResolved({
      apiKey: null,
      providerConfig: {
        baseURL: "https://api.example.com/v1",
        apiKeyEnv: "SOME_KEY",
        models: [],
      },
    })
    expect(() => createClient(model)).toThrow("Missing API key")
  })
})
