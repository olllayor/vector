import * as dotenv from "dotenv"
import { resolve } from "path"
dotenv.config({ path: resolve(import.meta.dirname ?? ".", "..", ".env") })

import * as readline from "readline"
import { getDefaultClient, getClient, registry } from "./model.config.js"
import { resolveWorkspaceRoot } from "./safety.js"
import { getApprovalMode, setApprovalMode, type ApprovalMode } from "./approval.js"
import { saveSession, loadSession, clearSession, addMessage, getSessionSize, type SessionMessage } from "./session.js"
import { compactHistory } from "./compact.js"
import { stripThinkingTags } from "./utils/strip-thinking.js"
import { createCompleter } from "./completer.js"
import { loadAgentsMd, formatSystemPromptWithAgentsMd } from "./agents-md.js"
import { initAgentsMd } from "./init-agents-md.js"
import { undoLastBatch, hasPendingUndo, getPendingBatchSize, clearPendingBatch } from "./undo.js"
import { readFile } from "./tools/read-file.js"
import { listFiles } from "./tools/list-files.js"
import { searchCode } from "./tools/search-code.js"
import { strReplace } from "./tools/str-replace.js"
import { writeFile } from "./tools/write-file.js"
import { gitDiff } from "./tools/git-diff.js"
import { runCommand } from "./tools/run-command.js"
import { ReadFileArgsSchema, ListFilesArgsSchema, SearchCodeArgsSchema, StrReplaceArgsSchema, WriteFileArgsSchema, GitDiffArgsSchema, RunCommandArgsSchema } from "./tool-schemas.js"
import { recordUsage, getStatus, getStateForPersist, loadStateFromPersist, formatStatus } from "./status.js"
import type { ChatCompletion } from "openai/resources/chat/completions"

const workspaceRoot = resolveWorkspaceRoot()
let currentModel: string | undefined
let messages: SessionMessage[] = []
let reasoningEnabled = true
let toolCallCount = 0
const auditLogPath = resolve(workspaceRoot, ".vector", "audit.log")

const BASE_SYSTEM_PROMPT = "You are a coding agent. Use tools to help the user. Always read files before editing them. Prefer str_replace over write_file for edits."

async function loadOrCreateSession(): Promise<void> {
  const session = loadSession(workspaceRoot)
  if (session) {
    currentModel = `${session.provider}/${session.model}`
    messages = session.messages
    setApprovalMode(session.approvalMode)
    if (session.tokenUsage) {
      loadStateFromPersist(session.tokenUsage)
    }
    console.log(`  Resumed session from ${session.updatedAt}`)
    console.log(`  Model: ${currentModel} | Mode: ${session.approvalMode} | Messages: ${messages.length}`)
  } else {
    const agentsMd = await loadAgentsMd({ projectRoot: workspaceRoot })
    messages = [
      { role: "system", content: formatSystemPromptWithAgentsMd(BASE_SYSTEM_PROMPT, agentsMd) },
    ]
    if (agentsMd) {
      console.log("  Loaded project instructions from AGENTS.md")
    }
  }
}

function persistSession(): void {
  const ref = currentModel ?? registry.getDefault()
  const resolved = registry.resolve(ref)
  saveSession(workspaceRoot, {
    workspace: workspaceRoot,
    provider: resolved.provider,
    model: resolved.modelId,
    approvalMode: getApprovalMode(),
    messages,
    tokenUsage: getStateForPersist(),
  })
}

function printHelp() {
  console.log(`
Commands:
  /status               Show model, approvals, and token usage
  /help                 Show this help
  /init                 Generate AGENTS.md for this project
  /model                Show current model
  /model <provider/id>  Switch model
  /providers            List all providers and models
  /approval             Show current approval mode
  /approval <mode>      Set approval mode (ask/auto/full)
  /reasoning            Toggle reasoning (<think> tags)
  /undo                 Undo last file edit batch
  /diff                 Show git diff
  /clear                Clear conversation history
  /exit                 Exit vector
`)
}

function printProviders() {
  for (const p of registry.listProviders()) {
    console.log(`\n  ${p}:`)
    const models = registry.listModels(p)
    if (models.length === 0) {
      console.log("    (no models configured)")
    } else {
      for (const m of models) {
        console.log(`    ${p}/${m.id}  [tools: ${m.supportsTools}, ctx: ${m.contextWindow}]`)
      }
    }
  }
  console.log()
}

async function dispatchTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "list_files": {
      const parsed = ListFilesArgsSchema.parse(args)
      return listFiles(parsed, workspaceRoot)
    }
    case "search_code": {
      const parsed = SearchCodeArgsSchema.parse(args)
      return searchCode(parsed, workspaceRoot)
    }
    case "read_file": {
      const parsed = ReadFileArgsSchema.parse(args)
      return readFile(parsed, workspaceRoot)
    }
    case "str_replace": {
      const parsed = StrReplaceArgsSchema.parse(args)
      const result = await strReplace(parsed, workspaceRoot, {
        autoApprove: getApprovalMode() !== "ask",
        createBackup: hasPendingUndo() || true,
      })
      return result.output
    }
    case "write_file": {
      const parsed = WriteFileArgsSchema.parse(args)
      const result = await writeFile(parsed, workspaceRoot, {
        autoApprove: getApprovalMode() !== "ask",
      })
      return result.output
    }
    case "git_diff": {
      const parsed = GitDiffArgsSchema.parse(args)
      return gitDiff(parsed, workspaceRoot)
    }
    case "run_command": {
      const parsed = RunCommandArgsSchema.parse(args)
      const result = await runCommand(parsed, workspaceRoot, auditLogPath)
      return result.output
    }
    default:
      return `<tool_output name="${name}" status="error">\nUnknown tool: ${name}\n</tool_output>`
  }
}

const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "List files in a directory with depth control",
      parameters: { type: "object", properties: { path: { type: "string", default: "." }, depth: { type: "number", default: 1 } }, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_code",
      description: "Search codebase for a pattern",
      parameters: { type: "object", properties: { query: { type: "string" }, caseSensitive: { type: "boolean", default: false } }, required: ["query"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read file contents with optional line range",
      parameters: { type: "object", properties: { path: { type: "string" }, startLine: { type: "number" }, endLine: { type: "number" } }, required: ["path"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "str_replace",
      description: "Search and replace text in a file",
      parameters: { type: "object", properties: { path: { type: "string" }, oldText: { type: "string" }, newText: { type: "string" } }, required: ["path", "oldText", "newText"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Create or overwrite a file",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "git_diff",
      description: "Show git diff of changes",
      parameters: { type: "object", properties: { filePath: { type: "string" } }, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_command",
      description: "Run a shell command",
      parameters: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" }, timeout: { type: "number", default: 30000 } }, required: ["command"] },
    },
  },
]

async function handleCommand(input: string): Promise<boolean> {
  const trimmed = input.trim()
  if (!trimmed.startsWith("/")) return false

  const [cmd, ...args] = trimmed.split(/\s+/)

  switch (cmd) {
    case "/help":
      printHelp()
      break
    case "/status": {
      const ref = currentModel ?? registry.getDefault()
      const resolved = registry.resolve(ref)
      const statusOutput = formatStatus(getStatus(), {
        model: `${resolved.provider}/${resolved.modelId}`,
        approvalMode: getApprovalMode(),
        reasoningEnabled,
        contextWindow: resolved.config.contextWindow,
        messageCount: messages.length,
        toolCallCount,
      })
      console.log(statusOutput)
      break
    }
    case "/init": {
      const { initAgentsMd: initMd, gatherProjectFacts } = await import("./init-agents-md.js")
      const facts = await gatherProjectFacts(workspaceRoot)
      console.log("  Detected:")
      if (facts.project?.name) console.log(`    Name: ${facts.project.name}`)
      if (facts.language) console.log(`    Language: ${facts.language}`)
      if (facts.framework) console.log(`    Framework: ${facts.framework}`)
      if (facts.testing?.framework) console.log(`    Testing: ${facts.testing.framework}`)
      if (facts.tooling?.linter) console.log(`    Linter: ${facts.tooling.linter}`)

      let client: any = undefined
      let modelId: string | undefined
      try {
        const ref = currentModel ?? registry.getDefault()
        const resolved = registry.resolve(ref)
        const result = getClient(ref)
        client = result.client
        modelId = resolved.modelId
      } catch {
        // no model available, use static generation
      }

      const { content, path } = await initMd(workspaceRoot, client && modelId ? { client, modelId } : undefined)
      console.log(`\n  Generated ${path}`)
      console.log("  (edit freely — this is a starter template)")
      break
    }
    case "/model":
      if (args.length === 0) {
        console.log(`  Current model: ${currentModel ?? registry.getDefault()}`)
      } else {
        try {
          const ref = args.join("/")
          registry.resolve(ref)
          currentModel = ref
          console.log(`  Switched to: ${ref}`)
        } catch (e) {
          console.error(`  Error: ${(e as Error).message}`)
        }
      }
      break
    case "/providers":
      printProviders()
      break
    case "/approval":
      if (args.length === 0) {
        console.log(`  Current mode: ${getApprovalMode()}`)
        console.log("  Modes: ask (default), auto, full")
      } else {
        const mode = args[0] as ApprovalMode
        if (["ask", "auto", "full"].includes(mode)) {
          setApprovalMode(mode)
          console.log(`  Approval mode: ${mode}`)
        } else {
          console.error("  Invalid mode. Use: ask, auto, or full")
        }
      }
      break
    case "/reasoning":
      reasoningEnabled = !reasoningEnabled
      console.log(`  Reasoning: ${reasoningEnabled ? "ON" : "OFF"}`)
      break
    case "/undo": {
      const result = undoLastBatch(workspaceRoot)
      if (result.restored.length > 0) {
        console.log("  Undone:")
        result.restored.forEach((r) => console.log(`    ${r}`))
      }
      if (result.errors.length > 0) {
        result.errors.forEach((e) => console.error(`    ${e}`))
      }
      break
    }
    case "/diff": {
      const result = gitDiff({}, workspaceRoot)
      console.log(result)
      break
    }
    case "/clear": {
      const agentsMd = await loadAgentsMd({ projectRoot: workspaceRoot })
      messages = [
        { role: "system", content: formatSystemPromptWithAgentsMd(BASE_SYSTEM_PROMPT, agentsMd) },
      ]
      clearPendingBatch()
      console.log("  Conversation cleared.")
      break
    }
    case "/exit":
      persistSession()
      console.log("  Session saved. Bye!")
      process.exit(0)
    default:
      console.log(`  Unknown command: ${cmd}. Type /help for available commands.`)
  }
  return true
}

async function main() {
  await loadOrCreateSession()

  console.log("\nvector — provider-agnostic coding agent")
  console.log(`  Model: ${currentModel ?? registry.getDefault()}`)
  console.log(`  Mode: ${getApprovalMode()}`)
  console.log(`  Workspace: ${workspaceRoot}`)
  console.log("  Type /status for details, /help for commands, /exit to quit.\n")

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "You: ",
    completer: createCompleter({
      listProviders: () => registry.listProviders(),
      listModels: (provider) => registry.listModels(provider),
    }),
  })

  const processInput = async (input: string) => {
    if (!input.trim()) {
      rl.prompt()
      return
    }

    if (await handleCommand(input)) {
      rl.prompt()
      return
    }

    messages = addMessage(messages, { role: "user", content: input })

    try {
      const { client, resolved } = getClient(currentModel)
      const contextMessages = compactHistory(messages, resolved.config.contextWindow)
      const useTools = resolved.config.supportsTools
      const canStream = !useTools

      let assistantContent = ""
      const toolCalls: { id: string; name: string; arguments: string }[] = []

      if (canStream) {
        const stream = await client.chat.completions.create({
          model: resolved.modelId,
          messages: contextMessages as any,
          stream: true,
        })
        process.stdout.write("\nAssistant: ")
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta
          if (delta?.content) {
            process.stdout.write(delta.content)
            assistantContent += delta.content
          }
        }
        console.log("\n")
      } else {
        const response = await client.chat.completions.create({
          model: resolved.modelId,
          messages: contextMessages as any,
          tools: TOOL_SCHEMAS,
          tool_choice: "auto",
        })
        const choice = response.choices[0]
        if (!choice) {
          console.log("\n  (No response from model. Try rephrasing your message.)\n")
          messages = addMessage(messages, { role: "assistant", content: "(No response)" })
          persistSession()
          rl.prompt()
          return
        }
        assistantContent = choice.message?.content ?? ""
        const rawToolCalls = choice.message?.tool_calls ?? []
        for (const tc of rawToolCalls) {
          toolCalls.push({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments })
        }
        if (assistantContent) {
          const displayContent = reasoningEnabled ? assistantContent : stripThinkingTags(assistantContent)
          process.stdout.write(`\nAssistant: ${displayContent}\n\n`)
        }
        recordUsage((response as ChatCompletion).usage)
      }

      if (assistantContent) {
        messages = addMessage(messages, { role: "assistant", content: assistantContent })
      }

      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(tc.arguments)
          } catch {
            try {
              args = JSON.parse(tc.arguments.replace(/'/g, '"'))
            } catch {
              const errOutput = `<tool_output name="${tc.name}" status="error">\nInvalid JSON arguments\n</tool_output>`
              messages = addMessage(messages, { role: "tool", content: errOutput, tool_call_id: tc.id })
              console.log(errOutput)
              continue
            }
          }

          console.log(`  [tool: ${tc.name}]`)
          const output = await dispatchTool(tc.name, args)
          console.log(output)
          toolCallCount++
          messages = addMessage(messages, { role: "tool", content: output, tool_call_id: tc.id })
        }

        const toolMessages = messages.filter((m) => m.role === "tool").slice(-toolCalls.length)
        const followUp = await client.chat.completions.create({
          model: resolved.modelId,
          messages: [
            ...contextMessages,
            {
              role: "assistant",
              content: assistantContent,
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            },
            ...toolMessages,
          ] as any,
        })

        const followUpContent = followUp.choices[0].message.content ?? ""
        if (followUpContent) {
          const displayContent = reasoningEnabled ? followUpContent : stripThinkingTags(followUpContent)
          process.stdout.write(`\nAssistant: ${displayContent}\n\n`)
          messages = addMessage(messages, { role: "assistant", content: followUpContent })
        }
        recordUsage((followUp as ChatCompletion).usage)
      }
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes("401") || msg.includes("Unauthorized")) {
        console.error("  Error: Missing or invalid API key. Check your .env file.")
      } else if (msg.includes("404")) {
        console.error(`  Error: Model not available. Current: ${currentModel ?? registry.getDefault()}`)
        console.error("  Use /model to switch to a configured model.")
        const available = registry.listModels("nvidia")
        if (available.length > 0) {
          console.log("  Available models:")
          available.forEach((m) => console.log(`    nvidia/${m.id}`))
        }
      } else {
        console.error(`  Error: ${msg}`)
      }
      console.log()
    }

    persistSession()
    rl.prompt()
  }

  rl.on("line", (input) => {
    processInput(input)
  })

  rl.on("SIGINT", () => {
    console.log("\n  (Ctrl+C) Use /exit to quit.")
    rl.prompt()
  })

  rl.prompt()
}

main()
