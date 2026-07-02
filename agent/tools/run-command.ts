import { execSync } from "child_process"
import { appendFileSync, mkdirSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { isInsideWorkspace } from "../safety.js"
import { formatToolOutput } from "../utils/format-tool-output.js"
import { truncateOutput } from "../utils/truncate.js"
import { stripAnsi } from "../utils/strip-ansi.js"
import { scrubSecrets } from "../utils/scrub-secrets.js"
import { requestApproval, getApprovalMode } from "../approval.js"
import type { RunCommandArgs } from "../tool-schemas.js"

const SECRET_EXPOSURE_PATTERNS = [
  { pattern: /\bcat\s+\.env\b/i, reason: "reads .env file" },
  { pattern: /\bcat\s+.*\.npmrc\b/i, reason: "reads .npmrc" },
  { pattern: /\bcat\s+.*\.pypirc\b/i, reason: "reads .pypirc" },
  { pattern: /\bcat\s+.*private[_-]?key\b/i, reason: "reads private key" },
  { pattern: /\benv\b\s*$/, reason: "prints all environment variables" },
  { pattern: /\bprintenv\b/, reason: "prints all environment variables" },
  { pattern: /\becho\s+.*\$\w*(KEY|TOKEN|SECRET|PASSWORD)\w*/i, reason: "may expose secrets" },
  { pattern: /\bset\b.*\|\s*(?:grep|head|tail)/i, reason: "may expose secrets in env dump" },
]

const DESTRUCTIVE_PATTERNS = [
  { pattern: /\brm\s+(-rf?|--recursive|--force)\s+[^(]/i, reason: "recursive delete" },
  { pattern: /\bmkfs\b/, reason: "formats filesystem" },
  { pattern: /\bdd\b.*of=\//, reason: "raw disk write" },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: "raw disk write" },
  { pattern: /\bchmod\s+777\b/, reason: "world-writable permissions" },
]

function checkCommandSafety(command: string): { safe: boolean; warnings: string[] } {
  const warnings: string[] = []

  for (const { pattern, reason } of SECRET_EXPOSURE_PATTERNS) {
    if (pattern.test(command)) {
      warnings.push(`Secret exposure: ${reason}`)
    }
  }

  for (const { pattern, reason } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) {
      warnings.push(`Destructive: ${reason}`)
    }
  }

  return { safe: warnings.length === 0, warnings }
}

function auditLog(logPath: string, entry: string): void {
  try {
    const dir = dirname(logPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(logPath, `${new Date().toISOString()} ${entry}\n`)
  } catch {}
}

export interface RunCommandResult {
  output: string
}

export async function runCommand(
  args: RunCommandArgs,
  workspaceRoot: string,
  auditLogPath?: string
): Promise<RunCommandResult> {
  const { command, cwd: rawCwd, timeout } = args
  const mode = getApprovalMode()

  const effectiveCwd = rawCwd ?? workspaceRoot
  const fullCwd = resolve(workspaceRoot, effectiveCwd)

  if (!isInsideWorkspace(fullCwd, workspaceRoot)) {
    return { output: formatToolOutput("run_command", `Error: cwd "${effectiveCwd}" is outside workspace`, "error") }
  }

  const { safe, warnings } = checkCommandSafety(command)

  if (warnings.length > 0) {
    if (mode !== "full") {
      const approved = await requestApproval({
        toolName: "run_command",
        description: `WARNING: ${warnings.join("; ")}\n  Command: ${command}\n  Cwd: ${effectiveCwd}`,
      })
      if (!approved) {
        if (auditLogPath) auditLog(auditLogPath, `DENIED: ${command} [${warnings.join(", ")}]`)
        return { output: formatToolOutput("run_command", `Denied: ${warnings.join("; ")}`, "error") }
      }
    }
  } else if (mode === "ask") {
    const approved = await requestApproval({
      toolName: "run_command",
      description: `Run: ${command}\n  Cwd: ${effectiveCwd}\n  Timeout: ${timeout}ms`,
    })
    if (!approved) {
      if (auditLogPath) auditLog(auditLogPath, `DENIED: ${command}`)
      return { output: formatToolOutput("run_command", "Denied by user", "error") }
    }
  } else if (mode === "auto") {
    const approved = await requestApproval({
      toolName: "run_command",
      description: `Run: ${command}\n  Cwd: ${effectiveCwd}`,
    })
    if (!approved) {
      if (auditLogPath) auditLog(auditLogPath, `DENIED: ${command}`)
      return { output: formatToolOutput("run_command", "Denied by user", "error") }
    }
  }

  if (auditLogPath) auditLog(auditLogPath, `APPROVED: ${command} [mode=${mode}]`)

  try {
    const result = execSync(command, {
      cwd: fullCwd,
      encoding: "utf-8",
      timeout,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    })

    const cleaned = scrubSecrets(stripAnsi(result))
    return { output: formatToolOutput("run_command", truncateOutput(cleaned || "(no output)")) }
  } catch (e: any) {
    const stdout = e.stdout ? stripAnsi(e.stdout) : ""
    const stderr = e.stderr ? stripAnsi(e.stderr) : ""
    const combined = [stdout, stderr].filter(Boolean).join("\n")
    const cleaned = scrubSecrets(combined)

    if (e.code === "ETIMEDOUT") {
      return { output: formatToolOutput("run_command", `Error: command timed out after ${timeout}ms`, "error") }
    }

    return { output: formatToolOutput("run_command", truncateOutput(cleaned || `Error: ${e.message}`), "error") }
  }
}
