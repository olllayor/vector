import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { fileExists } from "./types.js"

export const ciDetector: Detector = {
  name: "ci",
  async detect(root: string): Promise<ProjectFacts> {
    const ci: string[] = []

    if (await fileExists(join(root, ".github", "workflows"))) ci.push("GitHub Actions")
    if (await fileExists(join(root, ".gitlab-ci.yml"))) ci.push("GitLab CI")
    if (await fileExists(join(root, ".circleci"))) ci.push("CircleCI")
    if (await fileExists(join(root, "Jenkinsfile"))) ci.push("Jenkins")
    if (await fileExists(join(root, ".travis.yml"))) ci.push("Travis CI")
    if (await fileExists(join(root, "bitbucket-pipelines.yml"))) ci.push("Bitbucket Pipelines")

    return ci.length > 0 ? { ci } : {}
  },
}
