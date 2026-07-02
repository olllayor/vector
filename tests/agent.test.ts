import { describe, it, expect } from "vitest"
import * as dotenv from "dotenv"
import { resolve } from "path"
import { runAgent } from "../agent/tools.js"
import type { FreeModelId } from "../agent/model.config.js"

dotenv.config({ path: resolve(import.meta.dirname ?? "..", ".env") })

const hasKey = !!process.env.NVAPI_KEY

describe.skipIf(!hasKey)("Agent Tool Use", () => {
  const models: FreeModelId[] = [
    "nvidia/nemotron-3-nano-30b-a3b",
    "minimaxai/minimax-m3",
    "moonshotai/kimi-k2.6",
    "deepseek-ai/deepseek-v4-flash",
  ]

  models.forEach((modelId) => {
    it(`agent uses tools via ${modelId}`, async () => {
      const result = await runAgent("What is the weather in Tokyo?", modelId)
      expect(result).toContain("Tokyo")
      console.log(`✓ ${modelId}: ${result.slice(0, 50)}...`)
    }, 60000)
  })
})
