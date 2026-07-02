import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { gatherProjectFacts, generateStatic } from "../agent/init-agents-md.js"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

function makeTmpDir(): string {
  const dir = join(tmpdir(), `test-init-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe("gatherProjectFacts", () => {
  let tmp: string

  beforeEach(() => {
    tmp = makeTmpDir()
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it("detects pnpm from lock file", async () => {
    writeFileSync(join(tmp, "package.json"), '{"name":"test"}')
    writeFileSync(join(tmp, "pnpm-lock.yaml"), "")
    const facts = await gatherProjectFacts(tmp)
    expect(facts.packageManager).toBe("pnpm")
  })

  it("detects TypeScript from tsconfig", async () => {
    writeFileSync(join(tmp, "package.json"), '{"name":"test"}')
    writeFileSync(join(tmp, "tsconfig.json"), "{}")
    const facts = await gatherProjectFacts(tmp)
    expect(facts.language).toBe("TypeScript")
  })

  it("detects ESM from type module", async () => {
    writeFileSync(join(tmp, "package.json"), '{"name":"test","type":"module"}')
    const facts = await gatherProjectFacts(tmp)
    expect(facts.moduleSystem).toBe("ESM")
  })

  it("detects vitest", async () => {
    writeFileSync(join(tmp, "package.json"), '{"devDependencies":{"vitest":"^1.0.0"}}')
    const facts = await gatherProjectFacts(tmp)
    expect(facts.testing?.framework).toBe("Vitest")
  })

  it("detects eslint", async () => {
    writeFileSync(join(tmp, "package.json"), '{"devDependencies":{"eslint":"^8.0.0"}}')
    const facts = await gatherProjectFacts(tmp)
    expect(facts.tooling?.linter).toBe("ESLint")
  })

  it("detects react framework", async () => {
    writeFileSync(join(tmp, "package.json"), '{"dependencies":{"react":"^18.0.0"}}')
    const facts = await gatherProjectFacts(tmp)
    expect(facts.framework).toBe("React")
  })

  it("detects prisma database", async () => {
    writeFileSync(join(tmp, "package.json"), '{"devDependencies":{"prisma":"^5.0.0"}}')
    const facts = await gatherProjectFacts(tmp)
    expect(facts.database).toContain("Prisma")
  })

  it("detects docker deployment", async () => {
    writeFileSync(join(tmp, "package.json"), '{"name":"test"}')
    writeFileSync(join(tmp, "Dockerfile"), "")
    const facts = await gatherProjectFacts(tmp)
    expect(facts.deployment).toContain("Docker")
  })

  it("detects GitHub Actions CI", async () => {
    writeFileSync(join(tmp, "package.json"), '{"name":"test"}')
    mkdirSync(join(tmp, ".github", "workflows"), { recursive: true })
    const facts = await gatherProjectFacts(tmp)
    expect(facts.ci).toContain("GitHub Actions")
  })

  it("detects existing AGENTS.md", async () => {
    writeFileSync(join(tmp, "package.json"), '{"name":"test"}')
    writeFileSync(join(tmp, "AGENTS.md"), "# Test")
    const facts = await gatherProjectFacts(tmp)
    expect(facts.ai).toContain("AGENTS.md")
  })

  it("detects directories", async () => {
    writeFileSync(join(tmp, "package.json"), '{"name":"test"}')
    mkdirSync(join(tmp, "src"))
    mkdirSync(join(tmp, "tests"))
    const facts = await gatherProjectFacts(tmp)
    expect(facts.architecture).toContain("src")
    expect(facts.architecture).toContain("tests")
  })
})

describe("generateStatic", () => {
  it("generates markdown with all sections", () => {
    const facts = {
      project: { name: "test", description: "A test project" },
      packageManager: "pnpm",
      language: "TypeScript",
      moduleSystem: "ESM",
      testing: { framework: "Vitest" },
      tooling: { linter: "ESLint", formatter: "Prettier" },
      scripts: { test: "vitest", build: "tsc" },
      architecture: ["src", "tests"],
    }
    const md = generateStatic(facts)
    expect(md).toContain("# Project Conventions")
    expect(md).toContain("A test project")
    expect(md).toContain("TypeScript (ESM)")
    expect(md).toContain("pnpm install")
    expect(md).toContain("Vitest")
    expect(md).toContain("ESLint")
    expect(md).toContain("src/")
  })

  it("omits scripts section when no scripts", () => {
    const facts = { packageManager: "npm", language: "JavaScript", moduleSystem: "CommonJS" }
    const md = generateStatic(facts)
    expect(md).not.toContain("## Commands")
  })

  it("includes framework when detected", () => {
    const facts = { packageManager: "npm", language: "TypeScript", moduleSystem: "ESM", framework: "React" }
    const md = generateStatic(facts)
    expect(md).toContain("React")
  })
})
