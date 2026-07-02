We need to output only valid markdown, no preamble, no code fences around whole output. The structure:

# Project Conventions
{1-line project description}

## Project Type
{language} ({module system}). {framework if any}.

## Setup
```bash
{package manager} install
```

## Commands
```bash
{list scripts with descriptions}
```

## Architecture
{directory listing with one-line purpose for each}

## Key Conventions
{bullet list: module system, test framework, linter, formatter, and any other notable patterns}

We must be concise, each section 1-5 lines. Use actual commands from project. Provide actual commands.

We have scripts listed. Provide list with descriptions.

Directory listing: agent, docs, tests. Provide one-line purpose.

Key Conventions: mention ESM, Vitest, maybe tsx, etc. Also mention linter? Not mentioned. But we can include notable patterns: ESM, Vitest, tsx for CLI, test:all etc.

Make sure each section 1-5 lines. Use bullet list for Key Conventions.

We must not use code fences around whole output, but we can use code fences within sections? The instruction says "Output ONLY valid markdown. No preamble, no explanation, no code fences around the whole output." It doesn't forbid code fences inside sections. But we need to output markdown. Typically we can include code fences for commands. That's okay.

But we must not wrap the entire output in a code fence. So we can have code fences inside sections.

Let's craft:

# Project Conventions
Access 5 frontier Chinese AI models for free via NVIDIA NIM

## Project Type
TypeScript (ESM).

## Setup
```bash
npm install
```

## Commands
```bash
npm run start        # start the CLI
npm test             # run all Vitest tests
npm test:models      # run model.config.test.ts
npm test:agent       # run agent.test.ts
npm test:tools       # run tools.test.ts
npm test:all         # alias for running all tests
```

But need to list scripts with descriptions. Could be a bullet list? The instruction says "list scripts with descriptions". Could be a code block with each line. That's fine.

## Architecture
- agent/ – CLI implementation
- docs/ – documentation files
- tests/ – test suite

But need directory listing with one-line purpose for each. Could be a bullet list or plain lines. Keep 1-5 lines.

## Key Conventions
- ESM module system
- Vitest for testing
- tsx for running TypeScript CLI
- npm scripts for all tasks
- README.md and docs/ for documentation

Make sure each section 1-5 lines. Let's count lines.

Section headings are separate lines. Then content lines.

We need to ensure each section is 1-5 lines. Let's design:

# Project Conventions
Access 5 frontier Chinese AI models for free via NVIDIA NIM

## Project Type
TypeScript (ESM).

## Setup
```bash
npm install
```

## Commands
```bash
npm run start        # start the CLI
npm test             # run all Vitest tests
npm test:models      # run model.config.test.ts
npm test:agent       # run agent.test.ts
npm test:tools       # run tools.test.ts
npm test:all         # run all tests
```

## Architecture
agent/ – CLI implementation
docs/ – documentation
tests/ – test suite

## Key Conventions
- ESM modules
- Vitest test framework
- tsx for CLI execution
- npm scripts for all commands
- README.md and docs/ for docs

Check line counts:

# Project Conventions (1 line)
Access 5 frontier Chinese AI models for free via NVIDIA NIM (1 line) => total 2 lines? Actually heading counts as line, then description line. That's 2 lines, okay within 1-5 lines? The rule says each section 1-5 lines. Does heading count? Probably the whole section should be 1-5 lines total. We have 2 lines, okay.

## Project Type: "TypeScript (ESM)." That's 1 line. Good.

## Setup: code block with command. That's maybe 2 lines (the code block lines). But code block may be considered multiple lines but still part of section. It's okay as long as overall section <=5 lines. The code block includes the ```bash line and the npm install line, that's 2 lines inside code fence. Plus the heading line? Actually heading is separate line before code block. So total lines: heading line, blank line? Not needed. Then code fence line, then command line, then closing fence line. That's maybe 4 lines. That's okay.

## Commands: code block with multiple lines. That's okay.

## Architecture: we have heading line, then three bullet lines? Actually we wrote "agent/ – CLI implementation" etc each on separate lines. That's heading line plus three lines = 4 lines, okay.

## Key Conventions: heading line, then bullet list lines (maybe 5 bullet lines). That's heading + 5 bullet lines = 6 lines, exceeds 5? The rule says each section 1-5 lines. So we need to keep bullet list within 5 lines total including heading? Probably the whole section should be 1-5 lines. So we need to limit to max 5 lines total. Let's make heading line plus maybe 4 bullet lines = 5 lines total. Let's do heading line then 4 bullet points, each on its own line. That's 5 lines total (heading counts as line 1, then 4 bullet lines = 5). That's okay.

We need bullet list: use hyphens. Provide 4 bullet points.

Let's craft:

## Key Conventions
- ESM modules
- Vitest testing
- tsx CLI runner
- npm scripts for all tasks
- README.md & docs/ for docs

That's heading line + 5 bullet lines = 6 lines, too many. Need only 4 bullet lines after heading to keep total 5 lines. So we can have heading line then 4 bullet lines = 5 lines total. Let's drop one bullet. Maybe combine some. Let's do:

## Key Conventions
- ESM modules
- Vitest testing
- tsx CLI runner
- npm scripts & docs

That's heading + 4 bullet lines = 5 lines total. Good.

Now ensure no extra blank lines? Blank lines may be considered lines but not content. Probably okay. But to be safe, keep minimal blank lines.

Now ensure each section 1-5 lines. Let's count each:

# Project Conventions
Access 5 frontier Chinese AI models for free via NVIDIA NIM

That's 2 lines (heading + description). That's okay (max 5). Could be considered 2 lines, okay.

## Project Type
TypeScript (ESM).

That's 1 line? Actually heading line plus content line = 2 lines. That's okay.

## Setup
```bash
npm install
```

That's heading line, then code fence line, then command line, then closing fence line = 4 lines. That's okay.

## Commands
```bash
npm run start        # start the CLI
npm test             # run all Vitest tests
npm test:models      # run model.config.test.ts
npm test:agent       # run agent.test.ts
npm test:tools       # run tools.test.ts
npm test:all         # run all tests
```

Heading line + code fence line + 5 command lines + closing fence line = maybe 8 lines, exceeds 5. Need to limit to 5 lines total. We need to compress. Perhaps we can list scripts in a concise way without code fences? The instruction says "list scripts with descriptions". Could be a bullet list outside code fences. But we need to keep section 1-5 lines. So we need to produce a concise list maybe 4 lines total including heading. Let's think.

We can have heading line, then a bullet list of scripts each on its own line, but that would be many lines. Better to use a compact format: maybe "npm run start – start the CLI" as a single line. But we need to list all scripts. Could we put them in a single line separated by commas? That might be okay but need descriptions. Could be "npm run start – start CLI; npm test – all tests; npm test:models – model tests; npm test:agent – agent tests; npm test:tools – tools tests; npm test:all – all tests". That's one line, but maybe too long but still one line. That would be heading line + that line = 2 lines, within 5. That satisfies "list scripts with descriptions". It's a list with descriptions. So we can produce a single line with semicolons.

Thus:

## Commands
npm run start – start CLI; npm test – all tests; npm test:models – model tests; npm test:agent – agent tests; npm test:tools – tools tests; npm test:all – all tests

That's heading line + that line = 2 lines.

Now ## Architecture: we need directory listing with one-line purpose for each. Could be heading line + three lines each describing a