import { appendFileSync } from "fs"

const COMMANDS = [
  "/status",
  "/help",
  "/init",
  "/model",
  "/providers",
  "/approval",
  "/reasoning",
  "/undo",
  "/diff",
  "/clear",
  "/exit",
]

const APPROVAL_MODES = ["ask", "auto", "full"]

interface CompleterDeps {
  listProviders: () => string[]
  listModels: (provider: string) => { id: string; supportsTools: boolean; contextWindow: number }[]
}

export function createCompleter(deps: CompleterDeps) {
  return function completer(line: string): [string[], string] {
    appendFileSync("completer-debug.log", `CALLED: "${line}"\n`)

    if (line.startsWith("/")) {
      const parts = line.split(" ")
      const cmd = parts[0]
      const arg = parts.slice(1).join(" ")

      if (cmd === "/approval" && arg) {
        const matches = APPROVAL_MODES
          .filter((m) => m.startsWith(arg))
          .map((m) => `/approval ${m}`)
        appendFileSync("completer-debug.log", `RETURNING: ${JSON.stringify(matches)}\n`)
        return [matches, line]
      }

      if (cmd === "/model" && arg) {
        const allModels: string[] = []
        for (const provider of deps.listProviders()) {
          for (const model of deps.listModels(provider)) {
            allModels.push(`${provider}/${model.id}`)
          }
        }
        const matches = allModels.filter((m) => m.startsWith(arg)).map((m) => `/model ${m}`)
        appendFileSync("completer-debug.log", `RETURNING: ${JSON.stringify(matches)}\n`)
        return [matches, line]
      }

      const matches = COMMANDS.filter((c) => c.startsWith(cmd))
      appendFileSync("completer-debug.log", `RETURNING: ${JSON.stringify(matches)}\n`)
      return [matches, line]
    }

    appendFileSync("completer-debug.log", `RETURNING: []\n`)
    return [[], line]
  }
}
