import { execSync } from "child_process"
import { formatToolOutput } from "../utils/format-tool-output.js"
import { truncateOutput } from "../utils/truncate.js"
import type { GitDiffArgs } from "../tool-schemas.js"

export function gitDiff(args: GitDiffArgs, workspaceRoot: string): string {
  const { filePath } = args

  try {
    if (filePath) {
      const result = execSync(`git diff -- "${filePath}"`, {
        cwd: workspaceRoot,
        encoding: "utf-8",
        timeout: 5000,
      })
      if (!result.trim()) {
        return formatToolOutput("git_diff", `No changes in "${filePath}"`)
      }
      return formatToolOutput("git_diff", truncateOutput(result))
    }

    const statusResult = execSync("git status --short", {
      cwd: workspaceRoot,
      encoding: "utf-8",
      timeout: 5000,
    })

    const diffResult = execSync("git diff", {
      cwd: workspaceRoot,
      encoding: "utf-8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    })

    const output = []
    if (statusResult.trim()) {
      output.push("Changed files:")
      output.push(statusResult.trim())
      output.push("")
    }
    if (diffResult.trim()) {
      output.push("Diff:")
      output.push(diffResult.trim())
    }

    if (output.length === 0) {
      return formatToolOutput("git_diff", "No changes detected")
    }

    return formatToolOutput("git_diff", truncateOutput(output.join("\n")))
  } catch (e) {
    return formatToolOutput("git_diff", `Error: ${(e as Error).message}`, "error")
  }
}
