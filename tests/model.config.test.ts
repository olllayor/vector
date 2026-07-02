import { describe, it, expect } from "vitest"
import { getDefaultClient, FREE_MODELS, registry } from "../agent/model.config.js"

const resolved = registry.resolve(registry.getDefault())
const hasKey = !!resolved.apiKey

describe.skipIf(!hasKey)("NVIDIA NIM Connection", () => {
  FREE_MODELS.forEach(({ id, name }) => {
    it(`${name} (${id})`, async () => {
      const client = getDefaultClient()
      const response = await client.chat.completions.create({
        model: id,
        messages: [{ role: "user", content: "Say hi" }],
        max_tokens: 10,
      })
      expect(response.choices[0].message.content).toBeDefined()
      console.log(`✓ ${name} connected`)
    }, 60000)
  })
})
