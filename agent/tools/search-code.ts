import { execSync } from "child_process"
import { resolve } from "path"
import { isInsideWorkspace } from "../safety.js"
import { scrubSecrets } from "../utils/scrub-secrets.js"
import { truncateOutput } from "../utils/truncate.js"
import { formatToolOutput } from "../utils/format-tool-output.js"
import type { SearchCodeArgs } from "../tool-schemas.js"

function tryRipgrep(query: string, cwd: string, caseSensitive: boolean): string | null {
  try {
    const flags = ["--no-heading", "--line-number", "--max-count=50"]
    if (!caseSensitive) flags.push("--ignore-case")
    const result = execSync(`rg ${flags.join(" ")} -- "${query}" .`, {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    })
    return result
  } catch {
    return null
  }
}

function tryGrep(query: string, cwd: string, caseSensitive: boolean): string | null {
  try {
    const flags = ["-rn", "--include=*.ts", "--include=*.js", "--include=*.json", "--include=*.md", "--include=*.txt", "--include=*.css", "--include=*.html"]
    if (!caseSensitive) flags.push("-i")
    const result = execSync(`grep ${flags.join(" ")} "${query}" .`, {
      cwd,
      encoding: "utf-8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    })
    return result
  } catch {
    return null
  }
}

export function searchCode(args: SearchCodeArgs, workspaceRoot: string): string {
  const { query, caseSensitive } = args

  let raw: string | null = null
  raw = tryRipgrep(query, workspaceRoot, caseSensitive)
  if (raw === null) {
    raw = tryGrep(query, workspaceRoot, caseSensitive)
  }

  if (raw === null || raw.trim() === "") {
    return formatToolOutput("search_code", `No results for "${query}"`)
  }

  const lines = raw.trim().split("\n")
  const formatted = lines.map((line) => {
    const parts = line.split(":")
    if (parts.length >= 3) {
      const filePath = parts[0]
      const lineNum = parts[1]
      const snippet = parts.slice(2).join(":").trim()
      return `${filePath}:${lineNum}: ${snippet}`
    }
    return line
  })

  const output = scrubSecrets(formatted.join("\n"))
  return formatToolOutput("search_code", truncateOutput(output))
}
