import { defineConfig } from 'tsdown'

/**
 * Client bundle build — replicates the DSH client bundle protocol
 * (packages/client/tsdown.client.ts): tsc emits lib/client/*.js, tsdown rolls
 * it into a single CJS closure-factory that registers itself with the browser
 * module loader:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *
 * Everything except the platform module table is inlined; `clean: false` so the
 * host tsc output in lib/ is never wiped.
 */
/**
 * Platform module table of the browser loader (DSH 0.1.5-rc.2). Extracted from
 * the shipped client bundles' `require(...)` calls: the 0.1.5 line replaced
 * `dsh-client-runtime/client` with `dsh-client-store`, dropped
 * `dsh-client-ui-attachment`, and added `dsh-api-gateway/client` plus
 * `dsh-client-ui-dockkit`.
 */
const PLATFORM_EXTERNALS = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
  '@deepseek-ai/dsh-api-gateway/client',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
]

export default defineConfig({
  name: '@chestnut23/dsh-conversation-outline/client',
  entry: { client: 'lib/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: PLATFORM_EXTERNALS,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    // The loader id MUST equal the package name: the browser roster keys the
    // module record by it.
    banner: 'window.__ModuleLoader__.load({ id: "@chestnut23/dsh-conversation-outline", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
  plugins: [
    {
      // Purity gate: the browser module table only answers the platform seed
      // modules. Any other @deepseek-ai value-import that survived tsc (type-only
      // imports are erased) would be inlined (duplicate instance) or rejected at
      // runtime — fail the build instead. Type-only imports never reach here.
      name: 'dsh-conversation-outline-purity',
      resolveId(source: string) {
        if (source.startsWith('@deepseek-ai/') && !PLATFORM_EXTERNALS.includes(source)) {
          throw new Error(
            `[purity] value-import of "${source}" is not in the platform module table. ` +
              'Type-only imports are erased by tsc; runtime cross-plugin collaboration must go through cordis services.',
          )
        }
        return null
      },
    },
  ],
})
