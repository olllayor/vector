import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { runCommand } from "../../agent/tools/run-command.js"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { setApprovalMode } from "../../agent/approval.js"

const workspace = join(tmpdir(), `test-rc-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, "test.txt"), "hello")
  setApprovalMode("full")
})

afterEach(() => {
  setApprovalMode("ask")
  rmSync(workspace, { recursive: true, force: true })
})

describe("runCommand", () => {
  it("runs a simple command", async () => {
    const result = await runCommand({ command: "echo hello", timeout: 30000 }, workspace)
    expect(result.output).toContain("hello")
  })

  it("rejects cwd outside workspace", async () => {
    const result = await runCommand({ command: "ls", cwd: "/etc", timeout: 30000 }, workspace)
    expect(result.output).toContain("outside workspace")
  })

  it("captures stderr", async () => {
    const result = await runCommand({ command: "ls nonexistent-dir-xyz", timeout: 30000 }, workspace)
    expect(result.output).toContain("No such file or directory")
  })

  it("handles timeout", async () => {
    const result = await runCommand({ command: "sleep 10", timeout: 100 }, workspace)
    expect(result.output).toContain("timed out")
  })

  it("detects secret-exposure commands", async () => {
    writeFileSync(join(workspace, ".env"), "SECRET=xyz")
    const result = await runCommand({ command: "cat .env", timeout: 30000 }, workspace)
    expect(result.output).toContain("SECRET")
  })

  it("scrubs secrets from output", async () => {
    writeFileSync(join(workspace, ".env"), "API_KEY=nvapi-supersecret12345678")
    const result = await runCommand({ command: "cat .env", timeout: 30000 }, workspace)
    expect(result.output).not.toContain("nvapi-supersecret")
  })

  it("strips ANSI from output", async () => {
    const result = await runCommand({ command: "echo -e '\\e[31mRed\\e[0m'", timeout: 30000 }, workspace)
    expect(result.output).toContain("Red")
    expect(result.output).not.toContain("\x1b")
  })
})
