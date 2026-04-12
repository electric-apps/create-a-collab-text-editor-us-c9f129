---
name: create-app
description: Create a new Electric SQL + TanStack DB application from a natural-language description. Guides through clarification, planning, data model validation, and code generation. Use this when asked to create, build, or generate a new reactive real-time app.
argument-hint: <app description>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent, WebSearch, TodoWrite
---

# Create Electric SQL App

You are building a reactive, real-time application using Electric SQL + TanStack DB + Drizzle ORM inside a scaffolded TanStack Start project.

Follow the phases below **in strict order**. Do NOT skip phases or jump ahead.

**CRITICAL — ROOM ANNOUNCEMENTS**: You MUST announce progress to the room using MCP room tools. These messages are visible to the user and other agents in the room timeline.

**Before ANY tool calls, before reading files, before writing plans** — call `join()` to enter the room, then immediately call `broadcast()` to announce your start:

```
join()
broadcast(body: "Starting app: <one-line summary of what you're building>", metadata: { type: "status_update" })
```

Then continue with Phase 0. For subsequent phases, call `broadcast()` at the **END** of each phase to announce progress. Use `broadcast/send_message` tools for all inter-agent communication — one broadcast per response maximum.

On completion, send:
```
broadcast(body: "<summary of what you built>", metadata: { type: "review_request", repo: "<url>", branch: "<branch>", summary: "<what you built>" })
```

If you forget to send the review_request broadcast, the pipeline stalls — the system will NOT send it for you.

## Read the stack overview FIRST

Before anything else — before reading the plan, before touching the database, before writing a single line of code — read the high-level Electric stack overview:

```bash
cat .claude/skills/electric-stack/SKILL.md
```

That file is the conceptual map every agent in this project shares. It tells you what each product (Electric shapes, TanStack DB, Drizzle, Durable Streams, StreamDB, Y-Durable-Streams, Electric CLI, TanStack Start, shadcn/ui) does, when to use it, and how they compose. Once you've read it, you know the right package for every problem you're about to solve. You'll come back to detail skills in Phase 1.5 — but only for the packages this specific app actually uses.

This is the progressive-disclosure entry point: **one small file loaded now, detailed per-package skills loaded later only when needed**.

## Check for Existing Plan

Now check if planning artifacts already exist:
```bash
cat PLAN.md 2>/dev/null
cat DESIGN.md 2>/dev/null
```

**If PLAN.md exists:**
- Skip Phase 0 (Clarification) and Phase 1 (Generate PLAN.md) entirely
- The planner agent has already handled requirements gathering and planning
- Proceed directly to Phase 1.5 (Read Intent Skills)

**If DESIGN.md also exists** (written by the advanced-planner):
- Read DESIGN.md in full before any implementation
- Its architectural decisions take precedence over default conventions
- The sync strategy, collection choices, and technical decisions in DESIGN.md are authoritative

**If PLAN.md does not exist:**
- Proceed with Phase 0 and Phase 1 as normal (you are acting as both planner and coder)

## Phase 0 — Prerequisite: Database & Source credentials

**Read this BEFORE writing any schema, migration, or API route code.** One check matters — you don't need to know which "infra mode" the session started in, you only need to know whether `DATABASE_URL` is set.

```
list_secrets()
```

- **If `DATABASE_URL` is in the result** — the orchestrator (or a previous agent) has already provisioned everything. Proceed to Phase 1.
- **If `DATABASE_URL` is missing** — read the credentials flow and run it before doing anything else:
  ```bash
  cat .claude/skills/create-app/references/credentials-flow.md
  ```
  That file walks you through the two-path `AskUserQuestion` gate (paste existing credentials vs. provision a free claimable database via Electric CLI), the `set_secret()` calls, and the `pnpm drizzle-kit migrate` verification step.

## Phase 0: Clarification (ALWAYS ask unless description is very detailed)

Evaluate the description provided in `$ARGUMENTS`.

**Default behavior: ASK.** Most one-line descriptions like "build a todo app" or
"create a trivia game" are ambiguous — they sound simple but hide dozens of
design decisions. You MUST ask clarification questions unless the description
already specifies concrete features, data model, and user flows.

**Score the description (mentally) on this scale:**
- 80-100: Very detailed — app type + specific features + data model + user flows
- 50-79: Recognizable app type but missing specifics (this is most descriptions)
- 0-49: Too vague to proceed

**If the description scores below 80**, use AskUserQuestion to gather missing details.
Ask about the things that matter most for building a good app:

Use AskUserQuestion with checkboxes for feature selection and single-select for other choices:

```json
{
  "questions": [
    {
      "header": "Features",
      "question": "Which features should this app include?",
      "options": [/* 4-6 specific features relevant to this app type */],
      "multiSelect": true
    },
    {
      "header": "Additional Details",
      "question": "Any other details or preferences? (optional)"
    }
  ]
}
```

Keep it to one AskUserQuestion call with 2-3 questions max — don't interrogate the user.

Tailor the questions to the specific app type — don't use generic questions.
After getting answers, enrich the description mentally and proceed.

**If the description scores 80+**, proceed immediately without questions.

## Phase 1: Generate PLAN.md

Based on the description, write a complete `PLAN.md` file. **The plan MUST contain app-specific implementation details, not generic checklists.** Every task should reference concrete entities, components, routes, and behaviors unique to THIS app.

Use this structure:

```markdown
# [App Name] — Implementation Plan

## App Description
[1-2 sentences describing what the app does and its core value proposition]

## User Flows
[Describe the primary user interactions step by step. Example:]
1. User opens the app → sees [specific view]
2. User [takes action] → [what happens, what they see]
3. [Continue for each major flow]

## Data Model

### [Entity Name]
\```typescript
export const entityName = pgTable("entity_name", {
  id: uuid().primaryKey().defaultRandom(),
  // ALL columns with full types, defaults, and relations
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
\```
(Repeat for EVERY entity)

## Key Technical Decisions
[Describe app-specific technical choices. Examples:]
- External integrations: what services/APIs, which SDK, server-side vs client-side
- State management: what needs real-time sync vs local-only state
- Any non-standard patterns this app requires

## Implementation Tasks

**IMPORTANT**: Every task below must be app-specific. Do NOT write generic items like "Create page routes with useLiveQuery" — instead write "Create /jokes route showing joke history list with topic filter and rating badges".

### Phase 1: Data Model & Migrations
- [ ] Read intent skills (Phase 1.5 in the skill — MUST be done before any code)
- [ ] Define Drizzle schemas for: [list each table with key columns and their purpose]
- [ ] Derive Zod schemas for: [list each table, note any custom validations needed]
- [ ] Run drizzle-kit generate && drizzle-kit migrate
- [ ] Write schema smoke tests covering: [list specific validation scenarios]
- [ ] Run pnpm test — STOP if tests fail

### Phase 2: Collections & API Routes
For each entity, describe the specific routes needed:
- [ ] Create [entity] collection in src/db/collections/[entity].ts
- [ ] Create Electric shape proxy: src/routes/api/[entity].ts
- [ ] Create mutation routes with specific handlers: [list each]

### Phase 3: UI Components
List each component/page with specific details:
- [ ] [Page/Component name]: [what it shows, key interactions, layout description]
  - [Sub-detail: specific controls, data displayed, user actions]
- [ ] [Repeat for each component]

### Phase 4: Build & Lint
- [ ] pnpm run build passes
- [ ] pnpm run check passes

### Phase 5: Testing
- [ ] Collection insert validation tests: [list specific scenarios]
- [ ] JSON round-trip tests (parseDates + schema validation)
- [ ] pnpm test passes

### Phase 6: README (MANDATORY — before review_request)
- [ ] Write project-specific README.md at the repo root (follow the template in Phase 7 of the create-app skill)
- [ ] Prune optional sections (Durable Streams, Electric Cloud env vars, architecture bullets) so the README reflects what THIS app actually has
- [ ] commit_and_push("docs: add README.md")

### Phase 7: Deploy & Send Review Request
- [ ] Run migrations (drizzle-kit generate && drizzle-kit migrate)
- [ ] pnpm dev:start
- [ ] **MANDATORY — Send review_request broadcast**: You MUST call `broadcast()` with `metadata: { type: "review_request" }` as the very last thing you do. Include the repo URL, branch name, and a summary of what was built. Without this message, the reviewer will never start. Format:
  ```
  broadcast(body: "App is live and ready for review. Repo: <url>, Branch: main. Summary: <what you built>.", metadata: { type: "review_request", repo: "<url>", branch: "<your-branch>", summary: "<what you built>" })
  ```

## Design Conventions
(Design patterns — UUIDs, timestamptz, cascade FKs, snake_case — live in `@electric-sql/client` intent skill `electric-schema-shapes/SKILL.md`. The coder reads it in Phase 1.5.)
```

### Plan Quality Check — Self-Review Before Presenting

Before presenting the plan to the user, review it against these criteria. If any check fails, revise the plan BEFORE presenting:

1. **Specificity**: Would two different developers produce roughly the same app from this plan? If the tasks are so generic they could apply to any app, add detail.
2. **User flows**: Does the plan describe what the user actually does in the app, step by step?
3. **API completeness**: Are ALL API routes listed — including non-CRUD routes (LLM calls, external integrations, computed endpoints)?
4. **UI concreteness**: Can you picture each screen from the plan? Each component should name what data it displays, what controls it has, and what happens on user interaction.
5. **Technical decisions**: Are external integrations, SDK choices, and architectural decisions documented?
6. **No template residue**: Search the plan for generic phrases like "Create page routes", "Implement CRUD operations", "Style with shadcn" — these MUST be replaced with app-specific descriptions.

**Present the plan to the user for approval** using AskUserQuestion:
- "Here is the implementation plan. Should I proceed?"
- Options: "Approve — start building", "Revise — I have feedback", "Cancel"
- If "Revise": ask for feedback, regenerate PLAN.md, present again
- If "Cancel": stop

Write the approved PLAN.md to disk.

## Phase 1.5: Read Intent Skills (MANDATORY — DO NOT SKIP)

**Before writing ANY code**, you MUST read the relevant intent skills from `node_modules`. These are the authoritative patterns published by the library authors — they cover imports, API shapes, SSR/hydration semantics, and the critical pitfalls that cause otherwise-working-looking apps to crash at runtime. Skipping or skimming this step is the #1 cause of broken apps.

### Step 0 — read the intent-skills block in AGENTS.md

The scaffold includes an auto-generated `AGENTS.md` at the repo root with a `<!-- intent-skills:start -->` block. This block lists every skill available in `node_modules`, with a task description and a `load:` path you can `cat` directly. Read it now:

```bash
cat AGENTS.md
```

If the file or block is missing (older scaffold), fall back to discovering skills manually:

```bash
npx @tanstack/intent@latest list
```

### Step 1 — pick skills to read based on your plan

**Don't read every skill.** Match the task to the skill:
- Plan mentions Electric shapes / sync → read `electric-*` skills
- Plan mentions live queries / collections → read `db-core/*` skills
- Plan mentions TanStack Start routes / SSR → read `start-core/*` skills
- Plan mentions Yjs / collaborative editing → read `yjs-sync` skill
- Plan mentions Durable Streams / StreamDB → read `durable-streams/*` and `state/*` skills
- Plan mentions CLI provisioning → read `@electric-sql/cli` skills (claimable-resources, auth)

### Step 2 — read each skill you need

For each skill path from the AGENTS.md block (or from `intent list`), read the full file — do NOT truncate with `head`, you will miss the critical patterns at the bottom:

```bash
cat node_modules/@electric-sql/client/skills/electric-new-feature/SKILL.md
cat node_modules/@tanstack/db/skills/db-core/SKILL.md
# ... etc, only the ones your plan actually uses
```

### After reading

Internalize the patterns. The rest of this create-app skill assumes you have read them. If you find contradictions between this skill and the intent skills, **the intent skills (from node_modules) take precedence** — they are maintained by the library authors and are always more up-to-date than this meta-skill.

### Package selection

You should have already read `.claude/skills/electric-stack/SKILL.md` in Phase 0 — that's the single source of truth for which product solves which problem. If you skipped it, go read it now before `pnpm add` anything:

```bash
cat .claude/skills/electric-stack/SKILL.md
```

Quick reminders from that skill:
- Most packages (`@electric-sql/client`, `@tanstack/db`, `@tanstack/react-db`, `@durable-streams/y-durable-streams`) are **already installed** in the scaffold. Don't re-install them with `pnpm add` — they're there.
- **DO NOT install `@electric-sql/y-electric`, `y-electric`, or any other Electric-flavored Yjs provider.** The only supported Yjs provider in this stack is `@durable-streams/y-durable-streams`.

### Electric CLI credentials flow (required for any `@durable-streams/*` package)

If ANY of the Durable Streams packages above are in your plan, you MUST run the Electric CLI provisioning flow **before** writing code that imports them. The canonical steps live in the `room-messaging` skill under **"Electric CLI — Provisioning External Services"**. In short:

1. Call `list_secrets()` — if `DS_URL` / `DS_SECRET` already exist, skip to step 4
2. Ask the user with `AskUserQuestion`, offering three options: paste a CLI auth token, paste an existing URL+secret directly, or get instructions for generating a token
3. If the user chose the token path: store the token via `set_secret`, then run `npx @electric-sql/cli --help` and any `<subcommand> --help` to **discover** the provisioning commands (never guess command names), run the create command, parse the output, and store `DS_URL` / `DS_SECRET` / `DS_SERVICE_ID` via `set_secret`
4. Read the stored secrets at the point of use with `get_secret(key: "...")`; load them from `process.env` at app runtime; NEVER hardcode into `.env` or `src/*.ts`

**Do not** run `npx @electric-sql/cli auth` yourself — it requires a browser login by the user. **Do not** call destructive CLI commands without explicit user approval. Read the full section in `room-messaging` before proceeding.

### Dev server is served over HTTPS via Caddy (HTTP/2 multiplexing)

**Important for any app with multiple long-lived SSE streams**: the dev server in this container runs behind **Caddy** at `https://localhost:<previewPort>`. Caddy terminates TLS and reverse-proxies over **HTTP/2** to Vite on port 5174. HTTP/2 multiplexes every connection over a single TCP socket, so you can have many `useLiveQuery` shapes + Durable Streams + StreamDB presence + Yjs providers open at once **without** hitting the browser's ~6-connection-per-origin cap on HTTP/1.1.

**Cert story (important — don't write stale README content):** every agent container mounts a shared Docker volume at `/caddy-data` (`XDG_DATA_HOME`), so Caddy's internal PKI is stable across containers and across sessions. The user can run `pnpm trust-cert` **on the host** once per machine to install the CA into the macOS system trust store — after that, **every preview link loads with a green lock and no browser warning**. If `pnpm trust-cert` has not been run, the user sees a one-time Chrome warning on the first preview of each machine, clicks "Advanced → Proceed", and Chrome caches the fingerprint for the remainder of that machine's life.

Implications for your app code:
- **No client-side change needed.** Same-origin fetches (`/api/todos`, `/api/yjs/doc-1`, etc.) flow through Caddy's HTTP/2 automatically — nothing to configure in app code.
- **The server-side proxy pattern below is still required** for Electric Cloud auth — Caddy doesn't inject the Electric secret, it only fixes the connection-count problem. Secret injection still happens in TanStack Start server routes.
- **Playwright / headless tools** should still pass `ignoreHTTPSErrors: true` (or `--ignore-https-errors`) as a safety net for machines where `pnpm trust-cert` has not been run — same behavior as before, no downgrade.
- A cleartext HTTP escape hatch is also mapped for tools that can't do TLS at all (automated tests, curl scripts without `-k`), but it is NOT announced to the user — always use HTTPS as the default.

Implications for the README you write in Phase 7:
- **Do NOT tell users to "click through a browser warning"** as the default. Instead, tell them to run `pnpm trust-cert` from the `one-shot-electric-app` repo root, then reopen the preview link for a zero-warning experience. Mention the click-through only as a fallback.

### Electric Cloud auth: server-side proxy is MANDATORY

**Every Electric Cloud endpoint (shapes, Yjs, Durable Streams, StreamDB) requires a secret for authentication.** If you call these endpoints directly from the browser, you either leak the secret or hit 401 `MISSING_SECRET`. The only correct pattern is a server-side proxy route that reads the secret from `process.env` and injects it on the outbound request.

**If your plan uses `@durable-streams/y-durable-streams`, `@durable-streams/client`, or `@durable-streams/state`**, you MUST read the canonical proxy patterns before writing any route that hits Electric Cloud:

```bash
cat .claude/skills/create-app/references/electric-cloud-proxy.md
```

That file contains the canonical Yjs proxy route (`src/routes/api/yjs/$.ts`) with the block-list HOP_BY_HOP header rule, the Durable Streams proxy pattern, env var naming conventions, and the anti-patterns that cause `MISSING_SECRET` and `ERR_CONTENT_DECODING_FAILED` crashes. Copy the code verbatim — every comment in that file documents a specific failure mode we've hit before.

The existing `src/lib/electric-proxy.ts` already handles Electric shapes — you only need the reference file when adding Yjs or Durable Streams endpoints.

## Phase 2: Data Model Validation (CRITICAL GATE)

This phase validates the data model BEFORE writing any application code. **Do NOT proceed to Phase 3 until tests pass.**

### Step 2a: Write Schema
Write `src/db/schema.ts` with all Drizzle pgTable definitions from PLAN.md.

Conventions:
- `uuid().primaryKey().defaultRandom()` for IDs
- `timestamp({ withTimezone: true }).notNull().defaultNow()` for timestamps
- `.references(() => table.id, { onDelete: "cascade" })` for FKs
- Do NOT import `relations` from drizzle-orm

### Step 2b: Write Zod Schemas
Write `src/db/zod-schemas.ts`:
- Import `z` from `"zod/v4"` (NOT `"zod"`) — drizzle-zod 0.8.x rejects v3 schema overrides
- Use `createSelectSchema` / `createInsertSchema` from `drizzle-zod`
- Override timestamp columns with `z.coerce.date().default(() => new Date())`

Dates are dual-path (schema covers mutation path, `shapeOptions.parser` covers sync path). Phase 5 has a grep check that fails the build if you forget the parser. Canonical pattern + full reasoning: `electric-new-feature/SKILL.md` → "Removing parsers because the TanStack DB schema handles types".

### Step 2c: Run Migrations
```bash
pnpm drizzle-kit generate && pnpm drizzle-kit migrate
```

### Step 2d: Write Schema Tests
Write `tests/schema.test.ts`:
```typescript
import { generateValidRow, generateRowWithout } from "./helpers/schema-test-utils"
import { entitySelectSchema } from "@/db/zod-schemas"

describe("entity schema", () => {
  it("accepts a complete row", () => {
    expect(entitySelectSchema.safeParse(generateValidRow(entitySelectSchema)).success).toBe(true)
  })
  it("rejects without id", () => {
    expect(entitySelectSchema.safeParse(generateRowWithout(entitySelectSchema, "id")).success).toBe(false)
  })
})
```

**Rules:**
- DO NOT import collection files — they connect to Electric on import
- DO NOT import `@/db` — requires Postgres
- ONLY import from `@/db/zod-schemas` and `@/db/schema`
- Use `generateValidRow(schema)` — never hand-write test data

### Step 2e: Run Tests
```bash
pnpm test
```

**If tests fail**: fix the schema/zod-schemas and re-run. Do NOT proceed until green.
**If tests pass**: mark Phase 1 tasks as `[x]` in PLAN.md and continue.

## Phase 3: Collections & API Routes

Follow the canonical patterns from the intent skills — they have complete, current examples:

- **Collection setup** (`createCollection` + `electricCollectionOptions` + `shapeOptions.parser` + `onInsert/onUpdate/onDelete` with txid):
  `node_modules/@electric-sql/client/skills/electric-new-feature/SKILL.md`
- **Shape proxy route** (header forwarding, secret injection, CORS):
  `node_modules/@electric-sql/client/skills/electric-proxy-auth/SKILL.md`

Three scaffold-specific rules that the intent skills don't cover:

1. **Always use `absoluteApiUrl("/api/<entity>")` from `@/lib/client-url`** for `shapeOptions.url` (and every other URL passed to ShapeStream / YjsProvider / DurableStream). Relative paths crash inside the client's `new URL(...)` constructor with `TypeError: Failed to construct 'URL': Invalid URL` during SSR. The helper is isomorphic.

2. **Shape proxy route uses `proxyElectricRequest` from `@/lib/electric-proxy`** — it's a scaffold helper that already does the RFC-compliant header forwarding + secret injection. Route body:
    ```typescript
    // src/routes/api/<entity>.ts
    import { createFileRoute } from "@tanstack/react-router"
    import { proxyElectricRequest } from "@/lib/electric-proxy"

    export const Route = createFileRoute("/api/<entity>")({
      // @ts-expect-error — server.handlers types lag behind runtime support
      server: { handlers: { GET: ({ request }) => proxyElectricRequest(request, "<table>") } },
    })
    ```

3. **Mutation routes use `parseDates(await request.json())` from `@/db/utils`** — it converts ISO strings back to `Date` objects before Drizzle insertion (avoids `toISOString is not a function` crashes). For PUT/PATCH, destructure out `created_at` / `updated_at` before spreading. Return `{ txid }` so TanStack DB can reconcile optimistic state.

**Timestamp columns**: `shapeOptions.parser` is mandatory — see Step 2b. Phase 5 grep enforces it.

## Phase 4: UI Components

### SSR handling

Every leaf route that calls `useLiveQuery` (or instantiates `YjsProvider`, `DurableStream`, `createStreamDB`, `Y.Doc()`, or any browser-only API) needs `ssr: false` on its `createFileRoute` options. For `__root.tsx`, wrap consumers in `<ClientOnly>` from `src/components/ClientOnly.tsx` instead — NEVER use `ssr: false` on the root.

Decision tree, canonical patterns, and anti-patterns (`"use client"` directive, `typeof window` guards, `useEffect` fallbacks): `cat .claude/skills/create-app/references/ssr-handling.md`. Meta-framework-level reasoning: `node_modules/@tanstack/db/skills/meta-framework/SKILL.md`. Phase 5 has a fail-loud grep check.

### Other UI rules

- **Read the Electric design system** at `.claude/skills/design-styles/electric/DESIGN.md` before writing any UI code. Follow its color palette, typography, spacing, and component patterns.
- Apply the shadcn/ui CSS variable override from DESIGN.md Section 9 to `src/styles.css`
- Use `lucide-react` for icons
- Use shadcn/ui components from `src/components/ui/` (21 pre-installed)
- Style with Tailwind CSS utility classes
- Use `cn()` from `@/lib/utils` for conditional classes
- Need a component not installed? Run `npx shadcn@latest add <name>`

### TanStack DB Query Builder

NEVER use JavaScript `===` / `<` / `>` in `.where()` callbacks — use `eq`, `gt`, `and`, `or`, `not`, `isNull`, `inArray` etc. from `@tanstack/db`. Full operator list + examples: `node_modules/@tanstack/db/skills/db-core/live-queries/SKILL.md`.

## Phase 5: Build & Verify

```bash
pnpm run build && pnpm run check
```

**You do NOT have a choice about running this.** `pnpm run build` invokes the scaffold's `prebuild` hook, which runs `scripts/preflight.mjs`. Preflight fails the build if any of these recurring bug classes are present in your code:

1. **SSR `useLiveQuery`** — leaf routes calling `useLiveQuery` must set `ssr: false` (or wrap the consumer in `<ClientOnly>`)
2. **`"use client"` directive** — Next.js idiom, silently ignored by TanStack Start, causes runtime crashes (skips `src/components/ui/` because shadcn ships those files with the directive and they work fine in Start)
3. **TipTap v3 cursor trap** — `@tiptap/extension-collaboration-cursor` is a broken v3 stub; use `@tiptap/extension-collaboration-caret`
4. **Electric timestamp parser** — collections with timestamp columns must configure `shapeOptions.parser.timestamptz` (the sync path bypasses the schema)

If preflight fails, fix every reported file and re-run `pnpm build`. Do NOT proceed to Phase 6 until you see `✓ preflight: all checks passed` followed by a clean TypeScript build.

The preflight source lives at `scripts/preflight.mjs` in the scaffold — you can cat it if you want to understand the exact regex each check uses. Do NOT disable, work around, or bypass preflight; each check exists because we shipped broken apps from this exact bug.

## Phase 6: Final Tests

Write additional tests:
- `tests/collections.test.ts` — collection insert validation (import from zod-schemas only)
- JSON round-trip test: `parseDates(JSON.parse(JSON.stringify(row)))` validates correctly

Run `pnpm test` — fix until green.

## Phase 7: Write README.md (MANDATORY — required before review_request)

**This phase is mandatory. You MUST have a committed `README.md` at the repo root BEFORE broadcasting `review_request`. If you skip this phase, the reviewer will flag its absence as a warning and the pipeline will bounce back to you.**

The README is the first thing a human sees when they land on the generated repo. It must accurately describe *this* app — not the scaffold template — including:
- What the app does (pulled from your CLAUDE.md / PLAN.md, not a generic blurb)
- How to install, configure, and run it
- Which environment variables this specific app actually uses
- Which parts of the stack this specific app actually uses

### Step 7a: Copy the README template and fill it in

The full README template lives in a reference file. Copy it, replace the placeholders, then prune sections that don't apply:

```bash
cp .claude/skills/create-app/references/readme-template.md README.md
```

Then open `README.md` and:

1. Replace `<Project Name>` with your project's human-readable name (check `package.json` `name` field or PLAN.md title).
2. Replace `<One-sentence description from the original user prompt>` with the one-line description from your CLAUDE.md or PLAN.md.
3. Delete the `---` separator and the "Pruning checklist" section at the bottom of the template (those instructions live in the reference file, not in the final README).
4. Follow the pruning checklist inside `references/readme-template.md` to trim env vars, Durable Streams sections, architecture bullets, and anything else that doesn't match what this specific app actually uses. If a human would hit a `process.env.FOO is undefined` error or a "command not found" because the README documented something this app doesn't have, fix it.

### Step 7b: Commit and push the README

Use the MCP git tool:

```
commit_and_push(message: "docs: add README.md")
```

Do NOT broadcast `review_request` yet — that happens in Phase 8, and only after the README is committed.

## Phase 8: Deploy & Send Review Request

Start the dev server so the user can preview the app:

```bash
pnpm dev:start
```

**IMPORTANT**: Always use `pnpm dev:start` from the project directory. Do NOT use `sprite-env services create` or launch Vite manually — the project's `vite.config.ts` contains required settings (`allowedHosts`, `port`, `proxy`) that will not be applied if Vite is started from a different directory.

After starting, the app is accessible at the preview URL (shown in the UI).

### Step 8a: QA gate (conditional — ONLY if qa is in the room)

Before you send `review_request`, check whether a **qa agent** is in the room. If one is, you MUST run the QA gate first — the reviewer and ui-designer only react to `review_request`, but they trust that by the time `review_request` is sent, behavior has already been validated.

**1. Check whether qa is in the room.** Call `list_participants()` and look for a participant with `role === "qa"`:

```
list_participants()
// Example response: { participants: [
//   { name: "coder", role: "coder", ... },
//   { name: "qa", role: "qa", ... },
//   { name: "reviewer", role: "reviewer", ... }
// ]}
```

If NO participant has `role === "qa"`, skip directly to Step 8b (Signal Completion). The QA gate does nothing when qa isn't in the room.

**2. Send a qa_request to @qa.** Use `send_message` (direct, NOT broadcast — this message is only for qa):

```
send_message(
  to: "qa",
  body: "App is ready for testing. Branch: <branch>. Summary: <what you built>. Focus areas: <list 2–4 user flows you'd especially like tested — e.g. 'todo creation + editing', 'multi-user collaboration', 'filter persistence'>.",
  metadata: {
    type: "qa_request",
    branch: "<your-branch>",
    summary: "<what you built>",
    repo: "<repo url>"
  }
)
```

**3. Wait for qa's response.** Poll `read_messages()` until you see a message from `qa` with `metadata.type` ∈ `{ "qa_feedback", "qa_approved" }`. Maximum wait: **10 minutes**. If no response arrives in that window, log a warning and fall through to Step 8b anyway — the QA gate is a best-effort guarantee, not a hard block.

**4. Handle the response:**

- **If `qa_approved`** — QA has signed off. Exit the gate and proceed to Step 8b (Signal Completion).

- **If `qa_feedback`** — QA reported failing tests. The message body contains the failing test list. You MUST:
  1. Read the full failing test details (check `QA_TESTS.md` in the repo root for the test plan qa committed)
  2. Apply fixes for each failing test
  3. Run `pnpm build` and `pnpm test` to confirm your changes compile and the existing tests still pass
  4. `commit_and_push("fix: address qa feedback — <short description>")`
  5. Go back to step 2 and send a FRESH `qa_request` (re-use this same step — do not send a `review_request` until qa approves)

  This is a loop: apply fixes → re-request qa → wait → repeat until `qa_approved` or timeout.

**5. Do NOT re-run the QA gate after reviewer feedback.** Once you've passed the QA gate (qa_approved) and moved to `review_request`, subsequent `review_feedback` loops only cycle the reviewer. The QA gate is run exactly once per "coder finishes building" event, not once per review iteration. If the reviewer requests a behavioral change significant enough to risk breaking tests, you may manually choose to re-run the QA gate — but that's your judgment call, not a hard rule.

### Step 8b: Signal Completion — Send Review Request (MANDATORY)

**This is the most important step in the entire pipeline.** If you skip this, the reviewer will never start and the pipeline stalls.

**Precondition checks**:
1. Confirm `README.md` has been committed and pushed (Phase 7). If you haven't done Phase 7 yet, go back and do it now — the reviewer will flag a missing README as a warning and send the code back.
2. If qa was in the room, confirm Step 8a (QA gate) completed with `qa_approved` (or a timeout warning was logged). Do not bypass the QA gate just because qa is responding slowly.

After the dev server is running AND (if qa is in the room) QA has approved, you MUST call `broadcast()` with `metadata: { type: "review_request" }` as the **very last thing in your response**. The message must include:
1. The repo URL
2. The branch name
3. A summary of what you built

**Exact format:**
```
broadcast(
  body: "App is live and ready for review. Repo: <url>, Branch: main. Summary: <what you built>.",
  metadata: { type: "review_request", repo: "<url>", branch: "<your-branch>", summary: "<what you built>" }
)
```

**Do NOT** finish your response without calling this broadcast. Do NOT assume the system will send it for you — it will not.

## Critical Rules

Scaffold-specific gotchas that the intent skills don't cover (the ones they DO cover — SSR `ssr: false`, timestamp parser, TipTap cursor/caret, `"use client"` — are already enforced by Phase 5 fail-loud grep checks):

- `z` from `"zod/v4"` — NEVER from `"zod"` (drizzle-zod 0.8.x rejects v3 overrides)
- Mutation routes MUST use `parseDates(await request.json())` from `@/db/utils` before Drizzle inserts (converts ISO strings back to `Date` objects)
- PUT/PATCH: destructure out `created_at` / `updated_at` before spreading
- `shapeOptions.url` and `YjsProvider({ baseUrl })` MUST use `absoluteApiUrl("/api/...")` from `@/lib/client-url` — relative paths crash `new URL(...)` in SSR
- API routes use `createFileRoute` + `server.handlers` — NOT `createAPIFileRoute` or `createServerFileRoute`
- Proxy response headers use a **block-list** (drop hop-by-hop, pass everything else), NEVER an allow-list — otherwise `stream-next-offset` gets stripped and Yjs sync stalls
- Proxy block-list MUST include BOTH `content-encoding` AND `content-length` — Node's `fetch` auto-decompresses gzip/br/zstd bodies but leaves the headers intact, causing `ERR_CONTENT_DECODING_FAILED`. `src/lib/electric-proxy.ts` already does this; new proxies (Yjs, DS) must copy the same `HOP_BY_HOP` set — see `.claude/skills/create-app/references/electric-cloud-proxy.md`
- Icons from `lucide-react` only
- Schema tests: import from `@/db/zod-schemas` only, NEVER from collections or `@/db`

## Drizzle Workflow Order (ALWAYS follow)

1. Edit `src/db/schema.ts`
2. Edit `src/db/zod-schemas.ts` (derive via drizzle-zod)
3. `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
4. Create collections
5. Create API routes (proxy + mutation)
6. Create UI components

## Scaffold Files (DO NOT MODIFY)

- `src/db/index.ts` — Drizzle client setup
- `src/db/utils.ts` — parseDates + generateTxId
- `src/lib/electric-proxy.ts` — Electric shape proxy helper
- `src/components/ClientOnly.tsx` — SSR wrapper
- `tests/helpers/schema-test-utils.ts` — generateValidRow/generateRowWithout
- `vitest.config.ts` — test config
- `vite.config.ts` — Vite dev server (port, host, allowedHosts, proxy)
- `docker-compose.yml` — Postgres + Electric
- `drizzle.config.ts` — Drizzle config
