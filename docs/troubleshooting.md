# Troubleshooting

## I installed but see nothing

1. **Restart the DSH Web service** — the plugin roster is cached at boot. Installing
   only writes the profile; the running process keeps its old roster until restart.
2. Refresh the page afterwards.
3. **Open a session that already has messages** — the rail intentionally renders
   nothing on the blank new-session screen (there is nothing to outline yet).
4. Confirm the plugin is in the profile: `dsh plugin --profile web list`.

## I see the old capsule badge instead of the rail

Your page is still running an old bundle. Refresh the page (Ctrl/Cmd+R). If a stale
version persists, restart the DSH Web service and refresh again.

## The rail shows but the panel will not open

Click the strip (or any bar) — since v0.1.1 a click pins the panel open, so it no longer
depends on a hover event reaching the rail. If a click still does nothing at all:

1. Check the pointer is on the strip, not on the window edge outside the app frame.
2. Open the browser console: a failure inside the jump path logs the target key.
3. Refresh the page once — a bundle in the page cache can predate the fix.
4. If it still fails, report the console output with the DSH version and the plugin
   version (`dsh plugin --profile web list`).

## Jumping does nothing / logs "jump failed"

- The target message must be in the **loaded history window** (the panel only lists
  loaded questions). Click `Load older` first for deeper history, then jump again. The
  panel now shows this notice itself instead of failing silently.
- Extremely long sessions: if the row does not render within 1.5 s after switching
  views, the jump is abandoned (a console warning is logged). Retrying usually works.

## The rail overlaps another floating panel

The rail sits on the right edge, vertically centered; the hover panel is an overlay on
the right side too. If another plugin (e.g. an activity panel) occupies the same area,
the panel may overlap it while open — close one of them, or open an issue describing
the conflict so the panel anchor can be tuned.

## `dsh plugin add dsh-conversation-outline` reports "package not found"

The npm path only works **after the package is published to the npm registry**. Until
then, install from GitHub instead:

```sh
dsh plugin --profile web add github:lzbaclz/dsh-conversation-outline
```

## `dsh plugin add` fails on the GitHub path

- The repo **commits `lib/`** — make sure you are not pointing at a fork that deleted
  the built output (then the exports would not resolve).
- pnpm version: use pnpm 10+.

## Scratch-profile web boot hangs forever

A fresh scratch profile bundles only `@deepseek-ai/dsh-base`. Add the official
`@deepseek-ai/dsh-web-app` bundle **by path** from your dsh installation before
booting (see README → Development). Do NOT add it by package name: the public
registry only carries the old `0.0.1-rc.1` channel, which mismatches a `0.1.0-rc.x`
CLI and fails at boot.

## Type errors when building from source

Run `pnpm dev:types` once — it symlinks the `@deepseek-ai` type packages from the
local dsh profile into `node_modules` (the packages are not re-installable from the
public registry at their rc channels).

## Hot reload does not trigger

Client-bundle HMR needs the `tsdown --watch` builder rewriting `lib/client.js`, and the
browser reload chain is always mounted. If it still does not update, refresh the page —
a plain rebuild plus refresh is the supported fallback. Host-side / manifest changes
always require a service restart.
