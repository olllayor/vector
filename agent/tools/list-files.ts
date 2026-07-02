import { readdirSync, statSync } from "fs"
import { resolve, relative, join } from "path"
import { execSync } from "child_process"
import { isInsideWorkspace } from "../safety.js"
import { likelyBinaryExtension } from "../utils/binary-file.js"
import { truncateOutput } from "../utils/truncate.js"
import { formatToolOutput } from "../utils/format-tool-output.js"
import type { ListFilesArgs } from "../tool-schemas.js"

function getGitTrackedFiles(dir: string): Set<string> | null {
  try {
    const output = execSync("git ls-files", { cwd: dir, encoding: "utf-8", timeout: 5000 })
    return new Set(output.trim().split("\n"))
  } catch {
    return null
  }
}

function walkDir(dir: string, depth: number, maxDepth: number, gitFiles: Set<string> | null): string[] {
  if (depth > maxDepth) return []

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }

  const results: string[] = []
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git" || entry === ".nvcoder") continue

    const fullPath = join(dir, entry)
    const relPath = relative(process.cwd(), fullPath)

    if (gitFiles && !gitFiles.has(relPath)) {
      try {
        if (statSync(fullPath).isDirectory()) {
          results.push(...walkDir(fullPath, depth + 1, maxDepth, gitFiles))
        }
      } catch {}
      continue
    }

    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        results.push(`${entry}/`)
        results.push(...walkDir(fullPath, depth + 1, maxDepth, gitFiles))
      } else {
        const marker = likelyBinaryExtension(fullPath) ? " [binary]" : ""
        results.push(`${entry}${marker}`)
      }
    } catch {}
  }

  return results
}

export function listFiles(args: ListFilesArgs, workspaceRoot: string): string {
  const { path: dirPath, depth } = args
  const fullPath = resolve(workspaceRoot, dirPath)

  if (!isInsideWorkspace(fullPath, workspaceRoot)) {
    return formatToolOutput("list_files", `Error: path "${dirPath}" is outside workspace`, "error")
  }

  const gitFiles = getGitTrackedFiles(workspaceRoot)
  const files = walkDir(fullPath, 1, depth, gitFiles)

  if (files.length === 0) {
    return formatToolOutput("list_files", `No files found in "${dirPath}"`)
  }

  const output = files.join("\n")
  return formatToolOutput("list_files", truncateOutput(output, { headLines: 100, tailLines: 100 }))
}
