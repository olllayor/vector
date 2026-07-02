import { describe, it, expect } from "vitest"
import { resolveWorkspaceRoot, isInsideWorkspace } from "../agent/safety.js"
import { mkdirSync, writeFileSync, realpathSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { execSync } from "child_process"

describe("resolveWorkspaceRoot", () => {
  it("returns git root when inside a git repo", () => {
    const dir = join(tmpdir(), `test-ws-${Date.now()}`)
    mkdirSync(dir)
    execSync("git init", { cwd: dir })
    const root = resolveWorkspaceRoot(dir)
    expect(root).toBe(realpathSync(dir))
  })

  it("returns cwd when not in a git repo", () => {
    const dir = join(tmpdir(), `test-ws-nogit-${Date.now()}`)
    mkdirSync(dir)
    const root = resolveWorkspaceRoot(dir)
    expect(root).toBe(realpathSync(dir))
  })
})

describe("isInsideWorkspace", () => {
  const workspace = join(tmpdir(), `test-ws-guard-${Date.now()}`)
  mkdirSync(workspace)
  execSync("git init", { cwd: workspace })
  writeFileSync(join(workspace, "hello.txt"), "hi")

  it("allows paths inside workspace", () => {
    expect(isInsideWorkspace(join(workspace, "hello.txt"), workspace)).toBe(true)
  })

  it("allows workspace root itself", () => {
    expect(isInsideWorkspace(workspace, workspace)).toBe(true)
  })

  it("rejects paths outside workspace", () => {
    expect(isInsideWorkspace("/etc/passwd", workspace)).toBe(false)
  })

  it("rejects parent directory traversal", () => {
    expect(isInsideWorkspace(join(workspace, "..", "etc", "passwd"), workspace)).toBe(false)
  })
})
