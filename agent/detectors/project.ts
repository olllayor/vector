import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { fileExists, readJsonIfExists } from "./types.js"

export const projectDetector: Detector = {
  name: "project",
  async detect(root: string): Promise<ProjectFacts> {
    const pkg = await readJsonIfExists(join(root, "package.json"))
    const hasTsconfig = await fileExists(join(root, "tsconfig.json"))

    const packageManager = (await fileExists(join(root, "pnpm-lock.yaml")))
      ? "pnpm"
      : (await fileExists(join(root, "yarn.lock")))
        ? "yarn"
        : "npm"

    const language = hasTsconfig ? "TypeScript" : "JavaScript"
    const moduleSystem = pkg?.type === "module" ? "ESM" : "CommonJS"

    return {
      project: { name: pkg?.name as string, description: pkg?.description as string },
      packageManager,
      language,
      moduleSystem,
      scripts: (pkg?.scripts as Record<string, string>) ?? {},
    }
  },
}
