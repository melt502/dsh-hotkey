// Deeper inspection of a dsh-web-frontend bundle without embedding a machine path.
// Usage: node tools/inspect-web-frontend2.mjs <path-to-bundle.js>
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? process.env.DSH_WEB_FRONTEND_BUNDLE;
if (!path) {
	console.error("Usage: node tools/inspect-web-frontend2.mjs <path-to-bundle.js>");
	process.exitCode = 1;
} else {
	const s = readFileSync(path, "utf8");
	console.log("total len:", s.length);

	function show(pat, ctxChars, label, max = 10) {
		console.log("=== " + label + " ===");
		let m, n = 0;
		pat.lastIndex = 0;
		while ((m = pat.exec(s)) !== null && n < max) {
			const a = Math.max(0, m.index - ctxChars);
			const b = Math.min(s.length, m.index + ctxChars + (m[0] ? m[0].length : 0));
			console.log((n + 1) + ". ..." + s.slice(a, b).replace(/\n/g, " ") + "...");
			n++;
			if (m.index === pat.lastIndex) pat.lastIndex++;
		}
		if (n === 0) console.log("(none)");
		console.log("");
	}

	show(/session/gi, 180, "session (any case)");
	show(/sidebarCol|centerCol|detailsCol/gi, 120, "column classes");
	show(/conversation/gi, 180, "conversation");
	show(/composer/gi, 180, "composer");
	show(/textarea/gi, 100, "textarea (shorter ctx)");
	show(/data-pane/g, 100, "data-pane");
}
