# dsh-conversation-outline — Implementation Spec

A DeepSeek Harness (DSH) client plugin that adds a **Codex-style conversation outline**:
a floating panel listing every user question in the current conversation, with
search and **click-to-jump** (switches to the Chat view, scrolls to the message,
flashes a highlight). Bilingual zh-CN / en.

This spec is the single source of truth for the team. All paths are relative to
the repo root `/Users/liziqing/Programs/agents/dsh-conversation-outline`.

---

## 1. Facts about DSH (verified against installed rc.6 packages)

Reference material on disk (READ ONLY):
- DSH packages (runtime + types): `/Users/liziqing/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/`
- Web profile flat node_modules (symlinks to the above, plus react):
  `/Users/liziqing/.dsh/profiles/node_modules/`
- Working third-party plugin example (published, MIT): `@nanmicoder/dsh-agent-teams`
  installed at `/Users/liziqing/.dsh/profiles/web/node_modules/@nanmicoder/dsh-agent-teams/`
  — its `lib/client.js` shows the exact loader-wrapper shape, panel CSS patterns,
  and `apply(ctx)` portal pattern.
- Authoritative dev skill: `/tmp/dsh-plugin-skill.md` (fetched from
  NanmiCoder/dsh-agent-teams `skills/dsh-plugin-development/SKILL.md`) and
  `/tmp/developing-dsh-plugins.md` (the long-form guide). Read both.

### 1.1 Client plugin contract

- A bundle = npm package whose `package.json` has:
  - `dsh.bundle.patch` → `./cordis.patch.yml` (bundle patch layer)
  - `dsh.client` = `{ platform: "web", inject: ["@deepseek-ai/dsh-client-runtime", ...] }`
    (`inject` is informational metadata; the REAL activation deps come from the
    client bundle's exported `inject` array)
  - `exports["./client"]` → the built browser bundle
- `cordis.patch.yml` is a top-level YAML array: `- insert: [{id, name, config}]`.
  `name` MUST equal the package name (roster resolves `require.resolve('<name>/package.json')`).
- The browser bundle is a CJS closure factory:
  ```js
  window.__ModuleLoader__.load({ id: "<package-name>", factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    /* ...bundled code... */
    return module.exports;
  } });
  ```
  Built with tsdown@0.22 (cjs, platform browser), `external` = the platform
  module table (see 1.4), everything else inlined, sourcemap on, `clean: false`
  (must not wipe the tsc host output).
- Client plugin entry (`src/client/index.tsx`, MUST be `.tsx` to use JSX) exports:
  ```ts
  export const inject = ['slots', 'sessions', 'locale']  // cordis services to wait for
  export function apply(ctx: ClientContext): void { ... }
  ```
- HMR/dispose: every DOM node, React root, style tag, listener must be owned by
  `ctx.effect(() => disposer, 'label')`.

### 1.2 The host half

Even a client-only plugin needs a host row in the composition (the roster scans
Loader entries for `dsh.client` packages). The host module (`src/index.ts`, tsc
→ `lib/index.js`) must export a plugin body — a function or `{apply}` object
(cordis throws otherwise). Use a minimal:
```ts
import type { Context } from '@deepseek-ai/cordis'
export const name = 'dsh-conversation-outline'
export const inject: string[] = []
export function apply(ctx: Context): void {
  // client-only plugin: nothing to do on the host
}
```
(Keep a `Config` schema optional with a `z.object({})` default so the row config
is valid; follow the agent-teams shape.)

### 1.3 UI seams (verified in rc.6)

- `shell.overlay` — **the** seat for frame-wide floating surfaces:
  `kind: 'list'`, `scope: 'root'`, declared by `@deepseek-ai/dsh-client-ui-layout`.
  The layer is click-through by default; entries opt back into pointer events.
  Register with a fresh `id` (e.g. `dsh-conversation-outline.badge`), no `key`.
  Types: `@deepseek-ai/dsh-client-ui-layout/client` (module augmentation only).
  Render site verified in layout `lib/client.js` line ~236.
- Conversation scrollport: `[data-conversation-scroll]` (ui-conversation).
- Chat flow rows: each row div carries `data-chat-anchor-key=<node.key>` and
  `data-chat-flow-kind=<kind>` (ui-conversation `ChatNodeSeat`).
- Chat view tab id is `"chat"`, registered at `order: 0` (the FIRST tab in
  `[role="tablist"]`); trajectory is `order: 10`. Tab buttons are
  `button[role="tab"]` inside `[role="tablist"]`; clicking one calls
  `setView(id)`.
- Layout phases: the active app column has `[data-phase="active"]`; the CSS var
  `--dsh-sidebar-width` exists. Panel CSS may rely on these (see agent-teams
  panel CSS for the pattern), but do NOT depend on hashed class names of other
  packages.

### 1.4 Platform module table (externals for tsdown)

Verified `require(...)` calls inside official client bundles (rc.6):
`@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-runtime/client`,
`@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`,
`@deepseek-ai/dsh-client-ui-attachment`, `react`, `react/jsx-runtime`,
`react-dom`, `react-dom/client`.

Use these as `external` in tsdown. Do NOT value-import any other cross-plugin
package (purity gate; the browser module table would reject it). Type-only
imports are erased and allowed, e.g.
`import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'` and
`import type {} from '@deepseek-ai/dsh-client-ui-layout/client'` (declaration
merge).

### 1.5 Runtime data (verified)

- `ctx.sessions.list` is an `ObservableSnapshot<SessionListState>`:
  `getSnapshot()` → `{ current: SessionId | undefined, byId, ... }`, `subscribe`.
  (agent-teams passes it into its panel component and subscribes with
  `useSyncExternalStore`.)
- Current session object: `ctx.sessions.binding(sessionId)?.session` → `Session`
  with `subscribe(listener)` (uSES) and `getSnapshot()` →
  `ConversationSnapshot` with:
  - `chat.nodes` — Map-like `ChatNodeStore` (`get(key)`, `values()`)
  - `chat.order` — `readonly string[]` of node keys in flow order
  - `chat.legacy.nodes` — array form
  - `hasMore: boolean`, `loadingOlder: boolean`
  - `running`, `blank`, `openState`, `pending`, `queue`, ...
- `session.loadOlder()` — pages up (returns Promise, guarded by hasMore).
- Chat node shape (from `chatNode()` in ui-conversation):
  `{ key, kind, id, target: 'chat', anchorSeq, location, visibility, data }`.
  - user-message node: `kind: 'user'` (also `'steering'` for mid-turn steers,
    `'context'` for injected context). `data` =
    `{ kind, seq, time (unix ms), content: ContentBlock[], source }` where
    `ContentBlock` is `{ type: 'text', text } | { type: 'image', ... } | ...`.
  - `node.key` = `conversationContextKey(defKind, businessId)` with format
    `<kindLen>:<kind><id>` — e.g. `13:input-message<uuid>` for user messages.
    Use `node.key` verbatim for DOM lookup.
  - `node.location`: `{kind:'turn', turn: TurnLocation} | {kind:'step', turn, step} |
    {kind:'session'} | {kind:'unresolved'}`; turn number =
    `location.kind === 'step' ? location.turn.turn : location.kind === 'turn' ? location.turn.turn : undefined`.
- Locale: `ctx.locale.register(NS, { zh, en })` then `ctx.locale.bind(NS)` → `t(key)`.
- Open a session: `ctx.sessions.open(id)`.

### 1.6 Versions (match these in peerDependencies/devDependencies)

- `@deepseek-ai/cordis` 4.0.1 → peer `^4.0.1`
- `@deepseek-ai/dsh-client-runtime` 0.1.0-rc.6 → peer `^0.1.0-rc.6`
- `@deepseek-ai/dsh-client-ui-layout` 0.1.0-rc.6 → peer `^0.1.0-rc.6`
- `react` / `react-dom` 18.3.1 (in profile flat dir) → peer `^18.2.0`
- devDeps from public npm: `typescript@^5.9.3`, `tsdown@0.22.2`, `lightningcss@^1.33.0`,
  `@types/react@~18.3.1`, `@types/react-dom@^19.2.4`, `react@^18.2.0`,
  `react-dom@^18.2.0` (react needed as devDep for jsx types).
- Node `^22.19.0 || >=24` (engines).

### 1.7 Typecheck strategy (no registry access to @deepseek-ai)

`@deepseek-ai/*` packages are NOT re-installable from the public registry here;
the profile flat dir already has everything. Symlink (do NOT commit):
```sh
mkdir -p node_modules/@deepseek-ai
for p in cordis dsh-client-runtime dsh-client-ui-layout dsh-client-ui-slots dsh-client-ui-primitives dsh-client-locale dsh-client-web-react; do
  ln -sfn /Users/liziqing/.dsh/profiles/node_modules/@deepseek-ai/$p node_modules/@deepseek-ai/$p
done
```
Provide a `scripts/link-types.mjs` that does this (idempotent), and a
`pnpm dev:types` script. `.gitignore` must exclude `node_modules/` so the
symlinks never ship.

Two tsc programs (host and client) — see skill §6.1 / guide §3.1. The client
program compiles `src/client/**` with `lib: ["ES2022","DOM","DOM.Iterable"]`,
`jsx: "react-jsx"`, `types: []`, `allowImportingTsExtensions` +
`rewriteRelativeImportExtensions` (TS 5.7+). Output: host → `lib/`, client →
`lib/client/`. tsdown then bundles `lib/client/index.js` → `lib/client.js`
(with banner/footer wrapper + sourcemap; keep `lib/client/*.js` files — the
verify script imports the pure-logic module from there).

### 1.8 CSS

Keep it simple and HMR-safe: plain CSS string in a `.ts` module, injected in
`apply()` via `ctx.effect` with a `<style data-plugin="dsh-conversation-outline"
data-plugin-css="dsh-conversation-outline/panel.css">` tag (same pattern the
shipped bundles generate; HMR removes owned `style[data-plugin]` tags).
Use stable prefixed class names (`dso_*`) and DSH theme vars (`--dsw-alias-*`,
`--dsw-specific-*`, `--dsh-sidebar-width`) — see agent-teams' injected CSS for
the exact vars. CSS Modules via lightningcss is allowed but optional; the
manual style-tag approach is preferred for lower build risk.

---

## 2. Product spec (the panel)

### 2.1 Surfaces

1. **Badge** (always mounted, `shell.overlay` entry): fixed top-right
   (`top: 64px; right: 18px`), pill button showing an outline icon + question
   count for the CURRENT session; hidden (renders nothing) when there is no
   current session or the session is blank. Click toggles the panel. `aria-label`
   localized, `:focus-visible` outline, hover lift.
2. **Panel** (mounted with the badge entry, shown when open): fixed right
   (`right: 18px`, `top: 64px`), `width: min(360px, calc(100vw - 24px))`,
   `max-height: min(70dvh, ...)`, rounded 16px card, internal scroll, backdrop
   blur, uses DSH theme vars. Sections:
   - Header: title `会话大纲 / Outline` + count + close button (X).
   - Search input (placeholder localized; filters case-insensitively on the
     flattened question text).
   - Question list, **chronological** (flow order): one row per user question:
     - leading turn badge `#<turn>` (when the location yields a turn number),
     - 2-line clamped text preview,
     - trailing time `HH:MM` (from `node.data.time`, local time),
     - a copy button (copies the question text),
     - steering messages (kind `steering`) get a subtle `追问` / `steer` tag.
     Clicking a row = jump (2.2).
   - Footer: `加载更早 / Load older` button when `snapshot.hasMore` (disabled
     while `loadingOlder`); calls `session.loadOlder()`.
   - Empty state when no user messages in the loaded window.
3. Behavior rules:
   - Follows `sessions.list.current`; on session change the panel closes
     (navigate → collapse) and the badge re-derives count for the new session.
   - Panel open state is local component state; Escape closes; click on badge
     toggles.
   - Wide screens: optionally make the active column yield (padding-right) while
     the panel is open, exactly like agent-teams' `html[data-agent-teams-panel-open]
     [data-phase=active]` rule, using a root data attribute
     `data-dsh-outline-open`. Narrow screens (≤960px): no yield, panel is an
     overlay (position over content). Respect `prefers-reduced-motion`.
   - While a session is running, new user messages appear in the list live
     (the snapshot subscription covers it).

### 2.2 Jump-to-message algorithm (core feature)

On row click, given the target `node.key`:

1. Ensure the Chat view is active: read `document.querySelector('[role="tablist"]')`;
   if it exists and its active tab is not the first tab, click the first
   `button[role="tab"]` (chat is `order: 0` — always first; `setView("chat")`
   is idempotent, so clicking unconditionally is safe). If no tablist exists
   (e.g. hero phase), abort silently.
2. Wait for the target row to render: poll with `requestAnimationFrame` up to
   ~1500ms for `[data-chat-anchor-key="<node.key>"]` inside the chat list. The
   row is guaranteed to be in the loaded window (it comes from the snapshot),
   so this is a render-timing wait.
3. Scroll: `const scrollport = row.closest('[data-conversation-scroll]') ?? document.querySelector('[data-conversation-scroll]')`; compute
   `row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top`
   and set `scrollport.scrollTop += flowTop - 96` (leave ~96px headroom under
   the sticky header/composer area). Use smooth behavior unless
   `prefers-reduced-motion`.
4. Flash highlight: set `row.dataset.dshOutlineFlash = 'true'`; CSS
   `[data-dsh-outline-flash]{ animation: dso-flash 1.8s ease-out }` (a
   background/outline pulse using `--dsw-alias-state-business-primary`);
   remove the attribute after ~1.9s (timeout, cleaned on unmount).
5. Close the panel.

All DOM work must be guarded (elements may be missing) and cleaned up on
dispose (timeouts/RAF cancelled in the effect disposer).

### 2.3 Pure logic module (`src/client/outline.ts`, NO DOM, NO React)

Keep the derivations as importable pure functions so `scripts/verify.mjs` can
test them in Node by importing `lib/client/outline.js`:

- `flattenQuestionText(content: ContentBlock[]): string` — join text blocks,
  image blocks → `[图片]` / `[image]`, trim, collapse whitespace.
- `collectQuestions(snapshot): OutlineItem[]` — walk `snapshot.chat.order`,
  look up `snapshot.chat.nodes.get(key)`, keep `kind === 'user' | 'steering'`,
  skip empty text; item =
  `{ key, kind, seq, time, turn: number | undefined, text }`.
- `filterQuestions(items, query): OutlineItem[]` — case-insensitive substring.
- `formatTime(ms): string` — `HH:MM` local.
- `isJumpTargetRow(row: Element, key: string): boolean` — pure DOM predicate
  (used by the jump loop; testable with a fake object in node).

### 2.4 Localization

Namespace `dsh-conversation-outline`; keys at least: title, count (with
`{count}`), searchPlaceholder, empty, loadOlder, loadingOlder, copy, copied,
steerTag, jumpFailed (console only). zh-CN + en dictionaries, registered via
`ctx.locale.register(NS, { zh, en })`.

---

## 3. Repo layout (create exactly this)

```
dsh-conversation-outline/
├── package.json
├── cordis.patch.yml
├── tsconfig.json            # host program (excludes src/client)
├── tsconfig.client.json     # client program
├── tsdown.config.ts         # client bundle (wrapper banner/footer)
├── .gitignore               # node_modules, lib, *.log, .DS_Store
├── LICENSE                  # MIT (owner placeholder "your name")
├── README.md                # written by docs member
├── docs/
│   ├── implementation-spec.md   # this file
│   └── publishing-guide.md      # written by docs member
├── scripts/
│   ├── link-types.mjs       # symlink @deepseek-ai types (dev-only)
│   └── verify.mjs           # offline smoke: manifest/patch/bundle shape + pure logic
└── src/
    ├── index.ts             # minimal host apply
    ├── event-types.ts       # NOT needed (no custom events) — skip
    └── client/
        ├── index.tsx        # apply(): locale, style tag, shell.overlay registration, badge+panel
        ├── OutlinePanel.tsx # badge + panel components
        ├── outline.ts       # pure logic (2.3)
        ├── locales.ts       # zh/en dictionaries
        └── styles.ts        # CSS string + injectStyle(ctx) helper
```

### 3.1 package.json essentials

```jsonc
{
  "name": "dsh-conversation-outline",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": ["lib", "cordis.patch.yml", "README.md", "LICENSE"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-layout"], "platform": "web" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.client.json && tsdown",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.client.json --noEmit",
    "verify": "node scripts/verify.mjs",
    "dev:types": "node scripts/link-types.mjs"
  },
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.1",
    "@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-client-ui-layout": "^0.1.0-rc.6",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "~18.3.1",
    "@types/react-dom": "^19.2.4",
    "lightningcss": "^1.33.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tsdown": "0.22.2",
    "typescript": "^5.9.3"
  },
  "engines": { "node": "^22.19.0 || >=24" },
  "license": "MIT",
  "keywords": ["dsh", "dsh-plugin", "deepseek-harness", "conversation", "outline", "navigation"],
  "repository": { "type": "git", "url": "git+https://github.com/<owner>/dsh-conversation-outline.git" }
}
```

### 3.2 cordis.patch.yml

```yaml
- insert:
    - id: dsh-conversation-outline
      name: dsh-conversation-outline
      config: {}
```

### 3.3 tsdown.config.ts

Entry `{ client: 'lib/client/index.js' }`, outDir `lib`, `format: 'cjs'`,
`platform: 'browser'`, `dts: false`, `sourcemap: true`, `clean: false`,
`external` = the platform table (1.4), `define` NODE_ENV production,
`outputOptions`: `entryFileNames: 'client.js'`, `banner: 'window.__ModuleLoader__.load({ id: "dsh-conversation-outline", factory: (require) => {'`,
`footer: 'return module.exports; } });'`,
`intro: 'var module = { exports: {} }; var exports = module.exports;'`.
No CSS-modules plugin needed (manual style tag); keep a simple purity guard
plugin that throws on value-imports of `@deepseek-ai/*` packages outside the
external table.

---

## 4. Verification plan

### 4.1 Offline (engineer, then researcher re-runs)

1. `pnpm dev:types` (symlink), `pnpm install`, `pnpm typecheck`, `pnpm build`.
2. `node scripts/verify.mjs`:
   - manifest/exports/files consistency (every exported path exists);
   - `cordis.patch.yml` parses, first insert id/name match package name;
   - `lib/client.js` starts with the `window.__ModuleLoader__.load` wrapper;
   - no absolute machine paths inside `lib/` (grep `/Users/`);
   - pure-logic assertions from `lib/client/outline.js`: flatten text incl.
     image blocks, collect/filter/sort questions from a fixture snapshot,
     formatTime, turn extraction.

### 4.2 Integration (researcher)

Use a SCRATCH profile + temporary `DSH_HOME` + different port — NEVER touch the
running instance (the user's GUI at 127.0.0.1:3080 serves the current session;
restarting it would kill the session. Also do not start a replacement server on
3080).

1. `pnpm build` in the repo.
2. `tmp=$(mktemp -d)`; `DSH_HOME=$tmp npx -p @deepseek-ai/dsh dsh plugin --profile scratch add /Users/liziqing/Programs/agents/dsh-conversation-outline`
   (network: npm registry reachable for the dsh CLI; if the npx download fails,
   fall back to the already-installed CLI:
   `DSH_HOME=$tmp node /Users/liziqing/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh/lib/bin.js plugin --profile scratch add <path>`).
3. `DSH_HOME=$tmp <dsh> --profile scratch --dump-config` — assert the
   `dsh-conversation-outline` row appears with id/name/config.
4. Boot the scratch web instance on a free port (e.g. 3199) in the background:
   `DSH_HOME=$tmp <dsh> --profile scratch --port 3199` (check `--help` flags if
   needed), then `curl http://127.0.0.1:3199/` and assert
   `window.__DSH_BOOT__` contains an entry
   `{"id":"dsh-conversation-outline","url":"/plugins/dsh-conversation-outline/client.js"...}`,
   and `curl http://127.0.0.1:3199/plugins/dsh-conversation-outline/client.js`
   returns 200 with the loader wrapper. Kill the instance afterwards.
5. Report exact commands + outputs in the task output.

### 4.3 Review (reviewer)

Check against the skill checklist (§9 完成标准): minimal surface; manifest/
exports/patch/products consistent; inject boundaries; effect ownership
(dispose of root/DOM/style/listeners/timeouts/RAF); purity of client imports;
no host/client type pollution (two programs); a11y (aria, focus-visible,
Escape, reduced motion); the jump algorithm's failure modes (missing row,
missing tablist, session switched mid-jump, blank session); live updates;
load-older; i18n coverage. Mark findings as must-fix / nice-to-have and hand
back to the engineer for fixes.

### 4.4 Final (captain)

Install into the user's real web profile (`dsh plugin --profile web add <path>`)
— this only edits profile files; the plugin takes effect after the user
restarts their GUI (document this). Keep the scratch instance killed and temp
dirs cleaned.

---

## 5. Order of work

1. engineer: scaffold (3.x) → implement (2.x) → build green (4.1).
2. researcher: 4.2 integration.
3. reviewer: 4.3; engineer fixes must-fix findings.
4. docs: README (install via `dsh plugin --profile web add <pkg|github:...>`,
   usage, dev loop with HMR: `tsdown --watch` + `pnpm run dev:web` note,
   screenshots placeholder) + `docs/publishing-guide.md` (GitHub publish:
   create repo, license choice — MIT recommended, .gitignore, README, release
   workflow: npm publish with `prepublishOnly: pnpm build && pnpm verify`,
   GitHub-only install without npm, versioning, CHANGELOG, issues/PR templates,
   publishing scoped vs unscoped, npm name collision fallback to a scope).
5. captain: final assembly, install into web profile, wrap-up report.
