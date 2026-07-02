import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { readJsonIfExists, getAllDeps } from "./types.js"

const FRAMEWORK_MAP: Record<string, string> = {
  react: "React",
  "react-dom": "React",
  vue: "Vue",
  svelte: "Svelte",
  next: "Next.js",
  nuxt: "Nuxt",
  express: "Express",
  fastify: "Fastify",
  koa: "Koa",
  hono: "Hono",
  "@nestjs/core": "NestJS",
  astro: "Astro",
  gatsby: "Gatsby",
  remix: "Remix",
  "@angular/core": "Angular",
  "@solidjs/solid-js": "Solid",
  preact: "Preact",
}

export const frameworkDetector: Detector = {
  name: "framework",
  async detect(root: string): Promise<ProjectFacts> {
    const pkg = await readJsonIfExists(join(root, "package.json"))
    if (!pkg) return {}

    const allDeps = getAllDeps(pkg)
    for (const [dep, name] of Object.entries(FRAMEWORK_MAP)) {
      if (allDeps[dep]) return { framework: name }
    }

    return {}
  },
}
