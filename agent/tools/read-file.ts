import { readFileSync } from "fs"
import { resolve, relative } from "path"
import { isInsideWorkspace } from "../safety.js"
import { isBinaryFile } from "../utils/binary-file.js"
import { scrubSecrets } from "../utils/scrub-secrets.js"
import { truncateOutput } from "../utils/truncate.js"
import { formatToolOutput } from "../utils/format-tool-output.js"
import type { ReadFileArgs } from "../tool-schemas.js"

export function readFile(args: ReadFileArgs, workspaceRoot: string): string {
  const { path: filePath, startLine, endLine } = args
  const fullPath = resolve(workspaceRoot, filePath)

  if (!isInsideWorkspace(fullPath, workspaceRoot)) {
    return formatToolOutput("read_file", `Error: path "${filePath}" is outside workspace`, "error")
  }

  if (isBinaryFile(fullPath)) {
    return formatToolOutput("read_file", `Skipped: "${filePath}" is a binary file`)
  }

  let content: string
  try {
    content = readFileSync(fullPath, "utf-8")
  } catch (e) {
    return formatToolOutput("read_file", `Error reading "${filePath}": ${(e as Error).message}`, "error")
  }

  const lines = content.split("\n")
  const totalLines = lines.length

  if (startLine !== undefined || endLine !== undefined) {
    const start = Math.max(1, startLine ?? 1)
    const end = Math.min(totalLines, endLine ?? totalLines)
    const selected = lines.slice(start - 1, end)
    const numbered = selected.map((line, i) => `${start + i}: ${line}`).join("\n")
    return formatToolOutput("read_file", scrubSecrets(numbered))
  }

  if (totalLines > 200) {
    const preview = lines.slice(0, 100).map((line, i) => `${i + 1}: ${line}`).join("\n")
    const msg = `\n\n[File has ${totalLines} lines. Use startLine/endLine to read a specific range.]`
    return formatToolOutput("read_file", scrubSecrets(truncateOutput(preview + msg)))
  }

  const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join("\n")
  return formatToolOutput("read_file", scrubSecrets(numbered))
}
