import { describe, it, expect, beforeEach } from "vitest"
import { recordUsage, getStatus, resetStatus, formatStatus, StatusState } from "../agent/status.js"

describe("status", () => {
  beforeEach(() => {
    resetStatus()
  })

  it("starts with zero tokens", () => {
    const status = getStatus()
    expect(status.totalPromptTokens).toBe(0)
    expect(status.totalCompletionTokens).toBe(0)
    expect(status.totalTokens).toBe(0)
    expect(status.latestPromptTokens).toBe(0)
    expect(status.turnCount).toBe(0)
  })

  it("accumulates token usage across turns", () => {
    recordUsage({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })
    recordUsage({ prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 })

    const status = getStatus()
    expect(status.totalPromptTokens).toBe(300)
    expect(status.totalCompletionTokens).toBe(130)
    expect(status.totalTokens).toBe(430)
    expect(status.latestPromptTokens).toBe(200)
    expect(status.turnCount).toBe(2)
  })

  it("tracks latestPromptTokens from most recent call", () => {
    recordUsage({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })
    recordUsage({ prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 })
    recordUsage({ prompt_tokens: 300, completion_tokens: 80, total_tokens: 380 })

    const status = getStatus()
    expect(status.latestPromptTokens).toBe(300)
  })

  it("handles null/undefined usage gracefully", () => {
    recordUsage(undefined)
    recordUsage(null as any)

    const status = getStatus()
    expect(status.totalTokens).toBe(0)
    expect(status.turnCount).toBe(0)
  })

  it("formatStatus is a pure function", () => {
    const state: StatusState = {
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      totalTokens: 1500,
      latestPromptTokens: 800,
      turnCount: 5,
    }

    const output = formatStatus(state, {
      model: "nvidia/nvidia/nemotron-3-nano-30b-a3b",
      approvalMode: "ask",
      reasoningEnabled: true,
      contextWindow: 1000000,
      messageCount: 8,
      toolCallCount: 3,
    })

    expect(output).toContain("nvidia/nvidia/nemotron-3-nano-30b-a3b")
    expect(output).toContain("ask")
    expect(output).toContain("ON")
    expect(output).toContain("1,000 prompt")
    expect(output).toContain("500 completion")
    expect(output).toContain("1,500")
    expect(output).toContain("Messages: 8")
    expect(output).toContain("Tool calls: 3")
  })

  it("formatStatus uses latestPromptTokens for context percentage", () => {
    const state: StatusState = {
      totalPromptTokens: 50000,
      totalCompletionTokens: 10000,
      totalTokens: 60000,
      latestPromptTokens: 8000,
      turnCount: 20,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "auto",
      reasoningEnabled: false,
      contextWindow: 128000,
      messageCount: 20,
      toolCallCount: 10,
    })

    // 8000 / 128000 = 6.25% ≈ 6%
    expect(output).toContain("6%")
    expect(output).toContain("128,000")
  })

  it("formatStatus handles undefined contextWindow", () => {
    const state: StatusState = {
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      totalTokens: 1500,
      latestPromptTokens: 800,
      turnCount: 5,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "ask",
      reasoningEnabled: true,
      contextWindow: undefined,
      messageCount: 8,
      toolCallCount: 3,
    })

    expect(output).toContain("Unknown context window")
    expect(output).not.toContain("NaN")
  })

  it("formatStatus handles zero contextWindow", () => {
    const state: StatusState = {
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      totalTokens: 1500,
      latestPromptTokens: 800,
      turnCount: 5,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "ask",
      reasoningEnabled: true,
      contextWindow: 0,
      messageCount: 8,
      toolCallCount: 3,
    })

    expect(output).toContain("Unknown context window")
  })

  it("formatStatus shows <1% when tokens exist but percentage rounds to zero", () => {
    const state: StatusState = {
      totalPromptTokens: 1854,
      totalCompletionTokens: 610,
      totalTokens: 2464,
      latestPromptTokens: 1854,
      turnCount: 1,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "ask",
      reasoningEnabled: true,
      contextWindow: 1000000,
      messageCount: 2,
      toolCallCount: 0,
    })

    expect(output).toContain("<1%")
    expect(output).not.toContain("0%")
  })
})
