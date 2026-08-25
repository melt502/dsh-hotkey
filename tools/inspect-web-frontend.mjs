// Inspect a dsh-web-frontend renderer bundle without embedding a machine path.
// Usage: node tools/inspect-web-frontend.mjs <path-to-bundle.js>
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? process.env.DSH_WEB_FRONTEND_BUNDLE;
if (!path) {
	console.error("Usage: node tools/inspect-web-frontend.mjs <path-to-bundle.js>");
	process.exitCode = 1;
} else {
	const s = readFileSync(path, "utf8");
	console.log("total len:", s.length);

	function show(pat, ctxChars, label, max = 8) {
		console.log("=== " + label + " ===");
		let m, n = 0;
		pat.lastIndex = 0;
		while ((m = pat.exec(s)) !== null && n < max) {
			const a = Math.max(0, m.index - ctxChars);
			const b = Math.min(s.length, m.index + ctxChars + pat.source.length);
			console.log((n + 1) + ". ..." + s.slice(a, b).replace(/\n/g, " ") + "...");
			n++;
			if (m.index === pat.lastIndex) pat.lastIndex++;
		}
		if (n === 0) console.log("(none)");
		console.log("");
	}

	show(/contentEditable/g, 180, "contentEditable");
	show(/contenteditable/gi, 180, "contenteditable (ci)");
	show(/placeholder/g, 240, "placeholder");
	show(/textarea/gi, 140, "textarea");
	show(/sessionRow/g, 200, "sessionRow");
	show(/ask-for-approval|approval|approve|Decide/g, 200, "approval hints");
	show(/data-dsh-/g, 100, "data-dsh-* attrs");
}
