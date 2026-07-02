import { describe, it, expect } from "vitest"
import { matchCommands } from "../../agent/slash/matcher.js"
import type { SlashCommand } from "../../agent/slash/registry.js"

const commands: SlashCommand[] = [
  { name: "status", description: "Show status", source: "builtin", handler: async () => {} },
  { name: "model", description: "Switch model", source: "builtin", handler: async () => {} },
  { name: "providers", description: "List providers", source: "builtin", handler: async () => {} },
  { name: "approval", description: "Set approval mode", source: "builtin", handler: async () => {} },
]

describe("matchCommands", () => {
  it("returns all commands for empty query", () => {
    const results = matchCommands(commands, "")
    expect(results).toHaveLength(commands.length)
  })

  it("fuzzy matches by name", () => {
    const results = matchCommands(commands, "mod")
    expect(results[0].name).toBe("model")
  })

  it("fuzzy matches by description", () => {
    const results = matchCommands(commands, "switch")
    expect(results[0].name).toBe("model")
  })

  it("returns empty for no matches", () => {
    const results = matchCommands(commands, "xyz")
    expect(results).toHaveLength(0)
  })

  it("does not cap results", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      name: `cmd${i}`,
      description: `Command ${i}`,
      source: "builtin" as const,
      handler: async () => {},
    }))
    const results = matchCommands(many, "cmd")
    expect(results).toHaveLength(50)
  })
})
