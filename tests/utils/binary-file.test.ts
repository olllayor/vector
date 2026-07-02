import { describe, it, expect } from "vitest"
import { isBinaryFile, likelyBinaryExtension } from "../../agent/utils/binary-file.js"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("likelyBinaryExtension", () => {
  it("detects image extensions", () => {
    expect(likelyBinaryExtension("photo.png")).toBe(true)
    expect(likelyBinaryExtension("icon.jpg")).toBe(true)
  })

  it("detects archive extensions", () => {
    expect(likelyBinaryExtension("archive.zip")).toBe(true)
  })

  it("rejects text extensions", () => {
    expect(likelyBinaryExtension("file.ts")).toBe(false)
    expect(likelyBinaryExtension("readme.md")).toBe(false)
  })
})

describe("isBinaryFile", () => {
  it("detects text files as non-binary", () => {
    const dir = join(tmpdir(), `test-bin-txt-${Date.now()}-1`)
    mkdirSync(dir)
    const file = join(dir, "test.txt")
    writeFileSync(file, "hello world")
    expect(isBinaryFile(file)).toBe(false)
  })

  it("detects null bytes as binary", () => {
    const dir = join(tmpdir(), `test-bin-null-${Date.now()}-2`)
    mkdirSync(dir)
    const file = join(dir, "test.bin")
    writeFileSync(file, Buffer.from([0x00, 0x01, 0x02]))
    expect(isBinaryFile(file)).toBe(true)
  })
})
