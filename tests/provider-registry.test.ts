import { describe, it, expect } from "vitest"
import { ProviderRegistry } from "../agent/provider-registry.js"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

function writeProviders(dir: string, data: Record<string, unknown>) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "providers.json"), JSON.stringify(data))
}

describe("ProviderRegistry", () => {
  const validConfig = {
    providers: {
      nvidia: {
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKeyEnv: "NVAPI_KEY",
        models: [
          {
            id: "minimaxai/minimax-m3",
            supportsTools: true,
            contextWindow: 128000,
          },
        ],
      },
      ollama: {
        baseURL: "http://localhost:11434/v1",
        apiKeyEnv: null,
        models: [],
      },
    },
    default: "nvidia/minimaxai/minimax-m3",
  }

  it("loads valid config", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(reg.getDefault()).toBe("nvidia/minimaxai/minimax-m3")
  })

  it("rejects invalid config", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, { providers: {}, default: "x/y" })
    expect(() => new ProviderRegistry(join(dir, "providers.json"))).toThrow()
  })

  it("parses provider/model-id correctly", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    const resolved = reg.resolve("nvidia/minimaxai/minimax-m3")
    expect(resolved.provider).toBe("nvidia")
    expect(resolved.modelId).toBe("minimaxai/minimax-m3")
  })

  it("throws on unknown provider", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(() => reg.resolve("unknown/model")).toThrow("Unknown provider")
  })

  it("throws on unknown model", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(() => reg.resolve("nvidia/unknown-model")).toThrow("Unknown model")
  })

  it("returns null apiKey when env not set", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    delete process.env.NVAPI_KEY
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    const resolved = reg.resolve("nvidia/minimaxai/minimax-m3")
    expect(resolved.apiKey).toBeNull()
  })

  it("resolves apiKey from env when set", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    process.env.NVAPI_KEY = "test-key-123"
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    const resolved = reg.resolve("nvidia/minimaxai/minimax-m3")
    expect(resolved.apiKey).toBe("test-key-123")
    delete process.env.NVAPI_KEY
  })

  it("lists all providers", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(reg.listProviders()).toEqual(["nvidia", "ollama"])
  })

  it("lists models for a provider", () => {
    const dir = join(tmpdir(), `test-reg-${Date.now()}`)
    writeProviders(dir, validConfig)
    const reg = new ProviderRegistry(join(dir, "providers.json"))
    expect(reg.listModels("nvidia")).toHaveLength(1)
    expect(reg.listModels("ollama")).toHaveLength(0)
  })
})
