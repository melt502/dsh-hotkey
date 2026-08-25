// test/bindings.test.mjs — dsh-hotkey keybinding core tests.
//
// Two layers:
//   1. Direct assertions against lib/core.mjs (the source of truth).
//   2. A drift guard: the CORE-BEGIN…CORE-END region of lib/client.js is
//      extracted, imported under node, and both copies must pass an identical
//      behavior battery — so the browser bundle cannot drift from core.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import {
	MODIFIER_ORDER,
	CODE_TO_SPEC,
	normalizeCombo,
	describeEvent,
	eventMatches,
	formatCombo,
	computeEffective,
	parseImportPayload,
	isValidComboSpec
} from "../lib/core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Extract and import the mirrored CORE region from lib/client.js. */
async function importClientCore() {
	const source = readFileSync(path.join(here, "../lib/client.js"), "utf8");
	const beginMatch = /^[ \t]*\/\* CORE-BEGIN.*$/m.exec(source);
	const endMatch = /^[ \t]*\/\* CORE-END \*\/[ \t]*$/m.exec(source);
	assert.ok(beginMatch !== null, "CORE-BEGIN marker missing from lib/client.js");
	assert.ok(endMatch !== null && endMatch.index > beginMatch.index, "CORE-END marker missing from lib/client.js");
	const begin = beginMatch.index;
	const end = endMatch.index + endMatch[0].length;
	const region = source.slice(begin, end);
	const shim = `${region}\nexport { MODIFIER_ORDER, CODE_TO_SPEC, normalizeCombo, describeEvent, eventMatches, formatCombo, computeEffective, parseImportPayload, isValidComboSpec };`;
	const temp = path.join(here, ".core-mirror.mjs");
	const { writeFileSync } = await import("node:fs");
	writeFileSync(temp, shim);
	try {
		return await import(pathToFileURL(temp).href);
	} finally {
		const { unlinkSync } = await import("node:fs");
		unlinkSync(temp);
	}
}

/** Shared behavior battery run against BOTH copies. */
function behaviorBattery(Core) {
	const { normalizeCombo: norm, describeEvent: describe, eventMatches: matches, formatCombo: format, computeEffective: effective, isValidComboSpec: validSpec } = Core;

	// --- normalizeCombo ---
	assert.deepEqual(
		norm("ctrl+b"),
		{ id: "ctrl+b", ctrl: true, alt: false, shift: false, meta: false, primary: "b" }
	);
	assert.equal(norm("Ctrl + B").id, "ctrl+b", "case/whitespace normalized");
	assert.equal(norm("b+ctrl").id, "ctrl+b", "modifier order canonicalized");
	assert.equal(norm("alt+e").id, "alt+e");
	assert.equal(norm("ctrl+`").id, "ctrl+`");
	assert.equal(norm("ctrl+[").id, "ctrl+[");
	assert.equal(norm("enter").id, "enter");
	assert.equal(norm("escape").id, "escape");
	assert.equal(norm(""), null, "empty spec rejected");
	assert.equal(norm(null), null);
	assert.equal(norm(undefined), null);
	assert.equal(norm("ctrl"), null, "modifier-only rejected");
	assert.equal(norm("ctrl+b+d"), null, "two primaries rejected");
	assert.equal(norm("ctrl+shift+b").id, "ctrl+shift+b", "multi-modifier parses");
	assert.equal(norm("ctrl+b+b"), null, "duplicate primary rejected");
	assert.equal(norm("ctrl+ctrl"), null, "duplicate modifier rejected");

	// --- describeEvent / matching ---
	const ev = (overrides) => ({
		ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
		code: "", key: "", isComposing: false, ...overrides
	});
	assert.equal(describe(ev({ ctrlKey: true, code: "KeyB", key: "b" })), "ctrl+b");
	assert.equal(describe(ev({ ctrlKey: true, code: "Backquote", key: "`" })), "ctrl+`");
	assert.equal(describe(ev({ ctrlKey: true, code: "BracketLeft", key: "[" })), "ctrl+[");
	assert.equal(describe(ev({ code: "BracketRight", key: "]" })), "ctrl+]".replace("ctrl+", ""));
	assert.equal(describe(ev({ altKey: true, code: "KeyE", key: "e" })), "alt+e");
	assert.equal(describe(ev({ code: "Enter", key: "Enter" })), "enter");
	assert.equal(describe(ev({ code: "NumpadEnter", key: "Enter" })), "enter", "numpad enter equals enter");
	assert.equal(describe(ev({ code: "Escape", key: "Escape" })), "escape");
	assert.equal(describe(ev({ ctrlKey: true, shiftKey: true, code: "KeyE", key: "E" })), "ctrl+shift+e");
	assert.equal(describe(ev({ ctrlKey: true, altKey: true, code: "KeyB", key: "b" })), "ctrl+alt+b");
	assert.equal(describe(ev({ code: "Comma", key: "," })), ",");
	assert.equal(describe(ev({ code: "Unidentified", key: "F13" })), "f13", "unknown code falls back to e.key");

	assert.equal(matches(ev({ ctrlKey: true, code: "KeyB", key: "b" }), "ctrl+b"), true);
	assert.equal(matches(ev({ ctrlKey: true, code: "KeyB", key: "B" }), "ctrl+b"), true, "shifted display key still matches by code");
	assert.equal(matches(ev({ ctrlKey: true, shiftKey: true, code: "KeyB", key: "B" }), "ctrl+b"), false, "extra modifier breaks match");
	assert.equal(matches(ev({ ctrlKey: true, code: "KeyB", key: "b" }), "ctrl+c"), false);
	assert.equal(matches(ev({}), null), false, "invalid spec never matches");

	// Shifted punctuation: ctrl+shift+e must NOT fire for ctrl+shift+E typed via code KeyE? It must:
	assert.equal(matches(ev({ ctrlKey: true, shiftKey: true, code: "KeyE", key: "E" }), "ctrl+shift+e"), true);

	// --- formatCombo ---
	assert.equal(format("ctrl+b"), "Ctrl+B");
	assert.equal(format("ctrl+`"), "Ctrl+`");
	assert.equal(format("alt+e"), "Alt+E");
	assert.equal(format("ctrl+["), "Ctrl+[");
	assert.equal(format("enter"), "Enter");
	assert.equal(format("escape"), "Esc");
	assert.equal(format(42), "", "non-string input yields empty label");

	// --- computeEffective ---
	const actions = [
		{ id: "a.one", def: "ctrl+a" },
		{ id: "a.two", def: null },
		{ id: "a.three", def: "ctrl+x" },
		{ id: "a.four", def: "ctrl+y" }
	];
	const resolved = effective(actions, null);
	assert.equal(resolved.perAction.get("a.one"), "ctrl+a");
	assert.equal(resolved.perAction.get("a.two"), null);
	assert.equal(resolved.byCombo.get(norm("ctrl+a").id), "a.one");
	assert.equal(resolved.conflicts.size, 0);

	// reassign
	const reassigned = effective(actions, { "a.two": { key: "alt+t" } });
	assert.equal(reassigned.perAction.get("a.two"), "alt+t");
	assert.equal(reassigned.byCombo.get(norm("alt+t").id), "a.two");

	// disable ("")
	const disabled = effective(actions, { "a.three": { key: "" } });
	assert.equal(disabled.perAction.get("a.three"), null);
	assert.equal(disabled.byCombo.get(norm("ctrl+x").id), undefined);

	// disable (null entry)
	const disabledNull = effective(actions, { "a.three": { key: null } });
	assert.equal(disabledNull.perAction.get("a.three"), null);

	// restore default = absent entry
	const restored = effective(actions, { "a.one": { key: "ctrl+z" }, "a.four": { key: undefined } });
	assert.equal(restored.perAction.get("a.one"), "ctrl+z");

	// conflict: later action loses byCombo but is marked
	const conflicting = effective(actions, { "a.two": { key: "ctrl+a" } });
	assert.ok(conflicting.conflicts.has("a.two"));
	assert.equal(conflicting.byCombo.get(norm("ctrl+a").id), "a.one", "first action keeps the combo");
	assert.equal(conflicting.byCombo.get(norm("ctrl+x").id), "a.three", "unrelated combos unaffected");

	// invalid user combo falls back to default
	const invalidUser = effective(actions, { "a.one": { key: "ctrl++" } });
	assert.equal(invalidUser.perAction.get("a.one"), "ctrl+a");

	// --- isValidComboSpec ---
	assert.equal(validSpec("ctrl+b"), true);
	assert.equal(validSpec("alt+e"), true);
	assert.equal(validSpec("`"), true, "single punctuation char allowed");
	assert.equal(validSpec("f13"), true);
	assert.equal(validSpec("not a combo!!!"), false, "garbage multi-char token rejected");
	assert.equal(validSpec("ctrl+ctrl"), false);

	// --- parseImportPayload ---
	assert.deepEqual(parseImportPayload({ "a.one": "ctrl+b", "a.two": "" }), { "a.one": { key: "ctrl+b" }, "a.two": { key: "" } });
	assert.deepEqual(parseImportPayload({ "a.one": null }), { "a.one": { key: null } });
	assert.deepEqual(parseImportPayload({ "a.one": { key: "ctrl+k" } }), { "a.one": { key: "ctrl+k" } });
	assert.equal(parseImportPayload([]), null, "arrays rejected");
	assert.equal(parseImportPayload("x"), null, "strings rejected");
	assert.equal(parseImportPayload({ "a.one": 42 }), null, "numeric values rejected");
	assert.equal(parseImportPayload({ "a.one": "not a combo!!!" }), null, "invalid combo rejected");
}

test("core.mjs behavior battery", () => {
	behaviorBattery({ normalizeCombo, describeEvent, eventMatches, formatCombo, computeEffective, isValidComboSpec });
});

test("client.js CORE region mirrors core.mjs without drift", async () => {
	const mirror = await importClientCore();
	for (const key of ["MODIFIER_ORDER", "CODE_TO_SPEC"]) {
		assert.deepEqual(mirror[key], key === "MODIFIER_ORDER" ? MODIFIER_ORDER : CODE_TO_SPEC);
	}
	behaviorBattery(mirror);
});

test("constants are complete", () => {
	for (const letter of "abcdefghijklmnopqrstuvwxyz") {
		assert.notEqual(CODE_TO_SPEC[`Key${letter.toUpperCase()}`], undefined, `missing Key${letter.toUpperCase()}`);
	}
	for (const digit of "0123456789") {
		assert.notEqual(CODE_TO_SPEC[`Digit${digit}`], undefined, `missing Digit${digit}`);
	}
	assert.deepEqual(MODIFIER_ORDER, ["ctrl", "alt", "shift", "meta"]);
});
