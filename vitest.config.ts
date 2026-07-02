import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    setup: ["./tests/vitest-setup.ts"],
  },
})
