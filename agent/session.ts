import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs"
import { resolve, dirname } from "path"
import type { ApprovalMode } from "./approval.js"

export interface SessionMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  tool_call_id?: string
}

export interface Session {
  version: number
  workspace: string
  provider: string
  model: string
  approvalMode: ApprovalMode
  messages: SessionMessage[]
  tokenUsage?: {
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    latestPromptTokens: number
    turnCount: number
  }
  updatedAt: string
}

const SESSION_VERSION = 1
const MAX_TOOL_OUTPUT_CHARS = 500
const MAX_SESSION_CHARS = 100000

function getSessionDir(workspaceRoot: string): string {
  return resolve(workspaceRoot, ".vector")
}

function getSessionPath(workspaceRoot: string): string {
  return resolve(getSessionDir(workspaceRoot), "session.json")
}

function compactToolOutput(content: string): string {
  if (content.length <= MAX_TOOL_OUTPUT_CHARS) return content
  return content.slice(0, MAX_TOOL_OUTPUT_CHARS) + "\n[Tool output truncated for session storage]"
}

function compactMessages(messages: SessionMessage[]): SessionMessage[] {
  return messages.map((msg) => {
    if (msg.role === "tool") {
      return { ...msg, content: compactToolOutput(msg.content) }
    }
    return msg
  })
}

export function saveSession(
  workspaceRoot: string,
  session: Omit<Session, "version" | "updatedAt">
): void {
  const dir = getSessionDir(workspaceRoot)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const full: Session = {
    ...session,
    version: SESSION_VERSION,
    updatedAt: new Date().toISOString(),
  }

  full.messages = compactMessages(full.messages)

  const json = JSON.stringify(full, null, 2)
  writeFileSync(getSessionPath(workspaceRoot), json)
}

export function loadSession(workspaceRoot: string): Session | null {
  const path = getSessionPath(workspaceRoot)
  if (!existsSync(path)) return null

  try {
    const raw = readFileSync(path, "utf-8")
    const parsed = JSON.parse(raw)
    if (parsed.version !== SESSION_VERSION) return null
    return parsed as Session
  } catch {
    return null
  }
}

export function clearSession(workspaceRoot: string): void {
  const path = getSessionPath(workspaceRoot)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}

export function addMessage(messages: SessionMessage[], msg: SessionMessage): SessionMessage[] {
  return [...messages, msg]
}

export function getSessionSize(messages: SessionMessage[]): number {
  return messages.reduce((sum, m) => sum + m.content.length, 0)
}
