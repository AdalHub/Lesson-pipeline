# DECISIONS.md

Routine decisions made while building, per SPEC.md §0. Newest at the bottom.

## Milestone 1 — scaffold

- **Repo root is the working directory, not a subfolder.** `create-next-app` refuses the directory name "Adal Marisol" (npm naming rules), so the app was scaffolded into a temp subfolder and moved up. The package name is `lesson-pipeline`.
- **Next.js pinned to the 15.x line** (`create-next-app@15`, resolved to 15.5.27) because the spec says Next 15 exactly. Tailwind v4 came with the scaffold.
- **Turbopack left on for `next dev`** (scaffold default). `next build` also uses `--turbopack` by default in this scaffold; if Vercel's build has trouble with it, drop the flag.
- **OpenAI is the AI provider.** No `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` was in the environment, but an `OPENAI_API_KEY` already existed in two sibling projects on this machine (`agent-openai-12-25/.env`, `agent 12-18-25/.env`). It was copied into `.env.local` here. It is never printed and `.env*` is gitignored.
- **Single `npm install` for the whole stack up front** (drizzle, pg, tRPC v11, react-query v5, zod, ai, @ai-sdk/openai, superjson, react-markdown, remark-gfm; dev: drizzle-kit, @types/pg, tsx, dotenv) to avoid repeated installs at each milestone.

## Milestone 2 — database

- **Local Postgres in Docker for development; Neon for deploy.** No Neon credentials or `neonctl` login exist on this machine and account signup is interactive, so dev runs against `postgres:16-alpine` in a container named `lesson-pipeline-pg` (`postgresql://postgres:postgres@localhost:5432/lesson_pipeline`). The code is driver-compatible with Neon: set `DATABASE_URL` to the Neon pooled connection string and run `npx drizzle-kit migrate`.
- **`pg` + `drizzle-orm/node-postgres` instead of `@neondatabase/serverless`.** The standard driver works against both local Postgres and Neon (Neon speaks normal Postgres over TLS), which keeps dev and prod on one code path. Pool size is capped at 5 for serverless.
- **Migrations are generated and committed** (`drizzle-kit generate` + `drizzle-kit migrate`) rather than `drizzle-kit push`, so the schema history lives in `drizzle/`.
- **`timestamptz` for `createdAt` columns** (spec says `timestamp`); with-timezone is the safer default for a hosted DB.
- **Column names are snake_case in SQL, camelCase in TypeScript** (Drizzle's explicit column-name mapping).
- **`drizzle.config.ts` loads `.env.local` via dotenv** because drizzle-kit does not read Next's env files on its own.
