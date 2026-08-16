# Security

`dsh-conversation-outline` is a **client-only** UI plugin. This page states what it can
and cannot do, and how to verify it.

## What it runs

- **Host half**: a minimal, empty plugin body (`src/index.ts`) that exists only so the
  plugin appears in the profile composition and the browser roster. It registers no
  tools, no HTTP routes, no prompt sections, and reads no files.
- **Client half**: the browser bundle renders the outline rail + hover panel. It
  subscribes to the session snapshot and to the sessions list, and touches the DOM only
  to scroll to and highlight a message row.

## What it does NOT do

- No telemetry, analytics, or tracking. No `fetch`/`XMLHttpRequest`/`WebSocket` calls of
  its own — all data comes from the DSH runtime's existing connections.
- No data leaves your browser or machine. Question text is only used to render the
  panel, to filter, and to copy to your clipboard when you click Copy.
- No writes to disk, no environment access (the host half has no code), no spawned
  processes, no native modules.

## Dependencies

- Runtime platform modules only: `react` (peer), plus DSH platform services resolved
  through the profile's own installation. The bundled client requires exactly
  `react` and `react/jsx-runtime` — enforced by the build's purity gate and re-checked
  by `pnpm verify` (require-purity scan).
- `scripts/link-types.mjs` symlinks local `@deepseek-ai/*` type packages for
  type-checking only; they are dev-time links, never shipped.

## Verifying

```sh
pnpm verify
```

Checks include: exports/files/patch consistency, the loader-wrapper shape of
`lib/client.js`, absence of absolute machine paths in `lib/`, and that every
`require(...)` in the bundle is a platform module.

## Reporting

If you find a security issue, please report it privately to the maintainer first
(open a normal issue if it is not sensitive). See the [publishing guide](publishing-guide.md)
for release policy.
