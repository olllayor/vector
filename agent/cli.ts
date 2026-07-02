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
import { loadBuiltins } from "./slash/registry.js"
import { dispatchSlashCommand } from "./slash/dispatch.js"
import { SlashMenu } from "./slash/menu.js"
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



async function main() {
  await loadOrCreateSession()

  const slashRegistry = loadBuiltins({
    getStatus: () => {
      const ref = currentModel ?? registry.getDefault()
      const resolved = registry.resolve(ref)
      return formatStatus(getStatus(), {
        model: `${resolved.provider}/${resolved.modelId}`,
        approvalMode: getApprovalMode(),
        reasoningEnabled,
        contextWindow: resolved.config.contextWindow,
        messageCount: messages.length,
        toolCallCount,
      })
    },
    getCurrentModel: () => currentModel ?? registry.getDefault(),
    listProviders: () => registry.listProviders(),
    listModels: (p) => registry.listModels(p),
    getApprovalMode: () => getApprovalMode(),
    setApprovalMode: (m) => setApprovalMode(m as ApprovalMode),
    reasoningEnabled: () => reasoningEnabled,
    toggleReasoning: () => { reasoningEnabled = !reasoningEnabled },
    undoLastBatch: () => undoLastBatch(workspaceRoot),
    gitDiff: (args) => gitDiff(args, workspaceRoot),
    clearSession: () => {
      messages = [{ role: "system", content: formatSystemPromptWithAgentsMd(BASE_SYSTEM_PROMPT, "") }]
      clearPendingBatch()
    },
    exitSession: () => {
      persistSession()
      console.log("  Session saved. Bye!")
      process.exit(0)
    },
  })

  // Add /init command after registry is created (needs dynamic import)
  slashRegistry.register({
    name: "init",
    description: "Generate AGENTS.md for this project",
    source: "builtin",
    handler: async () => {
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
    },
  })

  const menu = new SlashMenu(slashRegistry.list())

  console.log("\nvector — provider-agnostic coding agent")
  console.log(`  Model: ${currentModel ?? registry.getDefault()}`)
  console.log(`  Mode: ${getApprovalMode()}`)
  console.log(`  Workspace: ${workspaceRoot}`)
  console.log("  Type / for commands, /status for details, /exit to quit.\n")

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: "You: ",
  })

  const processInput = async (input: string) => {
    if (!input.trim()) {
      rl.prompt()
      return
    }

    if (input.startsWith("/")) {
      await dispatchSlashCommand(input, slashRegistry)
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

  // Handle raw keystrokes for slash menu
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")

    let lineBuffer = ""

    process.stdin.on("data", async (key: string) => {
      // Ctrl+C
      if (key === "\x03") {
        console.log("\n  (Ctrl+C) Use /exit to quit.")
        rl.prompt()
        return
      }

      // If in slashMenu mode, handle keys ourselves
      if (menu.mode === "slashMenu") {
        const selected = menu.handleKey(key)

        if (selected !== null) {
          // Command was selected — dispatch it
          lineBuffer = ""
          await dispatchSlashCommand(`/${selected}`, slashRegistry)
          rl.prompt()
          return
        }

        if (menu.mode === "editing") {
          // Escaped out of menu
          lineBuffer = ""
          rl.prompt()
          return
        }

        // Render popup
        const popup = menu.render()
        if (popup) {
          process.stdout.write(popup)
        }
        return
      }

      // In editing mode, track the line buffer for "/" trigger detection
      if (key === "\r") {
        // Enter — submit the line
        const input = lineBuffer
        lineBuffer = ""
        await processInput(input)
        return
      }

      if (key === "\x7F" || key === "\b") {
        // Backspace
        lineBuffer = lineBuffer.slice(0, -1)
        return
      }

      if (key.length === 1) {
        lineBuffer += key

        // Check if we just typed "/" at the start of a new line
        if (lineBuffer === "/") {
          menu.handleKey("/")
          const popup = menu.render()
          if (popup) {
            process.stdout.write(popup)
          }
          return
        }
      }
    })
  } else {
    // Fallback for non-TTY (piped input)
    rl.on("line", async (input) => {
      await processInput(input)
    })
  }

  rl.on("SIGINT", () => {
    console.log("\n  (Ctrl+C) Use /exit to quit.")
    rl.prompt()
  })

  rl.prompt()
}

main()
