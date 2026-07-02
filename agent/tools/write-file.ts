import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { mkdirSync } from "fs"
import { isInsideWorkspace } from "../safety.js"
import { isBinaryFile } from "../utils/binary-file.js"
import { formatToolOutput } from "../utils/format-tool-output.js"
import { requestApproval } from "../approval.js"
import { recordFileHash } from "../file-hashes.js"
import type { WriteFileArgs } from "../tool-schemas.js"

export interface WriteFileResult {
  applied: boolean
  output: string
}

export async function writeFile(
  args: WriteFileArgs,
  workspaceRoot: string,
  options: { autoApprove?: boolean } = {}
): Promise<WriteFileResult> {
  const { path: filePath, content } = args
  const fullPath = resolve(workspaceRoot, filePath)

  if (!isInsideWorkspace(fullPath, workspaceRoot)) {
    return { applied: false, output: formatToolOutput("write_file", `Error: path "${filePath}" is outside workspace`, "error") }
  }

  if (isBinaryFile(fullPath)) {
    return { applied: false, output: formatToolOutput("write_file", `Error: "${filePath}" is a binary file`, "error") }
  }

  const isNewFile = !existsSync(fullPath)

  if (!isNewFile) {
    let existingContent: string
    try {
      existingContent = readFileSync(fullPath, "utf-8")
    } catch (e) {
      return { applied: false, output: formatToolOutput("write_file", `Error reading "${filePath}": ${(e as Error).message}`, "error") }
    }

    const ratio = content.length / existingContent.length
    if (ratio < 0.5) {
      if (!options.autoApprove) {
        const approved = await requestApproval({
          toolName: "write_file",
          description: `WARNING: New content is ${Math.round(ratio * 100)}% of original size in "${filePath}". This may indicate data loss. Proceed?`,
        })
        if (!approved) {
          return { applied: false, output: formatToolOutput("write_file", "Rejected: suspicious size reduction", "error") }
        }
      }
    }

    const preview = generateWriteDiff(filePath, existingContent, content)
    if (!options.autoApprove) {
      const approved = await requestApproval({
        toolName: "write_file",
        description: `Overwrite "${filePath}":\n${preview}`,
      })
      if (!approved) {
        return { applied: false, output: formatToolOutput("write_file", "Rejected by user", "error") }
      }
    }
  }

  try {
    const dir = dirname(fullPath)
    mkdirSync(dir, { recursive: true })
    writeFileSync(fullPath, content)
    recordFileHash(fullPath)
    const action = isNewFile ? "Created" : "Overwrote"
    return { applied: true, output: formatToolOutput("write_file", `${action} "${filePath}" (${content.length} bytes)`) }
  } catch (e) {
    return { applied: false, output: formatToolOutput("write_file", `Error writing "${filePath}": ${(e as Error).message}`, "error") }
  }
}

function generateWriteDiff(filePath: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split("\n")
  const newLines = newContent.split("\n")
  const diff: string[] = []

  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < Math.min(maxLen, 20); i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) diff.push(`- ${oldLines[i]}`)
      if (newLines[i] !== undefined) diff.push(`+ ${newLines[i]}`)
    }
  }

  if (diff.length === 0) return "(no changes)"
  return diff.join("\n") + (maxLen > 20 ? `\n... (${maxLen} lines total)` : "")
}
