import type { Detector, ProjectFacts } from "./types.js"
import { projectDetector } from "./project.js"
import { frameworkDetector } from "./framework.js"
import { toolingDetector } from "./tooling.js"
import { testingDetector } from "./testing.js"
import { ciDetector } from "./ci.js"
import { docsDetector } from "./docs.js"
import { architectureDetector } from "./architecture.js"
import { databaseDetector } from "./database.js"
import { deploymentDetector } from "./deployment.js"
import { aiDetector } from "./ai.js"

export const ALL_DETECTORS: Detector[] = [
  projectDetector,
  frameworkDetector,
  toolingDetector,
  testingDetector,
  ciDetector,
  docsDetector,
  architectureDetector,
  databaseDetector,
  deploymentDetector,
  aiDetector,
]

export async function runDetectors(root: string, detectors?: Detector[]): Promise<ProjectFacts> {
  const active = detectors ?? ALL_DETECTORS
  const facts: ProjectFacts = {}

  for (const detector of active) {
    try {
      const result = await detector.detect(root)
      merge(facts, result)
    } catch {
      // skip failed detectors
    }
  }

  return facts
}

function merge(target: ProjectFacts, source: ProjectFacts): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    const k = key as keyof ProjectFacts
    const existing = target[k]

    if (Array.isArray(value) && Array.isArray(existing)) {
      ;(target as any)[k] = [...existing, ...value]
    } else if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof existing === "object" && existing !== null) {
      ;(target as any)[k] = { ...existing, ...value }
    } else {
      ;(target as any)[k] = value
    }
  }
}

export type { ProjectFacts, Detector } from "./types.js"
