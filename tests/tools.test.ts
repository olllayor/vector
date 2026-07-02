import { describe, it, expect } from "vitest"
import { FREE_MODELS } from "../agent/model.config.js"

describe("Free Models Config", () => {
  it("has models", () => {
    expect(FREE_MODELS.length).toBeGreaterThanOrEqual(1)
  })

  it("all have required fields", () => {
    FREE_MODELS.forEach((m) => {
      expect(m.id).toBeDefined()
      expect(m.name).toBeDefined()
      expect(m.desc).toBeDefined()
    })
  })

  it("minimax-m3 is coding assistant", () => {
    const m = FREE_MODELS.find((m) => m.id === "minimaxai/minimax-m3")
    expect(m?.desc).toContain("coding")
  })
})
