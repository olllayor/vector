import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { fileExists } from "./types.js"

export const aiDetector: Detector = {
  name: "ai",
  async detect(root: string): Promise<ProjectFacts> {
    const ai: string[] = []

    if (await fileExists(join(root, "AGENTS.md"))) ai.push("AGENTS.md")
    if (await fileExists(join(root, "CLAUDE.md"))) ai.push("CLAUDE.md")
    if (await fileExists(join(root, "GEMINI.md"))) ai.push("GEMINI.md")
    if (await fileExists(join(root, ".github", "copilot.yml"))) ai.push("GitHub Copilot")
    if (await fileExists(join(root, ".cursorrules"))) ai.push("Cursor")
    if (await fileExists(join(root, ".windsurfrules"))) ai.push("Windsurf")

    return ai.length > 0 ? { ai } : {}
  },
}
