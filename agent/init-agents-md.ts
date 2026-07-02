import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { runDetectors, type ProjectFacts } from "./detectors/index.js"

export async function gatherProjectFacts(root: string): Promise<ProjectFacts> {
  return runDetectors(root)
}

function formatFactsForLlm(facts: ProjectFacts): string {
  const lines: string[] = []
  lines.push("Project facts detected from repository analysis:")
  lines.push("")
  if (facts.project?.name) lines.push(`- Name: ${facts.project.name}`)
  if (facts.project?.description) lines.push(`- Description: ${facts.project.description}`)
  if (facts.packageManager) lines.push(`- Package manager: ${facts.packageManager}`)
  if (facts.language) lines.push(`- Language: ${facts.language}`)
  if (facts.moduleSystem) lines.push(`- Module system: ${facts.moduleSystem}`)
  if (facts.framework) lines.push(`- Framework: ${facts.framework}`)
  if (facts.tooling?.linter) lines.push(`- Linter: ${facts.tooling.linter}`)
  if (facts.tooling?.formatter) lines.push(`- Formatter: ${facts.tooling.formatter}`)
  if (facts.tooling?.bundler) lines.push(`- Bundler: ${facts.tooling.bundler}`)
  if (facts.testing?.framework) lines.push(`- Test framework: ${facts.testing.framework}`)
  if (facts.testing?.e2e) lines.push(`- E2E testing: ${facts.testing.e2e}`)
  if (facts.ci?.length) lines.push(`- CI/CD: ${facts.ci.join(", ")}`)
  if (facts.docs?.length) lines.push(`- Documentation: ${facts.docs.join(", ")}`)
  if (facts.architecture?.length) lines.push(`- Directories: ${facts.architecture.join(", ")}`)
  if (facts.database?.length) lines.push(`- Database: ${facts.database.join(", ")}`)
  if (facts.deployment?.length) lines.push(`- Deployment: ${facts.deployment.join(", ")}`)
  if (facts.ai?.length) lines.push(`- AI configs: ${facts.ai.join(", ")}`)
  if (facts.scripts && Object.keys(facts.scripts).length > 0) {
    lines.push("- Scripts:")
    for (const [name, cmd] of Object.entries(facts.scripts)) {
      lines.push(`  - ${name}: ${cmd}`)
    }
  }
  return lines.join("\n")
}

const SYSTEM_PROMPT = `You are a technical writer generating an AGENTS.md file for a coding agent.
The AGENTS.md tells the agent about project conventions, setup, commands, and architecture.
Output ONLY valid markdown. No preamble, no explanation, no code fences around the whole output.

Structure:
# Project Conventions
{1-line project description}

## Project Type
{language} ({module system}). {framework if any}.

## Setup
\`\`\`bash
{package manager} install
\`\`\`

## Commands
\`\`\`bash
{list scripts with descriptions}
\`\`\`

## Architecture
{directory listing with one-line purpose for each}

## Key Conventions
{bullet list: module system, test framework, linter, formatter, and any other notable patterns}

Rules:
- Be concise. Each section 1-5 lines.
- Use actual commands from the project, not placeholders.
- If a section has no relevant info, skip it entirely.
- Match the project's actual tools and patterns.`

export async function generateWithLlm(
  facts: ProjectFacts,
  client: { chat: { completions: { create: (opts: any) => Promise<any> } } },
  modelId: string,
): Promise<string> {
  const factsText = formatFactsForLlm(facts)
  const userPrompt = `Generate an AGENTS.md for this project:\n\n${factsText}`

  const response = await client.chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  })

  return response.choices[0]?.message?.content ?? ""
}

export function generateStatic(facts: ProjectFacts): string {
  const sections: string[] = []

  sections.push("# Project Conventions\n")

  if (facts.project?.description) {
    sections.push(facts.project.description + "\n")
  }

  sections.push("## Project Type\n")
  const typeLine = `${facts.language ?? "JavaScript"} (${facts.moduleSystem ?? "CommonJS"})`
  if (facts.framework) {
    sections.push(`${typeLine}. ${facts.framework}.\n`)
  } else {
    sections.push(typeLine + ".\n")
  }

  sections.push("## Setup\n")
  sections.push("```bash")
  sections.push(`${facts.packageManager ?? "npm"} install`)
  sections.push("```\n")

  if (facts.scripts && Object.keys(facts.scripts).length > 0) {
    sections.push("## Commands\n")
    sections.push("```bash")
    for (const [name, cmd] of Object.entries(facts.scripts)) {
      sections.push(`${name.padEnd(20)}# ${cmd}`)
    }
    sections.push("```\n")
  }

  if (facts.architecture && facts.architecture.length > 0) {
    sections.push("## Architecture\n")
    sections.push(facts.architecture.map((d) => `- \`${d}/\``).join("\n") + "\n")
  }

  sections.push("## Key Conventions\n")
  const conventions: string[] = []
  conventions.push(`- ${facts.moduleSystem ?? "CommonJS"} module system`)
  if (facts.testing?.framework) conventions.push(`- Uses ${facts.testing.framework} for testing`)
  if (facts.tooling?.linter) conventions.push(`- ${facts.tooling.linter} for linting`)
  if (facts.tooling?.formatter) conventions.push(`- ${facts.tooling.formatter} for formatting`)
  if (facts.database?.length) conventions.push(`- Database: ${facts.database.join(", ")}`)
  if (facts.deployment?.length) conventions.push(`- Deployment: ${facts.deployment.join(", ")}`)
  sections.push(conventions.join("\n") + "\n")

  return sections.join("\n")
}

export async function initAgentsMd(
  root: string,
  opts?: { client?: any; modelId?: string },
): Promise<{ content: string; path: string; facts: ProjectFacts }> {
  const facts = await gatherProjectFacts(root)

  let content: string
  if (opts?.client && opts?.modelId) {
    content = await generateWithLlm(facts, opts.client, opts.modelId)
  } else {
    content = generateStatic(facts)
  }

  const path = join(root, "AGENTS.md")
  await writeFile(path, content, "utf-8")

  return { content, path, facts }
}
