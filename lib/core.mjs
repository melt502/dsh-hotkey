// lib/core.mjs — dsh-hotkey pure keybinding core.
//
// No DOM / browser / React access: this module is imported directly by the
// node test suite and mirrored verbatim into lib/client.js between the
// /* CORE-BEGIN */ … /* CORE-END */ markers (the test suite dynamically
// imports that marked region and asserts both copies behave identically, so
// the bundle cannot drift from this source of truth).
//
// Canonical combo grammar: modifiers in fixed order `ctrl+alt+shift+meta`
// followed by exactly one primary key token, all lowercase — e.g.
// "ctrl+b", "ctrl+alt+b", "ctrl+shift+e", "alt+e", "ctrl+`", "ctrl+[",
// "ctrl+]", "enter", "escape". Primary tokens prefer KeyboardEvent.code
// mapping (layout-stable); unknown tokens fall back to e.key.toLowerCase().

/** Fixed modifier order used by every canonical combo id. */
export const MODIFIER_ORDER = ["ctrl", "alt", "shift", "meta"];

const MODIFIER_SET = new Set(MODIFIER_ORDER);

/** KeyboardEvent.code → canonical primary token. */
export const CODE_TO_SPEC = {
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

/** Human display for primary tokens (formatCombo). */
const DISPLAY_OVERRIDES = {
	"`": "`", enter: "Enter", escape: "Esc", tab: "Tab", space: "Space",
	up: "↑", down: "↓", left: "←", right: "→",
	delete: "Del", backspace: "Backspace", pageup: "PgUp", pagedown: "PgDn"
};

/** Primary tokens reachable through KeyboardEvent.code mapping. */
const KNOWN_PRIMARIES = new Set(Object.values(CODE_TO_SPEC));

/**
 * Strict validation used for persisted/imported specs: the grammar accepts
 * any single token as a primary (runtime matching falls back to e.key), but
 * stored combos should resolve to something a keyboard can actually produce —
 * a mapped code name, any single character, or an F-key.
 */
export function isValidComboSpec(spec) {
	const norm = normalizeCombo(spec);
	if (norm === null) return false;
	if (KNOWN_PRIMARIES.has(norm.primary)) return true;
	if (norm.primary.length === 1) return true;
	return /^f\d{1,2}$/.test(norm.primary);
}

/**
 * Parse a user-facing combo string into a canonical descriptor.
 * @param spec - e.g. "Ctrl+B", "ctrl+alt+b", "alt+e", "`".
 * @returns `{ id, ctrl, alt, shift, meta, primary }` or null when invalid
 *   (empty, duplicate modifier, or more than one primary key).
 */
export function normalizeCombo(spec) {
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

/**
 * Describe a keyboard event as a canonical combo id using the same grammar,
 * so matching is `describeEvent(event) === normalizeCombo(spec).id`.
 * @param event - a KeyboardEvent-like object (`ctrlKey/altKey/shiftKey/metaKey/code/key`).
 */
export function describeEvent(event) {
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

/**
 * Whether a keyboard event matches a combo spec string.
 * Convenience over describeEvent + normalizeCombo; null/invalid specs never match.
 */
export function eventMatches(event, spec) {
	const norm = normalizeCombo(spec);
	return norm !== null && norm.id === describeEvent(event);
}

/**
 * Human-readable label for a canonical combo id, e.g. "ctrl+`" → "Ctrl+`".
 * Invalid input returns the raw string unchanged.
 */
export function formatCombo(spec) {
	const norm = normalizeCombo(spec);
	if (norm === null) return typeof spec === "string" ? spec : "";
	const labels = [];
	for (const mod of MODIFIER_ORDER) if (norm[mod]) labels.push(mod === "ctrl" ? "Ctrl" : mod === "meta" ? "Meta" : mod === "alt" ? "Alt" : "Shift");
	const primary = norm.primary;
	labels.push(Object.prototype.hasOwnProperty.call(DISPLAY_OVERRIDES, primary) ? DISPLAY_OVERRIDES[primary] : primary.length === 1 ? primary.toUpperCase() : primary);
	return labels.join("+");
}

/**
 * Resolve effective bindings from defaults plus user overrides.
 *
 * User entry semantics per action id:
 *   - missing entry            → use the action default (`def`)
 *   - `{ key: "<combo>" }`     → reassigned to that combo
 *   - `{ key: "" }`            → explicitly disabled (unassigned)
 *   - `{ key: null }`          → explicitly disabled (unassigned)
 *
 * @param actions - ordered list of `{ id, def? }` (table order = runtime priority).
 * @param userBindings - plain object map or null/undefined.
 * @returns `{ perAction: Map<actionId, string|null>, byCombo: Map<comboId, actionId>,
 *   conflicts: Set<actionId> }` where `byCombo` keeps only the first action per
 *   combo (VS Code priority semantics) and `conflicts` marks every action whose
 *   combo collides with an earlier one.
 */
export function computeEffective(actions, userBindings) {
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
				// Reassignment: store canonically; an invalid combo falls back to
				// the default rather than silently disabling the action.
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

/**
 * Validate an import payload for the settings editor:
 * accepts a plain object of `actionId → combo-string|null|""`.
 * @returns normalized map, or null when the payload shape is invalid.
 */
export function parseImportPayload(payload) {
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
