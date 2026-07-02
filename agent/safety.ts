import { execSync } from "child_process"
import { realpathSync } from "fs"
import { resolve, relative, isAbsolute } from "path"

export function resolveWorkspaceRoot(from?: string): string {
  const cwd = from ?? process.cwd()
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", { cwd, encoding: "utf-8" }).trim()
    return realpathSync(gitRoot)
  } catch {
    return realpathSync(cwd)
  }
}

export function isInsideWorkspace(targetPath: string, workspaceRoot: string): boolean {
  const realRoot = realpathSync(workspaceRoot)
  if (!isAbsolute(targetPath)) {
    targetPath = resolve(workspaceRoot, targetPath)
  }
  let realTarget: string
  try {
    realTarget = realpathSync(targetPath)
  } catch {
    realTarget = resolve(realRoot, relative(workspaceRoot, targetPath))
  }
  const rel = relative(realRoot, realTarget)
  return !rel.startsWith("..") && !isAbsolute(rel)
}
