import { readFileSync } from "fs"

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
  ".mp3", ".mp4", ".avi", ".mov", ".mkv", ".flac", ".wav", ".ogg",
  ".pdf", ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z",
  ".exe", ".dll", ".so", ".dylib", ".o", ".a",
  ".woff", ".woff2", ".ttf", ".eot",
  ".sqlite", ".db",
  ".pyc", ".pyo", ".class",
  ".min.js", ".min.css",
])

export function isBinaryFile(filePath: string): boolean {
  const ext = "." + filePath.split(".").pop()?.toLowerCase()
  if (BINARY_EXTENSIONS.has(ext)) return true

  try {
    const buf = readFileSync(filePath)
    const checkLen = Math.min(buf.length, 512)
    for (let i = 0; i < checkLen; i++) {
      if (buf[i] === 0) return true
    }
  } catch {
    return false
  }
  return false
}

export function likelyBinaryExtension(filePath: string): boolean {
  const ext = "." + filePath.split(".").pop()?.toLowerCase()
  return BINARY_EXTENSIONS.has(ext)
}
