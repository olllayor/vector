import { readFile, access } from "fs/promises"
import { homedir } from "os"
import { join, relative } from "path"
import { execSync } from "child_process"
import { realpathSync } from "fs"

const MAX_BYTES_DEFAULT = 32768
const OVERRIDE_SUFFIX = ".override.md"
const PRIMARY_SUFFIX = ".md"
const GLOBAL_DIR = ".vector"
const FILENAME = "AGENTS"
const TRUNCATION_WARNING = "\n\n<!-- WARNING: AGENTS.md context truncated due to size limits -->"

export interface AgentsMdOptions {
  projectRoot?: string
  cwd?: string
  maxBytes?: number
  globalDir?: string
}

function getGlobalDir(opts: AgentsMdOptions): string {
  return opts.globalDir ?? join(homedir(), GLOBAL_DIR)
}

function findProjectRoot(from: string): string {
  const cwd = realpathSync(from)
  let dir = cwd
  while (true) {
    try {
      execSync("git rev-parse --show-toplevel", { cwd: dir, encoding: "utf-8", stdio: "pipe" })
      return realpathSync(dir)
    } catch {
      // not a git repo
    }
    const parent = join(dir, "..")
    if (parent === dir) return cwd
    dir = parent
  }
}

function getDirectoriesBetween(root: string, cwd: string): string[] {
  const rootReal = realpathSync(root)
  const cwdReal = realpathSync(cwd)
  const rel = relative(rootReal, cwdReal)
  if (rel === "" || rel === ".") return [rootReal]

  const parts = rel.split(/[/\\]/).filter(Boolean)
  const dirs: string[] = [rootReal]
  let current = rootReal
  for (const part of parts) {
    current = join(current, part)
    dirs.push(current)
  }
  return dirs
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readFileIfExists(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, "utf-8")
    return content.trim().length > 0 ? content.trim() : null
  } catch {
    return null
  }
}

async function discoverGlobal(globalDir: string): Promise<string | null> {
  const overridePath = join(globalDir, `${FILENAME}${OVERRIDE_SUFFIX}`)
  const primaryPath = join(globalDir, `${FILENAME}${PRIMARY_SUFFIX}`)

  if (await fileExists(overridePath)) {
    return readFileIfExists(overridePath)
  }
  return readFileIfExists(primaryPath)
}

async function discoverProject(projectRoot: string, cwd: string): Promise<string[]> {
  const dirs = getDirectoriesBetween(projectRoot, cwd)
  const files: string[] = []

  for (const dir of dirs) {
    const overridePath = join(dir, `${FILENAME}${OVERRIDE_SUFFIX}`)
    const primaryPath = join(dir, `${FILENAME}${PRIMARY_SUFFIX}`)

    if (await fileExists(overridePath)) {
      const content = await readFileIfExists(overridePath)
      if (content) files.push(content)
    } else {
      const content = await readFileIfExists(primaryPath)
      if (content) files.push(content)
    }
  }

  return files
}

export async function loadAgentsMd(opts: AgentsMdOptions = {}): Promise<string> {
  const cwd = opts.cwd ?? process.cwd()
  const projectRoot = opts.projectRoot ?? findProjectRoot(cwd)
  const maxBytes = opts.maxBytes ?? MAX_BYTES_DEFAULT

  const parts: string[] = []

  const globalContent = await discoverGlobal(getGlobalDir(opts))
  if (globalContent) parts.push(globalContent)

  const projectFiles = await discoverProject(projectRoot, cwd)
  parts.push(...projectFiles)

  if (parts.length === 0) return ""

  let result = parts.join("\n\n")

  if (Buffer.byteLength(result, "utf-8") > maxBytes) {
    result = result.slice(0, maxBytes) + TRUNCATION_WARNING
  }

  return result
}

export function formatSystemPromptWithAgentsMd(basePrompt: string, agentsMd: string): string {
  if (!agentsMd) return basePrompt

  return `${basePrompt}

<project_instructions>
${agentsMd}
</project_instructions>`
}
