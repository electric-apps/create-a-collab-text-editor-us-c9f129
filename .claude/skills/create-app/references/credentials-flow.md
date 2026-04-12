# Phase 0 — Database & Source credentials flow

**Read this when `list_secrets()` shows that `DATABASE_URL` is missing.** If `DATABASE_URL` is already set, skip this entire file and proceed to Phase 1.

## Why this matters

If you skip credential provisioning and just start writing schema code, the first `pnpm drizzle-kit migrate` will fail with a connection error because `DATABASE_URL` is undefined. Worse, the server-side Electric shape proxy (`src/lib/electric-proxy.ts`) will return 500 "Yjs/shape service not configured" the first time the browser loads the app — because `process.env.ELECTRIC_SOURCE_ID` is empty. Both issues are easy to diagnose but annoying to chase. Better to ask for credentials upfront.

## Sanity check

```bash
cat .env 2>/dev/null | grep -E "^(DATABASE_URL|ELECTRIC_)" || echo "(no .env or no Electric vars)"
```

If `DATABASE_URL` shows up here, do NOT run the flow below — secrets already exist. Proceed to Phase 1.

## The flow

The user has two paths and you must let them pick.

### Step 1 — open an `AskUserQuestion` gate with two options

```json
{
  "questions": [{
    "header": "Electric Cloud Credentials",
    "question": "This app needs a Postgres database and an Electric Cloud source, but none are provisioned yet in the session. How would you like to set them up?",
    "options": [
      {
        "label": "I have existing credentials — I'll paste them",
        "description": "You already have a Postgres database and an Electric Cloud source configured. You'll paste DATABASE_URL, ELECTRIC_SOURCE_ID, and ELECTRIC_SECRET in the next step."
      },
      {
        "label": "Provision a free claimable database",
        "description": "I'll run `npx @electric-sql/cli` to create a new free 72h claimable source on Electric Cloud. Requires an Electric CLI auth token (I'll use the one already in the session if available, or ask you for one)."
      }
    ]
  }]
}
```

### Step 2a — if the user picks "I have existing credentials"

Open a follow-up `AskUserQuestion` with three freeform fields. This keeps the turn alive while the user looks up their values:

```json
{
  "questions": [
    {
      "header": "DATABASE_URL",
      "question": "Paste your Postgres connection string. Format: postgresql://user:password@host:port/dbname"
    },
    {
      "header": "ELECTRIC_SOURCE_ID",
      "question": "Paste your Electric Cloud source ID (e.g. src_abc123)"
    },
    {
      "header": "ELECTRIC_SECRET",
      "question": "Paste your Electric Cloud source secret (e.g. eyJ... — the JWT from `npx @electric-sql/cli services get-secret <id>`)"
    }
  ]
}
```

Once the user submits, store each value via `set_secret`:

```
set_secret(key: "DATABASE_URL", value: "<pasted>")
set_secret(key: "ELECTRIC_SOURCE_ID", value: "<pasted>")
set_secret(key: "ELECTRIC_SECRET", value: "<pasted>")
```

These will propagate to every newly-spawned agent container via the SecretStore. You can also read them yourself via `process.env.DATABASE_URL` etc. after starting a new Bash shell (the MCP server automatically merges SecretStore values into the container's environment on `pnpm dev:start`).

Then run `pnpm drizzle-kit migrate` against the pasted `DATABASE_URL` to verify the database is reachable. If the migration fails with a connection error, open another gate with the error text and ask the user to verify their credentials.

### Step 2b — if the user picks "Provision a free claimable database"

Follow the full Electric CLI flow documented in the `room-messaging` skill (section "Electric CLI — Provisioning External Services"). In summary:

1. Call `list_secrets()` — if `ELECTRIC_CLI_TOKEN` is already set, skip to step 3
2. Open a freeform `AskUserQuestion` gate asking the user to paste a token (the question body should instruct them to run `npx @electric-sql/cli auth` in their own terminal and paste the resulting token back). Do NOT try to run `npx @electric-sql/cli auth` yourself — it opens a browser and needs interactive login.
3. Store the token: `set_secret(key: "ELECTRIC_CLI_TOKEN", value: "<token>")`
4. Run `npx @electric-sql/cli --help` and `npx @electric-sql/cli services --help` to discover the exact command names — do NOT guess. The command set may evolve between releases.
5. Use the CLI to create a new source (typically `services create` or similar — confirm with `--help`). Parse the output to extract `source_id`, `secret`, and the `connection_uri` (the Postgres DATABASE_URL).
6. Store all three via `set_secret`:
   ```
   set_secret(key: "DATABASE_URL", value: "<connection_uri from CLI>")
   set_secret(key: "ELECTRIC_SOURCE_ID", value: "<source_id from CLI>")
   set_secret(key: "ELECTRIC_SECRET", value: "<secret from CLI>")
   ```
7. Run `pnpm drizzle-kit migrate` to verify the database is reachable.

### Step 3 — confirm + continue

Once credentials are stored and `pnpm drizzle-kit migrate` succeeds, broadcast a status update:

```
broadcast(body: "DB + source credentials acquired via <existing|CLI-provisioned>. Proceeding to schema and API routes.", metadata: { type: "status_update" })
```

Then return to Phase 1 of `create-app/SKILL.md` and continue normally.
