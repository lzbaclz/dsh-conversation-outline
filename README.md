# dsh-conversation-outline

[![npm](https://img.shields.io/npm/v/dsh-conversation-outline.svg)](https://www.npmjs.com/package/dsh-conversation-outline)
[![license](https://img.shields.io/npm/l/dsh-conversation-outline.svg)](LICENSE)

English | [中文](README.zh.md)

A Codex-style **conversation outline** client plugin for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) (DSH) Web:
a slim, always-visible **right-edge rail** (one small bar per question — a conversation minimap)
that **expands on hover into a preview panel** listing the opening words of every user
question, with search, load-older and **click-to-jump** (switch to the Chat view → scroll to
the message → flash highlight). The UI is bilingual (zh-CN / en) and follows the DSH
interface language.

## Features

- **Right-edge rail (minimap)** — a thin strip pinned to the right edge, one bar per user
  question in chronological order. Out of the way while you read; questions beyond 60 fold
  into a top `+N` marker.
- **Hover-expanded preview panel** — hover the rail and a panel slides out showing each
  question's opening words (single-line truncated), its `#turn` badge and `HH:MM` time.
  Moving the pointer away collapses it after a 240 ms grace period; on touch devices tap
  the strip to pin the panel, `Esc` or × closes it. The panel is a pure overlay — it never
  shifts your content.
- **Click-to-jump** — click a bar on the rail or a row in the panel: DSH switches to the
  Chat view, scrolls to that message and flashes it for 1.8 s (respects
  `prefers-reduced-motion`).
- **Search** — case-insensitive substring filter over the flattened question text.
- **Load older** — paging through older history via the session's `loadOlder()`.
- **Live updates** — new questions appear while the session is running (snapshot subscription).
- **Session isolation** — follows the current session; switching sessions collapses the
  panel and rebuilds the rail for the new session.
- **Bilingual i18n** — zh-CN / en, switching with the DSH interface language.

## Preview

> TODO: placeholder — drop a screenshot at `assets/ui.png` before the release and update
> the image link below.

![Conversation outline panel](assets/ui.png)

## Install

**Prerequisites**: [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)
installed (the `dsh` command available); Node.js `^22.19` or `>=24`; pnpm 10+.

> If you run DSH through `npx` instead of a global install, prefix the commands below
> with `npx -p @deepseek-ai/dsh `.

### 1. From npm (recommended after publishing)

```sh
dsh plugin --profile web add dsh-conversation-outline
```

### 2. From GitHub (unreleased / latest commit)

```sh
dsh plugin --profile web add github:lzbaclz/dsh-conversation-outline
```

> **Zero build scripts**: this repository commits the built output `lib/` to git
> (`.gitignore` deliberately does not ignore `lib`), so a GitHub install fetches
> ready-to-load artifacts — no `prepare` script and no profile `allowBuilds`
> configuration. Install-and-go, zero interaction.

### 3. From source (local development)

```sh
git clone https://github.com/lzbaclz/dsh-conversation-outline.git
cd dsh-conversation-outline
pnpm install
pnpm dev:types    # symlink @deepseek-ai type packages into node_modules (one-time)
pnpm build
dsh plugin --profile web add "link:$(pwd)"
```

### After installing

> **Restart to apply**: after install / upgrade / any host-side change, restart the
> running DeepSeek Harness Web service and refresh the page. (A `link:` install picks up
> rebuilt `lib/` without re-adding — refresh the page after `pnpm build`.)

Confirm the plugin is in the profile:

```sh
dsh plugin --profile web list
```

Upgrade with the same `add` command (optionally pin a version, e.g.
`dsh-conversation-outline@0.1.0`).

## Usage

After install and restart, a thin vertical strip appears on the right edge of a session
(the conversation's question minimap):

1. **Hover to expand** — move the pointer onto the strip: a preview panel slides out
   (each question's opening words + `#turn` + time). It collapses automatically after
   you move away; on touch devices tap the strip to pin it, `Esc` or × to close.
2. **Jump** — click a bar on the strip or any row in the panel: DSH switches to the Chat
   view, scrolls to the message and flashes it.
3. **Search** — type in the panel's search box to filter the list instantly.
4. **Load older** — the `Load older` button at the bottom pages through earlier questions
   (greyed out while loading).
5. **Copy** — hover a row and click the copy button to copy the full question text.

## Development

```sh
pnpm dev:types   # symlink @deepseek-ai types (first time / after rebuilding node_modules)
pnpm install
pnpm typecheck   # host + client dual tsc programs
pnpm build       # tsc(host) → tsc(client) → tsdown bundles lib/client.js
pnpm verify      # offline smoke: manifest/exports/patch/bundle shape + pure-logic assertions
```

### Local debugging

1. Use a **scratch profile** (never touch the running instance). Important: a fresh
   scratch profile bundles only `@deepseek-ai/dsh-base` — you must **also add the official
   web-app bundle by path**, otherwise the web boot hangs forever. Locate the
   `@deepseek-ai/dsh-web-app` folder inside YOUR dsh installation (it ships with the CLI;
   e.g. `~/.npm/_npx/*/node_modules/@deepseek-ai/dsh-web-app` for npx runs, or
   `<npm root -g>/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-app` for a global
   install). Do NOT add it by name: the public registry only carries the old
   `0.0.1-rc.1` channel, which mismatches a `0.1.0-rc.x` CLI and fails the boot.

   ```sh
   tmp=$(mktemp -d)   # throwaway DSH_HOME
   # 1) install the plugin itself (path install)
   DSH_HOME=$tmp dsh plugin --profile scratch add "$(pwd)"
   # 2) critical: add the official web-app bundle by path (web boot hangs without it)
   DSH_HOME=$tmp dsh plugin --profile scratch add "<path-to>/@deepseek-ai/dsh-web-app"
   # 3) boot on a free port (avoid occupied ones such as 3080)
   DSH_HOME=$tmp dsh --profile scratch --port 3199
   # 4) when done: kill the dsh process, then rm -rf "$tmp"
   ```

2. **Client changes + HMR**: `pnpm exec tsdown --watch` keeps rewriting `lib/client.js`.
   With the DSH checkout's `pnpm run dev:web` watcher running, the browser hot-reloads
   without a refresh; otherwise run a plain `pnpm build` and refresh the existing DSH page
   (do NOT start a separate Vite server — the Web shell relies on the host-injected
   `window.__DSH_BOOT__`).
3. **Host-side / manifest changes**: edits to `src/index.ts`, `package.json`, `exports`
   or `cordis.patch.yml` require a DSH service restart; manifest-level changes require
   re-running `dsh plugin add`.

## Docs

| Document | Contents |
|---|---|
| [docs/implementation-spec.md](docs/implementation-spec.md) | Authoritative design spec: DSH facts, UI seams, jump algorithm, verification plan |
| [docs/publishing-guide.md](docs/publishing-guide.md) | Publishing guide: license choice, GitHub repo, npm/GitHub distribution, release workflow |

## License

MIT — see [LICENSE](LICENSE).
