import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { strReplace } from "../../agent/tools/str-replace.js"
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { setApprovalMode } from "../../agent/approval.js"

const workspace = join(tmpdir(), `test-sr-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, "code.ts"), "const x = 1\nconst y = 2\nconst z = 3\n")
  setApprovalMode("full")
})

afterEach(() => {
  setApprovalMode("ask")
  rmSync(workspace, { recursive: true, force: true })
})

describe("strReplace", () => {
  it("replaces exact match", async () => {
    const result = await strReplace(
      { path: "code.ts", oldText: "const x = 1", newText: "const x = 100" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(true)
    const content = readFileSync(join(workspace, "code.ts"), "utf-8")
    expect(content).toBe("const x = 100\nconst y = 2\nconst z = 3\n")
  })

  it("rejects paths outside workspace", async () => {
    const result = await strReplace(
      { path: "../etc/passwd", oldText: "a", newText: "b" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(false)
    expect(result.output).toContain("outside workspace")
  })

  it("returns error when no match found", async () => {
    const result = await strReplace(
      { path: "code.ts", oldText: "nonexistent text", newText: "replacement" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(false)
    expect(result.output).toContain("no match found")
  })

  it("returns error for ambiguous match", async () => {
    writeFileSync(join(workspace, "dup.ts"), "const x = 1\nconst x = 1\n")
    const result = await strReplace(
      { path: "dup.ts", oldText: "const x = 1", newText: "const x = 10" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(false)
    expect(result.output).toContain("2 matches")
  })

  it("creates backup when requested", async () => {
    const result = await strReplace(
      { path: "code.ts", oldText: "const x = 1", newText: "const x = 100" },
      workspace,
      { autoApprove: true, createBackup: true }
    )
    expect(result.applied).toBe(true)
    const backup = readFileSync(join(workspace, "code.ts.bak"), "utf-8")
    expect(backup).toContain("const x = 1")
  })

  it("handles CRLF line endings", async () => {
    writeFileSync(join(workspace, "crlf.ts"), "const x = 1\r\nconst y = 2\r\n")
    const result = await strReplace(
      { path: "crlf.ts", oldText: "const x = 1", newText: "const x = 100" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(true)
  })
})
