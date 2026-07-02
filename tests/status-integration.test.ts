import { describe, it, expect, beforeEach } from "vitest"
import { recordUsage, getStatus, resetStatus, formatStatus, getStateForPersist, loadStateFromPersist, StatusState } from "../agent/status.js"

describe("status integration", () => {
  beforeEach(() => {
    resetStatus()
  })

  it("persists and restores token state", () => {
    recordUsage({ prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 })
    recordUsage({ prompt_tokens: 300, completion_tokens: 100, total_tokens: 400 })

    const saved = getStateForPersist()
    resetStatus()

    expect(getStatus().totalTokens).toBe(0)

    loadStateFromPersist(saved)
    const restored = getStatus()
    expect(restored.totalPromptTokens).toBe(800)
    expect(restored.totalCompletionTokens).toBe(300)
    expect(restored.totalTokens).toBe(1100)
    expect(restored.latestPromptTokens).toBe(300)
    expect(restored.turnCount).toBe(2)
  })

  it("handles loadStateFromPersist with missing fields (old session)", () => {
    const oldSession = {
      totalPromptTokens: 500,
      totalCompletionTokens: 200,
      totalTokens: 700,
    }

    loadStateFromPersist(oldSession)
    const restored = getStatus()
    expect(restored.totalPromptTokens).toBe(500)
    expect(restored.totalCompletionTokens).toBe(200)
    expect(restored.totalTokens).toBe(700)
    expect(restored.latestPromptTokens).toBe(0)
    expect(restored.turnCount).toBe(0)
  })

  it("formats complete status output with context window", () => {
    const state: StatusState = {
      totalPromptTokens: 12345,
      totalCompletionTokens: 6789,
      totalTokens: 19134,
      latestPromptTokens: 50000,
      turnCount: 10,
    }

    const output = formatStatus(state, {
      model: "nvidia/nvidia/nemotron-3-nano-30b-a3b",
      approvalMode: "auto",
      reasoningEnabled: false,
      contextWindow: 1000000,
      messageCount: 15,
      toolCallCount: 7,
    })

    expect(output).toContain("vector status")
    expect(output).toContain("Model: nvidia/nvidia/nemotron-3-nano-30b-a3b")
    expect(output).toContain("Approval: auto")
    expect(output).toContain("Reasoning: OFF")
    expect(output).toContain("12,345 prompt")
    expect(output).toContain("6,789 completion")
    expect(output).toContain("19,134")
    expect(output).toContain("Messages: 15")
    expect(output).toContain("Tool calls: 7")
    expect(output).toContain("Context:")
    expect(output).toContain("1,000,000")
    expect(output).toContain("5%")
  })

  it("formats status with unknown context window", () => {
    const state: StatusState = {
      totalPromptTokens: 1000,
      totalCompletionTokens: 500,
      totalTokens: 1500,
      latestPromptTokens: 800,
      turnCount: 5,
    }

    const output = formatStatus(state, {
      model: "test/model",
      approvalMode: "full",
      reasoningEnabled: true,
      contextWindow: undefined,
      messageCount: 8,
      toolCallCount: 3,
    })

    expect(output).toContain("Unknown context window")
    expect(output).not.toContain("NaN")
    expect(output).not.toContain("0%")
  })
})
