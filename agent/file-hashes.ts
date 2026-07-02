import { readFileSync } from "fs"
import { createHash } from "crypto"

const fileHashes = new Map<string, string>()

export function getFileHash(filePath: string): string {
  try {
    const content = readFileSync(filePath)
    return createHash("sha256").update(content).digest("hex")
  } catch {
    return ""
  }
}

export function recordFileHash(filePath: string): string {
  const hash = getFileHash(filePath)
  fileHashes.set(filePath, hash)
  return hash
}

export function hasFileChanged(filePath: string): boolean {
  const recorded = fileHashes.get(filePath)
  if (!recorded) return false
  return recorded !== getFileHash(filePath)
}

export function clearFileHashes(): void {
  fileHashes.clear()
}
