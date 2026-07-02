import { describe, it, expect } from "vitest"
import { scrubSecrets } from "../../agent/utils/scrub-secrets.js"

describe("scrubSecrets", () => {
  it("redacts OpenAI-style keys", () => {
    expect(scrubSecrets("key: sk-abc123def456ghi789jkl0")).toContain("[REDACTED_SECRET]")
  })

  it("redacts NVIDIA keys", () => {
    expect(scrubSecrets("key: nvapi-abc123def456ghi789jkl0")).toContain("[REDACTED_SECRET]")
  })

  it("redacts GitHub tokens", () => {
    expect(scrubSecrets("token: ghp_abcdefghijklmnopqrstuvwxyz123456")).toContain("[REDACTED_SECRET]")
  })

  it("redacts AWS keys", () => {
    expect(scrubSecrets("key: AKIAIOSFODNN7EXAMPLE")).toContain("[REDACTED_SECRET]")
  })

  it("redacts KEY=value patterns", () => {
    expect(scrubSecrets('API_KEY="super-secret-value-here"')).toContain("[REDACTED_SECRET]")
  })

  it("does not redact normal text", () => {
    const normal = "This is a normal sentence with no secrets."
    expect(scrubSecrets(normal)).toBe(normal)
  })
})
