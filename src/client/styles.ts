import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Outline rail + hover panel CSS (implementation-spec §1.8/§2.1, revised):
 * a thin right-edge rail (conversation minimap) that is always visible while
 * the session has questions, and a preview panel that expands on hover.
 * Plain CSS string injected via an HMR-safe
 * `<style data-plugin="dsh-conversation-outline" data-plugin-css="...">` tag.
 * Stable prefixed class names (`dso_*`), DSH theme vars (`--dsw-alias-*`) —
 * never hashed class names of other packages. No layout shift: the panel is a
 * pure overlay.
 */
export const panelCss = `
/* ---- Right-edge rail (always-visible minimap) --------------------------- */
.dso-rail {
  position: fixed;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 2147483000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 30px;
  max-height: 55vh;
  padding: 8px 10px;
  overflow: hidden;
  cursor: pointer;
}
.dso-rail-more {
  flex: none;
  font-size: 9px;
  font-weight: 600;
  line-height: 10px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}
.dso-bar {
  flex: none;
  width: 10px;
  height: 6px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: color-mix(in srgb, var(--dsw-alias-label-tertiary) 45%, transparent);
  cursor: pointer;
  transition: background 0.12s, transform 0.12s;
}
.dso-bar:hover {
  background: var(--dsw-alias-state-business-primary);
  transform: scaleX(1.35);
}
.dso-rail:focus-visible,
.dso-bar:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

/* ---- Hover-expanded preview panel --------------------------------------- */
.dso-panel {
  position: fixed;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  z-index: 2147483000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(340px, calc(100vw - 24px));
  max-height: min(70vh, 600px);
  overflow: hidden;
  border: 1px solid var(--dsw-alias-line-normal);
  border-radius: 16px;
  background: color-mix(in srgb, var(--dsw-alias-bg-module-platform) 92%, transparent);
  backdrop-filter: blur(20px);
  box-shadow: 0 16px 48px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  color: var(--dsw-alias-label-primary);
  animation: dso-panel-in 140ms ease-out;
}
@keyframes dso-panel-in {
  from { opacity: 0; transform: translateY(-50%) translateX(12px); }
  to { opacity: 1; transform: translateY(-50%) translateX(0); }
}

.dso-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--dsw-alias-line-normal);
}
.dso-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.dso-panel-count {
  flex: 1;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}
.dso-panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s;
}
.dso-panel-close:hover { background: var(--dsw-alias-interactive-bg-hover-solid); }

.dso-panel-close:focus-visible,
.dso-search:focus-visible,
.dso-row-main:focus-visible,
.dso-copy:focus-visible,
.dso-load-older:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

.dso-search {
  margin: 10px 12px 4px;
  box-sizing: border-box;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-line-normal);
  border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover-solid);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.dso-search::placeholder { color: var(--dsw-alias-label-tertiary); }

/* ---- Question list ------------------------------------------------------ */
.dso-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
}
/* Row container: two sibling buttons (jump + copy) — no nested interactive
   controls. Hover highlights the whole row. */
.dso-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: 10px;
  transition: background 0.12s;
}
.dso-row:hover { background: var(--dsw-alias-interactive-bg-hover-solid); }
.dso-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 2px 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}
.dso-row-main:hover { background: var(--dsw-alias-interactive-bg-hover-solid); }

.dso-turn {
  flex: none;
  min-width: 26px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--dsw-alias-bg-fill-business);
  color: var(--dsw-alias-label-on-fill);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
/* Single-line truncation: shows the opening words of each question —
   anything longer simply ellipsizes (per user request). */
.dso-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dso-time {
  flex: none;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
}
.dso-steer {
  flex: none;
  padding: 0 6px;
  border: 1px solid var(--dsw-alias-line-normal);
  border-radius: 999px;
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
}
.dso-copy {
  flex: none;
  padding: 2px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s, background 0.12s;
}
.dso-row:hover .dso-copy,
.dso-row:focus-within .dso-copy,
.dso-copy:focus-visible { opacity: 1; }
.dso-copy:hover { background: var(--dsw-alias-bg-fill-neutral); }
.dso-copy.dso-copied { color: var(--dsw-alias-state-success); }

.dso-empty {
  padding: 28px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--dsw-alias-label-tertiary);
}

/* ---- Footer / load older ------------------------------------------------ */
.dso-footer {
  display: flex;
  justify-content: center;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--dsw-alias-line-normal);
}
.dso-load-older {
  padding: 4px 14px;
  border: none;
  border-radius: 14px;
  background: var(--dsw-alias-interactive-bg-hover-solid);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dso-load-older:disabled { cursor: default; opacity: 0.6; }

/* ---- Jump flash highlight ----------------------------------------------- */
[data-dsh-outline-flash] {
  animation: dso-flash 1.8s ease-out;
}
@keyframes dso-flash {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--dsw-alias-state-business-primary) 50%, transparent);
    background-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);
  }
  70% {
    box-shadow: 0 0 0 6px transparent;
    background-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
    background-color: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dso-panel { animation: none; }
  .dso-bar { transition: none; }
  [data-dsh-outline-flash] { animation: none; }
}
`

/** Inject the style tag, owned by the client fiber (removed on dispose/HMR). */
export function injectStyle(ctx: ClientContext): void {
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-conversation-outline'
    tag.dataset.pluginCss = 'dsh-conversation-outline/panel.css'
    tag.textContent = panelCss
    document.head.appendChild(tag)
    return () => {
      tag.remove()
    }
  }, 'dsh-conversation-outline: panel css')
}
