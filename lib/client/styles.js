/**
 * Panel CSS (implementation-spec §1.8/§2.1): a plain CSS string injected via an
 * HMR-safe `<style data-plugin="dsh-conversation-outline"
 * data-plugin-css="dsh-conversation-outline/panel.css">` tag. Stable prefixed
 * class names (`dso_*`), DSH theme vars (`--dsw-alias-*`, `--dsh-sidebar-width`),
 * a root data attribute (`data-dsh-outline-open`) for the wide-screen column
 * yield — never hashed class names of other packages.
 */
export const panelCss = `
:root {
  --dso-panel-width: min(360px, calc(100vw - 24px));
  --dso-panel-right: 18px;
  --dso-panel-top: 64px;
  --dso-panel-gap: 14px;
  --dso-panel-shift: calc(var(--dso-panel-width) + var(--dso-panel-right) + var(--dso-panel-gap));
}

/* Wide screens: the active app column yields to the open panel (like
   agent-teams' html[data-*-panel-open] [data-phase=active] rule). */
html[data-dsh-outline-open] [data-phase='active'] {
  box-sizing: border-box;
  padding-right: var(--dso-panel-shift);
}
[data-phase='active'] {
  transition: padding-right 360ms cubic-bezier(0.22, 1, 0.36, 1);
}
@media (max-width: 960px) {
  /* Narrow screens: no yield, the panel is a plain overlay. */
  html[data-dsh-outline-open] [data-phase='active'] { padding-right: 0; }
}

/* ---- Badge ------------------------------------------------------------ */
.dso-badge {
  position: fixed;
  top: var(--dso-panel-top);
  right: var(--dso-panel-right);
  z-index: 2147483000;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 13px;
  border: 1px solid var(--dsw-alias-line-normal);
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-bg-module-platform) 92%, transparent);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 28px color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.12s;
}
.dso-badge:hover { border-color: var(--dsw-alias-line-strong); transform: translateY(-1px); }
.dso-badge:active { transform: translateY(0) scale(0.98); }
.dso-badge:focus-visible,
.dso-panel-close:focus-visible,
.dso-search:focus-visible,
.dso-row-main:focus-visible,
.dso-copy:focus-visible,
.dso-load-older:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.dso-badge-icon { display: inline-flex; flex: none; color: var(--dsw-alias-state-business-primary); }
.dso-badge-count { font-variant-numeric: tabular-nums; }

/* ---- Panel ------------------------------------------------------------ */
.dso-panel {
  position: fixed;
  top: var(--dso-panel-top);
  right: var(--dso-panel-right);
  z-index: 2147483000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: var(--dso-panel-width);
  max-height: min(70dvh, 640px);
  overflow: hidden;
  border: 1px solid var(--dsw-alias-line-normal);
  border-radius: 16px;
  background: color-mix(in srgb, var(--dsw-alias-bg-module-platform) 92%, transparent);
  backdrop-filter: blur(20px);
  box-shadow: 0 16px 48px color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
  color: var(--dsw-alias-label-primary);
  animation: dso-panel-in 160ms ease-out;
}
@keyframes dso-panel-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to { opacity: 1; transform: none; }
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

/* ---- Question list ---------------------------------------------------- */
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
  align-items: flex-start;
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
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}
.dso-row-main:hover { background: var(--dsw-alias-interactive-bg-hover-solid); }

.dso-turn {
  flex: none;
  min-width: 28px;
  height: 18px;
  margin-top: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--dsw-alias-bg-fill-business);
  color: var(--dsw-alias-label-on-fill);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.dso-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dso-time {
  flex: none;
  margin-top: 1px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
}
.dso-steer {
  flex: none;
  margin-top: 1px;
  padding: 1px 7px;
  border: 1px solid var(--dsw-alias-line-normal);
  border-radius: 999px;
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
}
.dso-copy {
  flex: none;
  align-self: flex-start;
  margin: 6px 8px 0 0;
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

/* ---- Footer / load older ---------------------------------------------- */
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

/* ---- Jump flash highlight --------------------------------------------- */
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
  [data-phase='active'] { transition: none; }
  .dso-panel { animation: none; }
  [data-dsh-outline-flash] { animation: none; }
  .dso-badge { transition: none; }
}
`;
/** Inject the style tag, owned by the client fiber (removed on dispose/HMR). */
export function injectStyle(ctx) {
    ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-conversation-outline';
        tag.dataset.pluginCss = 'dsh-conversation-outline/panel.css';
        tag.textContent = panelCss;
        document.head.appendChild(tag);
        return () => {
            tag.remove();
        };
    }, 'dsh-conversation-outline: panel css');
}
