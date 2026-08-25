// dom.test.mjs — DOM-integration tests for dsh-hotkey's panel/session logic.
// Runs the REAL lib/client.js factory inside a vm with a fake document that
// mimics the app's actual DOM contract (learned from dsh-better-sidebar 0.15.2):
//   - [data-dsh-toggle-cluster] holds the bottom/right panel toggle buttons
//     with aria-labels 折叠底部面板 / 展开底部面板 / 折叠侧边栏 / 展开侧边栏
//   - [data-dsh-panel-host] wraps the panel chrome
//   - session rows match [class*="sessionRow"]
// Run: node test\dom.test.mjs  (NOT node --test test/ — sandbox EPERM)
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal fake element with click tracking. */
class FakeEl {
	constructor({ aria = null, text = "", cls = "", tag = "button" }) {
		this._attrs = {};
		if (aria !== null) this._attrs["aria-label"] = aria;
		this._text = text;
		this.className = cls;
		this.tagName = tag.toUpperCase();
		this.clicked = 0;
		this._visible = true;
		this.isConnected = true;
		this.parentElement = null;
	}
	click() { this.clicked += 1; }
	getAttribute(name) { return this._attrs[name] ?? null; }
	setAttribute(name, value) { this._attrs[name] = value; }
	getAttributeNames() { return Object.keys(this._attrs); }
	get textContent() { return this._text; }
	getClientRects() { return this._visible ? [{ x: 0, y: 0 }] : []; }
	querySelectorAll() { return []; }
	querySelector() { return null; }
	closest() { return null; }
	get setSelectionRange() { return () => {}; }
	get value() { return this._value || ""; }
	set value(v) { this._value = v; }
	focus() { this._focused = true; }
}

/** Fake document serving the selectors the bundle uses. */
class FakeDocument {
	constructor() {
		this.bottomBtn = new FakeEl({ aria: "折叠底部面板", text: "", cls: "toggleButton" });
		this.rightBtn = new FakeEl({ aria: "折叠侧边栏", text: "", cls: "toggleButton" });
		this.otherBtn = new FakeEl({ aria: "发送", text: "发送", cls: "sendButton" });
		this.sessionRow1 = new FakeEl({ tag: "div", cls: "YDXeBa_sessionRow", text: "会话 A" });
		this.sessionRow2 = new FakeEl({ tag: "div", cls: "YDXeBa_sessionRow YDXeBa_selected", text: "会话 B" });
		this.sessionRow3 = new FakeEl({ tag: "div", cls: "YDXeBa_sessionRow", text: "会话 C" });
		this.sessionRow2.setAttribute("aria-selected", "true");
		this.sessionRow1.setAttribute("role", "treeitem");
		this.sessionRow2.setAttribute("role", "treeitem");
		this.sessionRow3.setAttribute("role", "treeitem");
		this.composer = new FakeEl({ tag: "textarea", cls: "uV2eYG_input" });
		this.sidebarToggleBtn = new FakeEl({ tag: "button", cls: "hHd-Xa_iconButton hHd-Xa_toggle", aria: "收起侧边栏" });
		this.newSessionBtn = new FakeEl({ tag: "button", cls: "hHd-Xa_newSession", aria: "新建会话" });
		this.newWorkspaceBtn = new FakeEl({ tag: "button", cls: "workspaceAdd", aria: "添加工作区" });
		this.sidebarPane = { querySelectorAll: (sel) => {
			if (sel === '[class*="iconButton"]') return [this.sidebarToggleBtn];
			if (sel === "button") return [this.sidebarToggleBtn, this.newSessionBtn];
			return [];
		} };
		this.cluster = { querySelectorAll: () => [this.bottomBtn, this.rightBtn] };
		this.frame = new FakeEl({ tag: "div", cls: "frame" });
		this.settingsArea = new FakeEl({ tag: "button", cls: "hHd-Xa_settingsArea", text: "设置" });
		this.terminalTab = new FakeEl({ tag: "div", cls: "nArs4W_tab", text: "终端" });
		this.sidechatTab = new FakeEl({ tag: "div", cls: "nArs4W_tab", text: "侧边对话(beta)" });
		this.terminalTab.setAttribute("title", "终端");
		this.sidechatTab.setAttribute("title", "侧边对话(beta)");
	}
	querySelectorAll(selector) {
		switch (selector) {
			case "[data-dsh-toggle-cluster]": return [this.cluster];
			case "[data-dsh-panel-host]": return [this.cluster];
			case 'button[class*="toggleButton"]': return [this.bottomBtn, this.rightBtn];
			case "button": return [this.bottomBtn, this.rightBtn, this.otherBtn];
			case '[class*="sessionRow"]': return [this.sessionRow1, this.sessionRow2, this.sessionRow3];
			case 'textarea, [contenteditable="true"], [contenteditable=""]': return [this.composer];
			case 'textarea': return [this.composer];
			case '[class*="settingsArea"]': return [this.settingsArea];
			case '[data-pane="sidebar"] [class*="iconButton"]': return [this.sidebarToggleBtn];
			case '[data-pane="sidebar"] button': return [this.sidebarToggleBtn, this.newSessionBtn, this.newWorkspaceBtn];
			case '[class*="workspace"] button': return [this.newWorkspaceBtn];
			case '[class*="workspace"] button': return [this.newWorkspaceBtn];
			case "[data-pane=sidebar]": return [this.sidebarPane];
			case "[data-dsh-frame]": return [this.frame];
			case '[data-dsh-panel-host] [class*="tab"][title]': return [this.terminalTab, this.sidechatTab];
			default: return [];
		}
	}
	querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
	createElement() { return {}; }
	createRange() { return { selectNodeContents() {}, collapse() {} }; }
}

/** Build a fake ctx the bundle can apply() against. */
function makeCtx() {
	const listeners = new Set();
	const injections = new Map();
	const slots = new Map();
	const that = {
		effect: (fn, label) => { that._effects.push(fn); return () => {}; },
		inject: (names, cb) => { injections.set(names.join(","), cb); },
		locale: {
			register: () => () => {},
			bind: () => (key) => key
		},
		slots: {
			inject: (name, cb) => { slots.set(name, cb); },
			register: () => () => {}
		},
		provide: (name, value) => { that._provided.set(name, value); that[name] = value; },
		get: (name) => that._provided.get(name),
		settingsScope: null,
		layout: null,
		workspaces: null,
		sessions: null,
		betterSidebar: null,
		_effects: [],
		_provided: new Map()
	};
	return that;
}

function loadBundle(fakeDoc, fakeWindow) {
	const source = readFileSync(join(ROOT, "lib", "client.js"), "utf8");
	const sandbox = {
		window: fakeWindow,
		document: fakeDoc,
		console,
		setTimeout,
		clearTimeout,
		structuredClone: (v) => JSON.parse(JSON.stringify(v)),
		InputEvent: class {},
		Symbol,
		Object,
		Array,
		Map,
		Set,
		JSON,
		String,
		Number,
		Boolean,
		Math,
		Date,
		Error,
		TypeError,
		RegExp,
		Promise
	};
	sandbox.window = fakeWindow;
	sandbox.window.__ModuleLoader__ = {
		load: ({ id, factory }) => {
			fakeWindow._factory = factory;
		}
	};
	fakeWindow.window = fakeWindow;
	vm.createContext(sandbox);
	vm.runInContext(source, sandbox, { filename: "client.js" });
	return fakeWindow;
}

const doc = new FakeDocument();
const win = {};
win.addEventListener = () => {};
win.removeEventListener = () => {};
win.getSelection = () => ({ removeAllRanges() {}, addRange() {} });
win.innerWidth = 1440;
loadBundle(doc, win);

// Build factory and __DSH_HOTKEY__: call apply(ctx) to populate window.__DSH_HOTKEY__.
const factory = win._factory;
assert.ok(factory, "factory must be captured");
const fakeWindowPriv = win;
// Re-export __DSH_HOTKEY__ by calling apply with a stub ctx.
const reactStub = {
	createElement: (type, props, ...children) => ({ type, props, children }),
	useState: (init) => [init, () => {}],
	useEffect: () => {},
	useRef: () => ({ current: null }),
	useId: () => "test-id",
	useCallback: (fn) => fn,
	useSyncExternalStore: () => null
};
const require = (name) => {
	if (name === "react") return reactStub;
	if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
	throw new Error(`require("${name}") not stubbed`);
};
const ctx = makeCtx();
const exported = factory(require); // returns { name, inject, apply }
exported.apply(ctx);
const hotkey = win.__DSH_HOTKEY__;
assert.ok(hotkey, "__DSH_HOTKEY__ must be defined");
const t = hotkey._test();

// --- Tests ---
// 1. bottom toggle click via cluster
let handled = t.clickPanelToggle("bottom");
assert.equal(handled, true, "bottom toggle must be found");
assert.equal(doc.bottomBtn.clicked, 1, "bottom button clicked once");

// 2. right toggle click via cluster
handled = t.clickPanelToggle("right");
assert.equal(handled, true, "right toggle must be found");
assert.equal(doc.rightBtn.clicked, 1, "right button clicked once");

// 3. keyword matching with real labels
assert.equal(t.matchesKeywords("折叠底部面板\n\n", ["折叠底部面板", "底部面板"]), true);
assert.equal(t.matchesKeywords("发送\n发送\n发送", ["折叠底部面板", "底部面板"]), false);

// 4. session nav fallback (rows exist → should click the target ROW itself, not a nested button)
// actSessionNav(1) with rows [A, B(selected), C] should click C — target.click() must hit the row div.
const rows = doc.querySelectorAll('[class*="sessionRow"]');
const selectedIdx = rows.findIndex((r) => r.getAttribute("aria-selected") === "true");
assert.equal(selectedIdx, 1, "row B is selected via aria-selected");
const prevClicks = doc.sessionRow3.clicked;
const navHandled = t.actSessionNav(1);
assert.equal(navHandled, true, "session.next handled (row found)");
assert.ok(doc.sessionRow3.clicked > prevClicks, "session.next clicked the ROW C (not a nested button)");

// 5. accessibleName composition
assert.ok(t.accessibleName(doc.bottomBtn).includes("折叠底部面板"));

// 6. probe runs without throwing
const probeOut = hotkey.probe();
assert.ok(probeOut, "probe returns data");
assert.ok(probeOut.toggleCluster, "probe dumps toggle cluster");
assert.ok(Array.isArray(probeOut.toggleCluster) && probeOut.toggleCluster.length >= 2, "cluster has 2 buttons");

console.log("✔ dom integration tests passed (panel toggles + session nav + probe)");
console.log("  bottomCluster:", JSON.stringify(probeOut.toggleCluster));

// 7. readiness map without services (no side effects)
const readyEmpty = hotkey.readiness();
assert.ok(readyEmpty, "readiness returns data");
assert.equal(readyEmpty["toggle.terminal: tab"], false, "no betterSidebar → terminal not ready");
assert.equal(readyEmpty["toggle.sidebar: layout"], false, "no layout → not ready");

// 8. readiness with services provided (simulate real app)
ctx.provide("betterSidebar", {
	getTabs: () => [
		{ id: "editor" }, { id: "terminal" }, { id: "git" },
		{ id: "sidechat" }, { id: "subagent" }
	]
});
ctx.provide("layout", {});
ctx.provide("workspaces", {});
const readyFull = hotkey.readiness();
assert.equal(readyFull["toggle.terminal: tab"], true, "terminal tab ready");
assert.equal(readyFull["open.files: tab"], true, "editor tab ready");
assert.equal(readyFull["open.sideChat: tab"], true, "sidechat tab ready");
assert.equal(readyFull["toggle.sidebar: layout"], true, "layout ready");
assert.equal(readyFull["new.session: workspaces"], true, "workspaces ready");
assert.equal(readyFull["toggle.bottomPanel: cluster"], true, "bottom cluster ready");
assert.equal(readyFull["open.settings: settingsArea"], true, "settingsArea ready");
assert.equal(readyFull["sessionNav: rows/workspaces"], true, "session rows or workspaces ready");

console.log("✔ readiness map correct (services → true, no services → false)");
console.log("  with services:", JSON.stringify(readyFull, null, 0));

// 9. composer detection finds the main InputBar textarea
const t2 = hotkey._test();
assert.ok(typeof t2.findComposerInput === "function", "_test exposes findComposerInput");
const composerEl = t2.findComposerInput();
assert.ok(composerEl !== null, "composer found in fake DOM");
assert.equal(composerEl.tagName, "TEXTAREA", "composer is the textarea");
assert.equal(hotkey.readiness()["focus.composer"], true, "composer readiness true with textarea present");

console.log("✔ composer detection works (findComposerInput → InputBar textarea)");

// 10. DOM fallback for toggle.sidebar (no layout service provided at this point)
const toggleClicks = doc.sidebarToggleBtn.clicked;
const sidebarHandled = t.actToggleSidebar();
assert.equal(sidebarHandled, true, "toggle.sidebar via DOM fallback");
assert.ok(doc.sidebarToggleBtn.clicked > toggleClicks, "sidebar toggle button clicked");

// 11. DOM fallback for new.session (no workspaces service provided at this point)
const newClicks = doc.newSessionBtn.clicked;
const newHandled = t.actNewSession();
assert.equal(newHandled, true, "new.session via DOM fallback");
assert.ok(doc.newSessionBtn.clicked > newClicks, "new session button clicked");

console.log("✔ DOM fallback: toggle.sidebar + new.session work without services");

// 12. keydown handler simulation: ctrl+b → toggle.sidebar → preventDefault + DOM click
function synthKey({ key, code, ctrlKey = false, altKey = false, shiftKey = false, metaKey = false, isComposing = false }) {
	const ev = {
		key, code, ctrlKey, altKey, shiftKey, metaKey, isComposing,
		srcElement: { tagName: "BODY" },
		defaultPrevented: false,
		preventDefault() { this.defaultPrevented = true; },
		stopPropagation() { this._stopped = true; }
	};
	return ev;
}
t._prime([["ctrl+b", "toggle.sidebar"]], true);
const beforeClick = doc.sidebarToggleBtn.clicked;
const ev1 = synthKey({ key: "b", code: "KeyB", ctrlKey: true });
t.handleKeyDown(ev1);
assert.equal(ev1.defaultPrevented, true, "ctrl+b is handled (preventDefault)");
assert.ok(doc.sidebarToggleBtn.clicked > beforeClick, "ctrl+b clicked sidebar toggle");

// 13. unbound key passes through untouched
const ev2 = synthKey({ key: "x", code: "KeyX", ctrlKey: true });
t.handleKeyDown(ev2);
assert.equal(ev2.defaultPrevented, false, "ctrl+x (unbound) passes through");

// 14. disabled state passes through
t._prime([["ctrl+b", "toggle.sidebar"]], false);
const ev3 = synthKey({ key: "b", code: "KeyB", ctrlKey: true });
t.handleKeyDown(ev3);
assert.equal(ev3.defaultPrevented, false, "disabled → pass through");
t._prime([["ctrl+b", "toggle.sidebar"]], true); // restore

// 15. IME composition passes through
const ev4 = synthKey({ key: "b", code: "KeyB", ctrlKey: true, isComposing: true });
t.handleKeyDown(ev4);
assert.equal(ev4.defaultPrevented, false, "IME composing → pass through");

console.log("✔ keydown handler simulation (bound / unbound / disabled / IME) passed");

// 16. openSidebarTab DOM fallback: click terminal tab (no betterSidebar service provided)
const termClicks = doc.terminalTab.clicked;
const termHandled = t.openSidebarTab("terminal");
assert.equal(termHandled, true, "openSidebarTab('terminal') via DOM fallback");
assert.ok(doc.terminalTab.clicked > termClicks, "terminal tab clicked");

// 17. openSidebarTab DOM fallback: sidechat
const sideClicks = doc.sidechatTab.clicked;
const sideHandled = t.openSidebarTab("sidechat");
assert.equal(sideHandled, true, "openSidebarTab('sidechat') via DOM fallback");
assert.ok(doc.sidechatTab.clicked > sideClicks, "sidechat tab clicked");

// 18. unknown tab type → false (no crash)
const unkHandled = t.openSidebarTab("nonexistent");
assert.equal(unkHandled, false, "unknown tab type → false");

console.log("✔ openSidebarTab DOM fallback (terminal / sidechat / unknown) passed");

// 19. Ctrl+Alt+B action uses the right-panel toggle, not the details column.
const rightPanelBefore = doc.rightBtn.clicked;
assert.equal(t.actRightPanel(), true, "right panel action handled");
assert.ok(doc.rightBtn.clicked > rightPanelBefore, "right panel toggle clicked");

console.log("✔ right-panel action targets right sidebar toggle");

// 20. Side Chat expands a collapsed right sidebar before creating the chat.
doc.rightBtn.setAttribute("aria-label", "展开侧边栏");
const sidePanelBefore = doc.rightBtn.clicked;
assert.equal(t.actSideChat(), true, "side chat handles collapsed panel");
assert.ok(doc.rightBtn.clicked > sidePanelBefore, "side chat first expands right sidebar");
doc.rightBtn.setAttribute("aria-label", "折叠侧边栏");
console.log("✔ side chat two-step flow expands panel first");

// 21. Right-panel arrow navigation and Enter activation.
doc.rightBtn.setAttribute("aria-label", "折叠侧边栏");
const navDown = { key: "ArrowDown", isComposing: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
assert.equal(t.handleRightPanelNavigation(navDown), true, "ArrowDown handled in right panel");
assert.equal(navDown.prevented, true, "ArrowDown prevented");
const navEnter = { key: "Enter", isComposing: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
const bottomBeforeEnter = doc.bottomBtn.clicked;
assert.equal(t.handleRightPanelNavigation(navEnter), true, "Enter handled in right panel");
assert.ok(doc.bottomBtn.clicked > bottomBeforeEnter, "Enter clicks selected right-panel button");
console.log("✔ right-panel ArrowUp/ArrowDown + Enter navigation passed");

// 22. Ctrl+F action opens the workspace picker.
const workspaceBefore = doc.newWorkspaceBtn.clicked;
assert.equal(t.actNewWorkspace(), true, "new workspace action handled");
assert.ok(doc.newWorkspaceBtn.clicked > workspaceBefore, "workspace add button clicked");
console.log("✔ new workspace action passed");