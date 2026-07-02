import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { gitDiff } from "../../agent/tools/git-diff.js"
import { writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { execSync } from "child_process"

const workspace = join(tmpdir(), `test-gd-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  execSync("git init", { cwd: workspace })
  execSync("git config user.email 'test@test.com'", { cwd: workspace })
  execSync("git config user.name 'Test'", { cwd: workspace })
  writeFileSync(join(workspace, "file.ts"), "original")
  execSync("git add . && git commit -m 'init'", { cwd: workspace })
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe("gitDiff", () => {
  it("shows no changes when clean", () => {
    const result = gitDiff({}, workspace)
    expect(result).toContain("No changes")
  })

  it("shows diff for modified files", () => {
    writeFileSync(join(workspace, "file.ts"), "modified")
    const result = gitDiff({}, workspace)
    expect(result).toContain("modified")
  })

  it("shows diff for a specific file", () => {
    writeFileSync(join(workspace, "file.ts"), "modified")
    const result = gitDiff({ filePath: "file.ts" }, workspace)
    expect(result).toContain("modified")
  })
})
