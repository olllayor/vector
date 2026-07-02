import { describe, it, expect, beforeEach } from "vitest"
import { SlashRegistry } from "../../agent/slash/registry.js"

describe("SlashRegistry", () => {
  let registry: SlashRegistry

  beforeEach(() => {
    registry = new SlashRegistry()
    registry.register({
      name: "test",
      description: "Test command",
      source: "builtin",
      handler: async () => {},
    })
  })

  it("returns registered commands", () => {
    const commands = registry.list()
    expect(commands).toHaveLength(1)
    expect(commands[0].name).toBe("test")
  })

  it("deduplicates by name, last wins", () => {
    registry.register({
      name: "test",
      description: "Overridden",
      source: "user",
      handler: async () => {},
    })
    const commands = registry.list()
    expect(commands).toHaveLength(1)
    expect(commands[0].description).toBe("Overridden")
    expect(commands[0].source).toBe("user")
  })

  it("resolves command by name", () => {
    const cmd = registry.resolve("test")
    expect(cmd?.name).toBe("test")
  })

  it("returns undefined for unknown command", () => {
    const cmd = registry.resolve("unknown")
    expect(cmd).toBeUndefined()
  })
})
