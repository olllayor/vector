import { describe, it, expect } from "vitest"
import { stripAnsi } from "../../agent/utils/strip-ansi.js"

describe("stripAnsi", () => {
  it("removes ANSI color codes", () => {
    const input = "\x1b[31mRed text\x1b[0m"
    expect(stripAnsi(input)).toBe("Red text")
  })

  it("removes cursor movement sequences", () => {
    const input = "\x1b[2J\x1b[H"
    expect(stripAnsi(input)).toBe("")
  })

  it("leaves plain text unchanged", () => {
    const input = "Hello, World!"
    expect(stripAnsi(input)).toBe(input)
  })

  it("handles mixed content", () => {
    const input = "prefix\x1b[32m green \x1b[0msuffix"
    expect(stripAnsi(input)).toBe("prefix green suffix")
  })
})
