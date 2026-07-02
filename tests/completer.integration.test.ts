import { describe, it, expect } from "vitest"
import { createCompleter } from "../agent/completer.js"

describe("completer integration with registry", () => {
  it("completes real model IDs from providers.json", async () => {
    const { ProviderRegistry } = await import("../agent/provider-registry.js")
    const { resolve } = await import("path")

    const configPath = resolve(import.meta.dirname, "..", "agent", "providers.json")
    const registry = new ProviderRegistry(configPath)

    const completer = createCompleter({
      listProviders: () => registry.listProviders(),
      listModels: (p) => registry.listModels(p),
    })

    const [completions] = completer("/model n")
    expect(completions.length).toBeGreaterThan(0)
    expect(completions[0]).toMatch(/^\/model \w+\/\w+\/[\w-]+$/)
  })
})
