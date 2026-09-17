# dsh-conversation-outline

![banner](assets/banner.png)

[![npm](https://img.shields.io/npm/v/@chestnut23%2Fdsh-conversation-outline.svg)](https://www.npmjs.com/package/@chestnut23/dsh-conversation-outline)
[![npm downloads](https://img.shields.io/npm/dm/@chestnut23%2Fdsh-conversation-outline.svg)](https://www.npmjs.com/package/@chestnut23/dsh-conversation-outline)
[![license](https://img.shields.io/npm/l/@chestnut23%2Fdsh-conversation-outline.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-5FA04E?logo=nodedotjs)](https://nodejs.org/)
[![stars](https://img.shields.io/github/stars/lzbaclz/dsh-conversation-outline.svg)](https://github.com/lzbaclz/dsh-conversation-outline)
[![dsh plugin](https://img.shields.io/badge/dsh-plugin-4d6bfe)](https://github.com/deepseek-ai/DeepSeek-Harness)

[简体中文](README.zh.md) · [Usage](docs/usage.md) · [Troubleshooting](docs/troubleshooting.md) · [Security](docs/security.md) · [Publishing Guide](docs/publishing-guide.md) · [Design Spec](docs/implementation-spec.md)

**Find any question. Jump to any answer.**

Long agent conversations scroll forever. `dsh-conversation-outline` is a
Codex-style **conversation outline** for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) Web:
a slim, always-visible **right-edge rail** — one bar per question, like a minimap of the
conversation — that **expands on hover** into a preview panel of every question's opening
words. Click a bar or a row and you are teleported to that message in the Chat view, with
a flash highlight so you cannot miss it. Bilingual zh-CN / en.

## Highlights

- **Right-edge rail (minimap)** — thin, pinned to the right edge, one bar per question in
  chronological order. Out of the way while you read; >60 questions fold into a `+N` marker.
- **Hover to preview** — hover the rail and the panel slides out with each question's
  opening words (single-line truncated), `#turn` badge and `HH:MM` time. Collapses 240 ms
  after you move away. Pure overlay — your content never shifts.
- **Click to open as well** — clicking the strip (or a bar) pins the panel open until you
  close it with `Esc`, the ×, or a click outside, so the rail also works on touch, pen and
  automation where no hover event ever arrives.
- **Click-to-jump** — switches to the Chat view (even from Trajectory), scrolls to the
  message and flashes it for 1.8 s. Respects `prefers-reduced-motion`; a jump that cannot
  reach the message reports it in the panel instead of failing silently.
- **Search & load older** — case-insensitive filtering, plus paging into older history.
- **Live** — new questions appear while the session runs; follows the current session and
  collapses on switch.
- **Zero dependencies at runtime** — the browser bundle imports only React (the platform
  modules); everything else is inlined and purity-checked at build time.

## Install

> **Requirements**: DSH ≥ `0.1.5-rc.2` (the `next` channel / the DSH Desktop app).
>
> | Plugin version | Works with |
> |---|---|
> | `0.2.x` | DSH ≥ `0.1.5-rc.2` |
> | `0.1.2` and earlier | DSH `0.1.0-rc.x` (the Chat node graph still lived in `snapshot.chat`) |


> **Using the DSH Desktop app?** Run the same command in the app's built-in
> terminal **without `--profile`** — it targets the `desktop` profile
> automatically. The first install needs one restart of that DSH; later upgrades
> hot-reload (no restart).

**Prerequisites**: [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)
(`dsh` available) **≥ 0.1.5-rc.2**; Node.js `^22.19` or `>=24`; pnpm 10+.
If you run DSH via `npx`, prefix the commands with `npx -p @deepseek-ai/dsh `.
On an older host, use plugin `0.1.3` — see the
[compatibility table](docs/troubleshooting.md#compatibility).

```sh
# 1) npm (recommended — one command)
dsh plugin --profile web add @chestnut23/dsh-conversation-outline

# 2) GitHub (latest commit, no build step needed)
dsh plugin --profile web add github:lzbaclz/dsh-conversation-outline

# 3) from source (local development)
git clone https://github.com/lzbaclz/dsh-conversation-outline.git
cd dsh-conversation-outline
pnpm install && pnpm build
dsh plugin --profile web add "link:$(pwd)"
```

> **Zero build scripts on the GitHub path**: the built `lib/` is committed to this repo
> (`.gitignore` deliberately does not ignore it), so a `github:` install fetches
> ready-to-load artifacts — no `prepare` script, no profile `allowBuilds` configuration.
> **Name warning**: an unrelated project owns the *unscoped* npm name
> `dsh-conversation-outline`. This plugin is only published as
> `@chestnut23/dsh-conversation-outline` — always install the scoped name (or the
> GitHub path above).

**After installing**: restart the DSH Web service and refresh the page (`link:` installs
just need a page refresh after `pnpm build`). Confirm with:

```sh
dsh plugin --profile web list
```

Upgrade with the same `add` command (optionally pin a version:
`@chestnut23/dsh-conversation-outline@0.1.4`).

### Upgrade & hot reload

```sh
dsh plugin --profile web add @chestnut23/dsh-conversation-outline@latest   # fetch the new version
```

The DSH composition always mounts the `dsh-client-hmr` chain, which watches
installed plugin bundles and reloads them:

- **Upgrading an installed plugin** (same entry, new file content) is hot — no app
  restart, usually not even a page refresh.
- **Installing a brand-new plugin** (a new roster entry) needs one DSH restart.

Every side effect (style tag, locale dictionaries, slot registrations) is owned by
the plugin fiber, so a hot reload never leaves stale code behind.

## Usage

Install, restart, open any session that already has messages — a thin strip appears on
the right edge. Hover it to preview questions; click the strip (or a bar) to open the
panel and keep it open; click a row to jump; search to filter, `Load older` to page
through history. Full walkthrough: [docs/usage.md](docs/usage.md). Something's not
showing up? [Troubleshooting](docs/troubleshooting.md).

## Preview

> Real-screenshot placeholder: after installing, drop a screenshot of the rail + panel
> at `assets/ui.png` and it will appear here.

![Conversation outline](assets/ui.png)

## Development

```sh
pnpm install     # installs the pinned @deepseek-ai 0.1.5-rc.2 type packages
pnpm typecheck   # host + client dual tsc programs
pnpm build       # tsc(host) → tsc(client) → tsdown bundles lib/client.js
pnpm verify      # offline smoke: manifest/exports/patch/bundle shape + pure-logic asserts
pnpm test:dom    # headless DOM test: mounts the built rail in jsdom and asserts render/hover/jump
```

`pnpm typecheck` needs `lib/types/**` from the `@deepseek-ai/*` packages. Some DSH
installations ship those packages **without** declaration files (the Electron bundle
prunes them), and the npm `rc` channels publish a reduced type surface — in that case
typecheck reports missing modules while the build and runtime are unaffected. The
supported fix is to run against a DSH source checkout (or a profile whose
`@deepseek-ai/*` links resolve to one); `pnpm verify` covers the contract-shaped logic
either way.

Client-only changes hot-reload: `pnpm exec tsdown --watch` rewrites `lib/client.js`, and
the DSH client HMR chain (or a plain page refresh) picks it up. Host/manifest changes
need a service restart. Scratch-profile testing recipe:
[docs/implementation-spec.md §4.2](docs/implementation-spec.md).

## Talk to us

Issues are welcome any time: [open one](https://github.com/lzbaclz/dsh-conversation-outline/issues).
Questions, feature ideas, screenshots of what you built with it — all good.

## License

MIT — see [LICENSE](LICENSE). Client-only plugin: no telemetry, no extra network calls
([security notes](docs/security.md)).
