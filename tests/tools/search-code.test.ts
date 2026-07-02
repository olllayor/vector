import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { searchCode } from "../../agent/tools/search-code.js"
import { writeFileSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const workspace = join(tmpdir(), `test-sc-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, "app.ts"), 'const greeting = "hello world"\nconst target = "hello there"\n')
  writeFileSync(join(workspace, "config.ts"), 'export const API_URL = "https://api.example.com"\n')
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe("searchCode", () => {
  it("finds matching lines", () => {
    const result = searchCode({ query: "hello", caseSensitive: false }, workspace)
    expect(result).toContain("greeting")
    expect(result).toContain("target")
  })

  it("returns no results message when nothing found", () => {
    const result = searchCode({ query: "zzzznonexistent", caseSensitive: false }, workspace)
    expect(result).toContain("No results")
  })

  it("includes file path and line numbers", () => {
    const result = searchCode({ query: "greeting", caseSensitive: false }, workspace)
    expect(result).toContain("app.ts")
    expect(result).toContain("1:")
  })

  it("scrubs secrets from results", () => {
    writeFileSync(join(workspace, "env.ts"), 'const key = "nvapi-supersecret12345678"\n')
    const result = searchCode({ query: "nvapi", caseSensitive: false }, workspace)
    expect(result).not.toContain("nvapi-supersecret")
  })
})
