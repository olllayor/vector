const THINKING_REGEX = /<think>[\s\S]*?<\/think>/g

export function stripThinkingTags(text: string): string {
  return text.replace(THINKING_REGEX, "").trim()
}

export function hasThinkingTags(text: string): boolean {
  return THINKING_REGEX.test(text)
}

export function extractThinking(text: string): string | null {
  const match = text.match(THINKING_REGEX)
  return match ? match[0].replace(/<think>|<\/think>/g, "").trim() : null
}
