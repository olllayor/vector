import { z } from "zod"

export const ReadFileArgsSchema = z.object({
  path: z.string().describe("File path relative to workspace root"),
  startLine: z.number().optional().describe("1-indexed start line (inclusive)"),
  endLine: z.number().optional().describe("1-indexed end line (inclusive)"),
})

export const ListFilesArgsSchema = z.object({
  path: z.string().default(".").describe("Directory path relative to workspace root"),
  depth: z.number().default(1).describe("How deep to recurse (default: 1)"),
})

export const SearchCodeArgsSchema = z.object({
  query: z.string().describe("Search pattern (regex supported)"),
  caseSensitive: z.boolean().default(false).describe("Case-sensitive search"),
})

export const StrReplaceArgsSchema = z.object({
  path: z.string().describe("File path relative to workspace root"),
  oldText: z.string().describe("Exact text to find and replace"),
  newText: z.string().describe("Replacement text"),
})

export const WriteFileArgsSchema = z.object({
  path: z.string().describe("File path relative to workspace root"),
  content: z.string().describe("Full file content to write"),
})

export const GitDiffArgsSchema = z.object({
  filePath: z.string().optional().describe("Optional specific file to diff"),
})

export const RunCommandArgsSchema = z.object({
  command: z.string().describe("Shell command to execute"),
  cwd: z.string().optional().describe("Working directory (defaults to workspace root)"),
  timeout: z.number().default(30000).describe("Timeout in milliseconds (default: 30000)"),
})

export type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>
export type ListFilesArgs = z.infer<typeof ListFilesArgsSchema>
export type SearchCodeArgs = z.infer<typeof SearchCodeArgsSchema>
export type StrReplaceArgs = z.infer<typeof StrReplaceArgsSchema>
export type WriteFileArgs = z.infer<typeof WriteFileArgsSchema>
export type GitDiffArgs = z.infer<typeof GitDiffArgsSchema>
export type RunCommandArgs = z.infer<typeof RunCommandArgsSchema>
