// Harness: simulate the dsh web ModuleLoader to detect synchronous throws
// in lib/client.js during materialization (the phase that crashes boot).
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const window = {};
window.__ModuleLoader__ = {
	load(entry) {
		console.log("[harness] __ModuleLoader__.load called for", entry.id);
		const module = { exports: {} };
		const requireStub = (name) => {
			if (name === "react") {
				return {
					createElement: (...args) => ({ type: args[0], props: args[1] || {} }),
					createContext: () => ({ Provider: () => null }),
					useState: (init) => [typeof init === "function" ? init() : init, () => {}],
					useEffect: () => {},
					useRef: (v) => ({ current: v }),
					useMemo: (fn) => fn(),
					useCallback: (fn) => fn,
					Fragment: Symbol("fragment")
				};
			}
			throw new Error("harness: unknown require " + name);
		};
		try {
			const result = entry.factory(requireStub);
			console.log("[harness] factory returned keys:", Object.keys(result || {}));
			if (result && typeof result.apply === "function") {
				console.log("[harness] invoking apply(ctx)...");
				const ctxStub = {
					get: (n) => { console.log("  ctx.get(" + n + ") -> undefined"); return undefined; },
					effect: (fn, label) => { console.log("  ctx.effect(" + label + ") registered"); },
					inject: (deps, cb) => { console.log("  ctx.inject(" + JSON.stringify(deps) + ") registered"); },
					slots: { inject: (slot, cb) => { console.log("  ctx.slots.inject(" + slot + ") registered"); return undefined; } }
				};
				try { result.apply(ctxStub); console.log("[harness] apply() returned without throwing"); }
				catch (applyErr) { console.error("[harness] apply() THREW:", applyErr && applyErr.message); console.error(applyErr && applyErr.stack); }
			}
		} catch (factoryErr) {
			console.error("[harness] FACTORY THREW:", factoryErr && factoryErr.message);
			console.error(factoryErr && factoryErr.stack);
		}
	}
};

const source = readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
const sandbox = { window, console, require: () => { throw new Error("top-level require not allowed"); }, module: { exports: {} }, exports: {} };
vm.createContext(sandbox);
try {
	vm.runInContext(source, sandbox, { filename: "client.js" });
	console.log("[harness] top-level eval OK");
} catch (topErr) {
	console.error("[harness] TOP-LEVEL THREW:", topErr && topErr.message);
	console.error(topErr && topErr.stack);
}
