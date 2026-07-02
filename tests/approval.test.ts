import { describe, it, expect } from "vitest"
import { getApprovalMode, setApprovalMode, isReadOnlyTool, formatApprovalHeader } from "../agent/approval.js"

describe("ApprovalMode", () => {
  it("defaults to ask", () => {
    setApprovalMode("ask")
    expect(getApprovalMode()).toBe("ask")
  })

  it("can be set to auto", () => {
    setApprovalMode("auto")
    expect(getApprovalMode()).toBe("auto")
  })

  it("can be set to full", () => {
    setApprovalMode("full")
    expect(getApprovalMode()).toBe("full")
  })
})

describe("isReadOnlyTool", () => {
  it("identifies read-only tools", () => {
    expect(isReadOnlyTool("list_files")).toBe(true)
    expect(isReadOnlyTool("search_code")).toBe(true)
    expect(isReadOnlyTool("read_file")).toBe(true)
    expect(isReadOnlyTool("git_diff")).toBe(true)
  })

  it("identifies write tools as non-read-only", () => {
    expect(isReadOnlyTool("str_replace")).toBe(false)
    expect(isReadOnlyTool("write_file")).toBe(false)
    expect(isReadOnlyTool("run_command")).toBe(false)
  })
})

describe("formatApprovalHeader", () => {
  it("shows ask mode for file edits", () => {
    setApprovalMode("ask")
    expect(formatApprovalHeader("str_replace", "ask")).toBe("[ask] str_replace")
  })

  it("shows auto mode for file edits", () => {
    setApprovalMode("auto")
    expect(formatApprovalHeader("str_replace", "auto")).toBe("[auto] str_replace")
  })

  it("shows full mode", () => {
    setApprovalMode("full")
    expect(formatApprovalHeader("run_command", "full")).toBe("[full] run_command")
  })
})
