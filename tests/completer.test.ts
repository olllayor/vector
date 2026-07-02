import { describe, it, expect } from "vitest"
import { createCompleter } from "../agent/completer.js"

describe("createCompleter", () => {
  it("completes command prefixes", () => {
    const completer = createCompleter({
      listProviders: () => ["nvidia"],
      listModels: () => [{ id: "nvidia/deepseek-r1", supportsTools: true, contextWindow: 128000 }],
    })

    const [completions, original] = completer("/mo")
    expect(completions).toContain("/model")
    expect(original).toBe("/mo")
  })

  it("shows all commands when input is /", () => {
    const completer = createCompleter({
      listProviders: () => ["nvidia"],
      listModels: () => [],
    })

    const [completions] = completer("/")
    expect(completions.length).toBeGreaterThan(10)
  })

  it("completes approval modes", () => {
    const completer = createCompleter({
      listProviders: () => [],
      listModels: () => [],
    })

    const [completions] = completer("/approval a")
    expect(completions).toContain("/approval ask")
    expect(completions).toContain("/approval auto")
  })

  it("completes model names from registry", () => {
    const completer = createCompleter({
      listProviders: () => ["nvidia"],
      listModels: () => [{ id: "nvidia/deepseek-r1", supportsTools: true, contextWindow: 128000 }],
    })

    const [completions] = completer("/model nvidia/nvidia/d")
    expect(completions).toContain("/model nvidia/nvidia/deepseek-r1")
  })

  it("returns original when no matches", () => {
    const completer = createCompleter({
      listProviders: () => [],
      listModels: () => [],
    })

    const [completions, original] = completer("/xyz")
    expect(completions).toEqual([])
    expect(original).toBe("/xyz")
  })
})
