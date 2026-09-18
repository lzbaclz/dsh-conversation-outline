import { OutlinePanel } from "./OutlinePanel.js";
import { NS, dictionaries } from "./locales.js";
import { injectStyle } from "./styles.js";
/**
 * Client entry (implementation-spec §1.1/§2.4): the browser half of the
 * plugin. Cordis services this fiber waits for before apply() runs.
 *
 * `uiConversation` is declared here on purpose: cordis guards `ctx` with a
 * Proxy that THROWS on an undeclared service read, and the rail reaches the
 * session's Chat store through it. Reading it off another context (e.g.
 * `binding.ctx.uiConversation`) is not allowed even after declaring it — the
 * guard is per-context, so `apply` captures it from its own ctx below.
 */
export const inject = ['slots', 'sessions', 'locale', 'uiConversation'];
/**
 * The conversation service captured from this plugin's own context. Set in
 * `apply`; `undefined` only before activation, which the resolver tolerates.
 */
let pluginUiConversation;
export function apply(ctx) {
    pluginUiConversation = ctx.uiConversation;
    // Locale dictionaries — the typed register form (both shipped locales
    // required, keys compile-checked). The disposer is owned by the fiber, so
    // HMR removes the namespace on unload.
    ctx.effect(() => ctx.locale.register(NS, dictionaries), 'dsh-conversation-outline: locale');
    // Panel CSS as an HMR-safe <style data-plugin> tag (effect-owned).
    injectStyle(ctx);
    // Right-edge rail + hover panel in the frame-wide overlay layer.
    // slots.inject waits for the layout's declaration of `shell.overlay` and
    // routes the registration (and its unload cascade) through this fiber.
    // `locale: NS` gives the component the typed `t` seat; the inject factory
    // passes the services the component reads.
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-conversation-outline.rail',
        locale: NS,
        inject: () => ({ sessions: ctx.sessions, resolveChatFeed }),
    }, OutlinePanel));
}
/**
 * Resolve one session binding's Chat feed through the conversation service.
 *
 * Returns `undefined` for every failure mode — no service (host without
 * ui-conversation), no binding (no current session), no `chat` target — so the
 * rail renders nothing instead of throwing inside its slot. Throwing here is
 * especially costly: the slot error boundary swallows it and the plugin simply
 * disappears with no visible error.
 */
export function resolveChatFeed(binding) {
    if (binding === null || binding === undefined)
        return undefined;
    return pluginUiConversation?.binding?.(binding)?.target?.('chat');
}
