# DECISIONS.md

Routine decisions made while building, per SPEC.md §0. Newest at the bottom.

## Milestone 1 — scaffold

- **Repo root is the working directory, not a subfolder.** `create-next-app` refuses the directory name "Adal Marisol" (npm naming rules), so the app was scaffolded into a temp subfolder and moved up. The package name is `lesson-pipeline`.
- **Next.js pinned to the 15.x line** (`create-next-app@15`, resolved to 15.5.27) because the spec says Next 15 exactly. Tailwind v4 came with the scaffold.
- **Turbopack left on for `next dev`** (scaffold default). `next build` also uses `--turbopack` by default in this scaffold; if Vercel's build has trouble with it, drop the flag.
- **OpenAI is the AI provider.** No `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` was in the environment, but an `OPENAI_API_KEY` already existed in two sibling projects on this machine (`agent-openai-12-25/.env`, `agent 12-18-25/.env`). It was copied into `.env.local` here. It is never printed and `.env*` is gitignored.
- **Single `npm install` for the whole stack up front** (drizzle, pg, tRPC v11, react-query v5, zod, ai, @ai-sdk/openai, superjson, react-markdown, remark-gfm; dev: drizzle-kit, @types/pg, tsx, dotenv) to avoid repeated installs at each milestone.
