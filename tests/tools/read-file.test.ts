import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFile } from "../../agent/tools/read-file.js"
import { writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const workspace = join(tmpdir(), `test-rf-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, "hello.ts"), "const x = 1\nconst y = 2\nconst z = 3\n")
  writeFileSync(join(workspace, "secret.ts"), 'const key = "nvapi-supersecret12345678"\n')
  mkdirSync(join(workspace, "sub"))
  writeFileSync(join(workspace, "sub/nested.ts"), "export const a = 1\n")
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe("readFile", () => {
  it("reads a file with line numbers", () => {
    const result = readFile({ path: "hello.ts" }, workspace)
    expect(result).toContain("1: const x = 1")
    expect(result).toContain("2: const y = 2")
    expect(result).toContain("3: const z = 3")
  })

  it("reads a specific line range", () => {
    const result = readFile({ path: "hello.ts", startLine: 2, endLine: 3 }, workspace)
    expect(result).toContain("2: const y = 2")
    expect(result).toContain("3: const z = 3")
    expect(result).not.toContain("1: const x = 1")
  })

  it("rejects paths outside workspace", () => {
    const result = readFile({ path: "../etc/passwd" }, workspace)
    expect(result).toContain("outside workspace")
  })

  it("scrubs secrets from output", () => {
    const result = readFile({ path: "secret.ts" }, workspace)
    expect(result).not.toContain("nvapi-supersecret")
    expect(result).toContain("[REDACTED_SECRET]")
  })

  it("returns error for non-existent file", () => {
    const result = readFile({ path: "nope.txt" }, workspace)
    expect(result).toContain("Error reading")
  })

  it("handles nested files", () => {
    const result = readFile({ path: "sub/nested.ts" }, workspace)
    expect(result).toContain("1: export const a = 1")
  })
})
