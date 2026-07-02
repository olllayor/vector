import { describe, it, expect } from "vitest"
import { stripThinkingTags, hasThinkingTags, extractThinking } from "../../agent/utils/strip-thinking.js"

const T = "\x3Cthink\x3E"
const TE = "\x3C/think\x3E"

describe("stripThinkingTags", () => {
  it("removes thinking tags", () => {
    const input = T + "Let me think..." + TE + "The answer is 4."
    expect(stripThinkingTags(input)).toBe("The answer is 4.")
  })

  it("handles multiline thinking", () => {
    const input = T + "\nLine 1\nLine 2\n" + TE + "Done"
    expect(stripThinkingTags(input)).toBe("Done")
  })

  it("leaves text without tags unchanged", () => {
    const input = "Just a normal response"
    expect(stripThinkingTags(input)).toBe(input)
  })

  it("handles multiple thinking blocks", () => {
    const input = T + "First thought" + TE + "Text between" + T + "Second thought" + TE + "Final answer"
    expect(stripThinkingTags(input)).toBe("Text betweenFinal answer")
  })
})

describe("hasThinkingTags", () => {
  it("detects thinking tags", () => {
    expect(hasThinkingTags(T + "x" + TE + "y")).toBe(true)
  })

  it("detects no tags", () => {
    expect(hasThinkingTags("hello")).toBe(false)
  })
})

describe("extractThinking", () => {
  it("extracts thinking content", () => {
    const input = T + "Let me think" + TE + "The answer"
    expect(extractThinking(input)).toBe("Let me think")
  })

  it("returns null when no tags", () => {
    expect(extractThinking("hello")).toBeNull()
  })
})
