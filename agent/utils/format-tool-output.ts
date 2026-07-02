export function formatToolOutput(name: string, content: string, status: "ok" | "error" = "ok"): string {
  return `<tool_output name="${name}" status="${status}">\n${content}\n</tool_output>`
}
