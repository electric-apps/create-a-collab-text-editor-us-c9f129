# Electric Cloud proxy patterns

**Read this when your app uses Yjs (`@durable-streams/y-durable-streams`), Durable Streams (`@durable-streams/client`), or StreamDB (`@durable-streams/state`) with Electric Cloud credentials.** For local-only apps using just Electric shapes + TanStack DB, the scaffold's `src/lib/electric-proxy.ts` already handles everything — you do not need anything in this file.

## Why a server-side proxy is mandatory

Every Electric Cloud endpoint (shapes, Yjs, Durable Streams, StreamDB) requires a secret for authentication. If you call these endpoints directly from the browser, you will either leak the secret in the client bundle or hit a 401 with `MISSING_SECRET`. The ONLY correct pattern is a server-side proxy route that:

1. Reads `ELECTRIC_*` secrets from `process.env` at runtime (never imports them into client code)
2. Appends the secret as a query parameter (shapes) or `Authorization: Bearer <secret>` header (Yjs) to the outbound request
3. Returns the response to the browser

The existing `src/lib/electric-proxy.ts` already does this for Electric shapes (`?secret=${ELECTRIC_SECRET}`). You MUST create the equivalent for every other Electric Cloud service your app uses.

## Pattern: Yjs service proxy (CANONICAL — copy this exactly)

If you use `@durable-streams/y-durable-streams`, the `YjsProvider` must NOT point at `https://api.electric-sql.cloud/...` directly — you'd leak the secret or hit a 401. You need a server-side proxy that:

1. Injects the `Authorization: Bearer <secret>` header on outbound requests
2. Forwards **every response header** except a small hop-by-hop block-list
3. Streams the binary body through unchanged

**⚠️ The header-forwarding rule is the single most common place where Yjs proxies fail.** The Yjs Durable Streams protocol uses a custom header, `stream-next-offset`, as a **cursor** — the client reads it on every response to know where to continue reading updates. If your proxy uses an **allow-list** (only forwarding `content-type` / `cache-control` / etc.) you'll silently strip this header and Yjs sync will stall after the initial snapshot. Use a **block-list** instead.

Create `src/routes/api/yjs/$.ts` — the `$` splat captures the full sub-path under `/api/yjs/` (which is `docs/<docId>`, `docs/<docId>/awareness`, etc.):

```typescript
// src/routes/api/yjs/$.ts
import { createFileRoute } from "@tanstack/react-router"

// Headers that must NOT be forwarded from upstream to the browser.
//
//   1. RFC 9110 hop-by-hop — per spec, must not be passed end-to-end
//      by a proxy
//   2. `content-encoding` + `content-length` — Node's `fetch()` auto-
//      decompresses gzip/br/zstd response bodies but leaves the
//      `Content-Encoding` header intact on `response.headers`.
//      Forwarding that header with a decompressed body makes the
//      browser crash with `ERR_CONTENT_DECODING_FAILED` when it tries
//      to gunzip plaintext. Strip both; the runtime recomputes them.
//
// Every OTHER response header passes through untouched, including
// Yjs-specific ones like `stream-next-offset` that the client uses
// as a cursor to continue reading updates.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  // See comment above — CRITICAL, do not remove either of these:
  "content-encoding",
  "content-length",
])

async function proxyYjs({
  request,
  params,
}: {
  request: Request
  params: { _splat?: string }
}): Promise<Response> {
  // Env vars are projected from the SecretStore into .env at container
  // spawn time. Match the names your set_secret calls used.
  const baseUrl = process.env.YJS_URL  // e.g. https://api.electric-sql.cloud/v1/yjs/svc-yjs-...
  const secret = process.env.YJS_SECRET
  if (!baseUrl || !secret) {
    return new Response("Yjs service not configured (missing YJS_URL or YJS_SECRET)", {
      status: 500,
    })
  }

  // Preserve query string (?offset=, ?live=, ?awareness=, etc.)
  const requestUrl = new URL(request.url)
  const splat = params._splat ?? ""
  const upstream = `${baseUrl}/${splat}${requestUrl.search}`

  // Forward request body for write methods. The Yjs protocol uses
  // application/octet-stream binary bodies for updates and posts;
  // pass request.body directly (ReadableStream) with duplex: "half".
  const hasBody =
    request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS"

  // Forward request headers EXCEPT hop-by-hop + cookie + original
  // Authorization (we replace it with the server-side secret).
  const forwardedRequestHeaders = new Headers()
  for (const [key, value] of request.headers) {
    const lower = key.toLowerCase()
    if (HOP_BY_HOP.has(lower)) continue
    if (lower === "cookie") continue
    if (lower === "authorization") continue
    if (lower === "host") continue
    forwardedRequestHeaders.set(key, value)
  }
  forwardedRequestHeaders.set("Authorization", `Bearer ${secret}`)

  const upstreamResponse = await fetch(upstream, {
    method: request.method,
    headers: forwardedRequestHeaders,
    body: hasBody ? request.body : undefined,
    // duplex: "half" is required when streaming a ReadableStream body.
    // TypeScript doesn't know about this yet, hence the cast.
    duplex: "half",
    // Don't follow redirects automatically — the YjsProvider expects
    // to see the 307 from `?offset=snapshot` so it can follow it and
    // pick up the `stream-next-offset` header. Actually, wait: fetch()
    // DOES follow same-origin redirects by default and preserves
    // Authorization, which is what we want here. Leave redirect default.
  } as RequestInit)

  // Forward ALL response headers except hop-by-hop. DO NOT use an
  // allow-list — the Yjs protocol's `stream-next-offset` cursor header
  // is not a standard name and any allow-list you write will miss it.
  const forwardedResponseHeaders = new Headers()
  for (const [key, value] of upstreamResponse.headers) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    forwardedResponseHeaders.set(key, value)
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: forwardedResponseHeaders,
  })
}

export const Route = createFileRoute("/api/yjs/$")({
  server: {
    handlers: {
      GET: proxyYjs,
      POST: proxyYjs,
      PUT: proxyYjs,
      PATCH: proxyYjs,
      DELETE: proxyYjs,
      OPTIONS: proxyYjs,
    },
  },
})
```

**Critical details — do NOT change without understanding the consequences:**

- **Block-list, not allow-list.** The `HOP_BY_HOP` set is exhaustive. Everything else — including `stream-next-offset`, `stream-content-length`, content-type, cache-control, anything custom the upstream sends — must pass through. If you see a Yjs sync that "works for a moment then stops", the very first suspect is a proxy header filter.
- **`content-encoding` MUST be in the block-list** (alongside `content-length`). Node's `fetch()` auto-decompresses gzip/br/zstd response bodies but leaves `Content-Encoding` on the headers object. If you forward that header with the already-decompressed body, Chrome crashes with `ERR_CONTENT_DECODING_FAILED` when it tries to gunzip plaintext. This is THE single most common recurring bug class for these proxies — it looks like a network error but it's a header-forwarding bug. Strip `content-encoding` unconditionally.
- **`duplex: "half"` is required** when forwarding a `ReadableStream` body with `fetch`. Node throws `TypeError` without it.
- **Don't follow redirects manually.** The Yjs protocol uses `307` redirects from `?offset=snapshot` to `?offset={N}_snapshot`; `fetch()` follows them automatically and preserves the Authorization header for same-origin redirects. The final response the proxy returns is the snapshot data, not the 307.
- **Use the splat catch-all route** (`/api/yjs/$`) not a single `$docId` param — Yjs URLs can have sub-paths like `/docs/<id>`, `/docs/<id>/awareness`, etc. The `$` captures them all.

Then in client code — **the `baseUrl` must be the absolute same-origin proxy URL**, not a relative path (Electric's `new URL(baseUrl)` rejects relative URLs):

```typescript
// src/routes/doc.$documentId.tsx (or wherever you create the provider)
import { YjsProvider } from "@durable-streams/y-durable-streams"
import * as Y from "yjs"
import { useEffect, useState } from "react"

function EditorPage({ documentId }: { documentId: string }) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)

  useEffect(() => {
    const doc = new Y.Doc()
    setYdoc(doc)

    // ⚠️ ABSOLUTE URL. Relative paths like "/api/yjs" break the
    // `new URL(baseUrl)` call inside YjsProvider and most other
    // Electric client packages. See src/lib/electric-proxy.ts for
    // the `absoluteApiUrl()` helper that handles SSR correctly.
    const provider = new YjsProvider({
      doc,
      baseUrl: `${window.location.origin}/api/yjs`,
      docId: documentId,
      // NO `headers` here — the server proxy adds the Authorization header
    })

    return () => {
      provider.destroy()
      doc.destroy()
    }
  }, [documentId])

  // ... useEditor + Collaboration.configure({ document: ydoc }) ...
}
```

**Route the route under `<ClientOnly>`** or mark the route with `ssr: false`. `YjsProvider` touches `fetch` / `EventSource` in its constructor and will fail during SSR hydration if the component renders server-side.

## Pattern: Durable Streams service proxy (`@durable-streams/client`, StreamDB)

Same idea: create `src/routes/api/streams.$streamId.ts` that reads `ELECTRIC_DS_SERVICE_ID` and `ELECTRIC_DS_SECRET` from env and forwards to `${ELECTRIC_URL}/v1/stream/...` with `?secret=` query param or `Authorization: Bearer`. Client constructs `DurableStream({ url: "/api/streams/my-stream" })` against the proxy.

## Env var naming

Read the CLI's output carefully when provisioning and store each distinct service under its own key via `set_secret`. Suggested names (match these when writing to `.env`):

| Service | Env vars |
|---|---|
| Electric shapes (already auto-provisioned) | `ELECTRIC_URL`, `ELECTRIC_SOURCE_ID`, `ELECTRIC_SECRET` |
| Durable Streams (events / StreamDB) | `ELECTRIC_DS_SERVICE_ID`, `ELECTRIC_DS_SECRET` (reuse `ELECTRIC_URL`) |
| Yjs | `ELECTRIC_YJS_SERVICE_ID`, `ELECTRIC_YJS_SECRET` (reuse `ELECTRIC_URL`) |

If the CLI returns keys with different names, use those names — the point is: one env var per service, never mix secrets across services, and always read them ONLY from server code.

## Anti-patterns to avoid

- ❌ Client code that imports `process.env.ELECTRIC_SECRET` — Vite will fail or, worse, bundle the secret into the browser
- ❌ `YjsProvider({ baseUrl: "https://api.electric-sql.cloud/v1/yjs/svc-xyz/docs/..." })` directly — this will 401 with `MISSING_SECRET`
- ❌ Passing the secret as a `headers.Authorization` in a client-side `YjsProvider` config — the secret ends up in the bundle
- ❌ Hardcoding any of these secrets in committed files (`.env.example` is fine; `.env` must be gitignored)
