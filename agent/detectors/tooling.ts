import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { readJsonIfExists, getAllDeps } from "./types.js"

const LINTER_MAP: Record<string, string> = {
  eslint: "ESLint",
  "@biomejs/biome": "Biome",
  oxlint: "Oxlint",
  tslint: "TSLint",
}

const FORMATTER_MAP: Record<string, string> = {
  prettier: "Prettier",
  "@biomejs/biome": "Biome",
  dprint: "dprint",
}

const BUNDLER_MAP: Record<string, string> = {
  webpack: "Webpack",
  vite: "Vite",
  esbuild: "esbuild",
  rollup: "Rollup",
  parcel: "Parcel",
  turbo: "Turbopack",
  rspack: "Rspack",
}

export const toolingDetector: Detector = {
  name: "tooling",
  async detect(root: string): Promise<ProjectFacts> {
    const pkg = await readJsonIfExists(join(root, "package.json"))
    if (!pkg) return {}

    const allDeps = getAllDeps(pkg)

    let linter: string | undefined
    for (const [dep, name] of Object.entries(LINTER_MAP)) {
      if (allDeps[dep]) { linter = name; break }
    }

    let formatter: string | undefined
    for (const [dep, name] of Object.entries(FORMATTER_MAP)) {
      if (allDeps[dep]) { formatter = name; break }
    }

    let bundler: string | undefined
    for (const [dep, name] of Object.entries(BUNDLER_MAP)) {
      if (allDeps[dep]) { bundler = name; break }
    }

    return { tooling: { linter, formatter, bundler } }
  },
}
