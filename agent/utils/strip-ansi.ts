const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "")
}
