import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { saveSession, loadSession, clearSession, addMessage, getSessionSize, type SessionMessage } from "../agent/session.js"
import { mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const workspace = join(tmpdir(), `test-sess-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  mkdirSync(join(workspace, ".vector"), { recursive: true })
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe("Session persistence", () => {
  it("saves and loads session", () => {
    const messages: SessionMessage[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ]
    saveSession(workspace, {
      workspace,
      provider: "nvidia",
      model: "test-model",
      approvalMode: "ask",
      messages,
    })

    const loaded = loadSession(workspace)
    expect(loaded).not.toBeNull()
    expect(loaded!.provider).toBe("nvidia")
    expect(loaded!.model).toBe("test-model")
    expect(loaded!.messages).toHaveLength(2)
  })

  it("returns null for missing session", () => {
    const loaded = loadSession(join(tmpdir(), `no-session-${Date.now()}`))
    expect(loaded).toBeNull()
  })

  it("clears session", () => {
    saveSession(workspace, {
      workspace,
      provider: "nvidia",
      model: "test",
      approvalMode: "ask",
      messages: [{ role: "user", content: "hi" }],
    })
    clearSession(workspace)
    expect(loadSession(workspace)).toBeNull()
  })

  it("truncates large tool outputs on save", () => {
    const bigOutput = "x".repeat(1000)
    const messages: SessionMessage[] = [
      { role: "tool", content: bigOutput, tool_call_id: "1" },
    ]
    saveSession(workspace, {
      workspace,
      provider: "nvidia",
      model: "test",
      approvalMode: "ask",
      messages,
    })

    const loaded = loadSession(workspace)
    expect(loaded!.messages[0].content.length).toBeLessThan(1000)
    expect(loaded!.messages[0].content).toContain("truncated")
  })
})

describe("addMessage", () => {
  it("appends message to array", () => {
    const msgs: SessionMessage[] = [{ role: "user", content: "hi" }]
    const result = addMessage(msgs, { role: "assistant", content: "hello" })
    expect(result).toHaveLength(2)
    expect(result[1].content).toBe("hello")
  })
})

describe("getSessionSize", () => {
  it("calculates total character count", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "world!" },
    ]
    expect(getSessionSize(msgs)).toBe(11)
  })

  it("returns 0 for empty array", () => {
    expect(getSessionSize([])).toBe(0)
  })
})

describe("Session edge cases", () => {
  it("truncates tool output over 500 chars", () => {
    const msgs: SessionMessage[] = [
      { role: "tool", content: "x".repeat(1000), tool_call_id: "1" },
    ]
    saveSession(workspace, {
      workspace,
      provider: "nvidia",
      model: "test",
      approvalMode: "ask",
      messages: msgs,
    })
    const loaded = loadSession(workspace)
    expect(loaded!.messages[0].content).toContain("truncated")
    expect(loaded!.messages[0].content.length).toBeLessThan(1000)
  })

  it("does not truncate tool output under 500 chars", () => {
    const msgs: SessionMessage[] = [
      { role: "tool", content: "x".repeat(499), tool_call_id: "1" },
    ]
    saveSession(workspace, {
      workspace,
      provider: "nvidia",
      model: "test",
      approvalMode: "ask",
      messages: msgs,
    })
    const loaded = loadSession(workspace)
    expect(loaded!.messages[0].content).toBe("x".repeat(499))
  })

  it("preserves approval mode in session", () => {
    saveSession(workspace, {
      workspace,
      provider: "nvidia",
      model: "test",
      approvalMode: "full",
      messages: [],
    })
    const loaded = loadSession(workspace)
    expect(loaded!.approvalMode).toBe("full")
  })

  it("returns null for corrupted session file", () => {
    const { writeFileSync: wf } = require("fs")
    const path = require("path").resolve(workspace, ".vector", "session.json")
    wf(path, "not json{{{")
    expect(loadSession(workspace)).toBeNull()
  })

  it("does not truncate non-tool messages", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "x".repeat(1000) },
    ]
    saveSession(workspace, {
      workspace,
      provider: "nvidia",
      model: "test",
      approvalMode: "ask",
      messages: msgs,
    })
    const loaded = loadSession(workspace)
    expect(loaded!.messages[0].content.length).toBe(1000)
  })
})
