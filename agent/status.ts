export interface StatusState {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  latestPromptTokens: number
  turnCount: number
}

let state: StatusState = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  latestPromptTokens: 0,
  turnCount: 0,
}

export function recordUsage(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined | null): void {
  if (!usage) return
  state.totalPromptTokens += usage.prompt_tokens ?? 0
  state.totalCompletionTokens += usage.completion_tokens ?? 0
  state.totalTokens += usage.total_tokens ?? 0
  state.latestPromptTokens = usage.prompt_tokens ?? 0
  state.turnCount++
}

export function getStatus(): StatusState {
  return { ...state }
}

export function resetStatus(): void {
  state = {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    latestPromptTokens: 0,
    turnCount: 0,
  }
}

export function getStateForPersist(): StatusState {
  return { ...state }
}

export function loadStateFromPersist(saved: Partial<StatusState>): void {
  state = {
    totalPromptTokens: saved.totalPromptTokens ?? 0,
    totalCompletionTokens: saved.totalCompletionTokens ?? 0,
    totalTokens: saved.totalTokens ?? 0,
    latestPromptTokens: saved.latestPromptTokens ?? 0,
    turnCount: saved.turnCount ?? 0,
  }
}

export function formatStatus(
  statusState: StatusState,
  opts: {
    model: string
    approvalMode: string
    reasoningEnabled: boolean
    contextWindow: number | undefined
    messageCount: number
    toolCallCount: number
  }
): string {
  const lines: string[] = []
  lines.push("")
  lines.push("vector status")
  lines.push(`  Model: ${opts.model}`)
  lines.push(`  Approval: ${opts.approvalMode}`)
  lines.push(`  Reasoning: ${opts.reasoningEnabled ? "ON" : "OFF"}`)
  lines.push(
    `  Tokens: ${statusState.totalPromptTokens.toLocaleString()} prompt / ${statusState.totalCompletionTokens.toLocaleString()} completion (total: ${statusState.totalTokens.toLocaleString()})`
  )

  if (opts.contextWindow && opts.contextWindow > 0) {
    const contextPct = Math.round((statusState.latestPromptTokens / opts.contextWindow) * 100)
    const pctDisplay = contextPct === 0 && statusState.latestPromptTokens > 0 ? "<1" : `${contextPct}`
    lines.push(`  Context: ${pctDisplay}% of ${opts.contextWindow.toLocaleString()} window`)
  } else {
    lines.push(`  Context: Unknown context window`)
  }

  lines.push(`  Messages: ${opts.messageCount} | Tool calls: ${opts.toolCallCount}`)
  lines.push("")

  return lines.join("\n")
}
