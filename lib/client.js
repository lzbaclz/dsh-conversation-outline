window.__ModuleLoader__.load({
	id: "dsh-conversation-outline",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/client/outline.js
		/**
		* Pure logic for the conversation outline (implementation-spec §2.3).
		*
		* Deliberately has NO DOM access and NO React imports so scripts/verify.mjs can
		* import it directly in Node from the tsc output (lib/client/outline.js) and
		* assert the derivations offline.
		*
		* Input shapes are structural "lite" views of the runtime snapshot types
		* (@deepseek-ai/dsh-client-runtime/client) — the real objects are assignable
		* to them, and Node can import this module without the browser type graph.
		*/
		const IMAGE_PLACEHOLDER = "[image]";
		/**
		* Flatten message content blocks into a single display string: text blocks are
		* joined, image blocks become a placeholder, and whitespace is trimmed and
		* collapsed.
		*/
		function flattenQuestionText(content) {
			return content.map((block) => {
				if (block.type === "text") return block.text ?? "";
				if (block.type === "image") return IMAGE_PLACEHOLDER;
				return "";
			}).join(" ").trim().replace(/\s+/g, " ");
		}
		/** Turn number of a node location: step/turn → location.turn.turn, else undefined. */
		function turnOf(location) {
			if (!location) return void 0;
			if (location.kind === "step" || location.kind === "turn") return location.turn?.turn;
		}
		/**
		* Walk the chat flow in order, keep user/steering nodes, skip empty text, and
		* produce chronological outline items (spec §2.3).
		*/
		function collectQuestions(snapshot) {
			const items = [];
			for (const key of snapshot.chat.order) {
				const node = snapshot.chat.nodes.get(key);
				if (!node) continue;
				if (node.kind !== "user" && node.kind !== "steering") continue;
				const data = node.data;
				const text = flattenQuestionText(data?.content ?? []);
				if (!text) continue;
				items.push({
					key: node.key,
					kind: node.kind,
					seq: data?.seq ?? 0,
					time: data?.time ?? 0,
					turn: turnOf(node.location),
					text
				});
			}
			return items;
		}
		/** Case-insensitive substring filter over the flattened question text. */
		function filterQuestions(items, query) {
			const q = query.trim().toLowerCase();
			if (!q) return items;
			return items.filter((item) => item.text.toLowerCase().includes(q));
		}
		/** Local `HH:MM` from a unix-ms timestamp (spec §2.3). */
		function formatTime(ms) {
			const d = new Date(ms);
			return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
		}
		/** Pure DOM predicate for the jump loop: is this row the target node? */
		function isJumpTargetRow(row, key) {
			return row.getAttribute("data-chat-anchor-key") === key;
		}
		//#endregion
		//#region lib/client/OutlinePanel.js
		/** Stable getSnapshot value while no session is current (uSES contract). */
		const NO_SESSION = null;
		const JUMP_HEADROOM = 96;
		const JUMP_TIMEOUT_MS = 1500;
		const FLASH_MS = 1900;
		const COPIED_MS = 1500;
		/**
		* The conversation view's header tablist, scoped to the conversation root:
		* walk up from the scrollport's PARENT (the scrollport itself may contain
		* other tablists, e.g. the trajectory event-details tabs) and return the
		* nearest ancestor containing a `[role="tablist"]`. Never falls back to a
		* document-wide query, so other tablists (trajectory event details,
		* settings, cordis source viewer) are not hit.
		*/
		function findConversationTablist(scrollport) {
			let node = scrollport.parentElement;
			while (node) {
				const tablist = node.querySelector("[role=\"tablist\"]");
				if (tablist) return tablist;
				node = node.parentElement;
			}
			return null;
		}
		/** RAF that prunes itself from the tracking ref once it fires. */
		function scheduleRaf(rafRef, fn) {
			const id = requestAnimationFrame(() => {
				rafRef.current = rafRef.current.filter((x) => x !== id);
				fn();
			});
			rafRef.current.push(id);
		}
		/** Timeout that prunes itself from the tracking ref once it fires. */
		function scheduleTimeout(timeoutRef, fn, ms) {
			const id = window.setTimeout(() => {
				timeoutRef.current = timeoutRef.current.filter((x) => x !== id);
				fn();
			}, ms);
			timeoutRef.current.push(id);
		}
		function OutlinePanel({ sessions, useSessions, t }) {
			const current = useSessions((s) => s.current);
			const session = current ? sessions.binding(current)?.session : void 0;
			const snapshot = (0, react.useSyncExternalStore)((0, react.useCallback)((onChange) => session ? session.subscribe(onChange) : () => {}, [session]), (0, react.useCallback)(() => session ? session.getSnapshot() : NO_SESSION, [session]));
			const [open, setOpen] = (0, react.useState)(false);
			const [query, setQuery] = (0, react.useState)("");
			const [copiedKey, setCopiedKey] = (0, react.useState)(null);
			const timeoutsRef = (0, react.useRef)([]);
			const rafsRef = (0, react.useRef)([]);
			const flashedRowRef = (0, react.useRef)(null);
			const clearPending = (0, react.useCallback)(() => {
				for (const id of rafsRef.current) window.cancelAnimationFrame(id);
				for (const id of timeoutsRef.current) window.clearTimeout(id);
				rafsRef.current = [];
				timeoutsRef.current = [];
				if (flashedRowRef.current) {
					flashedRowRef.current.removeAttribute("data-dsh-outline-flash");
					flashedRowRef.current = null;
				}
			}, []);
			(0, react.useEffect)(() => {
				clearPending();
				setOpen(false);
			}, [current, clearPending]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKey = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [open]);
			(0, react.useEffect)(() => {
				const root = document.documentElement;
				if (open) root.setAttribute("data-dsh-outline-open", "");
				else root.removeAttribute("data-dsh-outline-open");
				return () => root.removeAttribute("data-dsh-outline-open");
			}, [open]);
			(0, react.useEffect)(() => () => clearPending(), [clearPending]);
			const allItems = (0, react.useMemo)(() => snapshot ? collectQuestions(snapshot) : [], [snapshot]);
			const items = (0, react.useMemo)(() => filterQuestions(allItems, query), [allItems, query]);
			const blank = snapshot?.blank ?? true;
			const hasMore = snapshot?.hasMore ?? false;
			const loadingOlder = snapshot?.loadingOlder ?? false;
			/** Find the chat row for a node key (pure predicate over DOM rows). */
			const findRow = (0, react.useCallback)((key) => {
				const rows = document.querySelectorAll("[data-chat-anchor-key]");
				for (const row of rows) if (isJumpTargetRow(row, key)) return row;
				return null;
			}, []);
			/** Scroll the row into view (96px headroom) and flash a highlight. */
			const flashAndScroll = (0, react.useCallback)((row) => {
				const scrollport = row.closest("[data-conversation-scroll]") ?? document.querySelector("[data-conversation-scroll]");
				if (scrollport) {
					const flowTop = row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top;
					const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
					scrollport.scrollTo({
						top: scrollport.scrollTop + flowTop - JUMP_HEADROOM,
						behavior: reduced ? "auto" : "smooth"
					});
				}
				const previous = flashedRowRef.current;
				if (previous && previous !== row) previous.removeAttribute("data-dsh-outline-flash");
				flashedRowRef.current = row;
				row.setAttribute("data-dsh-outline-flash", "true");
				scheduleTimeout(timeoutsRef, () => {
					if (flashedRowRef.current === row) {
						row.removeAttribute("data-dsh-outline-flash");
						flashedRowRef.current = null;
					}
				}, FLASH_MS);
			}, []);
			/** Jump-to-message algorithm (spec §2.2). */
			const jumpTo = (0, react.useCallback)((key) => {
				const scrollport = document.querySelector("[data-conversation-scroll]");
				if (!scrollport) return;
				const tablist = findConversationTablist(scrollport);
				if (tablist) {
					const firstTab = tablist.querySelector("button[role=\"tab\"]");
					if (firstTab) firstTab.click();
				}
				const deadline = Date.now() + JUMP_TIMEOUT_MS;
				const poll = () => {
					const row = findRow(key);
					if (row) {
						flashAndScroll(row);
						setOpen(false);
						return;
					}
					if (Date.now() < deadline) scheduleRaf(rafsRef, poll);
					else console.warn(t("jumpFailed"), { key });
				};
				scheduleRaf(rafsRef, poll);
			}, [
				findRow,
				flashAndScroll,
				t
			]);
			/** Copy a question's text (clipboard API with execCommand fallback). */
			const copyText = (0, react.useCallback)((text, key) => {
				const done = () => {
					setCopiedKey(key);
					scheduleTimeout(timeoutsRef, () => setCopiedKey((k) => k === key ? null : k), COPIED_MS);
				};
				const fallback = () => {
					try {
						const ta = document.createElement("textarea");
						ta.value = text;
						ta.setAttribute("readonly", "");
						ta.style.position = "fixed";
						ta.style.opacity = "0";
						document.body.appendChild(ta);
						ta.select();
						document.execCommand("copy");
						ta.remove();
						done();
					} catch {}
				};
				if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
				else fallback();
			}, []);
			if (!current || !session || blank) return null;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "dso-badge",
				"aria-label": t("title"),
				"aria-expanded": open,
				onClick: () => setOpen((v) => !v),
				children: [(0, react_jsx_runtime.jsx)("svg", {
					className: "dso-badge-icon",
					width: "14",
					height: "14",
					viewBox: "0 0 16 16",
					fill: "none",
					"aria-hidden": "true",
					children: (0, react_jsx_runtime.jsx)("path", {
						d: "M2.5 3.5h11M2.5 8h11M2.5 12.5h11",
						stroke: "currentColor",
						strokeWidth: "1.7",
						strokeLinecap: "round"
					})
				}), (0, react_jsx_runtime.jsx)("span", {
					className: "dso-badge-count",
					children: allItems.length
				})]
			}), open && (0, react_jsx_runtime.jsxs)("div", {
				className: "dso-panel",
				role: "region",
				"aria-label": t("title"),
				children: [
					(0, react_jsx_runtime.jsxs)("header", {
						className: "dso-panel-header",
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: "dso-panel-title",
								children: t("title")
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: "dso-panel-count",
								children: t("count", { count: allItems.length })
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dso-panel-close",
								"aria-label": t("close"),
								onClick: () => setOpen(false),
								children: "×"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("input", {
						className: "dso-search",
						type: "search",
						value: query,
						placeholder: t("searchPlaceholder"),
						"aria-label": t("searchPlaceholder"),
						onChange: (event) => setQuery(event.target.value)
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "dso-list",
						children: items.length === 0 ? (0, react_jsx_runtime.jsx)("div", {
							className: "dso-empty",
							children: t("empty")
						}) : items.map((item) => (0, react_jsx_runtime.jsxs)("div", {
							className: "dso-row",
							children: [(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "dso-row-main",
								onClick: () => jumpTo(item.key),
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dso-turn",
										children: item.turn !== void 0 ? `#${item.turn}` : ""
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dso-text",
										children: item.text
									}),
									item.kind === "steering" && (0, react_jsx_runtime.jsx)("span", {
										className: "dso-steer",
										children: t("steerTag")
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: "dso-time",
										children: formatTime(item.time)
									})
								]
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: copiedKey === item.key ? "dso-copy dso-copied" : "dso-copy",
								"aria-label": copiedKey === item.key ? t("copied") : t("copy"),
								onClick: () => copyText(item.text, item.key),
								children: copiedKey === item.key ? t("copied") : t("copy")
							})]
						}, item.key))
					}),
					hasMore && (0, react_jsx_runtime.jsx)("footer", {
						className: "dso-footer",
						children: (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dso-load-older",
							disabled: loadingOlder,
							onClick: () => {
								session.loadOlder();
							},
							children: loadingOlder ? t("loadingOlder") : t("loadOlder")
						})
					})
				]
			})] });
		}
		//#endregion
		//#region lib/client/locales.js
		const NS = "dsh-conversation-outline";
		const dictionaries = {
			zh: {
				title: "会话大纲",
				count: "{count} 个问题",
				searchPlaceholder: "搜索问题…",
				empty: "当前会话还没有问题",
				loadOlder: "加载更早",
				loadingOlder: "加载中…",
				copy: "复制",
				copied: "已复制",
				steerTag: "追问",
				close: "关闭",
				jumpFailed: "跳转失败：未找到对应消息"
			},
			en: {
				title: "Outline",
				count: "{count} questions",
				searchPlaceholder: "Search questions…",
				empty: "No questions in this conversation yet",
				loadOlder: "Load older",
				loadingOlder: "Loading…",
				copy: "Copy",
				copied: "Copied",
				steerTag: "steer",
				close: "Close",
				jumpFailed: "Jump failed: target message not found"
			}
		};
		//#endregion
		//#region lib/client/styles.js
		/**
		* Panel CSS (implementation-spec §1.8/§2.1): a plain CSS string injected via an
		* HMR-safe `<style data-plugin="dsh-conversation-outline"
		* data-plugin-css="dsh-conversation-outline/panel.css">` tag. Stable prefixed
		* class names (`dso_*`), DSH theme vars (`--dsw-alias-*`, `--dsh-sidebar-width`),
		* a root data attribute (`data-dsh-outline-open`) for the wide-screen column
		* yield — never hashed class names of other packages.
		*/
		const panelCss = `
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
		function injectStyle(ctx) {
			ctx.effect(() => {
				const tag = document.createElement("style");
				tag.dataset.plugin = "dsh-conversation-outline";
				tag.dataset.pluginCss = "dsh-conversation-outline/panel.css";
				tag.textContent = panelCss;
				document.head.appendChild(tag);
				return () => {
					tag.remove();
				};
			}, "dsh-conversation-outline: panel css");
		}
		//#endregion
		//#region lib/client/index.js
		/**
		* Client entry (implementation-spec §1.1/§2.4): the browser half of the
		* plugin. Cordis services this fiber waits for before apply() runs.
		*/
		const inject = [
			"slots",
			"sessions",
			"locale"
		];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, dictionaries), "dsh-conversation-outline: locale");
			injectStyle(ctx);
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-conversation-outline.badge",
				locale: NS,
				inject: () => ({ sessions: ctx.sessions })
			}, OutlinePanel));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map