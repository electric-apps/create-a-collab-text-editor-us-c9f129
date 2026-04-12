# Collab Text Editor

A real-time collaborative rich-text editor where multiple users can edit the same document simultaneously, powered by Yjs CRDTs over Durable Streams and TipTap.

Generated with [one-shot-electric-app](https://github.com/anthropics/one-shot-electric-app) — an Electric SQL + TanStack DB + shadcn/ui scaffold.

## Prerequisites

- Node.js 22+
- pnpm 9+

## Setup

```bash
pnpm install
```

### Environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Purpose | How to get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection | From Electric Cloud claim or your own Postgres |
| `ELECTRIC_URL` | Electric shape sync endpoint | `https://api.electric-sql.cloud` |
| `ELECTRIC_SOURCE_ID` | Electric Cloud source | From the Cloud claim or `npx @electric-sql/cli` |
| `ELECTRIC_SECRET` | Electric Cloud auth | Same source as above |
| `YJS_URL` | Yjs Durable Streams service URL | `npx @electric-sql/cli services create yjs` |
| `YJS_SECRET` | Yjs service auth token | Same source as above |

### Provisioning Yjs credentials

```bash
npx @electric-sql/cli auth
npx @electric-sql/cli services create yjs --environment <env-id> --name <name>
```

Add the resulting `baseUrl` and `secret` to your `.env` as `YJS_URL` and `YJS_SECRET`.

## Running

```bash
# Run migrations
pnpm drizzle-kit migrate

# Start the dev server
pnpm dev
```

App runs at `http://localhost:5174`.

> Tip: when running inside the agent sandbox, `pnpm dev:start` launches Vite behind a Caddy reverse proxy at `https://localhost:<preview-port>` (HTTP/2 multiplexing). Outside the sandbox, run `pnpm dev` directly.
>
> **First-time HTTPS setup:** from the `one-shot-electric-app` repo root run `pnpm trust-cert` once to install Caddy's local CA. After that, every preview link loads with a green lock.

## Architecture

- **Document metadata** (list, titles): Electric SQL shapes + TanStack DB collections + `useLiveQuery`
- **Document content** (concurrent edits): Yjs CRDT over Durable Streams via `@durable-streams/y-durable-streams`
- **Presence** (cursors, who's online): Yjs Awareness protocol
- **Rich-text editor**: TipTap v3 with Collaboration + CollaborationCaret extensions
- **Mutations**: Optimistic via `collection.insert/update/delete`, reconciled through API routes
- **UI**: shadcn/ui + Tailwind CSS + lucide-react
- **Validation**: zod/v4

See [`PLAN.md`](./PLAN.md) for the full implementation plan.
