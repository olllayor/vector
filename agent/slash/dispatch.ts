import type { SlashRegistry } from "./registry.js"

export async function dispatchSlashCommand(
  raw: string,
  registry: SlashRegistry,
): Promise<void> {
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/")) return

  const spaceIdx = trimmed.indexOf(" ")
  const name = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1)

  const cmd = registry.resolve(name)
  if (!cmd) {
    console.error(`  Unknown command: ${trimmed}`)
    return
  }

  await cmd.handler(args)
}
