import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { isInsideWorkspace } from "../safety.js"
import { isBinaryFile } from "../utils/binary-file.js"
import { recordFileHash, hasFileChanged, getFileHash } from "../file-hashes.js"
import { formatToolOutput } from "../utils/format-tool-output.js"
import { requestApproval } from "../approval.js"
import type { StrReplaceArgs } from "../tool-schemas.js"

function normalizeLineEnding(text: string): string {
  return text.replace(/\r\n/g, "\n")
}

function findAllOccurrences(haystack: string, needle: string): number[] {
  const indices: number[] = []
  let idx = haystack.indexOf(needle)
  while (idx !== -1) {
    indices.push(idx)
    idx = haystack.indexOf(needle, idx + 1)
  }
  return indices
}

function normalizeForFallback(line: string): string {
  return line.replace(/\s+$/, "").replace(/\r\n/g, "\n")
}

export interface StrReplaceResult {
  applied: boolean
  output: string
  backupPath?: string
}

export async function strReplace(
  args: StrReplaceArgs,
  workspaceRoot: string,
  options: { autoApprove?: boolean; createBackup?: boolean } = {}
): Promise<StrReplaceResult> {
  const { path: filePath, oldText, newText } = args
  const fullPath = resolve(workspaceRoot, filePath)

  if (!isInsideWorkspace(fullPath, workspaceRoot)) {
    return { applied: false, output: formatToolOutput("str_replace", `Error: path "${filePath}" is outside workspace`, "error") }
  }

  if (isBinaryFile(fullPath)) {
    return { applied: false, output: formatToolOutput("str_replace", `Error: "${filePath}" is a binary file`, "error") }
  }

  let content: string
  try {
    content = readFileSync(fullPath, "utf-8")
  } catch (e) {
    return { applied: false, output: formatToolOutput("str_replace", `Error reading "${filePath}": ${(e as Error).message}`, "error") }
  }

  if (hasFileChanged(fullPath)) {
    if (!options.autoApprove) {
      const approved = await requestApproval({
        toolName: "str_replace",
        description: `File "${filePath}" has been modified since last read. Continue?`,
      })
      if (!approved) {
        return { applied: false, output: formatToolOutput("str_replace", "Rejected: file changed since last read", "error") }
      }
    }
  }

  const normalizedContent = normalizeLineEnding(content)
  const normalizedOld = normalizeLineEnding(oldText)

  const exactMatches = findAllOccurrences(normalizedContent, normalizedOld)

  if (exactMatches.length === 1) {
    const replaced = normalizedContent.replace(normalizedOld, normalizeLineEnding(newText))
    const preview = generateDiff(filePath, content, replaced)

    if (!options.autoApprove) {
      const approved = await requestApproval({
        toolName: "str_replace",
        description: `Replace in "${filePath}":\n${preview}`,
      })
      if (!approved) {
        return { applied: false, output: formatToolOutput("str_replace", "Rejected by user", "error") }
      }
    }

    let backupPath: string | undefined
    if (options.createBackup) {
      backupPath = `${fullPath}.bak`
      writeFileSync(backupPath, content)
    }

    writeFileSync(fullPath, replaced)
    recordFileHash(fullPath)
    return { applied: true, output: formatToolOutput("str_replace", `Applied 1 replacement in "${filePath}"`), backupPath }
  }

  if (exactMatches.length > 1) {
    return { applied: false, output: formatToolOutput("str_replace", `Error: found ${exactMatches.length} matches for the given text in "${filePath}". Provide more context to make the match unique.`, "error") }
  }

  const fallbackLines = normalizedContent.split("\n")
  const needleLines = normalizedOld.split("\n")
  let fallbackMatchIdx = -1

  for (let i = 0; i <= fallbackLines.length - needleLines.length; i++) {
    let matches = true
    for (let j = 0; j < needleLines.length; j++) {
      if (normalizeForFallback(fallbackLines[i + j]) !== normalizeForFallback(needleLines[j])) {
        matches = false
        break
      }
    }
    if (matches) {
      if (fallbackMatchIdx !== -1) {
        return { applied: false, output: formatToolOutput("str_replace", `Error: found multiple normalized matches for the given text in "${filePath}". Provide more context.`, "error") }
      }
      fallbackMatchIdx = i
    }
  }

  if (fallbackMatchIdx === -1) {
    return { applied: false, output: formatToolOutput("str_replace", `Error: no match found for the given text in "${filePath}". Check for line-ending or trailing-whitespace differences.`, "error") }
  }

  const before = fallbackLines.slice(0, fallbackMatchIdx).join("\n")
  const after = fallbackLines.slice(fallbackMatchIdx + needleLines.length).join("\n")
  const replaced = [before, normalizeLineEnding(newText), after].join("\n")
  const preview = generateDiff(filePath, content, replaced)

  if (!options.autoApprove) {
    const approved = await requestApproval({
      toolName: "str_replace",
      description: `Replace (normalized fallback) in "${filePath}":\n${preview}`,
    })
    if (!approved) {
      return { applied: false, output: formatToolOutput("str_replace", "Rejected by user", "error") }
    }
  }

  let backupPath: string | undefined
  if (options.createBackup) {
    backupPath = `${fullPath}.bak`
    writeFileSync(backupPath, content)
  }

  writeFileSync(fullPath, replaced)
  recordFileHash(fullPath)
  return { applied: true, output: formatToolOutput("str_replace", `Applied 1 replacement (normalized fallback) in "${filePath}"`), backupPath }
}

function generateDiff(filePath: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n")
  const newLines = newContent.split("\n")
  const diff: string[] = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) diff.push(`- ${oldLines[i]}`)
      if (newLines[i] !== undefined) diff.push(`+ ${newLines[i]}`)
    }
  }

  if (diff.length === 0) return "(no changes)"
  return diff.slice(0, 20).join("\n") + (diff.length > 20 ? `\n... and ${diff.length - 20} more lines` : "")
}
