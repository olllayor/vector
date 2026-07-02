import fuzzysort from "fuzzysort"
import type { SlashCommand } from "./registry.js"

export function matchCommands(
  commands: SlashCommand[],
  query: string,
): SlashCommand[] {
  if (!query) return commands

  const results = fuzzysort.go(query, commands, {
    keys: ["name", "description"],
    limit: Infinity,
    scoreFn: (a) => {
      const nameScore = a[0]?.score ?? -Infinity
      const descScore = a[1]?.score ?? -Infinity
      return nameScore * 2 + descScore
    },
  })

  return results.map((r) => r.obj)
}
