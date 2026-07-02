export interface TruncateOptions {
  maxChars?: number
  headLines?: number
  tailLines?: number
}

const DEFAULTS: Required<TruncateOptions> = {
  maxChars: 10000,
  headLines: 50,
  tailLines: 150,
}

export function truncateOutput(text: string, opts: TruncateOptions = {}): string {
  const { maxChars, headLines, tailLines } = { ...DEFAULTS, ...opts }

  const lines = text.split("\n")

  if (lines.length > headLines + tailLines) {
    const head = lines.slice(0, headLines)
    const tail = lines.slice(-tailLines)
    const marker = `[Output truncated: kept first ${headLines} lines and last ${tailLines} lines]`
    text = [...head, marker, ...tail].join("\n")
  }

  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + `\n[Output truncated at ${maxChars} chars]`
  }

  return text
}
