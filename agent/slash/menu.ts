import type { SlashCommand } from "./registry.js"
import { matchCommands } from "./matcher.js"

export type MenuMode = "editing" | "slashMenu"

export class SlashMenu {
  private _mode: MenuMode = "editing"
  private _query = ""
  private _results: SlashCommand[] = []
  private _selected = 0
  private _scrollOffset = 0
  private readonly commands: SlashCommand[]
  private readonly maxVisible = 8

  constructor(commands: SlashCommand[]) {
    this.commands = commands
  }

  get mode(): MenuMode { return this._mode }
  get query(): string { return this._query }
  get results(): SlashCommand[] { return this._results }
  get selected(): number { return this._selected }
  get scrollOffset(): number { return this._scrollOffset }

  handleKey(key: string): string | null {
    if (this._mode === "editing") {
      if (key === "/") {
        this._mode = "slashMenu"
        this._query = "/"
        this._results = matchCommands(this.commands, "")
        this._selected = 0
        this._scrollOffset = 0
        return null
      }
      return null
    }

    // slashMenu mode
    if (key === "\x1B") { // Escape
      this._mode = "editing"
      this._query = ""
      this._results = []
      return null
    }

    if (key === "\x1B[A") { // Arrow up
      this._selected = this._selected > 0 ? this._selected - 1 : this._results.length - 1
      this.adjustScroll()
      return null
    }

    if (key === "\x1B[B") { // Arrow down
      this._selected = this._selected < this._results.length - 1 ? this._selected + 1 : 0
      this.adjustScroll()
      return null
    }

    if (key === "\r") { // Enter
      const cmd = this._results[this._selected]
      this._mode = "editing"
      this._query = ""
      this._results = []
      return cmd?.name ?? null
    }

    if (key === "\x7F" || key === "\b") { // Backspace
      if (this._query.length <= 1) {
        this._mode = "editing"
        this._query = ""
        this._results = []
        return null
      }
      this._query = this._query.slice(0, -1)
      this._results = matchCommands(this.commands, this._query.slice(1))
      this._selected = 0
      this._scrollOffset = 0
      return null
    }

    // Regular character — append to query
    if (key.length === 1) {
      this._query += key
      this._results = matchCommands(this.commands, this._query.slice(1))
      this._selected = 0
      this._scrollOffset = 0
      return null
    }

    return null
  }

  private adjustScroll(): void {
    if (this._selected < this._scrollOffset) {
      this._scrollOffset = this._selected
    } else if (this._selected >= this._scrollOffset + this.maxVisible) {
      this._scrollOffset = this._selected - this.maxVisible + 1
    }
  }

  render(): string {
    if (this._mode !== "slashMenu" || this._results.length === 0) return ""

    const visible = this._results.slice(this._scrollOffset, this._scrollOffset + this.maxVisible)
    const lines = visible.map((cmd, i) => {
      const idx = this._scrollOffset + i
      const prefix = idx === this._selected ? "> " : "  "
      return `${prefix}/${cmd.name}  ${cmd.description}`
    })

    // Move cursor up to overwrite previous popup, then render
    const moveUp = this._results.length > this.maxVisible
      ? this.maxVisible
      : this._results.length

    return `\x1B[${moveUp}A\x1B[J` + lines.join("\n")
  }
}
