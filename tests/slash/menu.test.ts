import { describe, it, expect } from "vitest"
import { SlashMenu } from "../../agent/slash/menu.js"
import type { SlashCommand } from "../../agent/slash/registry.js"

const commands: SlashCommand[] = [
  { name: "status", description: "Show status", source: "builtin", handler: async () => {} },
  { name: "model", description: "Switch model", source: "builtin", handler: async () => {} },
  { name: "providers", description: "List providers", source: "builtin", handler: async () => {} },
]

describe("SlashMenu", () => {
  it("starts in editing mode", () => {
    const menu = new SlashMenu(commands)
    expect(menu.mode).toBe("editing")
  })

  it("enters slashMenu mode on /", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    expect(menu.mode).toBe("slashMenu")
    expect(menu.results).toHaveLength(commands.length)
    expect(menu.selected).toBe(0)
  })

  it("filters results on keystroke", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("m")
    expect(menu.results).toHaveLength(1)
    expect(menu.results[0].name).toBe("model")
  })

  it("moves selection down on arrow down", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("\x1B[B") // ANSI down arrow
    expect(menu.selected).toBe(1)
  })

  it("wraps selection to top on arrow down at end", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("\x1B[B")
    menu.handleKey("\x1B[B")
    menu.handleKey("\x1B[B")
    expect(menu.selected).toBe(0)
  })

  it("returns to editing on Escape", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("\x1B") // Escape
    expect(menu.mode).toBe("editing")
  })

  it("selects command on Enter", () => {
    const menu = new SlashMenu(commands)
    menu.handleKey("/")
    menu.handleKey("m")
    const selected = menu.handleKey("\r") // Enter
    expect(selected).toBe("model")
    expect(menu.mode).toBe("editing")
  })
})
