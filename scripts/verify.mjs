#!/usr/bin/env node
/**
 * Offline smoke verification for dsh-conversation-outline (no network, no DSH
 * instance). Covers, per implementation-spec §4.1:
 *
 *   1. manifest/exports/files consistency — every exported path exists;
 *   2. cordis.patch.yml parses, its first insert has an id, and its name matches the package name;
 *   3. lib/client.js starts with the window.__ModuleLoader__.load wrapper;
 *   4. no absolute machine paths (/Users/...) inside lib/;
 *   5. pure-logic assertions from lib/client/outline.js (flatten text incl.
 *      image blocks, collect/filter questions, formatTime, turn extraction).
 *
 * Checks 3–5 depend on build artifacts (lib/) and report [skip] until
 * `pnpm build` has run; the manifest/patch checks always run.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
let failures = 0

function check(name, ok, detail = '') {
  const status = ok ? 'PASS' : 'FAIL'
  console.log(`[verify] ${status} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

function skip(name) {
  console.log(`[verify] SKIP ${name}`)
}

// --- 1. manifest / exports / files consistency ------------------------------
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const libBuilt = existsSync(join(root, 'lib'))

for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  if (typeof target === 'string') {
    check(`export "${subpath}" resolves to an existing file`, existsSync(join(root, target)), target)
    continue
  }
  const def = target?.default
  const types = target?.types
  if (def) {
    // default targets may point into lib/ before the first build — skip then
    if (def.replace(/^\.\//, '').startsWith('lib/') && !libBuilt) {
      skip(`export "${subpath}".default (lib/ not built yet)`)
    } else {
      check(`export "${subpath}".default exists`, existsSync(join(root, def)), def)
    }
  }
  if (types) {
    if (types.replace(/^\.\//, '').startsWith('lib/') && !libBuilt) {
      skip(`export "${subpath}".types (lib/ not built yet)`)
    } else {
      check(`export "${subpath}".types exists`, existsSync(join(root, types)), types)
    }
  }
}

const filesList = Array.isArray(pkg.files) ? pkg.files : []
for (const entry of filesList) {
  if (existsSync(join(root, entry))) {
    check(`files entry "${entry}" exists`, true, entry)
  } else if (entry === 'lib' && !libBuilt) {
    skip(`files entry "lib" (lib/ not built yet)`)
  } else {
    check(`files entry "${entry}" exists`, false, entry)
  }
}

check('dsh.bundle.patch points at an existing file', existsSync(join(root, pkg.dsh?.bundle?.patch ?? '')), pkg.dsh?.bundle?.patch)
check(
  'dsh.client declared with platform "web"',
  pkg.dsh?.client?.platform === 'web',
  `platform=${pkg.dsh?.client?.platform}`,
)
check('exports["./client"] declared', Boolean(pkg.exports?.['./client']), 'required by the roster scan')

// --- 2. cordis.patch.yml -----------------------------------------------------
const patchPath = join(root, 'cordis.patch.yml')
const patchText = readFileSync(patchPath, 'utf8')
const insertBlock = /^\s*-\s*insert\s*:\s*$/m.test(patchText)
check('cordis.patch.yml is a top-level "insert" array', insertBlock)
const idMatch = /^\s*-\s*id\s*:\s*(.+?)\s*$/m.exec(patchText)
const nameMatch = /^\s*name\s*:\s*(.+?)\s*$/m.exec(patchText)
const firstId = idMatch?.[1]?.replace(/^['"]|['"]$/g, '')
const firstName = nameMatch?.[1]?.replace(/^['"]|['"]$/g, '')
// The row `id` is a stable composition-tree identity (any unique string); the
// row `name` is what Node resolves, so only `name` must equal the package name.
check('patch first insert has an id', typeof firstId === 'string' && firstId.length > 0, `id=${firstId}`)
check('patch first insert name matches package name', firstName === pkg.name, `name=${firstName}`)

// --- 3. bundle shape + purity -----------------------------------------------
// Platform module table (spec §1.4): the ONLY specifiers the browser bundle
// may require at runtime.
const PLATFORM_EXTERNALS = new Set([
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
])
const clientBundle = join(root, 'lib', 'client.js')
if (existsSync(clientBundle)) {
  const text = readFileSync(clientBundle, 'utf8')
  const head = text.slice(0, 300)
  check(
    'lib/client.js starts with the module-loader wrapper',
    head.startsWith('window.__ModuleLoader__.load'),
    head.slice(0, 60).replace(/\s+/g, ' '),
  )
  check(
    'bundle wrapper id matches package name',
    head.includes(`id: "${pkg.name}"`),
    `id: "${pkg.name}"`,
  )
  check(
    'bundle wrapper footer present',
    text.replace(/\s+/g, ' ').includes('return module.exports; } });'),
    'return module.exports; } });',
  )
  const requires = [...text.matchAll(/require\((["'])([^"']+)\1\)/g)].map((m) => m[2])
  const purityOffenders = requires.filter((spec) => !PLATFORM_EXTERNALS.has(spec))
  check(
    'bundle requires only platform externals',
    purityOffenders.length === 0,
    purityOffenders.join(', ') || `${requires.length} require(s), all allowed`,
  )
} else {
  skip('bundle shape (lib/client.js not built yet)')
}

// --- 4. no absolute machine paths inside lib/ --------------------------------
const libDir = join(root, 'lib')
if (existsSync(libDir)) {
  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (statSync(full).isFile() && /\.(js|mjs|cjs|map)$/.test(entry)) {
        const text = readFileSync(full, 'utf8')
        if (/\/Users\//.test(text)) offenders.push(relative(root, full))
      }
    }
  }
  walk(libDir)
  check('no /Users/ absolute paths inside lib/', offenders.length === 0, offenders.join(', '))
} else {
  skip('machine-path scan (lib/ not built yet)')
}

// --- 5. pure-logic assertions (lib/client/outline.js) -------------------------
const outlineJs = join(root, 'lib', 'client', 'outline.js')
if (existsSync(outlineJs)) {
  const {
    flattenQuestionText,
    collectQuestions,
    filterQuestions,
    formatTime,
    isJumpTargetRow,
  } = await import(pathToFileURL(outlineJs).href)

  // flatten: joins text blocks, replaces image blocks with a placeholder,
  // trims and collapses whitespace.
  const flat = flattenQuestionText([
    { type: 'text', text: '  hello ' },
    { type: 'image', src: 'x' },
    { type: 'text', text: ' world\n\nnext' },
  ])
  check('flattenQuestionText joins text + image placeholder + collapses whitespace', flat === 'hello [image] world next', JSON.stringify(flat))

  // collect/filter from a fixture snapshot (flow order preserved, turn extracted).
  const fixture = {
    chat: {
      order: ['u1', 'a1', 'u2', 's1', 'u3'],
      nodes: new Map([
        ['u1', { key: 'u1', kind: 'user', data: { kind: 'user', seq: 1, time: 1_700_000_000_000, content: [{ type: 'text', text: 'first' }] }, location: { kind: 'turn', turn: { turn: 1 } } }],
        ['a1', { key: 'a1', kind: 'assistant', data: { kind: 'assistant', seq: 2, content: [] } }],
        ['u2', { key: 'u2', kind: 'user', data: { kind: 'user', seq: 3, time: 1_700_000_060_000, content: [{ type: 'text', text: '  second  question  ' }] }, location: { kind: 'step', turn: { turn: 2 }, step: 0 } }],
        ['s1', { key: 's1', kind: 'steering', data: { kind: 'steering', seq: 4, time: 1_700_000_120_000, content: [{ type: 'text', text: 'steer' }] }, location: { kind: 'turn', turn: { turn: 2 } } }],
        ['u3', { key: 'u3', kind: 'user', data: { kind: 'user', seq: 5, time: 1_700_000_180_000, content: [] } }],
      ]),
    },
  }
  const collected = collectQuestions(fixture)
  check('collectQuestions keeps user+steering in flow order, skips empty text', collected.length === 3, `count=${collected.length}`)
  check('collectQuestions extracts turn numbers (turn + step)', collected[0]?.turn === 1 && collected[1]?.turn === 2 && collected[2]?.turn === 2, JSON.stringify(collected.map((i) => i.turn)))
  check('collectQuestions flattens question text', collected[1]?.text === 'second question', JSON.stringify(collected[1]?.text))

  const filtered = filterQuestions(collected, 'SECOND')
  check('filterQuestions is case-insensitive substring', filtered.length === 1 && filtered[0]?.key === 'u2', filtered.map((i) => i.key).join(','))

  check('formatTime yields HH:MM local', /^\d{2}:\d{2}$/.test(formatTime(1_700_000_000_000)), formatTime(1_700_000_000_000))

  const fakeRow = { getAttribute: (name) => (name === 'data-chat-anchor-key' ? 'u2' : null) }
  check('isJumpTargetRow matches data-chat-anchor-key', isJumpTargetRow(fakeRow, 'u2') === true && isJumpTargetRow(fakeRow, 'u9') === false)
} else {
  skip('pure-logic assertions (lib/client/outline.js not built yet)')
}

console.log(failures === 0 ? '\n[verify] all checks passed ✔' : `\n[verify] ${failures} check(s) FAILED ✘`)
process.exit(failures === 0 ? 0 : 1)
