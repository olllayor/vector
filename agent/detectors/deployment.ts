import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { fileExists, readJsonIfExists } from "./types.js"

export const deploymentDetector: Detector = {
  name: "deployment",
  async detect(root: string): Promise<ProjectFacts> {
    const deployment: string[] = []

    if (await fileExists(join(root, "Dockerfile"))) deployment.push("Docker")
    if (await fileExists(join(root, "docker-compose.yml"))) deployment.push("Docker Compose")
    if (await fileExists(join(root, "docker-compose.yaml"))) deployment.push("Docker Compose")
    if (await fileExists(join(root, "k8s"))) deployment.push("Kubernetes")
    if (await fileExists(join(root, "kubernetes"))) deployment.push("Kubernetes")
    if (await fileExists(join(root, "vercel.json"))) deployment.push("Vercel")
    if (await fileExists(join(root, "netlify.toml"))) deployment.push("Netlify")
    if (await fileExists(join(root, "railway.json"))) deployment.push("Railway")
    if (await fileExists(join(root, "fly.toml"))) deployment.push("Fly.io")
    if (await fileExists(join(root, "render.yaml"))) deployment.push("Render")

    const pkg = await readJsonIfExists(join(root, "package.json"))
    if (pkg) {
      const scripts = (pkg.scripts ?? {}) as Record<string, string>
      if (scripts.deploy) deployment.push("Custom deploy script")
    }

    return deployment.length > 0 ? { deployment } : {}
  },
}
