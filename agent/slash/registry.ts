export interface SlashCommand {
  name: string
  description: string
  source: "builtin" | "project" | "user"
  handler: (args: string) => Promise<void>
}

export class SlashRegistry {
  private commands = new Map<string, SlashCommand>()

  register(cmd: SlashCommand): void {
    this.commands.set(cmd.name, cmd)
  }

  resolve(name: string): SlashCommand | undefined {
    return this.commands.get(name)
  }

  list(): SlashCommand[] {
    return [...this.commands.values()]
  }
}

import { createBuiltins, type BuiltinDeps } from "./builtins.js"

export function loadBuiltins(deps: BuiltinDeps): SlashRegistry {
  const registry = new SlashRegistry()
  for (const cmd of createBuiltins(deps)) {
    registry.register(cmd)
  }
  return registry
}
