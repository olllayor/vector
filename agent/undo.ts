import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, mkdirSync } from "fs"
import { resolve, basename } from "path"

interface UndoEntry {
  originalPath: string
  backupPath: string
  isNewFile: boolean
}

let pendingBatch: UndoEntry[] = []

export function getBackupDir(workspaceRoot: string): string {
  return resolve(workspaceRoot, ".vector", "backups")
}

export function recordBackup(
  workspaceRoot: string,
  filePath: string,
  isNewFile: boolean
): string {
  const backupDir = getBackupDir(workspaceRoot)
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true })

  const base = basename(filePath)
  const timestamp = Date.now()
  const backupPath = resolve(backupDir, `${base}.${timestamp}.bak`)

  if (!isNewFile && existsSync(filePath)) {
    writeFileSync(backupPath, readFileSync(filePath))
  }

  pendingBatch.push({ originalPath: filePath, backupPath, isNewFile })
  return backupPath
}

export function undoLastBatch(workspaceRoot: string): { restored: string[]; errors: string[] } {
  const restored: string[] = []
  const errors: string[] = []

  if (pendingBatch.length === 0) {
    return { restored, errors: ["Nothing to undo"] }
  }

  const batch = [...pendingBatch].reverse()
  pendingBatch = []

  for (const entry of batch) {
    try {
      if (entry.isNewFile) {
        if (existsSync(entry.originalPath)) {
          unlinkSync(entry.originalPath)
        }
        restored.push(`Deleted new file: ${entry.originalPath}`)
      } else {
        if (existsSync(entry.backupPath)) {
          writeFileSync(entry.originalPath, readFileSync(entry.backupPath))
          unlinkSync(entry.backupPath)
          restored.push(`Restored: ${entry.originalPath}`)
        } else {
          errors.push(`Backup not found for: ${entry.originalPath}`)
        }
      }
    } catch (e) {
      errors.push(`Failed to undo ${entry.originalPath}: ${(e as Error).message}`)
    }
  }

  return { restored, errors }
}

export function hasPendingUndo(): boolean {
  return pendingBatch.length > 0
}

export function getPendingBatchSize(): number {
  return pendingBatch.length
}

export function clearPendingBatch(): void {
  pendingBatch = []
}
