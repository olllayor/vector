import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { loadAgentsMd, formatSystemPromptWithAgentsMd } from "../agent/agents-md.js"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

function makeTmpDir(): string {
  const dir = join(tmpdir(), `test-agents-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe("loadAgentsMd", () => {
  let tmp: string

  beforeEach(() => {
    tmp = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it("returns empty string when no files exist", async () => {
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: tmp,
      globalDir: join(tmp, "global"),
    })
    expect(result).toBe("")
  })

  it("loads project AGENTS.md", async () => {
    writeFileSync(join(tmp, "AGENTS.md"), "# Project\nUse pnpm")
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: tmp,
      globalDir: join(tmp, "global"),
    })
    expect(result).toContain("# Project")
    expect(result).toContain("Use pnpm")
  })

  it("override wins over primary at same level", async () => {
    writeFileSync(join(tmp, "AGENTS.md"), "# Primary")
    writeFileSync(join(tmp, "AGENTS.override.md"), "# Override")
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: tmp,
      globalDir: join(tmp, "global"),
    })
    expect(result).toContain("# Override")
    expect(result).not.toContain("# Primary")
  })

  it("loads global AGENTS.md", async () => {
    const globalDir = join(tmp, "global")
    mkdirSync(globalDir, { recursive: true })
    writeFileSync(join(globalDir, "AGENTS.md"), "# Global rules")
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: tmp,
      globalDir,
    })
    expect(result).toContain("# Global rules")
  })

  it("global override wins over global primary", async () => {
    const globalDir = join(tmp, "global")
    mkdirSync(globalDir, { recursive: true })
    writeFileSync(join(globalDir, "AGENTS.md"), "# Global Primary")
    writeFileSync(join(globalDir, "AGENTS.override.md"), "# Global Override")
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: tmp,
      globalDir,
    })
    expect(result).toContain("# Global Override")
    expect(result).not.toContain("# Global Primary")
  })

  it("project overrides come after global", async () => {
    const globalDir = join(tmp, "global")
    mkdirSync(globalDir, { recursive: true })
    writeFileSync(join(globalDir, "AGENTS.md"), "# Global")
    writeFileSync(join(tmp, "AGENTS.md"), "# Project")
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: tmp,
      globalDir,
    })
    const globalIdx = result.indexOf("# Global")
    const projectIdx = result.indexOf("# Project")
    expect(projectIdx).toBeGreaterThan(globalIdx)
  })

  it("walks from project root to cwd", async () => {
    const subdir = join(tmp, "src", "lib")
    mkdirSync(subdir, { recursive: true })
    writeFileSync(join(tmp, "AGENTS.md"), "# Root")
    writeFileSync(join(subdir, "AGENTS.md"), "# Nested")
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: subdir,
      globalDir: join(tmp, "global"),
    })
    expect(result).toContain("# Root")
    expect(result).toContain("# Nested")
  })

  it("skips empty files", async () => {
    writeFileSync(join(tmp, "AGENTS.md"), "   \n  \n  ")
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: tmp,
      globalDir: join(tmp, "global"),
    })
    expect(result).toBe("")
  })

  it("truncates at maxBytes with warning", async () => {
    const bigContent = "x".repeat(1000)
    writeFileSync(join(tmp, "AGENTS.md"), bigContent)
    const result = await loadAgentsMd({
      projectRoot: tmp,
      cwd: tmp,
      globalDir: join(tmp, "global"),
      maxBytes: 500,
    })
    expect(result).toContain("WARNING: AGENTS.md context truncated")
    expect(result.length).toBeLessThan(bigContent.length + 200)
  })
})

describe("formatSystemPromptWithAgentsMd", () => {
  it("returns base prompt when no AGENTS.md", () => {
    const base = "You are nvcoder"
    expect(formatSystemPromptWithAgentsMd(base, "")).toBe(base)
  })

  it("wraps AGENTS.md in project_instructions tags", () => {
    const base = "You are nvcoder"
    const content = "Use pnpm"
    const result = formatSystemPromptWithAgentsMd(base, content)
    expect(result).toContain("<project_instructions>")
    expect(result).toContain("Use pnpm")
    expect(result).toContain("</project_instructions>")
    expect(result).toContain("You are nvcoder")
  })
})
