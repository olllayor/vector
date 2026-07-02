import type { SessionMessage } from "./session.js"

const COMPACTION_THRESHOLD_CHARS = 100000
const KEEP_RECENT_TURNS = 4

export function estimateMessageSize(messages: SessionMessage[]): number {
  return messages.reduce((sum, m) => sum + m.content.length, 0)
}

export function compactHistory(
  messages: SessionMessage[],
  contextWindow?: number
): SessionMessage[] {
  const threshold = contextWindow
    ? Math.floor(contextWindow * 0.7 * 4)
    : COMPACTION_THRESHOLD_CHARS

  const totalSize = estimateMessageSize(messages)
  if (totalSize <= threshold) return messages

  const systemMessages = messages.filter((m) => m.role === "system")
  const nonSystem = messages.filter((m) => m.role !== "system")

  if (nonSystem.length <= KEEP_RECENT_TURNS) return messages

  const recent = nonSystem.slice(-KEEP_RECENT_TURNS)
  const dropped = nonSystem.slice(0, -KEEP_RECENT_TURNS)

  const summaryContent = `[Note: ${dropped.length} earlier messages were truncated to save context. ` +
    `Summarized actions: ${summarizeMessages(dropped)}]`

  const compacted: SessionMessage[] = [
    ...systemMessages,
    { role: "system", content: summaryContent },
    ...recent,
  ]

  return compacted
}

function summarizeMessages(messages: SessionMessage[]): string {
  const actions: string[] = []
  for (const msg of messages) {
    if (msg.role === "assistant") {
      if (msg.content.includes("str_replace")) actions.push("file edits")
      else if (msg.content.includes("run_command")) actions.push("command execution")
      else if (msg.content.includes("read_file")) actions.push("file reads")
      else if (msg.content.includes("search_code")) actions.push("code searches")
    }
  }
  if (actions.length === 0) return "general conversation"
  return [...new Set(actions)].join(", ")
}
