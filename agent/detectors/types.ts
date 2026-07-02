import { readFile, access } from "fs/promises"
import { join } from "path"

export interface ProjectFacts {
  project?: { name?: string; description?: string }
  packageManager?: string
  language?: string
  moduleSystem?: string
  framework?: string
  tooling?: { linter?: string; formatter?: string; bundler?: string }
  testing?: { framework?: string; e2e?: string }
  ci?: string[]
  docs?: string[]
  architecture?: string[]
  database?: string[]
  deployment?: string[]
  ai?: string[]
  scripts?: Record<string, string>
}

export interface Detector {
  name: string
  detect(root: string): Promise<ProjectFacts>
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(path, "utf-8")
    return JSON.parse(content)
  } catch {
    return null
  }
}

export function getAllDeps(pkg: Record<string, unknown>): Record<string, string> {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>
  return { ...deps, ...devDeps }
}
