#!/usr/bin/env node
// preflight.mjs — static checks for recurring bug classes in Electric/TanStack Start apps.
//
// Runs as `prebuild` so every `pnpm build` invocation validates the codebase
// against the patterns the coder skill warns about. Exits non-zero on any
// failure; the build then aborts. The goal is to make the fail-loud path
// automatic instead of relying on the agent to remember to run grep checks.
//
// Checks performed:
//   1. SSR safety — leaf routes with `useLiveQuery` must set `ssr: false`
//      (or wrap the consumer in <ClientOnly>)
//   2. "use client" directive — a Next.js idiom that does nothing in TanStack
//      Start, but looks like it works. Reject it everywhere.
//   3. TipTap v3 cursor/caret trap — reject the broken v3 stub of
//      `@tiptap/extension-collaboration-cursor` (agents must use
//      `@tiptap/extension-collaboration-caret`)
//   4. Electric timestamp parser — collections with timestamp columns must
//      configure `shapeOptions.parser.timestamptz` or rows arrive as strings
//      and `.getTime()` crashes at runtime

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd()
const errors = []

// ── helpers ────────────────────────────────────────────────────────────────

function walk(dir, filter) {
  const results = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      results.push(...walk(full, filter))
    } else if (filter(entry, full)) {
      results.push(full)
    }
  }
  return results
}

function readSafe(path) {
  try {
    return readFileSync(path, "utf-8")
  } catch {
    return ""
  }
}

function fail(category, message, files = []) {
  errors.push({ category, message, files })
}

// ── 1. SSR safety check ────────────────────────────────────────────────────

{
  const routeFiles = walk(join(ROOT, "src/routes"), (name) => name.endsWith(".tsx"))
  const bad = []
  for (const file of routeFiles) {
    if (file.endsWith("/__root.tsx")) continue
    const content = readSafe(file)
    if (!/\buseLiveQuery\b/.test(content)) continue
    if (/\bClientOnly\b/.test(content)) continue
    if (/ssr:\s*false/.test(content)) continue
    bad.push(relative(ROOT, file))
  }
  if (bad.length) {
    fail(
      "SSR safety",
      "The following routes call useLiveQuery but do NOT set `ssr: false` and do NOT wrap the consumer in <ClientOnly>. At runtime they crash with `Missing getServerSnapshot` during SSR. Add `ssr: false` to the route's createFileRoute options, or wrap the consumer subtree in <ClientOnly>.",
      bad,
    )
  }
}

// ── 2. `"use client"` directive ────────────────────────────────────────────
// Scan agent-authored source only. Skip `src/components/ui/` — those are
// shadcn-pre-installed components that ship with `"use client"` at the top;
// TanStack Start ignores the directive and the components work fine there.
// The check exists to catch AGENT confusion about Next.js semantics, not to
// police third-party scaffolding.

{
  const sourceFiles = walk(join(ROOT, "src"), (name) => /\.(tsx?|jsx?)$/.test(name))
  const bad = []
  for (const file of sourceFiles) {
    const rel = relative(ROOT, file)
    if (rel.startsWith("src/components/ui/") || rel.startsWith("src\\components\\ui\\")) continue
    const content = readSafe(file)
    if (/^\s*['"]use client['"]/m.test(content)) {
      bad.push(rel)
    }
  }
  if (bad.length) {
    fail(
      '"use client" directive',
      '`"use client"` is a Next.js / React Server Components idiom. TanStack Start silently ignores it — your route still renders server-side and still crashes. Delete the directive and use `ssr: false` on the route options instead.',
      bad,
    )
  }
}

// ── 3. TipTap v3 cursor/caret trap ─────────────────────────────────────────

{
  const pkgPath = join(ROOT, "package.json")
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readSafe(pkgPath) || "{}")
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    const bad = []
    if (allDeps["@tiptap/extension-collaboration-cursor"]) {
      bad.push("package.json: @tiptap/extension-collaboration-cursor (broken in v3 — use @tiptap/extension-collaboration-caret instead)")
    }
    if (allDeps["y-prosemirror"]) {
      bad.push("package.json: y-prosemirror (TipTap v3 uses @tiptap/y-tiptap internally — remove this dep)")
    }
    // Also scan source files for imports of the old package
    const sourceFiles = walk(join(ROOT, "src"), (name) => /\.(tsx?|jsx?|mts|cts)$/.test(name))
    for (const file of sourceFiles) {
      const content = readSafe(file)
      if (/@tiptap\/extension-collaboration-cursor/.test(content)) {
        bad.push(`${relative(ROOT, file)}: imports @tiptap/extension-collaboration-cursor`)
      }
      if (/from\s+["']y-prosemirror["']/.test(content)) {
        bad.push(`${relative(ROOT, file)}: imports from y-prosemirror directly`)
      }
    }
    if (bad.length) {
      fail(
        "TipTap v3 cursor/caret trap",
        "TipTap v3 renamed `extension-collaboration-cursor` → `extension-collaboration-caret` and moved the Yjs integration from `y-prosemirror` into `@tiptap/y-tiptap`. Installing `@tiptap/extension-collaboration-cursor@3.x` produces a hard crash in `Plugin.init` (`TypeError: Cannot read properties of undefined (reading 'doc')` at cursor-plugin.js:76). Replace with `@tiptap/extension-collaboration-caret` and never pin `y-prosemirror` directly.",
        bad,
      )
    }
  }
}

// ── 4. Electric timestamp parser ───────────────────────────────────────────

{
  const schemaPath = join(ROOT, "src/db/schema.ts")
  const hasTimestampColumns = existsSync(schemaPath) && /\btimestamp\s*\(/.test(readSafe(schemaPath))
  if (hasTimestampColumns) {
    const collectionFiles = walk(join(ROOT, "src/db/collections"), (name) => name.endsWith(".ts"))
    const bad = []
    for (const file of collectionFiles) {
      const content = readSafe(file)
      // Only check files that use electricCollectionOptions
      if (!/electricCollectionOptions/.test(content)) continue
      if (!/timestamptz\s*:/.test(content)) {
        bad.push(relative(ROOT, file))
      }
    }
    if (bad.length) {
      fail(
        "Electric timestamp parser",
        "These collection files use electricCollectionOptions but do NOT configure `shapeOptions.parser.timestamptz`. Electric's sync path bypasses the TanStack DB schema, so timestamptz columns arrive as ISO strings and `.getTime()` / `.toLocaleDateString()` crash at runtime. Add:\n\n  shapeOptions: {\n    url: absoluteApiUrl('/api/<entity>'),\n    parser: {\n      timestamptz: (v) => new Date(v),\n      timestamp:   (v) => new Date(v),\n    },\n  }\n\nSee node_modules/@electric-sql/client/skills/electric-new-feature/SKILL.md → \"Removing parsers because the TanStack DB schema handles types\" for the full reasoning.",
        bad,
      )
    }
  }
}

// ── report ─────────────────────────────────────────────────────────────────

if (errors.length === 0) {
  console.log("✓ preflight: all checks passed")
  process.exit(0)
}

console.error("")
console.error("✗ preflight failed — the following issues MUST be fixed before the build can proceed:")
console.error("")
for (const err of errors) {
  console.error(`  [${err.category}]`)
  console.error(`    ${err.message.split("\n").join("\n    ")}`)
  if (err.files.length) {
    console.error("    Affected files:")
    for (const f of err.files) console.error(`      - ${f}`)
  }
  console.error("")
}
process.exit(1)
