import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { listFiles } from "../../agent/tools/list-files.js"
import { writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const workspace = join(tmpdir(), `test-lf-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, "a.ts"), "export const a = 1")
  writeFileSync(join(workspace, "b.js"), "export const b = 2")
  mkdirSync(join(workspace, "src"))
  writeFileSync(join(workspace, "src/c.ts"), "export const c = 3")
  mkdirSync(join(workspace, "src/deep"))
  writeFileSync(join(workspace, "src/deep/d.ts"), "export const d = 4")
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe("listFiles", () => {
  it("lists files at depth 1", () => {
    const result = listFiles({ path: ".", depth: 1 }, workspace)
    expect(result).toContain("a.ts")
    expect(result).toContain("b.js")
    expect(result).toContain("src/")
  })

  it("lists files at depth 2", () => {
    const result = listFiles({ path: ".", depth: 2 }, workspace)
    expect(result).toContain("c.ts")
  })

  it("rejects paths outside workspace", () => {
    const result = listFiles({ path: "../etc", depth: 1 }, workspace)
    expect(result).toContain("outside workspace")
  })

  it("handles empty directories", () => {
    mkdirSync(join(workspace, "empty"))
    const result = listFiles({ path: "empty", depth: 1 }, workspace)
    expect(result).toContain("No files found")
  })
})
