import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only module loads so their declaration merges apply in this program:
// - locale contributes `ctx.locale`;
// - the layout declares the `shell.overlay` SlotMap entry;
// - ui-renderer (0.1.5-rc.2 moved the slot service here) contributes `ctx.slots`;
// - the sessions controller contributes `ctx.sessions`.
// All are erased at compile time (purity gate).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { OutlinePanel } from './OutlinePanel.tsx'
import { NS, dictionaries } from './locales.ts'
import { injectStyle } from './styles.ts'

/**
 * Client entry (implementation-spec §1.1/§2.4): the browser half of the
 * plugin. Cordis services this fiber waits for before apply() runs.
 */
export const inject = ['slots', 'sessions', 'locale']

export function apply(ctx: ClientContext): void {
  // Locale dictionaries — the typed register form (both shipped locales
  // required, keys compile-checked). The disposer is owned by the fiber, so
  // HMR removes the namespace on unload.
  ctx.effect(
    () => ctx.locale.register(NS, dictionaries),
    'dsh-conversation-outline: locale',
  )

  // Panel CSS as an HMR-safe <style data-plugin> tag (effect-owned).
  injectStyle(ctx)

  // Right-edge rail + hover panel in the frame-wide overlay layer.
  // slots.inject waits for the layout's declaration of `shell.overlay` and
  // routes the registration (and its unload cascade) through this fiber.
  // `locale: NS` gives the component the typed `t` seat; the inject factory
  // passes the sessions service face.
  ctx.slots.inject(
    'shell.overlay',
    () =>
      ctx.slots.register(
        {
          name: 'shell.overlay',
          id: 'dsh-conversation-outline.rail',
          locale: NS,
          inject: () => ({ sessions: ctx.sessions }),
        },
        OutlinePanel,
      ),
  )
}
