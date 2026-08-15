#!/usr/bin/env node
/**
 * Dev-only type linking for dsh-conversation-outline.
 *
 * The @deepseek-ai/* packages are NOT re-installable from the public npm
 * registry (pre-release), so we symlink the exact installed versions from the
 * web profile's flat node_modules into this repo's node_modules so both tsc
 * programs can typecheck against the real runtime. The symlinks are gitignored
 * (node_modules/) and never ship.
 *
 * Also runs `pnpm install` (idempotent) to fetch the public devDependencies
 * (typescript, tsdown, lightningcss, react, ...). pnpm runs FIRST so it never
 * prunes the manually created @deepseek-ai symlinks.
 *
 * Usage: `pnpm dev:types` (or `node scripts/link-types.mjs`).
 * Env override: DSH_PROFILE_NODE_MODULES=<dir> to point at another flat dir.
 */
import { mkdirSync, existsSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const profileFlat =
  process.env.DSH_PROFILE_NODE_MODULES ?? '/Users/liziqing/.dsh/profiles/node_modules'

const packages = [
  'cordis',
  'dsh-client-runtime',
  'dsh-client-ui-layout',
  'dsh-client-ui-slots',
  'dsh-client-ui-primitives',
  'dsh-client-locale',
  'dsh-client-web-react',
]

// 1) Install public devDeps FIRST — pnpm manages node_modules and would prune
//    untracked entries created before it runs.
console.log('[link-types] running `pnpm install` for public devDeps…')
try {
  execSync('pnpm install', { cwd: root, stdio: 'inherit' })
} catch (error) {
  // Fall back to not auto-installing peer deps if the plain install tries to
  // fetch @deepseek-ai peers (they are symlinked below, not registry packages).
  console.warn('[link-types] plain `pnpm install` failed, retrying with auto-install-peers=false')
  execSync('pnpm install --config.auto-install-peers=false', { cwd: root, stdio: 'inherit' })
}

// 2) Symlink @deepseek-ai packages (idempotent).
const targetDir = join(root, 'node_modules', '@deepseek-ai')
mkdirSync(targetDir, { recursive: true })

for (const pkg of packages) {
  const target = join(profileFlat, '@deepseek-ai', pkg)
  const link = join(targetDir, pkg)
  if (!existsSync(target)) {
    console.warn(`[link-types] WARN: source package not found, skipping: ${target}`)
    continue
  }
  if (existsSync(link)) {
    rmSync(link, { recursive: true, force: true })
  }
  symlinkSync(target, link, 'dir')
  console.log(`[link-types] linked ${pkg} -> ${target}`)
}

console.log('[link-types] done.')
