import { join } from "path"
import type { Detector, ProjectFacts } from "./types.js"
import { readJsonIfExists, getAllDeps, fileExists } from "./types.js"

const DB_MAP: Record<string, string> = {
  prisma: "Prisma",
  drizzle: "Drizzle",
  typeorm: "TypeORM",
  mongoose: "Mongoose",
  sequelize: "Sequelize",
  knex: "Knex",
  "@prisma/client": "Prisma",
  "@trpc/server": "tRPC",
  pg: "PostgreSQL",
  mysql2: "MySQL",
  "better-sqlite3": "SQLite",
  redis: "Redis",
  ioredis: "Redis",
}

export const databaseDetector: Detector = {
  name: "database",
  async detect(root: string): Promise<ProjectFacts> {
    const database: string[] = []

    const pkg = await readJsonIfExists(join(root, "package.json"))
    if (pkg) {
      const allDeps = getAllDeps(pkg)
      for (const [dep, name] of Object.entries(DB_MAP)) {
        if (allDeps[dep] && !database.includes(name)) database.push(name)
      }
    }

    if (await fileExists(join(root, "prisma"))) database.push("Prisma")
    if (await fileExists(join(root, "drizzle"))) database.push("Drizzle")
    if (await fileExists(join(root, "schema.prisma"))) database.push("Prisma")

    return database.length > 0 ? { database } : {}
  },
}
