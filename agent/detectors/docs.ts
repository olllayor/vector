import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { fileExists } from "./types.js"

export const docsDetector: Detector = {
  name: "docs",
  async detect(root: string): Promise<ProjectFacts> {
    const docs: string[] = []

    if (await fileExists(join(root, "README.md"))) docs.push("README.md")
    if (await fileExists(join(root, "CONTRIBUTING.md"))) docs.push("CONTRIBUTING.md")
    if (await fileExists(join(root, "CHANGELOG.md"))) docs.push("CHANGELOG.md")
    if (await fileExists(join(root, "LICENSE"))) docs.push("LICENSE")
    if (await fileExists(join(root, "docs"))) docs.push("docs/")

    return docs.length > 0 ? { docs } : {}
  },
}
