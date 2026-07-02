import { describe, it, expect } from "vitest"
import { compactHistory, estimateMessageSize } from "../agent/compact.js"
import type { SessionMessage } from "../agent/session.js"

function makeMessages(count: number, contentLength: number = 100): SessionMessage[] {
  const msgs: SessionMessage[] = [
    { role: "system", content: "System prompt" },
  ]
  for (let i = 0; i < count; i++) {
    msgs.push({ role: "user", content: "x".repeat(contentLength) })
    msgs.push({ role: "assistant", content: "y".repeat(contentLength) })
  }
  return msgs
}

describe("compactHistory", () => {
  it("returns unchanged when under threshold", () => {
    const msgs = makeMessages(3, 100)
    const result = compactHistory(msgs)
    expect(result).toEqual(msgs)
  })

  it("compacts when over threshold", () => {
    const msgs = makeMessages(20, 10000)
    const result = compactHistory(msgs)
    expect(result.length).toBeLessThan(msgs.length)
    const hasSummary = result.some((m) => m.content.includes("truncated"))
    expect(hasSummary).toBe(true)
  })

  it("preserves system messages", () => {
    const msgs = makeMessages(20, 10000)
    const result = compactHistory(msgs)
    const systemMsgs = result.filter((m) => m.role === "system")
    expect(systemMsgs.length).toBeGreaterThanOrEqual(1)
  })

  it("preserves recent turns", () => {
    const msgs = makeMessages(20, 10000)
    const result = compactHistory(msgs)
    const lastUser = result.filter((m) => m.role === "user").pop()
    expect(lastUser?.content).toBe("x".repeat(10000))
  })
})

describe("estimateMessageSize", () => {
  it("sums content lengths", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "world!" },
    ]
    expect(estimateMessageSize(msgs)).toBe(11)
  })

  it("returns 0 for empty array", () => {
    expect(estimateMessageSize([])).toBe(0)
  })
})

describe("compactHistory edge cases", () => {
  it("respects contextWindow parameter for threshold", () => {
    const msgs = makeMessages(10, 5000)
    const result = compactHistory(msgs, 128000)
    expect(result.length).toBeLessThanOrEqual(msgs.length)
  })

  it("does not compact when under contextWindow threshold", () => {
    const msgs = makeMessages(2, 100)
    const result = compactHistory(msgs, 128000)
    expect(result).toEqual(msgs)
  })

  it("preserves all system messages after compaction", () => {
    const msgs: SessionMessage[] = [
      { role: "system", content: "System prompt 1" },
      { role: "system", content: "System prompt 2" },
    ]
    for (let i = 0; i < 20; i++) {
      msgs.push({ role: "user", content: "x".repeat(10000) })
      msgs.push({ role: "assistant", content: "y".repeat(10000) })
    }
    const result = compactHistory(msgs)
    const systemMsgs = result.filter((m) => m.role === "system")
    expect(systemMsgs.length).toBeGreaterThanOrEqual(2)
    expect(systemMsgs[0].content).toBe("System prompt 1")
    expect(systemMsgs[1].content).toBe("System prompt 2")
  })

  it("keeps exactly 4 most recent non-system turns", () => {
    const msgs = makeMessages(20, 10000)
    const result = compactHistory(msgs)
    const nonSystem = result.filter((m) => m.role !== "system")
    expect(nonSystem).toHaveLength(4)
  })

  it("returns empty array unchanged", () => {
    const result = compactHistory([])
    expect(result).toEqual([])
  })

  it("summarizes file edit actions in compaction note", () => {
    const msgs: SessionMessage[] = [
      { role: "system", content: "prompt" },
    ]
    for (let i = 0; i < 20; i++) {
      msgs.push({ role: "user", content: "x".repeat(10000) })
      msgs.push({ role: "assistant", content: `I will use str_replace to edit file ${i}.txt` })
    }
    const result = compactHistory(msgs)
    expect(result.length).toBeLessThan(msgs.length)
    const summary = result.find((m) => m.content.includes("truncated"))
    expect(summary).toBeDefined()
    expect(summary!.content).toContain("file edits")
  })
})
