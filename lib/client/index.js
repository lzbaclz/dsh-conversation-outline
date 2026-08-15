import { OutlinePanel } from "./OutlinePanel.js";
import { NS, dictionaries } from "./locales.js";
import { injectStyle } from "./styles.js";
/**
 * Client entry (implementation-spec §1.1/§2.4): the browser half of the
 * plugin. Cordis services this fiber waits for before apply() runs.
 */
export const inject = ['slots', 'sessions', 'locale'];
export function apply(ctx) {
    // Locale dictionaries — the typed register form (both shipped locales
    // required, keys compile-checked). The disposer is owned by the fiber, so
    // HMR removes the namespace on unload.
    ctx.effect(() => ctx.locale.register(NS, dictionaries), 'dsh-conversation-outline: locale');
    // Panel CSS as an HMR-safe <style data-plugin> tag (effect-owned).
    injectStyle(ctx);
    // Badge + panel in the frame-wide overlay layer. slots.inject waits for the
    // layout's declaration of `shell.overlay` and routes the registration (and
    // its unload cascade) through this fiber. `locale: NS` gives the component
    // the typed `t` seat; the inject factory passes the sessions service face.
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-conversation-outline.badge',
        locale: NS,
        inject: () => ({ sessions: ctx.sessions }),
    }, OutlinePanel));
}
