import { describe, it, expect } from "vitest"
import { truncateOutput } from "../../agent/utils/truncate.js"

describe("truncateOutput", () => {
  it("returns short text unchanged", () => {
    expect(truncateOutput("hello")).toBe("hello")
  })

  it("truncates by char limit", () => {
    const text = "a".repeat(10001)
    const result = truncateOutput(text, { maxChars: 100 })
    expect(result.length).toBeLessThan(10001)
    expect(result).toContain("truncated")
  })

  it("truncates by line count", () => {
    const text = Array.from({ length: 300 }, (_, i) => `line ${i}`).join("\n")
    const result = truncateOutput(text, { headLines: 10, tailLines: 20 })
    expect(result).toContain("kept first 10 lines")
    expect(result).toContain("line 0")
    expect(result).toContain("line 299")
  })

  it("preserves head and tail lines", () => {
    const text = Array.from({ length: 100 }, (_, i) => `L${i}`).join("\n")
    const result = truncateOutput(text, { headLines: 5, tailLines: 5 })
    const lines = result.split("\n")
    expect(lines[0]).toBe("L0")
    expect(lines[1]).toBe("L1")
    expect(lines[lines.length - 1]).toBe("L99")
  })
})
