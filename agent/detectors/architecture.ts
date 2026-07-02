import { readdir } from "fs/promises"
import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"

const SIGNIFICANT_DIRS = new Set([
  "src", "lib", "app", "pages", "components", "hooks", "utils", "helpers",
  "services", "models", "controllers", "routes", "middleware", "config",
  "tests", "test", "__tests__", "spec", "e2e",
  "packages", "apps", "services", "libs", "modules", "packages",
  "agent", "tools", "commands",
  "public", "static", "assets", "styles",
  "scripts", "bin",
  "prisma", "drizzle", "migrations",
  "docker", "k8s", "kubernetes",
])

export const architectureDetector: Detector = {
  name: "architecture",
  async detect(root: string): Promise<ProjectFacts> {
    try {
      const entries = await readdir(root, { withFileTypes: true })
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
        .map((e) => e.name)

      const significant = dirs.filter((d) => SIGNIFICANT_DIRS.has(d))
      const other = dirs.filter((d) => !SIGNIFICANT_DIRS.has(d)).slice(0, 5)

      const architecture = [...significant, ...other].sort()
      return architecture.length > 0 ? { architecture } : {}
    } catch {
      return {}
    }
  },
}
