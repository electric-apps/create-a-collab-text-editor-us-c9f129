# PLAN.md — Collaborative Text Editor

## App Description

A real-time collaborative rich-text editor where multiple users can edit the same document simultaneously. Documents are listed and managed via Electric SQL sync; document content is synced using Yjs CRDT over Durable Streams (via `@durable-streams/y-durable-streams`), and live cursors/presence are handled by Yjs Awareness.

---

## User Flows

### 1. Landing Page — Document List
- User visits `/` and sees a list of all documents (title, last-updated timestamp, author name).
- User clicks **New Document** → a new document row is created in Postgres → user is redirected to `/doc/$id`.
- User clicks an existing document → navigated to `/doc/$id`.

### 2. Document Editor — `/doc/$id`
- Page loads the document metadata (title) from Electric shape.
- TipTap editor initializes with a Yjs document backed by `@durable-streams/y-durable-streams`.
- The editor is collaborative: all connected users see each other's changes in real time with automatic conflict resolution.
- Colored remote cursors and user names are shown inline via Yjs Awareness.
- User can edit the document title inline (saved to Postgres via a mutation route).
- A sidebar or header shows **who's currently in the document** (names + cursor colors), derived from Yjs Awareness.
- A back button returns the user to the document list.

### 3. User Identity (lightweight)
- On first visit, user is assigned a random display name (e.g. "Penguin #42") and a random cursor color, stored in `localStorage`.
- No authentication required.

---

## Data Model

```ts
// src/db/schema.ts

import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("Untitled"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

> Note: Document *content* is NOT stored in Postgres — it lives in the Yjs CRDT document managed by `@durable-streams/y-durable-streams`. Only metadata (title, timestamps) is in Postgres.

---

## Key Technical Decisions

| Problem | Product | Package |
|---|---|---|
| Document metadata list, live-synced | Electric SQL shapes + TanStack DB | `@electric-sql/client` + `@tanstack/db` + `@tanstack/react-db` |
| Concurrent rich-text editing with CRDT | Y-Durable-Streams | `@durable-streams/y-durable-streams` |
| Presence (cursors, who's online) | Yjs Awareness (bundled with the Yjs provider) | `@durable-streams/y-durable-streams` |
| Schema + migrations | Drizzle ORM | `drizzle-orm` + `drizzle-kit` |
| Rich-text editor UI | TipTap | `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-collaboration` + `@tiptap/extension-collaboration-cursor` |
| Full-stack React framework | TanStack Start | `@tanstack/react-start` |
| UI components | shadcn/ui + Tailwind CSS | `@/components/ui/*` |

**Why not StreamDB for presence?** The Yjs Awareness protocol (built into the Yjs provider) already handles ephemeral presence (cursors, selections, user names). StreamDB would be redundant — Yjs Awareness is the correct tool for this pattern.

**Why not Electric shapes for document content?** Collaborative text editing requires CRDT-based conflict resolution; Postgres + Electric shapes is a last-write-wins model unsuitable for concurrent text. Yjs over Durable Streams is purpose-built for this.

> **Credential note:** Before the first stream operation, the coder must follow the Electric CLI flow in the `room-messaging` skill and store the resulting Yjs service URL + secret via `set_secret`.

---

## Implementation Tasks

### Phase 1: Project Setup & Schema

- [ ] Run `drizzle-kit generate` and `drizzle-kit migrate` to create the `documents` table from the schema above.
- [ ] Confirm Electric SQL shape proxy is set up for the `documents` table (the scaffold may already have a proxy template in `src/lib/electric-proxy.ts`).
- [ ] Provision a Yjs service via the Electric CLI flow (see `room-messaging` skill — "Electric CLI — Provisioning External Services"); store the service URL and secret via `set_secret`.
- [ ] Add a server-side Yjs proxy route (e.g. `src/routes/api/yjs-proxy.ts`) that forwards requests to the Durable Streams Yjs service, injecting the `Authorization: Bearer <secret>` header. Follow the canonical proxy pattern from `skills/create-app/SKILL.md` "Pattern: Yjs service proxy" — pay attention to the `stream-next-offset` header forwarding rule and `content-encoding` stripping.

### Phase 2: Document List Page (`/`)

- [ ] Create the `documents` TanStack DB collection pointing at the Electric shape proxy for the `documents` table. Include a `parser` for `timestamptz` columns (`created_at`, `updated_at`).
- [ ] Build the document list route `src/routes/index.tsx` with `ssr: false` (it uses live queries).
- [ ] Display documents sorted by `updated_at` descending; show title and a relative timestamp ("2 minutes ago").
- [ ] **New Document** button: calls a server function that inserts a row into `documents` and returns the new `id`, then navigates to `/doc/$id`.
- [ ] Each document row is a clickable link to `/doc/$id`.
- [ ] Empty state: "No documents yet. Create your first one."

### Phase 3: Document Editor Page (`/doc/$id`)

- [ ] Create route `src/routes/doc.$id.tsx` with `ssr: false`.
- [ ] Load document metadata (title) from the `documents` TanStack DB collection, filtered by `id`.
- [ ] Read or generate the user's display name and cursor color from `localStorage` on mount. Use a `useMemo` seeded from the doc id + a random suffix so names are stable per session.
- [ ] Set up a Yjs document and wire it to the Durable Streams Yjs service using `@durable-streams/y-durable-streams`. The `docId` for the stream should be the document's UUID. The coder must read `node_modules/@durable-streams/y-durable-streams/skills/yjs-sync/SKILL.md` for the exact provider API.
- [ ] Configure Yjs Awareness with the user's display name and cursor color so remote users see live cursors.
- [ ] Initialize a TipTap editor with:
  - `StarterKit` (with its built-in History disabled, because Yjs manages undo/redo)
  - `Collaboration` extension (backed by the Yjs document)
  - `CollaborationCursor` extension (backed by Yjs Awareness)
- [ ] Editable inline document title: clicking the title enters an edit mode; on blur or Enter, call a server function that updates `documents.title` and `documents.updated_at` in Postgres.
- [ ] Presence sidebar / header strip showing all connected users (name + colored dot), derived from Yjs Awareness state.
- [ ] Back button navigating to `/`.
- [ ] Destroy/disconnect the Yjs provider on component unmount to avoid memory leaks and dangling connections.

### Phase 4: Mutation Routes

- [ ] `POST /api/documents` — insert a new document row; return `{ id }`.
- [ ] `PATCH /api/documents/:id` — update `title` and `updated_at` for a given document.
- [ ] Validate request bodies with Zod schemas derived from the Drizzle schema via `drizzle-zod`.

### Phase 5: UI Polish

- [ ] Use shadcn/ui `Button`, `Input`, `Separator`, `Badge`, and `Tooltip` components throughout.
- [ ] Apply a clean, minimal design: white editor surface, thin top bar with document title + presence avatars, left-aligned back button.
- [ ] Each user's cursor in the editor is labeled with their display name and colored with their assigned cursor color.
- [ ] Responsive layout — editor fills available height; title bar is fixed at the top.
- [ ] Loading skeleton for the document list while the Electric shape syncs.
- [ ] Toast notification if the Yjs provider fails to connect (use shadcn/ui `Sonner` or `Toast`).

### Phase 6: Final Steps

- [ ] Write `README.md` documenting how to run the app locally, environment variables needed, and how the Yjs service is provisioned.
- [ ] Request a code review via `REVIEW_REQUEST` message in the room.

---

## Phase 7: Bug Fix — Editor Stuck in "Connecting" State (added)

**User report:** The document editor gets stuck in a "connecting" state and never becomes editable.

This is almost certainly the Yjs provider failing to establish a connection to the Durable Streams service. Investigate and fix the following:

- [ ] **Check provider status display:** Read the current provider connection state in the editor component. If a "connecting…" indicator is shown, verify it reacts to actual provider events (connected, disconnected, synced) rather than being a static placeholder.
- [ ] **Verify the Yjs proxy route is reachable:** Open `src/routes/api/yjs-proxy.ts` (or equivalent). Confirm the route correctly forwards requests — including the `Authorization: Bearer <secret>` header — to the Durable Streams Yjs service URL. Log or trace the proxy to confirm requests are arriving and a non-error HTTP status is returned.
- [ ] **Confirm env vars are populated at runtime:** Check that `VITE_YJS_SERVICE_URL` (or equivalent) and the secret key are present in the running environment. If either is missing, the provider will silently fail to connect. The coder must verify via `list_secrets` and confirm the `.env` file or process env reflects them.
- [ ] **Handle provider error / retry:** If the provider emits an error event (bad URL, 401 Unauthorized, network failure), surface it clearly in the UI — replace the "connecting" spinner with an error message and a **Retry** button. Do not leave the user indefinitely waiting.
- [ ] **Implement a connection timeout:** If the provider has not reached "connected" state within ~10 seconds, transition to an error state with a user-visible message ("Could not connect to the collaboration service — check your connection and try again") and a retry affordance.
- [ ] **Test with two browser tabs** to confirm that once connected, edits made in one tab appear in the other in real time.
