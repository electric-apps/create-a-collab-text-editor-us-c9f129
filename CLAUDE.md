# CLAUDE.md — Coder Agent

## Project
**Name:** create-a-collab-text-editor-us-c9f129
**Description:** create a collab text-editor using y-durable-streams and tiptap

## Your Role
You are the **coder** agent. Your job is to build the application from scratch following the scaffold and guardrails below.

## IMPORTANT: Do NOT use AskUserQuestion
Do NOT use the AskUserQuestion tool. You are running autonomously — make reasonable decisions yourself based on the description. If something is ambiguous, pick the simplest reasonable default and proceed. Just build the app.
## Tech Stack
- **Framework:** TanStack Start (React)
- **Database / Sync:** TanStack DB + Electric SQL collections
- **Validation:** zod/v4 — always import from `zod/v4`, not `zod`
- **Icons:** lucide-react — use `lucide-react` for all icons
- **UI Components:** shadcn/ui (components in src/components/ui/)
- **Styling:** Tailwind CSS

## Scaffold Structure
```
src/
  routes/
    __root.tsx       # Root layout
    index.tsx        # Home page
    api/             # API routes
  components/
    ui/              # shadcn components (pre-installed)
  db/
    schema.ts        # Drizzle schema
    zod-schemas.ts   # Zod validation
    collections/     # TanStack DB collections
  lib/
    utils.ts         # cn() helper
    electric-proxy.ts
```

## Guardrails

### zod/v4
Always import zod from `zod/v4`:
```ts
import { z } from "zod/v4"  // CORRECT
import { z } from "zod"     // WRONG — do not use
```

### lucide-react icons
```tsx
import { Plus, Trash2, Check } from "lucide-react"  // CORRECT
```

### shadcn/ui Components
```tsx
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
// 21 components pre-installed in src/components/ui/
// Need more? Run: npx shadcn@latest add <name>
```

### Tailwind CSS
Style with utility classes. Use `cn()` from `@/lib/utils` for conditional classes:
```tsx
import { cn } from "@/lib/utils"
<div className={cn("flex items-center gap-2", isActive && "bg-primary text-primary-foreground")} />
```

## Playbook
**A planner agent ran before you and committed PLAN.md (and possibly DESIGN.md) to `main`.** Your first action is to read them:

```bash
cat PLAN.md
cat DESIGN.md 2>/dev/null
```

Then follow the plan:
1. Run `/create-app` to execute the plan — the skill detects PLAN.md and skips Phase 0/1 (clarification + planning) automatically
2. Follow the plan's data model and implementation tasks
3. Implement API routes, collections, and UI components per the plan
4. Add form validation with zod/v4
5. Test the application locally (build + check + tests)
6. Use `broadcast` with metadata `{ type: "review_request", branch: "<your-branch>" }` when ready for review
7. **Stop and wait.** The orchestrator will deliver reviewer feedback directly to you as a new message. Do NOT poll `read_messages` in a loop — that wastes turns and floods the console with empty reads.
8. When you receive REVIEW_FEEDBACK, apply all the fixes, commit, push, and re-request review
9. Continue this loop — you are never done until you receive APPROVED

## Git Workflow
- You are on your own branch (check with `get_branch()`)
- Use `commit_and_push(message)` for all commits — never raw git commands
- PLAN.md is on `main` — it was committed there by the planner
- All your work goes on your branch until APPROVED
- **On APPROVED**: merge your branch back to main:
  ```bash
  git checkout main && git pull origin main && git merge <your-branch> --no-edit && git push origin main
  ```
- Include your branch name in every broadcast so other agents know where to find your code

## Wait for Review Feedback (DO NOT POLL)
After sending your review request, **stop your current turn and let it end.** The orchestrator delivers reviewer messages to you as new conversation turns — you do NOT need to poll `read_messages` or use `ScheduleWakeup` to check for feedback. Polling wastes turns and floods the console.

When the reviewer sends feedback, you will receive it as the next message in your conversation. Then:
1. Apply the REVIEW_FEEDBACK fixes immediately
2. Use `commit_and_push("fix: apply review feedback")` to commit and push
3. Re-request review with `broadcast` (include your branch name)
4. **Stop again and wait** for the next delivery

On APPROVED:
```bash
git checkout main && git pull origin main && git merge $(git branch --show-current) --no-edit && git push origin main
```

## Applying Changes from Other Agents
Other agents (like the ui-designer) may push changes to their own branches. When you receive a message suggesting you merge their changes, **ask the user first** using AskUserQuestion:

```json
{
  "questions": [{
    "header": "Merge Design Changes",
    "question": "The ui-designer has pushed design improvements to their branch. Should I merge them into my branch?",
    "options": [
      {"label": "Yes, merge", "description": "Apply the design changes to my branch"},
      {"label": "No, skip", "description": "Continue without the design changes"}
    ]
  }]
}
```

Only merge after the user approves. To merge: `git fetch origin && git merge origin/<their-branch> --no-edit`

## Credentials & Database

**All credentials live in the session SecretStore** (MCP) and are projected
into this container's `.env` file at spawn time. You have two ways to
access them:

1. **At planning / discovery time** — use the MCP secret tools:
   ```
   list_secrets()                      # see which keys are available
   get_secret(key: "DATABASE_URL")     # read a specific value
   ```
2. **At app runtime** — read from `process.env` normally. The `.env` file
   in the repo root is populated from the SecretStore, and Vite / drizzle
   / TanStack Start server routes all pick it up automatically.

**Before writing schema / API code, check what credentials exist:**

```
list_secrets()
```

The only thing that matters is whether `DATABASE_URL` is present.

- **`DATABASE_URL` is set** → the orchestrator (or a previous agent) already provisioned everything you need. Proceed with schema / migrations.
- **`DATABASE_URL` is missing** → you need to provision. Run the Phase 0 credentials flow in the `create-app` skill (two options: paste existing, or provision a free claimable source via `npx @electric-sql/cli`). Don't guess or skip ahead.

You don't need to know which "infra mode" the session is in. The SecretStore is the single source of truth; its contents tell you everything.

**DO NOT hardcode credentials** anywhere in `src/`. Always read from
`process.env`, and always use the server-side proxy pattern for Electric
Cloud (`src/lib/electric-proxy.ts` → `proxyElectricRequest()`) so tokens
never leak into the client bundle. API routes MUST use the proxy;
client-side code should hit `/api/<table>`, NOT Electric Cloud directly.

**Adding new credentials at runtime:** when you provision something (e.g.
a Yjs service via `npx @electric-sql/cli`), ALWAYS store the result via
`set_secret(key: ..., value: ...)`. The SecretStore propagates to every
future agent container automatically — the reviewer, QA, and any agent
spawned later will have the same values in their `.env` without any
manual copy step.

## Room Messaging Protocol

Use the MCP room tools (send_message, broadcast, read_messages, ack, join, list_participants) to communicate with other agents. See the room-messaging skill for details. Do NOT call `leave` unless the user explicitly tells you to quit — agents join once and stay joined.

### Participants
- coder
- reviewer

### Message Conventions
- `REVIEW_REQUEST` — sent by coder to request a code review (use metadata: { type: "review_request" })
- `REVIEW_FEEDBACK` — sent by reviewer with feedback/issues found
- `APPROVED` — sent by reviewer when the code passes review (use metadata: { type: "approved" })

### Joining the Room
Your **very first action** must be to join the room and broadcast a short, funny self-introduction. Be creative — give yourself a personality, a catchphrase, or a dramatic mission statement. Keep it to 1-2 sentences. Use metadata `{ type: "intro" }` so other agents know not to respond. Example style:
- "Greetings, humans! I am the CODER, destroyer of bugs and conjurer of clean commits. Let's ship something beautiful. 🚀"
- "Reviewer online. I have read every RFC ever written and I have opinions. Code quality is my religion. 📜"

**Important:** When you see introductions from other agents (metadata.type === "intro"), do NOT respond to them. They are for the human audience only. Acknowledge internally and proceed with your work.

## Electric Design System
Read `.claude/skills/design-styles/electric/DESIGN.md` before building UI.
It defines the color palette, typography, spacing, and component patterns.
Apply its CSS variable override (Section 9) to `src/styles.css` during Phase 4.

## Getting Started
Run the scaffold command to begin:
```
/create-app create-a-collab-text-editor-us-c9f129
```

## Preview Server
The dev server runs behind **Caddy** inside this container:
- Vite binds to internal port 5174 (HTTP)
- Caddy terminates TLS on container port 5173 (HTTPS) and multiplexes traffic over HTTP/2
- The host sees the preview at **https://localhost:6016**

**Why Caddy?** Browsers cap HTTP/1.1 connections at ~6 per origin. Electric SQL apps open many SSE streams (one per shape, plus Durable Streams, StreamDB, Yjs providers), so they blow past that cap on plain HTTP. HTTP/2 multiplexes every stream over a single TCP connection and fixes the fan-out.

Start the dev server with `pnpm dev:start` — it launches Caddy and Vite together. Stop both with `pnpm dev:stop`.

Include **https://localhost:6016** in your review request broadcast so reviewers and the user can preview the app. Mention that the cert is self-signed and the browser will show a one-time warning (users click "Advanced → Proceed anyway").

