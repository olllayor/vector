import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { recordBackup, undoLastBatch, hasPendingUndo, getPendingBatchSize, clearPendingBatch } from "../agent/undo.js"
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const workspace = join(tmpdir(), `test-undo-${Date.now()}`)

beforeEach(() => {
  mkdirSync(workspace, { recursive: true })
  clearPendingBatch()
})

afterEach(() => {
  clearPendingBatch()
  rmSync(workspace, { recursive: true, force: true })
})

describe("Undo system", () => {
  it("restores modified file", () => {
    const filePath = join(workspace, "file.ts")
    writeFileSync(filePath, "original content")

    recordBackup(workspace, filePath, false)
    writeFileSync(filePath, "modified content")

    const result = undoLastBatch(workspace)
    expect(result.restored).toHaveLength(1)
    expect(readFileSync(filePath, "utf-8")).toBe("original content")
  })

  it("deletes new file on undo", () => {
    const filePath = join(workspace, "new.ts")
    recordBackup(workspace, filePath, true)
    writeFileSync(filePath, "new content")

    const result = undoLastBatch(workspace)
    expect(result.restored).toHaveLength(1)
    expect(existsSync(filePath)).toBe(false)
  })

  it("returns error when nothing to undo", () => {
    const result = undoLastBatch(workspace)
    expect(result.errors).toContain("Nothing to undo")
  })

  it("tracks pending batch", () => {
    expect(hasPendingUndo()).toBe(false)
    recordBackup(workspace, join(workspace, "a.ts"), false)
    expect(hasPendingUndo()).toBe(true)
  })

  it("clears batch after undo", () => {
    const filePath = join(workspace, "file.ts")
    writeFileSync(filePath, "original")
    recordBackup(workspace, filePath, false)
    undoLastBatch(workspace)
    expect(hasPendingUndo()).toBe(false)
  })

  it("handles multiple files in one batch", () => {
    const f1 = join(workspace, "a.ts")
    const f2 = join(workspace, "b.ts")
    writeFileSync(f1, "original a")
    writeFileSync(f2, "original b")

    recordBackup(workspace, f1, false)
    recordBackup(workspace, f2, false)
    writeFileSync(f1, "modified a")
    writeFileSync(f2, "modified b")

    const result = undoLastBatch(workspace)
    expect(result.restored).toHaveLength(2)
    expect(readFileSync(f1, "utf-8")).toBe("original a")
    expect(readFileSync(f2, "utf-8")).toBe("original b")
  })

  it("cleans up backup files after undo", () => {
    const filePath = join(workspace, "file.ts")
    writeFileSync(filePath, "original")
    recordBackup(workspace, filePath, false)
    undoLastBatch(workspace)

    const backupDir = join(workspace, ".vector", "backups")
    const { readdirSync } = require("fs")
    const backups = readdirSync(backupDir).filter((f: string) => f.includes("file.ts"))
    expect(backups).toHaveLength(0)
  })

  it("getPendingBatchSize tracks count", () => {
    expect(getPendingBatchSize()).toBe(0)
    recordBackup(workspace, join(workspace, "a.ts"), false)
    recordBackup(workspace, join(workspace, "b.ts"), false)
    expect(getPendingBatchSize()).toBe(2)
  })
})
