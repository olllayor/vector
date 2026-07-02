import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { readJsonIfExists, getAllDeps } from "./types.js"

const TEST_FRAMEWORK_MAP: Record<string, string> = {
  vitest: "Vitest",
  jest: "Jest",
  mocha: "Mocha",
  ava: "AVA",
  tap: "tap",
  jasmine: "Jasmine",
}

const E2E_MAP: Record<string, string> = {
  playwright: "Playwright",
  cypress: "Cypress",
  puppeteer: "Puppeteer",
  "@playwright/test": "Playwright",
}

export const testingDetector: Detector = {
  name: "testing",
  async detect(root: string): Promise<ProjectFacts> {
    const pkg = await readJsonIfExists(join(root, "package.json"))
    if (!pkg) return {}

    const allDeps = getAllDeps(pkg)

    let framework: string | undefined
    for (const [dep, name] of Object.entries(TEST_FRAMEWORK_MAP)) {
      if (allDeps[dep]) { framework = name; break }
    }

    let e2e: string | undefined
    for (const [dep, name] of Object.entries(E2E_MAP)) {
      if (allDeps[dep]) { e2e = name; break }
    }

    return { testing: { framework, e2e } }
  },
}
