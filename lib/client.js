/* global window, document */
// lib/client.js — dsh-hotkey browser bundle.
//
// Hand-written CJS factory registered through the dsh web ModuleLoader
// (mirrors dsh-chat-import's bundle style; no build chain required).
//
// Layout:
//   1. /* CORE-BEGIN */ … /* CORE-END */  — verbatim mirror of lib/core.mjs
//      (pure keybinding functions). test/bindings.test.mjs extracts this
//      region, imports it under node, and asserts identical behavior, so the
//      two copies cannot silently drift.
//   2. Default action table + executors (services, better-sidebar, approvals,
//      DOM-driven experiments).
//   3. Settings persistence (settingsScope ns "hotkey") + live rebind.
//   4. Global keydown capture with when-gated conditional bindings.
//   5. Settings-page tab component (React createElement, no JSX).
//
window.__ModuleLoader__.load({
	id: "dsh-hotkey",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");

		/* CORE-BEGIN (mirror of lib/core.mjs — keep byte-equivalent logic) */
		const MODIFIER_ORDER = ["ctrl", "alt", "shift", "meta"];

		const MODIFIER_SET = new Set(MODIFIER_ORDER);

		const CODE_TO_SPEC = {
			KeyA: "a", KeyB: "b", KeyC: "c", KeyD: "d", KeyE: "e", KeyF: "f",
			KeyG: "g", KeyH: "h", KeyI: "i", KeyJ: "j", KeyK: "k", KeyL: "l",
			KeyM: "m", KeyN: "n", KeyO: "o", KeyP: "p", KeyQ: "q", KeyR: "r",
			KeyS: "s", KeyT: "t", KeyU: "u", KeyV: "v", KeyW: "w", KeyX: "x",
			KeyY: "y", KeyZ: "z",
			Digit0: "0", Digit1: "1", Digit2: "2", Digit3: "3", Digit4: "4",
			Digit5: "5", Digit6: "6", Digit7: "7", Digit8: "8", Digit9: "9",
			Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
			Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".",
			Slash: "/", Space: "space",
			Enter: "enter", NumpadEnter: "enter", Escape: "escape", Tab: "tab",
			ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
			Delete: "delete", Backspace: "backspace", Home: "home", End: "end",
			PageUp: "pageup", PageDown: "pagedown",
			Insert: "insert", F1: "f1", F2: "f2", F3: "f3", F4: "f4", F5: "f5",
			F6: "f6", F7: "f7", F8: "f8", F9: "f9", F10: "f10", F11: "f11", F12: "f12"
		};

		const DISPLAY_OVERRIDES = {
			"`": "`", enter: "Enter", escape: "Esc", tab: "Tab", space: "Space",
			up: "↑", down: "↓", left: "←", right: "→",
			delete: "Del", backspace: "Backspace", pageup: "PgUp", pagedown: "PgDn"
		};

		const KNOWN_PRIMARIES = new Set(Object.values(CODE_TO_SPEC));

		function isValidComboSpec(spec) {
			const norm = normalizeCombo(spec);
			if (norm === null) return false;
			if (KNOWN_PRIMARIES.has(norm.primary)) return true;
			if (norm.primary.length === 1) return true;
			return /^f\d{1,2}$/.test(norm.primary);
		}

		function normalizeCombo(spec) {
			if (typeof spec !== "string") return null;
			const parts = spec.trim().toLowerCase().split("+").map((part) => part.trim()).filter((part) => part.length > 0);
			if (parts.length === 0) return null;
			const mods = new Set();
			let primary = null;
			for (const part of parts) {
				if (MODIFIER_SET.has(part)) {
					if (mods.has(part)) return null;
					mods.add(part);
				} else if (primary === null) {
					primary = part;
				} else return null;
			}
			if (primary === null) return null;
			const idParts = [];
			for (const mod of MODIFIER_ORDER) if (mods.has(mod)) idParts.push(mod);
			idParts.push(primary);
			return { id: idParts.join("+"), ctrl: mods.has("ctrl"), alt: mods.has("alt"), shift: mods.has("shift"), meta: mods.has("meta"), primary };
		}

		function describeEvent(event) {
			const parts = [];
			if (event.ctrlKey) parts.push("ctrl");
			if (event.altKey) parts.push("alt");
			if (event.shiftKey) parts.push("shift");
			if (event.metaKey) parts.push("meta");
			parts.push(eventToSpec(event));
			return parts.join("+");
		}

		function eventToSpec(event) {
			const mapped = CODE_TO_SPEC[event.code];
			if (mapped !== undefined) return mapped;
			const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
			return key.length === 0 ? "" : key;
		}

		function eventMatches(event, spec) {
			const norm = normalizeCombo(spec);
			return norm !== null && norm.id === describeEvent(event);
		}

		function formatCombo(spec) {
			const norm = normalizeCombo(spec);
			if (norm === null) return typeof spec === "string" ? spec : "";
			const labels = [];
			for (const mod of MODIFIER_ORDER) if (norm[mod]) labels.push(mod === "ctrl" ? "Ctrl" : mod === "meta" ? "Meta" : mod === "alt" ? "Alt" : "Shift");
			const primary = norm.primary;
			labels.push(Object.prototype.hasOwnProperty.call(DISPLAY_OVERRIDES, primary) ? DISPLAY_OVERRIDES[primary] : primary.length === 1 ? primary.toUpperCase() : primary);
			return labels.join("+");
		}

		function computeEffective(actions, userBindings) {
			const perAction = new Map();
			const owners = new Map();
			const conflicts = new Set();
			const bindings = userBindings !== null && typeof userBindings === "object" ? userBindings : {};
			for (const action of actions) {
				const entry = bindings[action.id];
				const fallback = typeof action.def === "string" && action.def.length > 0 ? action.def : null;
				let combo;
				if (entry !== undefined && entry !== null && typeof entry === "object") {
					const raw = entry.key;
					if (typeof raw === "string" && raw.trim().length > 0) {
						combo = isValidComboSpec(raw) ? normalizeCombo(raw).id : fallback;
					} else {
						combo = null;
					}
				} else {
					combo = fallback;
				}
				perAction.set(action.id, combo);
				if (combo !== null) {
					const norm = normalizeCombo(combo);
					if (norm !== null) {
						if (owners.has(norm.id)) {
							conflicts.add(action.id);
						} else owners.set(norm.id, action.id);
					}
				}
			}
			const byCombo = new Map();
			for (const action of actions) {
				const combo = perAction.get(action.id);
				if (combo === null || conflicts.has(action.id)) continue;
				const norm = normalizeCombo(combo);
				if (norm !== null) byCombo.set(norm.id, action.id);
			}
			return { perAction, byCombo, conflicts };
		}

		function parseImportPayload(payload) {
			if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
			const out = {};
			for (const [key, value] of Object.entries(payload)) {
				if (typeof key !== "string" || key.length === 0) return null;
				if (value === null) {
					out[key] = { key: null };
					continue;
				}
				if (typeof value !== "string") {
					if (typeof value === "object" && value !== null && (typeof value.key === "string" || value.key === null)) {
						if (value.key !== null && value.key !== "" && !isValidComboSpec(value.key)) return null;
						out[key] = { key: value.key };
						continue;
					}
					return null;
				}
				if (value !== "" && !isValidComboSpec(value)) return null;
				out[key] = { key: value };
			}
			return out;
		}
		/* CORE-END */

		//#region constants + mutable state
		const PLUGIN_ID = "dsh-hotkey";
		const LOG_PREFIX = "[dsh-hotkey]";
		const SETTINGS_NS = "hotkey";

		/**
		 * Mutable plugin state. `effective` is rebuilt from defaults +
		 * `userBindings` on every settings change; the keydown handler reads it
		 * live so edits apply without remounting anything.
		 */
		const state = {
			enabled: true,
			userBindings: null,
			effective: null,
			recording: null,
			availability: {},
			importText: "",
			debug: false
		};

		const uiListeners = new Set();
		function notifyUI() {
			for (const fn of [...uiListeners]) {
				try {
					fn();
				} catch {}
			}
		}

		let ctxRef = null;
		let settingsScope = null;

		function getService(name) {
			if (ctxRef === null) return undefined;
			try {
				// Priority: direct property → .get() → .services map → .reflect.get().
				if (ctxRef[name] !== undefined && ctxRef[name] !== null) return ctxRef[name];
				if (typeof ctxRef.get === "function") {
					const viaGet = ctxRef.get(name);
					if (viaGet !== undefined && viaGet !== null) return viaGet;
				}
				if (ctxRef.services && ctxRef.services[name] !== undefined && ctxRef.services[name] !== null) return ctxRef.services[name];
				if (ctxRef.reflect && typeof ctxRef.reflect.get === "function") {
					const viaReflect = ctxRef.reflect.get(name);
					if (viaReflect !== undefined && viaReflect !== null) return viaReflect;
				}
				return undefined;
			} catch {
				return undefined;
			}
		}
		//#endregion

		//#region dom helpers
		function isVisible(element) {
			if (!element || !element.isConnected) return false;
			try {
				return element.getClientRects().length > 0;
			} catch {
				return false;
			}
		}

		function accessibleName(element) {
			return ((element.getAttribute("aria-label") || "") + "\n" + (element.getAttribute("title") || "") + "\n" + (element.textContent || "")).trim().toLowerCase();
		}
		//#endregion

		//#region better-sidebar integration
		function betterSidebarService() {
			if (ctxRef === null) return undefined;
			try {
				const direct = ctxRef["betterSidebar"];
				if (direct !== undefined && direct !== null) return direct;
				return getService("betterSidebar");
			} catch {
				return undefined;
			}
		}

		function snapshotField(bss, field) {
			if (!bss || typeof bss.getSnapshot !== "function") return undefined;
			try {
				const snap = bss.getSnapshot();
				return snap === null || typeof snap !== "object" ? undefined : snap[field];
			} catch {
				return undefined;
			}
		}

		function openSidebarTab(type) {
			const bss = betterSidebarService();
			if (bss && typeof bss.openTab === "function") {
				let known = false;
				if (typeof bss.getTabs === "function") {
					try {
						known = bss.getTabs().some((tab) => tab !== null && typeof tab === "object" && tab.id === type);
					} catch {
						known = false;
					}
				}
				if (!known) return false;
				const sessionId = snapshotField(bss, "sessionId");
				try {
					bss.openTab({ type }, sessionId === undefined ? undefined : { sessionId });
					return true;
				} catch (error) {
					console.warn(LOG_PREFIX, "openTab failed:", type, error);
				}
			}
			// DOM fallback: click the matching tab in better-sidebar's tab bar.
			const keywords = TAB_TITLE_KEYWORDS[type];
			if (keywords !== undefined) {
				for (const tab of document.querySelectorAll('[data-dsh-panel-host] [class*="tab"][title]')) {
					if (!isVisible(tab)) continue;
					const title = ((tab.getAttribute("title") || "") + "\n" + (tab.textContent || "")).toLowerCase();
					if (keywords.some((kw) => title.includes(kw))) { tab.click(); return true; }
				}
			}
			// If the requested tab is not open, create it through the tab-bar plus menu.
			if (type === "sidechat") {
				const plusKeywords = ["新建标签", "new tab", "新增标签"];
				for (const btn of document.querySelectorAll('[data-dsh-panel-host] button')) {
					if (!isVisible(btn)) continue;
					const name = accessibleName(btn);
					if (!plusKeywords.some((kw) => name.includes(kw))) continue;
					btn.click();
					setTimeout(() => {
						for (const item of document.querySelectorAll('[role="menuitem"], [class*="menuItem"], button')) {
							if (!isVisible(item)) continue;
							const label = accessibleName(item);
							if (keywords.some((kw) => label.includes(kw))) { item.click(); break; }
						}
					}, 0);
					return true;
				}
			}
			return false;
		}
		//#endregion

		//#region panel toggle glyphs (close paths — better-sidebar exposes no close API)
		// Tab bar titles from dsh-better-sidebar builtinTabs locale (zh + en).
		const TAB_TITLE_KEYWORDS = {
			editor: ["文件", "files"],
			git: ["源代码管理", "git"],
			terminal: ["终端", "terminal"],
			subagent: ["任务管理", "subagent", "tasks"],
			sidechat: ["侧边对话", "side chat"]
		};
		const PANEL_TOGGLE_KEYWORDS = {
			bottom: ["折叠底部面板", "展开底部面板", "collapse bottom panel", "expand bottom panel", "底栏", "底部面板"],
			right: ["折叠侧边栏", "展开侧边栏", "collapse sidebar", "expand sidebar", "侧边栏"]
		};

		function clickPanelToggle(kind) {
			const keywords = PANEL_TOGGLE_KEYWORDS[kind] || [];
			if (keywords.length === 0) return false;
			// Preferred: the known toggle-cluster container (stable, scoped).
			const clusters = Array.from(document.querySelectorAll("[data-dsh-toggle-cluster]"));
			for (const cluster of clusters) {
				for (const btn of cluster.querySelectorAll("button")) {
					if (matchesKeywords(accessibleName(btn), keywords)) {
						btn.click();
						return true;
					}
				}
			}
			// Fallback: any button inside a panel host.
			for (const root of document.querySelectorAll("[data-dsh-panel-host]")) {
				for (const btn of root.querySelectorAll("button")) {
					if (!isVisible(btn)) continue;
					if (matchesKeywords(accessibleName(btn), keywords)) {
						btn.click();
						return true;
					}
				}
			}
			// Last resort: global toggleButton class fragment + visible filter.
			for (const btn of document.querySelectorAll('button[class*="toggleButton"]')) {
				if (!isVisible(btn)) continue;
				if (matchesKeywords(accessibleName(btn), keywords)) {
					btn.click();
					return true;
				}
			}
			return false;
		}

		function matchesKeywords(haystack, keywords) {
			if (haystack.length === 0) return false;
			return keywords.some((needle) => haystack.includes(needle));
		}
		//#endregion

		//#region approval detection (question composer renders no service face)
		const APPROVE_TEXTS = ["批准", "同意", "允许", "允许一次", "确认执行", "approve", "allow", "allow once", "accept", "confirm"];
		const DECLINE_TEXTS = ["拒绝", "否定", "不同意", "refuse", "decline", "deny", "reject"];

		/**
		 * Locate the open approval card and its decision buttons. Returns null
		 * when no card is visible (or it was minimized) — callers must treat
		 * null as "pass through untouched".
		 */
		function approvalContext() {
			// DSH 0.1.2+ uses [data-approval-key] on the card root; older builds used
			// [class*="Mbwy4a_card"]. Match both so the binding survives a DSH upgrade.
			const cards = [
				...document.querySelectorAll("[data-approval-key]"),
				...document.querySelectorAll('[class*="Mbwy4a_card"]'),
			];
			for (const card of cards) {
				if (card.className && card.className.includes("cardMinimized")) continue;
				if (!isVisible(card)) continue;
				const buttons = findApprovalButtons(card);
				if (buttons.approve !== null || buttons.decline !== null) return { card, ...buttons };
			}
			return findApprovalByPair();
		}

		function findApprovalButtons(root) {
			let approveExact = null;
			let declineExact = null;
			let approveLoose = null;
			let declineLoose = null;
			for (const btn of root.querySelectorAll("button")) {
				if (!isVisible(btn)) continue;
				const name = accessibleName(btn);
				if (name.length === 0) continue;
				if (approveExact === null && APPROVE_TEXTS.some((needle) => name === needle)) {
					approveExact = btn;
					continue;
				}
				if (declineExact === null && DECLINE_TEXTS.some((needle) => name === needle)) {
					declineExact = btn;
					continue;
				}
				if (declineLoose === null && matchesKeywords(name, DECLINE_TEXTS)) declineLoose = btn;
				else if (approveLoose === null && matchesKeywords(name, APPROVE_TEXTS)) approveLoose = btn;
			}
			return { approve: approveExact !== null ? approveExact : approveLoose, decline: declineExact !== null ? declineExact : declineLoose };
		}

		/** Structural fallback: a visible approve/decline button pair sharing a nearby container. */
		function findApprovalByPair() {
			for (const btn of document.querySelectorAll("button")) {
				if (!isVisible(btn)) continue;
				const name = accessibleName(btn);
				if (!APPROVE_TEXTS.some((needle) => name === needle || name.includes(needle))) continue;
				let node = btn.parentElement;
				for (let hop = 0; node !== null && hop < 4; hop += 1) {
					const partner = findDeclinePartner(node, btn);
					if (partner !== null) return { card: node, approve: btn, decline: partner };
					node = node.parentElement;
				}
			}
			return null;
		}

		function findDeclinePartner(container, exclude) {
			for (const btn of container.querySelectorAll("button")) {
				if (btn === exclude || !isVisible(btn)) continue;
				const name = accessibleName(btn);
				if (DECLINE_TEXTS.some((needle) => name === needle || name.includes(needle))) return btn;
			}
			return null;
		}

		function actApprove() {
			const context = approvalContext();
			if (context === null) return false;
			const active = document.activeElement;
			if (active !== null && active !== undefined && active.tagName === "TEXTAREA" && context.card.contains(active) && typeof active.value === "string" && active.value.length > 0) return false;
			if (context.approve === null) return false;
			context.approve.click();
			return true;
		}

		function actDecline() {
			const context = approvalContext();
			if (context === null) return false;
			if (context.decline === null) return false;
			context.decline.click();
			return true;
		}
		//#endregion

		//#region layout / workspace actions
		function actToggleSidebar() {
			const layout = getService("layout");
			if (layout && typeof layout.toggleSidebar === "function") {
				layout.toggleSidebar();
				return true;
			}
			// DOM fallback: click the sidebar toggle icon button (inside the sidebar pane).
			for (const btn of document.querySelectorAll('[data-side="sidebar"] [class*="iconButton"], [data-pane="sidebar"] [class*="iconButton"]')) {
				if (isVisible(btn)) { btn.click(); return true; }
			}
			return false;
		}

		function actDetails() {
			const layout = getService("layout");
			if (!layout || typeof layout.openDetails !== "function" || typeof layout.closeDetails !== "function") return false;
			let collapsed = true;
			try {
				collapsed = document.querySelector("[data-details-collapsed]") !== null;
			} catch {}
			if (collapsed) layout.openDetails();
			else layout.closeDetails();
			return true;
		}

		function actToggleVision() {
			const selectors = [
				'button[data-vision-router-mode-toggle="true"]',
				'[data-vision-router-mode-toggle="true"]'
			];
			for (const selector of selectors) {
				for (const button of document.querySelectorAll(selector)) {
					if (!isVisible(button) || button.disabled === true || button.getAttribute("aria-disabled") === "true") continue;
					button.click();
					return true;
				}
			}
			return false;
		}

		function actNewWorkspace() {
			const keywords = ["添加工作区", "add workspace", "新建工作区", "new workspace"];
			for (const btn of [...document.querySelectorAll('[data-side="sidebar"] button, [data-pane="sidebar"] button'), ...document.querySelectorAll('[class*="workspace"] button')]) {
				if (!isVisible(btn)) continue;
				if (keywords.some((kw) => accessibleName(btn).includes(kw))) { btn.click(); return true; }
			}
			return false;
		}

		function actNewSession() {
			const workspaces = getService("workspaces");
			if (workspaces && typeof workspaces.startSession === "function") {
				workspaces.startSession(undefined);
				return true;
			}
			// DOM fallback: click the "新建会话" / "New Session" button in the sidebar.
			const NEW_SESSION_KEYWORDS = ["新建会话", "new session", "新会话"];
			for (const btn of document.querySelectorAll('[data-side="sidebar"] button, [data-pane="sidebar"] button')) {
				if (isVisible(btn)) {
					const name = accessibleName(btn);
					if (NEW_SESSION_KEYWORDS.some((kw) => name.includes(kw))) { btn.click(); return true; }
				}
			}
			return false;
		}
		//#endregion

		//#region terminal actions
		function actTerminal() {
			if (openSidebarTab("terminal")) return true;
			actSystemTerminalAsync();
			return false;
		}

		let systemTerminalInFlight = false;
		function actSystemTerminalAsync() {
			if (systemTerminalInFlight) return;
			systemTerminalInFlight = true;
			fetch("/api/desktop/terminal/open", {
				method: "POST",
				credentials: "same-origin",
				redirect: "error",
				headers: { "Accept": "application/json", "Content-Type": "application/json" },
				body: "{}"
			}).then(async (response) => {
				if (!response.ok) throw new Error(`status ${String(response.status)}`);
				const value = await response.json();
				if (value === null || typeof value !== "object" || value.accepted !== true) throw new Error("unexpected response shape");
				console.info(LOG_PREFIX, "system terminal opened");
			}).catch((error) => {
				console.warn(LOG_PREFIX, "system terminal unavailable:", error instanceof Error ? error.message : String(error));
			}).finally(() => {
				systemTerminalInFlight = false;
			});
		}
		//#endregion

		//#region panel toggles
		function actBottomPanel() {
			const bss = betterSidebarService();
			const bottomOpen = snapshotFlag(bss, "bottomOpen");
			if (bottomOpen === true) {
				if (clickPanelToggle("bottom")) return true;
				return openSidebarTab("terminal");
			}
			if (bottomOpen === false) {
				if (openSidebarTab("terminal")) return true;
				return clickPanelToggle("bottom");
			}
			// Unknown service snapshot: still use the stable DOM toggle.
			if (clickPanelToggle("bottom")) return true;
			return openSidebarTab("terminal");
		}

		function actRightPanel() {
			if (clickPanelToggle("right")) return true;
			return openSidebarTab("editor");
		}

		function rightPanelIsCollapsed() {
			const collapsedNames = ["展开侧边栏", "open sidebar", "打开侧边栏"];
			try {
				for (const cluster of document.querySelectorAll("[data-dsh-toggle-cluster]")) {
					for (const btn of cluster.querySelectorAll("button")) {
						if (!isVisible(btn)) continue;
						if (collapsedNames.some((name) => accessibleName(btn).includes(name))) return true;
					}
				}
			} catch {}
			return snapshotFlag(betterSidebarService(), "panelOpen") === false;
		}

		function retryOpenSideChat(attempt = 0) {
			if (openSidebarTab("sidechat")) return;
			if (attempt < 3) setTimeout(() => retryOpenSideChat(attempt + 1), 80);
		}

		function actSideChat() {
			// Two steps: expand the right sidebar, then create/activate Side Chat.
			if (rightPanelIsCollapsed()) {
				if (!clickPanelToggle("right")) return false;
				setTimeout(() => retryOpenSideChat(0), 80);
				return true;
			}
			if (openSidebarTab("sidechat")) return true;
			if (clickPanelToggle("right")) {
				setTimeout(() => retryOpenSideChat(0), 80);
				return true;
			}
			return false;
		}

		function snapshotFlag(bss, field) {
			const value = snapshotField(bss, field);
			return typeof value === "boolean" ? value : undefined;
		}
		//#endregion

		//#region experimental DOM-driven actions
		function actSessionNav(delta) {
			// Preferred path: the workspaces service API (no DOM dependency).
			const sessions = getService("workspaces") || getService("sessions");
			if (sessions !== undefined && typeof sessions.select === "function" && sessions.list !== undefined && typeof sessions.list.getSnapshot === "function") {
				try {
					const snap = sessions.list.getSnapshot();
					if (snap !== null && typeof snap === "object" && Array.isArray(snap.items)) {
						const currentIdx = snap.current === undefined || snap.current === null ? -1 : snap.items.findIndex((item) => item !== null && typeof item === "object" && item.sessionId === snap.current);
						const start = currentIdx === -1 ? (delta > 0 ? -1 : snap.items.length) : currentIdx;
						const targetIdx = start + delta;
						if (targetIdx >= 0 && targetIdx < snap.items.length) {
							const target = snap.items[targetIdx];
							if (target !== null && typeof target === "object" && typeof target.sessionId === "string") {
								sessions.select(target.sessionId);
								return true;
							}
						}
						return false;
					}
				} catch {}
			}
			// Fallback: legacy DOM row clicking.
			ensureSidebarExpanded();
			if (sessionNavAttempt(delta)) return true;
			setTimeout(() => {
				sessionNavAttempt(delta);
			}, 160);
			return false;
		}

		function sessionNavAttempt(delta) {
			ensureSidebarExpanded();
			const rows = Array.from(document.querySelectorAll('[class*="sessionRow"]')).filter(isVisible);
			if (rows.length === 0) return false;
			const index = rows.findIndex((row) => row.getAttribute("aria-selected") === "true" || row.className.includes("selected") || row.querySelector('[class*="selected"]') !== null);
			const target = index === -1 ? (delta > 0 ? rows[0] : rows[rows.length - 1]) : rows[index + delta];
			if (target === undefined || target === null) return false;
			// Click the ROW itself (its onClick calls onOpen → session navigation).
			// Never click a nested button (the row's ellipsis opens a menu, not navigation).
			target.click();
			return true;
		}

		function ensureSidebarExpanded() {
			try {
				if (document.querySelector("[data-sidebar-collapsed]") !== null) actToggleSidebar();
			} catch {}
		}

		function findComposerInput() {
			const candidates = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""]'))
				.filter(isVisible)
				.filter((el) => !(el.closest && (el.closest("[data-dsh-panel-host]") || el.closest("[data-approval-key]") || el.closest('[class*="Mbwy4a"]'))));
			return candidates.length > 0 ? candidates[candidates.length - 1] : null;
		}

		function placeCaretEnd(el) {
			try {
				if (el.tagName === "TEXTAREA") {
					const length = el.value.length;
					el.setSelectionRange(length, length);
				} else {
					const range = document.createRange();
					range.selectNodeContents(el);
					range.collapse(false);
					const selection = window.getSelection();
					if (selection !== null) {
						selection.removeAllRanges();
						selection.addRange(range);
					}
				}
			} catch {}
		}

		function actFocusComposer() {
			const input = findComposerInput();
			if (input === null) return false;
			input.focus();
			placeCaretEnd(input);
			return true;
		}

		function actCommandPalette() {
			const input = findComposerInput();
			if (input === null) return false;
			input.focus();
			let inserted = false;
			try {
				inserted = document.execCommand("insertText", false, "/");
			} catch {
				inserted = false;
			}
			if (!inserted) {
				try {
					input.textContent = (input.textContent || "") + "/";
					input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "/", inputType: "insertText" }));
				} catch {}
			}
			placeCaretEnd(input);
			return true;
		}

		function actOpenSettings() {
			const buttons = Array.from(document.querySelectorAll('[class*="settingsArea"] button')).filter(isVisible);
			const target = buttons.find((b) => b.getAttribute("aria-expanded") !== null) || buttons[0];
			if (target === undefined) return false;
			target.click();
			return true;
		}
		//#endregion

		//#region action catalog (table order = runtime priority for conflicts)
		const ACTIONS = [
			{ id: "toggle.sidebar", def: "ctrl+b", group: "core", zh: "切换侧边栏", en: "Toggle sidebar", run: actToggleSidebar },
			{ id: "toggle.terminal", def: "ctrl+`", group: "core", zh: "打开 / 聚焦终端", en: "Open / focus terminal", run: actTerminal },
			{ id: "toggle.bottomPanel", def: "ctrl+j", group: "core", zh: "切换底部面板", en: "Toggle bottom panel", run: actBottomPanel },
			{ id: "toggle.rightPanel", def: "ctrl+alt+b", group: "core", zh: "切换右侧边栏", en: "Toggle right sidebar", run: actRightPanel },
			{ id: "open.files", def: "ctrl+shift+e", group: "core", zh: "文件树 / 编辑器", en: "Files & editor", run: () => openSidebarTab("editor") },
			{ id: "open.git", def: "ctrl+shift+g", group: "core", zh: "Git 面板", en: "Git panel", run: () => openSidebarTab("git") },
			{ id: "open.sideChat", def: "alt+e", group: "core", zh: "侧边对话", en: "Side chat", run: actSideChat },
			{ id: "toggle.vision", def: "ctrl+alt+v", group: "core", zh: "切换识图模式", en: "Toggle Vision mode", run: actToggleVision },
			{ id: "open.subagent", def: null, group: "core", zh: "子代理面板", en: "Subagents panel", run: () => openSidebarTab("subagent") },
			{ id: "new.workspace", def: "ctrl+f", group: "core", zh: "打开新的工作区", en: "Open new workspace", run: actNewWorkspace },
			{ id: "new.session", def: "ctrl+n", group: "core", zh: "新建会话", en: "New session", run: actNewSession },
			{ id: "toggle.details", def: null, group: "experimental", zh: "切换详情列", en: "Toggle details column", run: actDetails },
			{ id: "open.systemTerminal", def: null, group: "core", zh: "打开系统终端窗口", en: "Open system terminal window", run: () => {
				actSystemTerminalAsync();
				return false;
			} },
			{ id: "approval.approve", def: "enter", group: "when", when: "approval", zh: "同意 / 确认审批", en: "Approve request", run: actApprove },
			{ id: "approval.decline", def: "esc", group: "when", when: "approval", zh: "否定审批", en: "Decline request", run: actDecline },
			{ id: "session.prev", def: "ctrl+[", group: "experimental", zh: "上一个会话", en: "Previous session", run: () => actSessionNav(-1) },
			{ id: "session.next", def: "ctrl+]", group: "experimental", zh: "下一个会话", en: "Next session", run: () => actSessionNav(1) },
			{ id: "command.palette", def: null, group: "experimental", zh: "命令菜单", en: "Command menu", run: actCommandPalette },
			{ id: "focus.composer", def: "ctrl+i", group: "experimental", zh: "聚焦输入框", en: "Focus composer", run: actFocusComposer },
			{ id: "open.settings", def: "ctrl+,", group: "experimental", zh: "打开设置", en: "Open settings", run: actOpenSettings }
		];

		const ACTION_BY_ID = new Map(ACTIONS.map((action) => [action.id, action]));

		function hasVisible(selector) {
			try { return Array.from(document.querySelectorAll(selector)).some(isVisible); } catch { return false; }
		}
		function refreshAvailability() {
			const bss = betterSidebarService() !== undefined;
			const layout = getService("layout") !== undefined;
			const workspaces = getService("workspaces") !== undefined;
			const sidebarToggle = hasVisible('[data-side="sidebar"] [class*="iconButton"], [data-pane="sidebar"] [class*="iconButton"]');
			const sidebarPanel = hasVisible('[data-dsh-panel-host]');
			const tabBar = hasVisible('[data-dsh-panel-host] [class*="tab"]');
			const panelToggle = hasVisible('[data-dsh-toggle-cluster]');
			const newSession = hasVisible('[data-side="sidebar"] button, [data-pane="sidebar"] button');
			state.availability = {
				"toggle.sidebar": layout || sidebarToggle,
				"toggle.details": layout || sidebarPanel,
				"new.workspace": hasVisible('[data-side="sidebar"] button, [data-pane="sidebar"] button') || hasVisible('[class*="workspace"] button'),
				"new.session": workspaces || newSession,
				"toggle.bottomPanel": bss || panelToggle,
				"toggle.rightPanel": bss || panelToggle,
				"open.files": bss || tabBar,
				"open.git": bss || tabBar,
				"open.sideChat": bss || tabBar || panelToggle,
				"toggle.vision": hasVisible('button[data-vision-router-mode-toggle="true"]'),
				"open.subagent": bss || tabBar,
				"toggle.terminal": true,
				"open.systemTerminal": true,
				"approval.approve": true,
				"approval.decline": true,
				"session.prev": true,
				"session.next": true,
				"command.palette": true,
				"focus.composer": true,
				"open.settings": true
			};
			notifyUI();
		}
		//#endregion

		//#region settings persistence (settingsScope ns "hotkey")
		function attachSettings() {
			const binder = getService("settingsScope");
			if (!binder || typeof binder.bind !== "function") return false;
			try {
				settingsScope = binder.bind({ namespace: SETTINGS_NS });
				if (settingsScope && typeof settingsScope.subscribe === "function") settingsScope.subscribe(() => hydrateFromSettings());
				hydrateFromSettings();
				return true;
			} catch {
				settingsScope = null;
				return false;
			}
		}

		function hydrateFromSettings() {
			if (!settingsScope || typeof settingsScope.getSnapshot !== "function") return;
			let value = null;
			try {
				const snapshot = settingsScope.getSnapshot();
				value = snapshot !== null && typeof snapshot === "object" && snapshot.value !== null && typeof snapshot.value === "object" ? snapshot.value : {};
			} catch {
				return;
			}
			state.enabled = value.enabled !== false;
			state.userBindings = value.bindings !== null && typeof value.bindings === "object" ? value.bindings : null;
			rebuildEffective();
			notifyUI();
		}

		function rebuildEffective() {
			state.effective = computeEffective(ACTIONS, state.userBindings);
		}

		function saveUserBinding(actionId, key) {
			const next = { ...(state.userBindings || {}) };
			if (key === undefined) delete next[actionId];
			else next[actionId] = { key };
			state.userBindings = next;
			rebuildEffective();
			persist("bindings", next);
			notifyUI();
		}

		function resetAllBindings() {
			state.userBindings = null;
			rebuildEffective();
			persist("bindings", {});
			notifyUI();
		}

		function setEnabled(next) {
			state.enabled = next !== false;
			persist("enabled", state.enabled);
			notifyUI();
		}

		function persist(field, value) {
			if (!settingsScope || typeof settingsScope.set !== "function") return;
			try {
				void Promise.resolve(settingsScope.set(field, value)).catch((error) => {
					console.warn(LOG_PREFIX, "settings write rejected:", error);
				});
			} catch (error) {
				console.warn(LOG_PREFIX, "settings write failed:", error);
			}
		}

		function applyImportPayload(payload) {
			const parsed = parseImportPayload(payload);
			if (parsed === null) return false;
			const next = { ...(state.userBindings || {}) };
			for (const [id, entry] of Object.entries(parsed)) {
				if (!ACTION_BY_ID.has(id)) continue;
				next[id] = entry;
			}
			state.userBindings = next;
			rebuildEffective();
			persist("bindings", next);
			notifyUI();
			return true;
		}

		function exportPayload() {
			const out = {};
			for (const action of ACTIONS) {
				const combo = state.effective !== null ? state.effective.perAction.get(action.id) : null;
				out[action.id] = combo === null || combo === undefined ? "" : combo;
			}
			return out;
		}
		//#endregion

		//#region keydown handling
		function warnAction(id, error) {
			console.warn(LOG_PREFIX, `action "${id}" failed:`, error instanceof Error ? error.message : error);
		}

		function logHit(id) {
			console.info(`${LOG_PREFIX} ${id}`);
		}

		let rightPanelFocusIndex = -1;
		function rightPanelButtons() {
			try {
				const out = [];
				for (const root of document.querySelectorAll("[data-dsh-panel-host]")) {
					for (const el of root.querySelectorAll('button, [role="button"]')) {
						if (!isVisible(el) || el.disabled === true || el.getAttribute("aria-hidden") === "true") continue;
						if (!out.includes(el)) out.push(el);
					}
				}
				return out;
			} catch { return []; }
		}
		function handleRightPanelNavigation(event) {
			if (event.isComposing || (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter")) return false;
			const active = document.activeElement;
			const editable = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable === true);
			if (editable && !(active.closest && active.closest("[data-dsh-panel-host]"))) return false;
			if (rightPanelIsCollapsed()) { rightPanelFocusIndex = -1; return false; }
			const buttons = rightPanelButtons();
			if (buttons.length === 0) return false;
			if (event.key === "Enter") {
				if (rightPanelFocusIndex < 0 || rightPanelFocusIndex >= buttons.length) return false;
				buttons[rightPanelFocusIndex].click();
				event.preventDefault();
				event.stopPropagation();
				return true;
			}
			const delta = event.key === "ArrowDown" ? 1 : -1;
			const activeIndex = buttons.indexOf(active);
			const base = activeIndex >= 0 ? activeIndex : rightPanelFocusIndex;
			rightPanelFocusIndex = base < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (base + delta + buttons.length) % buttons.length;
			const target = buttons[rightPanelFocusIndex];
			try { target.focus(); } catch {}
			target.setAttribute("aria-selected", "true");
			event.preventDefault();
			event.stopPropagation();
			return true;
		}

		function handleKeyDown(event) {
			if (state.recording !== null) return;
			if (handleRightPanelNavigation(event)) return;
			if (!state.enabled) return;
			if (event.isComposing) return;
			const comboId = describeEvent(event);
			if (state.debug) console.log(`[dsh-hotkey] keydown combo=${comboId} src=${event.srcElement ? event.srcElement.tagName : "?"}`);

			// When-gated conditional bindings evaluate first (approval Enter/Esc).
			for (const action of ACTIONS) {
				if (action.when === undefined) continue;
				const combo = state.effective !== null ? state.effective.perAction.get(action.id) : null;
				if (combo === null || combo === undefined) continue;
				const norm = normalizeCombo(combo);
				if (norm === null || norm.id !== comboId) continue;
				let handled = false;
				try {
					handled = action.run({ event }) === true;
				} catch (error) {
					warnAction(action.id, error);
				}
				if (handled) {
					event.preventDefault();
					event.stopPropagation();
					logHit(action.id);
				} else if (state.debug) {
					console.log(`[dsh-hotkey] when-action "${action.id}" matched but returned false`);
				}
				return;
			}

			const actionId = state.effective !== null ? state.effective.byCombo.get(comboId) : undefined;
			if (actionId === undefined) {
				if (state.debug) console.log(`[dsh-hotkey] combo ${comboId} not bound (effective=${state.effective ? state.effective.byCombo.size : "null"})`);
				return;
			}
			const action = ACTION_BY_ID.get(actionId);
			if (action === undefined) return;
			let handled = false;
			try {
				handled = action.run({ event }) === true;
			} catch (error) {
				warnAction(actionId, error);
			}
			if (handled) {
				event.preventDefault();
				event.stopPropagation();
				logHit(actionId);
			} else if (state.debug) {
				console.log(`[dsh-hotkey] action "${actionId}" ran but returned false (passed through)`);
			}
		}

		function recordingKeyDown(event) {
			const recording = state.recording;
			if (recording === null) return;
			event.preventDefault();
			event.stopPropagation();
			if (event.key === "Escape") {
				state.recording = null;
				notifyUI();
				return;
			}
			const comboId = describeEvent(event);
			const norm = normalizeCombo(comboId);
			if (norm === null) return;
			if (norm.primary === "delete" || norm.primary === "backspace") {
				state.recording = null;
				saveUserBinding(recording.actionId, "");
				return;
			}
			state.recording = null;
			saveUserBinding(recording.actionId, norm.id);
		}
		//#endregion

		//#region locale (ns "hotkey")
		const ZH_DICT = {
			"tab": "快捷键",
			"master": "启用全部快捷键",
			"col.action": "动作",
			"col.key": "键位",
			"col.status": "状态",
			"status.available": "可用",
			"status.unavailable": "不可用",
			"status.conflict": "冲突",
			"status.when": "条件",
			"status.experimental": "实验性",
			"status.disabled": "已禁用",
			"btn.rebind": "修改",
			"btn.clear": "禁用",
			"btn.reset": "恢复默认",
			"btn.resetAll": "全部恢复默认",
			"record.hint": "按下新的组合键（Esc 取消，Del 清除）",
			"io.title": "导入 / 导出配置",
			"io.placeholder": '{"toggle.sidebar":"ctrl+b", ...}',
			"io.apply": "应用导入",
			"io.copy": "复制当前配置",
			"io.invalid": "配置格式无效",
			"group.core": "核心",
			"group.when": "条件触发",
			"group.experimental": "实验性"
		};
		const EN_DICT = {
			"tab": "Keyboard shortcuts",
			"master": "Enable all shortcuts",
			"col.action": "Action",
			"col.key": "Keybinding",
			"col.status": "Status",
			"status.available": "Available",
			"status.unavailable": "Unavailable",
			"status.conflict": "Conflict",
			"status.when": "Conditional",
			"status.experimental": "Experimental",
			"status.disabled": "Disabled",
			"btn.rebind": "Change",
			"btn.clear": "Disable",
			"btn.reset": "Reset",
			"btn.resetAll": "Reset all",
			"record.hint": "Press the new combination (Esc cancels, Del clears)",
			"io.title": "Import / export configuration",
			"io.placeholder": '{"toggle.sidebar":"ctrl+b", ...}',
			"io.apply": "Apply import",
			"io.copy": "Copy current config",
			"io.invalid": "Invalid configuration payload",
			"group.core": "Core",
			"group.when": "Conditional",
			"group.experimental": "Experimental"
		};
		for (const action of ACTIONS) {
			ZH_DICT[`a.${action.id}`] = action.zh;
			EN_DICT[`a.${action.id}`] = action.en;
		}

		let localeService = null;
		function translate(key) {
			if (localeService !== null && localeService !== undefined && typeof localeService.bind === "function") {
				try {
					const bound = localeService.bind(SETTINGS_NS);
					const translated = bound(key);
					if (typeof translated === "string" && translated !== key) return translated;
				} catch {}
			}
			return Object.prototype.hasOwnProperty.call(ZH_DICT, key) ? ZH_DICT[key] : key;
		}
		//#endregion

		//#region settings tab component (React createElement, no JSX)
		const styles = {
			root: { display: "flex", flexDirection: "column", gap: 12, padding: "16px 4px", color: "var(--dsw-alias-label-primary)", fontSize: 13 },
			masterRow: { display: "flex", alignItems: "center", gap: 8 },
			table: { width: "100%", borderCollapse: "collapse" },
			th: { textAlign: "left", fontWeight: 500, color: "var(--dsw-alias-label-secondary)", padding: "6px 10px", borderBottom: "1px solid var(--dsw-alias-border-l2)" },
			td: { padding: "6px 10px", borderBottom: "1px solid var(--dsw-alias-border-l1)", verticalAlign: "middle" },
			keyBadge: { display: "inline-block", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--dsw-alias-border-l2)", fontFamily: "var(--ds-font-family-code, monospace)", fontSize: 12 },
			statusBadge: { marginLeft: 6, padding: "1px 8px", borderRadius: 999, fontSize: 11, border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-secondary)" },
			button: { appearance: "none", font: "inherit", cursor: "pointer", background: "transparent", color: "var(--dsw-alias-label-secondary)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, padding: "3px 10px", marginRight: 6 },
			groupTitle: { marginTop: 8, marginBottom: 2, fontWeight: 600, color: "var(--dsw-alias-label-secondary)", fontSize: 12 },
			textArea: { width: "100%", minHeight: 72, boxSizing: "border-box", font: "var(--ds-font-family-code, monospace)", fontSize: 12, color: "inherit", background: "var(--dsw-alias-bg-layer-3)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, padding: 8 },
			hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12 }
		};

		function statusBadges(action) {
			const badges = [];
			const available = state.availability[action.id];
			const push = (label) => badges.push(react.createElement("span", { key: label, style: styles.statusBadge }, label));
			if (state.effective !== null && state.effective.perAction.get(action.id) === null) push(translate("status.disabled"));
			if (state.effective !== null && state.effective.conflicts.has(action.id)) push(translate("status.conflict"));
			if (action.when !== undefined) push(translate("status.when"));
			else if (available === false) push(translate("status.unavailable"));
			else if (action.group === "experimental") push(translate("status.experimental"));
			return badges;
		}

		function HotkeySettingsPanel() {
			const [, setTick] = react.useState(0);
			react.useEffect(() => {
				const listener = () => setTick((tick) => tick + 1);
				uiListeners.add(listener);
				refreshAvailability();
				return () => {
					uiListeners.delete(listener);
				};
			}, []);
			const groups = [
				["core", "group.core"],
				["when", "group.when"],
				["experimental", "group.experimental"]
			];
			const rows = [];
			for (const [groupId, labelKey] of groups) {
				rows.push(react.createElement("div", { key: `g-${groupId}`, style: styles.groupTitle }, translate(labelKey)));
				for (const action of ACTIONS.filter((candidate) => candidate.group === groupId)) {
					rows.push(actionRow(action));
				}
			}
			return react.createElement("div", { style: styles.root },
				react.createElement("label", { style: styles.masterRow },
					react.createElement("input", { type: "checkbox", checked: state.enabled, onChange: (event) => setEnabled(event.target.checked) }),
					translate("master")),
				react.createElement("table", { style: styles.table },
					react.createElement("thead", null, react.createElement("tr", null,
						react.createElement("th", { style: styles.th }, translate("col.action")),
						react.createElement("th", { style: styles.th }, translate("col.key")),
						react.createElement("th", { style: styles.th }, translate("col.status")),
						react.createElement("th", { style: styles.th }, ""))),
					react.createElement("tbody", null, rows)),
				ioSection());
		}

		function actionRow(action) {
			const recording = state.recording !== null && state.recording.actionId === action.id;
			const combo = state.effective !== null ? state.effective.perAction.get(action.id) : null;
			const keyLabel = recording === true ? translate("record.hint") : combo === null || combo === undefined ? "—" : formatCombo(combo);
			const cells = [
				react.createElement("td", { key: "name", style: styles.td }, `${translate(`a.${action.id}`)} `, react.createElement("span", { style: styles.hint }, action.id)),
				react.createElement("td", { key: "key", style: styles.td }, react.createElement("span", { style: { ...styles.keyBadge, ...(recording ? { borderColor: "var(--dsw-alias-brand-primary)", color: "var(--dsw-alias-brand-primary)" } : {}) } }, keyLabel)),
				react.createElement("td", { key: "status", style: styles.td }, statusBadges(action)),
				react.createElement("td", { key: "ops", style: styles.td },
					react.createElement("button", { style: styles.button, onClick: () => beginRecording(action.id) }, translate("btn.rebind")),
					react.createElement("button", { style: styles.button, onClick: () => saveUserBinding(action.id, "") }, translate("btn.clear")),
					react.createElement("button", { style: styles.button, onClick: () => saveUserBinding(action.id, undefined) }, translate("btn.reset")))
			];
			return react.createElement("tr", { key: action.id }, cells);
		}

		function beginRecording(actionId) {
			state.recording = { actionId };
			notifyUI();
		}

		function ioSection() {
			return react.createElement(IoSection, { key: "io" });
		}

		function IoSection() {
			const [text, setText] = react.useState("");
			const [message, setMessage] = react.useState("");
			return react.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 } },
				react.createElement("div", { style: styles.groupTitle }, translate("io.title")),
				react.createElement("textarea", { style: styles.textArea, placeholder: translate("io.placeholder"), value: text, onChange: (event) => setText(event.target.value) }),
				react.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
					react.createElement("button", { style: styles.button, onClick: () => {
						try {
							const parsed = JSON.parse(text);
							const ok = applyImportPayload(parsed === null || typeof parsed !== "object" ? null : parsed);
							setMessage(ok ? "" : translate("io.invalid"));
						} catch {
							setMessage(translate("io.invalid"));
						}
					} }, translate("io.apply")),
					react.createElement("button", { style: styles.button, onClick: () => {
						setText(JSON.stringify(exportPayload(), null, 2));
						try {
							void navigator.clipboard.writeText(JSON.stringify(exportPayload(), null, 2));
						} catch {}
					} }, translate("io.copy")),
					react.createElement("button", { style: styles.button, onClick: () => resetAllBindings() }, translate("btn.resetAll")),
					message.length > 0 ? react.createElement("span", { style: styles.hint }, message) : null));
		}
		//#endregion

		//#region apply (client plugin body)
		let keydownInstalled = false;
		function installKeydownHandlers() {
			if (keydownInstalled) return () => {};
			if (!window || typeof window.addEventListener !== "function") return () => {};
			window.addEventListener("keydown", handleKeyDown, true);
			window.addEventListener("keydown", recordingKeyDown, true);
			keydownInstalled = true;
			return () => {
				if (!keydownInstalled) return;
				window.removeEventListener("keydown", handleKeyDown, true);
				window.removeEventListener("keydown", recordingKeyDown, true);
				keydownInstalled = false;
				uiListeners.clear();
			};
		}
		function apply(ctx) {
			ctxRef = ctx;
			ctx.effect(() => {
				const locale = ctx.get("locale");
				if (locale && typeof locale.register === "function") {
					localeService = locale;
					locale.register(SETTINGS_NS, { zh: ZH_DICT, en: EN_DICT });
				}
			}, "dsh-hotkey: dictionaries");

			// Late-binding service hooks: availability refresh + settings hydration
			// whenever the owning services come online (also covers their own HMR).
			try {
				ctx.inject(["settingsScope"], () => {
					attachSettings();
				});
			} catch {}
			try {
				ctx.inject(["betterSidebar"], () => refreshAvailability());
			} catch {}
			try {
				ctx.inject(["layout"], () => refreshAvailability());
			} catch {}
			try {
				ctx.inject(["workspaces"], () => refreshAvailability());
			} catch {}

			// Install synchronously: hotkeys must work even if the host effect scheduler is deferred.
			const disposeKeydown = installKeydownHandlers();
			try {
				ctx.effect(() => disposeKeydown, "dsh-hotkey: keydown capture");
			} catch {}

			ctx.slots.inject("settings.section", () => {
				const binder = ctx.get("settingsScope");
				if (!binder || typeof binder.bind !== "function") return undefined;
				if (!settingsScope) settingsScope = binder.bind({ namespace: SETTINGS_NS });
				return ctx.slots.register({
					name: "settings.section",
					id: "hotkey",
					order: 121,
					label: () => translate("tab"),
					locale: SETTINGS_NS,
					inject: () => ({ scope: settingsScope })
				}, HotkeySettingsPanel);
			});

			attachSettings();
			refreshAvailability();
			rebuildEffective();

			try {
				const bound = state.effective !== null ? [...state.effective.byCombo.values()].filter((id, index, all) => all.indexOf(id) === index).length : 0;
				console.info(`${LOG_PREFIX} activated: ${String(bound)} bound / ${String(ACTIONS.length)} actions`);
			} catch {}
		}
		//#endregion

		try {
			Object.defineProperty(window, "__DSH_HOTKEY__", {
				configurable: true,
				get: () => ({
					version: "0.1.0",
					actions: () => ACTIONS.map((action) => action.id),
					effective: () => {
						if (state.effective === null) return null;
						return {
							perAction: Object.fromEntries(state.effective.perAction),
							byCombo: Object.fromEntries(state.effective.byCombo),
							conflicts: [...state.effective.conflicts]
						};
					},
					availability: () => ({ ...state.availability }),
					reload: () => {
						attachSettings();
						refreshAvailability();
						rebuildEffective();
					},
					/** Enable debug logging: every handled/unhandled combo logged to console. */
					debug: (enable = true) => {
						state.debug = enable === true;
						console.log(`[dsh-hotkey] debug logging ${enable ? "ON" : "OFF"}`);
					},
					/** Dump live runtime info: services, DOM, tabs, sessions. */
					probe: () => {
						const out = {};
						// Services
						const bss = betterSidebarService();
						out.betterSidebar = bss !== undefined ? {
							snapshot: typeof bss.getSnapshot === "function" ? bss.getSnapshot() : null,
							tabs: typeof bss.getTabs === "function" ? bss.getTabs().map((t) => t.id) : null,
							capabilities: Object.keys(bss).filter((k) => typeof bss[k] === "function")
						} : "NOT_FOUND";
						out.layout = getService("layout") !== undefined ? "OK" : "NOT_FOUND";
						out.workspaces = getService("workspaces") !== undefined ? "OK" : "NOT_FOUND";
						const sessions = getService("sessions") || getService("workspaces");
						if (sessions !== undefined && sessions.list !== undefined && typeof sessions.list.getSnapshot === "function") {
							try {
								const snap = sessions.list.getSnapshot();
								out.sessionList = { current: snap.current, itemCount: snap.items ? snap.items.length : 0 };
							} catch (e) { out.sessionList = { error: String(e) }; }
						} else { out.sessionList = "NOT_FOUND"; }
						// Session row DOM
						try {
							const allRows = document.querySelectorAll('*[class*="sessionRow"]');
							out.sessionRowDOM = { selector: "[class*=sessionRow]", matchCount: allRows.length };
							if (allRows.length > 0) {
								const first = allRows[0];
								out.sessionRowDOM.firstRowClass = first.className;
								out.sessionRowDOM.firstRowTag = first.tagName;
								out.sessionRowDOM.buttonsInFirstRow = Array.from(first.querySelectorAll("button")).map((b) => ({ text: (b.textContent || "").trim().substring(0, 40), ariaLabel: b.getAttribute("aria-label") || "", title: b.getAttribute("title") || "" }));
							}
						} catch (e) { out.sessionRowDOM = { error: String(e) }; }
						// Bottom / right panel toggles: dump the stable toggle-cluster buttons.
						try {
							const clusterButtons = [];
							document.querySelectorAll("[data-dsh-toggle-cluster]").forEach((cluster) => {
								cluster.querySelectorAll("button").forEach((b) => {
									clusterButtons.push({
										ariaLabel: b.getAttribute("aria-label") || "",
										text: (b.textContent || "").trim().substring(0, 30),
										visible: b.getClientRects().length > 0
									});
								});
							});
							out.toggleCluster = clusterButtons.length > 0 ? clusterButtons : "NOT_FOUND";
						} catch (e) { out.toggleCluster = { error: String(e) }; }
						// Bottom panel keyword scan
						try {
							for (const kw of PANEL_TOGGLE_KEYWORDS.bottom) {
								const matches = [];
								document.querySelectorAll("button").forEach((b) => {
									const name = ((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "") + " " + (b.textContent || "")).toLowerCase();
									if (name.includes(kw)) matches.push({ text: (b.textContent || "").trim().substring(0, 40), ariaLabel: b.getAttribute("aria-label") || "", visible: b.getClientRects().length > 0, className: b.className.substring(0, 60) });
								});
								if (matches.length > 0) { out.bottomPanelToggle = { keyword: kw, matches }; break; }
							}
							if (!out.bottomPanelToggle) out.bottomPanelToggle = "NOT_FOUND (tried: " + PANEL_TOGGLE_KEYWORDS.bottom.join(", ") + ")";
						} catch (e) { out.bottomPanelToggle = { error: String(e) }; }
						// Details column
						try {
							const frame = document.querySelector("[data-dsh-frame]");
							if (frame) {
								out.detailsColumn = { collapsed: frame.getAttribute("data-details-collapsed") !== null, frameAttr: frame.getAttributeNames().join(", ") };
							} else {
								out.detailsColumn = { frameNotFound: true };
							}
						} catch (e) { out.detailsColumn = { error: String(e) }; }
						// Composer
						try {
							const composer = findComposerInput();
							out.composer = composer !== null ? { tag: composer.tagName, visible: composer.getClientRects().length > 0, parent: composer.parentElement ? (composer.parentElement.className || "").substring(0, 60) : "" } : "NOT_FOUND";
						} catch (e) { out.composer = { error: String(e) }; }
						// Settings scope
						out.settingsScope = settingsScope !== null ? "OK" : "NOT_YET_BOUND";
						return out;
					},
					/** Zero-side-effect readiness map: which actions can fire right now. */
					readiness: () => {
						const bss = betterSidebarService();
						const tabs = bss !== undefined && typeof bss.getTabs === "function" ? bss.getTabs().map((tab) => tab.id) : [];
						const layout = getService("layout");
						const workspaces = getService("workspaces");
						const hasTab = (id) => tabs.includes(id);
						let sessionRows = 0;
						let settingsArea = false;
						let cluster = false;
						try {
							sessionRows = document.querySelectorAll('[class*="sessionRow"]').length;
						} catch {}
						try {
							settingsArea = document.querySelector('[class*="settingsArea"]') !== null;
						} catch {}
						try {
							cluster = document.querySelector("[data-dsh-toggle-cluster]") !== null;
						} catch {}
						return {
							"toggle.sidebar: layout": layout !== undefined,
							"toggle.details: layout": layout !== undefined,
							"toggle.terminal: tab": hasTab("terminal"),
							"open.files: tab": hasTab("editor"),
							"open.git: tab": hasTab("git"),
							"open.sideChat: tab": hasTab("sidechat"),
							"toggle.vision: button": hasVisible('button[data-vision-router-mode-toggle="true"]'),
							"open.subagent: tab": hasTab("subagent"),
							"new.workspace: button": hasVisible('[data-side="sidebar"] button, [data-pane="sidebar"] button') || hasVisible('[class*="workspace"] button'),
							"new.session: workspaces": workspaces !== undefined,
							"sessionNav: rows/workspaces": sessionRows > 0 || workspaces !== undefined,
							"toggle.bottomPanel: cluster": cluster,
							"open.settings: settingsArea": settingsArea,
							"focus.composer": findComposerInput() !== null
						};
					},
					/** Test-only internals (used by automated DOM tests). */
					_test: () => ({
						clickPanelToggle,
						matchesKeywords,
						openSidebarTab,
						sessionNavAttempt,
						actDetails,
						actSessionNav,
						betterSidebarService,
						accessibleName,
						findComposerInput,
						actFocusComposer,
						actToggleSidebar,
						actToggleVision,
						actNewWorkspace,
						actNewSession,
						actRightPanel,
						actSideChat,
						actDetails,
						handleRightPanelNavigation,
						rightPanelButtons,
						handleKeyDown,
						describeEvent,
						// test-only state priming (bypasses settings hydration)
						_prime(bindings, enabled) {
							state.enabled = enabled !== false;
							state.effective = { byCombo: new Map(bindings), perAction: new Map() };
						}
					})
				})
			});
		} catch {}

		module.exports = { name: PLUGIN_ID, inject: ["slots", "locale"], apply };
		return module.exports;
	}
});
