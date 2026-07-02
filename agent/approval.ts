import * as readline from "readline"

export type ApprovalMode = "ask" | "auto" | "full"

let currentMode: ApprovalMode = "ask"

export function getApprovalMode(): ApprovalMode {
  return currentMode
}

export function setApprovalMode(mode: ApprovalMode): void {
  currentMode = mode
}

export function isReadOnlyTool(toolName: string): boolean {
  return ["list_files", "search_code", "read_file", "git_diff"].includes(toolName)
}

function promptUser(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(question, (answer) => {
      rl.close()
      resolve(/^(y|yes)$/i.test(answer.trim()))
    })
  })
}

export interface ApprovalContext {
  toolName: string
  description: string
}

export async function requestApproval(ctx: ApprovalContext): Promise<boolean> {
  const mode = currentMode

  if (mode === "full") {
    return true
  }

  if (mode === "auto" && !isReadOnlyTool(ctx.toolName)) {
    if (ctx.toolName === "run_command") {
      return await promptUser(`\n  [auto] Run command? ${ctx.description}\n  Approve? (y/n): `)
    }
    if (ctx.toolName === "str_replace" || ctx.toolName === "write_file") {
      return true
    }
  }

  if (mode === "ask") {
    if (isReadOnlyTool(ctx.toolName)) {
      return true
    }
    return await promptUser(`\n  [ask] ${ctx.description}\n  Approve? (y/n): `)
  }

  return false
}

export function formatApprovalHeader(toolName: string, mode: ApprovalMode): string {
  if (mode === "full") return `[full] ${toolName}`
  if (mode === "auto" && !isReadOnlyTool(toolName)) return `[auto] ${toolName}`
  return `[ask] ${toolName}`
}
