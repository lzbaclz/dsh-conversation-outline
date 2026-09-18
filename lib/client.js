window.__ModuleLoader__.load({
	id: "@chestnut23/dsh-conversation-outline",
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
		/**
		* Resolve a Chat store snapshot into the flow to walk.
		*
		* Never throws: a snapshot that has not produced `order` + `nodes` yet (or a
		* host that handed over something else entirely) yields `undefined`, so the
		* caller renders an empty rail instead of crashing its slot.
		*/
		function resolveOutlineFlow(snapshot) {
			if (snapshot === null || snapshot === void 0) return void 0;
			if (Array.isArray(snapshot.order) && snapshot.nodes !== void 0) return {
				order: snapshot.order,
				nodes: snapshot.nodes
			};
		}
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
			const flow = resolveOutlineFlow(snapshot);
			if (flow === void 0) return [];
			const items = [];
			for (const key of flow.order) {
				const node = flow.nodes.get(key);
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
		/** Attributes the chat flow renders a node's identity under. */
		const JUMP_KEY_ATTRIBUTES = ["data-chat-anchor-key", "data-chat-flow-key"];
		/**
		* Pure DOM predicate for the jump loop: is this row the target node?
		*
		* Exact match only, against either attribute the flow wrapper carries — the
		* platform's own anchor lookup uses `data-chat-anchor-key`, and its sibling
		* `data-chat-flow-key` holds the same value, so a row is still found when only
		* one of the two is present.
		*/
		function isJumpTargetRow(row, key) {
			return JUMP_KEY_ATTRIBUTES.some((attribute) => row.getAttribute(attribute) === key);
		}
		//#endregion
		//#region lib/client/OutlinePanel.js
		/**
		* Stable getSnapshot value while no session (or no feed) is current (uSES
		* contract): an empty flow, so the rail renders nothing instead of throwing on
		* a shape the host did not provide.
		*/
		const NO_FLOW = { order: [] };
		const JUMP_HEADROOM = 96;
		const JUMP_TIMEOUT_MS = 1500;
		const FLASH_MS = 1900;
		const COPIED_MS = 1500;
		/** Grace period before the hover panel collapses (lets the pointer travel). */
		const COLLAPSE_DELAY_MS = 240;
		/** Rail capacity; older questions fold into the "+N" marker. */
		const MAX_BARS = 60;
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
		function OutlinePanel({ sessions, resolveChatFeed, t }) {
			const current = (0, react.useSyncExternalStore)((0, react.useCallback)((onChange) => sessions.list.subscribe(onChange), [sessions]), (0, react.useCallback)(() => sessions.list.getSnapshot(), [sessions])).current;
			const binding = (0, react.useMemo)(() => current ? sessions.binding(current) : void 0, [sessions, current]);
			const session = binding?.session;
			const chat = (0, react.useMemo)(() => resolveChatFeed(binding), [resolveChatFeed, binding]);
			const chatSnapshot = (0, react.useSyncExternalStore)((0, react.useCallback)((onChange) => chat ? chat.subscribe(onChange) : () => {}, [chat]), (0, react.useCallback)(() => chat ? chat.getSnapshot() : NO_FLOW, [chat]));
			const snapshot = (0, react.useMemo)(() => ({
				...chatSnapshot,
				hasMore: session?.getSnapshot?.().hasMore ?? false,
				loadingOlder: session?.getSnapshot?.().loadingOlder ?? false
			}), [chatSnapshot, session]);
			const [pinned, setPinned] = (0, react.useState)(false);
			const [hovered, setHovered] = (0, react.useState)(false);
			const open = pinned || hovered;
			const [query, setQuery] = (0, react.useState)("");
			const [copiedKey, setCopiedKey] = (0, react.useState)(null);
			const [jumpFailed, setJumpFailed] = (0, react.useState)(null);
			const timeoutsRef = (0, react.useRef)([]);
			const rafsRef = (0, react.useRef)([]);
			const flashedRowRef = (0, react.useRef)(null);
			const collapseTimerRef = (0, react.useRef)(null);
			const railRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const clearPending = (0, react.useCallback)(() => {
				for (const id of rafsRef.current) window.cancelAnimationFrame(id);
				for (const id of timeoutsRef.current) window.clearTimeout(id);
				rafsRef.current = [];
				timeoutsRef.current = [];
				if (collapseTimerRef.current !== null) {
					window.clearTimeout(collapseTimerRef.current);
					collapseTimerRef.current = null;
				}
				if (flashedRowRef.current) {
					flashedRowRef.current.removeAttribute("data-dsh-outline-flash");
					flashedRowRef.current = null;
				}
			}, []);
			/** Close the panel from any trigger: drop the pin and the hover preview. */
			const closePanel = (0, react.useCallback)(() => {
				setPinned(false);
				setHovered(false);
				cancelCollapseRef.current();
			}, []);
			(0, react.useEffect)(() => {
				clearPending();
				setPinned(false);
				setHovered(false);
				setJumpFailed(null);
			}, [current, clearPending]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKey = (event) => {
					if (event.key === "Escape") closePanel();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [open, closePanel]);
			(0, react.useEffect)(() => {
				if (!pinned) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (!(target instanceof Node)) return;
					if (railRef.current?.contains(target) || panelRef.current?.contains(target)) return;
					closePanel();
				};
				window.addEventListener("mousedown", onPointerDown);
				return () => window.removeEventListener("mousedown", onPointerDown);
			}, [pinned, closePanel]);
			(0, react.useEffect)(() => clearPending, [clearPending]);
			const allItems = (0, react.useMemo)(() => collectQuestions(snapshot), [snapshot]);
			const items = (0, react.useMemo)(() => filterQuestions(allItems, query), [allItems, query]);
			const hasMore = snapshot?.hasMore ?? false;
			const loadingOlder = snapshot?.loadingOlder ?? false;
			const cancelCollapse = (0, react.useCallback)(() => {
				if (collapseTimerRef.current !== null) {
					window.clearTimeout(collapseTimerRef.current);
					collapseTimerRef.current = null;
				}
			}, []);
			const cancelCollapseRef = (0, react.useRef)(cancelCollapse);
			cancelCollapseRef.current = cancelCollapse;
			const scheduleCollapse = (0, react.useCallback)(() => {
				cancelCollapse();
				collapseTimerRef.current = window.setTimeout(() => {
					collapseTimerRef.current = null;
					if (railRef.current?.matches(":hover") || panelRef.current?.matches(":hover")) return;
					setHovered(false);
				}, COLLAPSE_DELAY_MS);
			}, [cancelCollapse]);
			/** Pointer entered the rail or the panel: cancel a pending collapse, preview. */
			const onEnter = (0, react.useCallback)(() => {
				cancelCollapse();
				setHovered(true);
			}, [cancelCollapse]);
			/** Pointer left: let the grace period decide, unless the panel is pinned. */
			const onLeave = (0, react.useCallback)(() => {
				if (pinned) return;
				scheduleCollapse();
			}, [pinned, scheduleCollapse]);
			/** A click on the rail (or any bar) opens the panel and keeps it open. */
			const togglePin = (0, react.useCallback)(() => {
				cancelCollapse();
				setPinned((value) => !value);
				setHovered(true);
			}, [cancelCollapse]);
			/** The panel's own controls: clicking inside never closes it. */
			const keepOpen = (0, react.useCallback)(() => {
				cancelCollapse();
				setHovered(true);
			}, [cancelCollapse]);
			/** Find the chat row for a node key (pure predicate over DOM rows). */
			const findRow = (0, react.useCallback)((key) => {
				const rows = document.querySelectorAll("[data-chat-anchor-key], [data-chat-flow-key]");
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
				if (flashedRowRef.current && flashedRowRef.current !== row) flashedRowRef.current.removeAttribute("data-dsh-outline-flash");
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
			const jumpTo = (0, react.useCallback)((key, label) => {
				const scrollport = document.querySelector("[data-conversation-scroll]");
				if (!scrollport) return;
				setJumpFailed(null);
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
						closePanel();
						return;
					}
					if (Date.now() < deadline) scheduleRaf(rafsRef, poll);
					else {
						console.warn(t("jumpFailed"), { key });
						setJumpFailed(label ?? key);
					}
				};
				scheduleRaf(rafsRef, poll);
			}, [
				findRow,
				flashAndScroll,
				t,
				closePanel
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
			if (!current || !session || allItems.length === 0) return null;
			const start = Math.max(0, allItems.length - MAX_BARS);
			const bars = allItems.slice(start);
			const overflow = start;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("div", {
				ref: railRef,
				className: "dso-rail",
				role: "group",
				"aria-label": t("title"),
				tabIndex: 0,
				onMouseEnter: onEnter,
				onMouseLeave: onLeave,
				onFocus: onEnter,
				onBlur: onLeave,
				onClick: (event) => {
					if (event.target === event.currentTarget || event.target instanceof HTMLSpanElement) togglePin();
				},
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						togglePin();
					}
				},
				"data-dso-open": open ? "true" : void 0,
				children: [overflow > 0 && (0, react_jsx_runtime.jsxs)("span", {
					className: "dso-rail-more",
					"aria-label": t("moreBars", { count: overflow }),
					children: ["+", overflow]
				}), bars.map((item, index) => (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dso-bar",
					"aria-label": t("barLabel", { n: start + index + 1 }),
					onClick: (event) => {
						event.stopPropagation();
						setPinned(true);
						setHovered(true);
						jumpTo(item.key, item.text);
					}
				}, item.key))]
			}), open && (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				className: "dso-panel",
				role: "region",
				"aria-label": t("title"),
				"data-dso-pinned": pinned ? "true" : void 0,
				onMouseEnter: onEnter,
				onMouseLeave: onLeave,
				onFocus: onEnter,
				onBlur: onLeave,
				onMouseDown: keepOpen,
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
								onClick: closePanel,
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
								onClick: () => jumpTo(item.key, item.text),
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
					jumpFailed !== null && (0, react_jsx_runtime.jsx)("p", {
						className: "dso-jump-failed",
						role: "status",
						"data-dso-jump-failed": "true",
						children: t("jumpFailed")
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
				jumpFailed: "跳转失败：未找到对应消息",
				barLabel: "跳到第 {n} 个问题",
				moreBars: "还有 {count} 个更早的问题"
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
				jumpFailed: "Jump failed: target message not found",
				barLabel: "Jump to question {n}",
				moreBars: "{count} more earlier questions"
			}
		};
		//#endregion
		//#region lib/client/styles.js
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
		const panelCss = `
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
/* Clickability affordance: a hovered or pinned strip lights its bars up, so
   it reads as a control rather than as decoration. */
.dso-rail:hover .dso-bar,
.dso-rail[data-dso-open] .dso-bar {
  background: color-mix(in srgb, var(--dsw-alias-label-tertiary) 72%, transparent);
}
.dso-rail:hover .dso-bar:hover {
  background: var(--dsw-alias-state-business-primary);
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
/* A pinned panel (clicked open) keeps a defined edge, so it is obvious that it
   no longer collapses when the pointer leaves. */
.dso-panel[data-dso-pinned] {
  border-color: var(--dsw-alias-state-business-primary);
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

/* ---- Jump failure notice ------------------------------------------------ */
.dso-jump-failed {
  margin: 0;
  padding: 8px 14px;
  border-top: 1px solid var(--dsw-alias-line-normal);
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-state-warning, var(--dsw-alias-label-secondary));
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
		*
		* `uiConversation` is declared here on purpose: cordis guards `ctx` with a
		* Proxy that THROWS on an undeclared service read, and the rail reaches the
		* session's Chat store through it. Reading it off another context (e.g.
		* `binding.ctx.uiConversation`) is not allowed even after declaring it — the
		* guard is per-context, so `apply` captures it from its own ctx below.
		*/
		const inject = [
			"slots",
			"sessions",
			"locale",
			"uiConversation"
		];
		/**
		* The conversation service captured from this plugin's own context. Set in
		* `apply`; `undefined` only before activation, which the resolver tolerates.
		*/
		let pluginUiConversation;
		function apply(ctx) {
			pluginUiConversation = ctx.uiConversation;
			ctx.effect(() => ctx.locale.register(NS, dictionaries), "dsh-conversation-outline: locale");
			injectStyle(ctx);
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-conversation-outline.rail",
				locale: NS,
				inject: () => ({
					sessions: ctx.sessions,
					resolveChatFeed
				})
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
		function resolveChatFeed(binding) {
			if (binding === null || binding === void 0) return void 0;
			return pluginUiConversation?.binding?.(binding)?.target?.("chat");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.resolveChatFeed = resolveChatFeed;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map