import type { SlashCommand } from "./registry.js"

export interface BuiltinDeps {
  getStatus: () => string
  getCurrentModel: () => string
  listProviders: () => string[]
  listModels: (provider: string) => { id: string; supportsTools: boolean; contextWindow: number }[]
  getApprovalMode: () => string
  setApprovalMode: (mode: string) => void
  reasoningEnabled: () => boolean
  toggleReasoning: () => void
  undoLastBatch: () => { restored: string[]; errors: string[] }
  gitDiff: (args: Record<string, unknown>) => string
  clearSession: () => void
  exitSession: () => void
}

export function createBuiltins(deps: BuiltinDeps): SlashCommand[] {
  return [
    {
      name: "status",
      description: "Show model, approvals, and token usage",
      source: "builtin",
      handler: async () => console.log(deps.getStatus()),
    },
    {
      name: "help",
      description: "Show available commands",
      source: "builtin",
      handler: async () => {
        console.log("\nCommands:")
        console.log("  /status     Show model, approvals, and token usage")
        console.log("  /help       Show this help")
        console.log("  /model      Show or switch model")
        console.log("  /providers  List all providers and models")
        console.log("  /approval   Show or set approval mode")
        console.log("  /reasoning  Toggle reasoning display")
        console.log("  /undo       Undo last file edit batch")
        console.log("  /diff       Show git diff")
        console.log("  /clear      Clear conversation history")
        console.log("  /exit       Exit vector\n")
      },
    },
    {
      name: "model",
      description: "Show or switch model",
      source: "builtin",
      handler: async (args) => {
        if (!args) {
          console.log(`  Current model: ${deps.getCurrentModel()}`)
        } else {
          console.log(`  Switched to: ${args}`)
        }
      },
    },
    {
      name: "providers",
      description: "List all providers and models",
      source: "builtin",
      handler: async () => {
        for (const p of deps.listProviders()) {
          console.log(`\n  ${p}:`)
          const models = deps.listModels(p)
          for (const m of models) {
            console.log(`    ${p}/${m.id}  [tools: ${m.supportsTools}, ctx: ${m.contextWindow}]`)
          }
        }
        console.log()
      },
    },
    {
      name: "approval",
      description: "Show or set approval mode (ask/auto/full)",
      source: "builtin",
      handler: async (args) => {
        if (!args) {
          console.log(`  Current mode: ${deps.getApprovalMode()}`)
          console.log("  Modes: ask (default), auto, full")
        } else if (["ask", "auto", "full"].includes(args)) {
          deps.setApprovalMode(args)
          console.log(`  Approval mode: ${args}`)
        } else {
          console.error("  Invalid mode. Use: ask, auto, or full")
        }
      },
    },
    {
      name: "reasoning",
      description: "Toggle reasoning (<think> tags)",
      source: "builtin",
      handler: async () => {
        deps.toggleReasoning()
        console.log(`  Reasoning: ${deps.reasoningEnabled() ? "ON" : "OFF"}`)
      },
    },
    {
      name: "undo",
      description: "Undo last file edit batch",
      source: "builtin",
      handler: async () => {
        const result = deps.undoLastBatch()
        if (result.restored.length > 0) {
          console.log("  Undone:")
          result.restored.forEach((r) => console.log(`    ${r}`))
        }
        if (result.errors.length > 0) {
          result.errors.forEach((e) => console.error(`    ${e}`))
        }
      },
    },
    {
      name: "diff",
      description: "Show git diff",
      source: "builtin",
      handler: async () => {
        console.log(deps.gitDiff({}))
      },
    },
    {
      name: "clear",
      description: "Clear conversation history",
      source: "builtin",
      handler: async () => {
        deps.clearSession()
        console.log("  Conversation cleared.")
      },
    },
    {
      name: "exit",
      description: "Exit vector",
      source: "builtin",
      handler: async () => {
        deps.exitSession()
      },
    },
  ]
}
