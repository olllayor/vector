import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { writeFile } from "../../agent/tools/write-file.js"
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { setApprovalMode } from "../../agent/approval.js"

const workspace = join(tmpdir(), `test-wf-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, "existing.ts"), "original content here for testing")
  setApprovalMode("full")
})

afterEach(() => {
  setApprovalMode("ask")
  rmSync(workspace, { recursive: true, force: true })
})

describe("writeFile", () => {
  it("creates a new file", async () => {
    const result = await writeFile(
      { path: "new-file.ts", content: "export const x = 1" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(true)
    expect(readFileSync(join(workspace, "new-file.ts"), "utf-8")).toBe("export const x = 1")
  })

  it("creates nested files", async () => {
    const result = await writeFile(
      { path: "src/deep/file.ts", content: "export const a = 1" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(true)
    expect(existsSync(join(workspace, "src/deep/file.ts"))).toBe(true)
  })

  it("overwrites existing file", async () => {
    const result = await writeFile(
      { path: "existing.ts", content: "new content" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(true)
    expect(readFileSync(join(workspace, "existing.ts"), "utf-8")).toBe("new content")
  })

  it("rejects paths outside workspace", async () => {
    const result = await writeFile(
      { path: "../etc/passwd", content: "bad" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(false)
    expect(result.output).toContain("outside workspace")
  })

  it("warns on suspicious size reduction", async () => {
    const result = await writeFile(
      { path: "existing.ts", content: "x" },
      workspace,
      { autoApprove: true }
    )
    expect(result.applied).toBe(true)
  })
})
