import { describe, it, expect, vi } from "vitest"
import { dispatchSlashCommand } from "../../agent/slash/dispatch.js"
import { SlashRegistry } from "../../agent/slash/registry.js"

describe("dispatchSlashCommand", () => {
  it("parses /name and calls handler with empty args", async () => {
    const handler = vi.fn()
    const registry = new SlashRegistry()
    registry.register({ name: "test", description: "", source: "builtin", handler })

    await dispatchSlashCommand("/test", registry)
    expect(handler).toHaveBeenCalledWith("")
  })

  it("parses /name args and passes args string", async () => {
    const handler = vi.fn()
    const registry = new SlashRegistry()
    registry.register({ name: "model", description: "", source: "builtin", handler })

    await dispatchSlashCommand("/model nvidia/deepseek", registry)
    expect(handler).toHaveBeenCalledWith("nvidia/deepseek")
  })

  it("prints error for unknown command", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const registry = new SlashRegistry()

    await dispatchSlashCommand("/unknown", registry)
    expect(consoleSpy).toHaveBeenCalledWith("  Unknown command: /unknown")
    consoleSpy.mockRestore()
  })

  it("handles commands with no args", async () => {
    const handler = vi.fn()
    const registry = new SlashRegistry()
    registry.register({ name: "help", description: "", source: "builtin", handler })

    await dispatchSlashCommand("/help", registry)
    expect(handler).toHaveBeenCalledWith("")
  })
})
