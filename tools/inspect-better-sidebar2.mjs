// Inspect a dsh-better-sidebar client bundle without embedding a machine path.
// Usage: node tools/inspect-better-sidebar2.mjs <path-to-client.js>
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? process.env.DSH_BETTER_SIDEBAR_CLIENT;
if (!path) {
	console.error("Usage: node tools/inspect-better-sidebar2.mjs <path-to-client.js>");
	process.exitCode = 1;
} else {
	const s = readFileSync(path, "utf8");

	function show(pat, ctx, label, max = 10) {
		console.log("=== " + label + " ===");
		let m, n = 0;
		pat.lastIndex = 0;
		while ((m = pat.exec(s)) !== null && n < max) {
			const lineNo = s.slice(0, m.index).split("\n").length;
			const a = Math.max(0, m.index - ctx);
			const b = Math.min(s.length, m.index + ctx);
			console.log("L" + lineNo + ": ..." + s.slice(a, b).replace(/\n/g, " ") + "...");
			n++;
			if (m.index === pat.lastIndex) pat.lastIndex++;
		}
		if (n === 0) console.log("(none)");
		console.log("");
	}

	show(/conversation.*composer|composer.*textarea|form.*composer/i, 250, "composer textarea", 8);
	show(/sessionItem|session.*click|onClick.*session|click.*session/i, 250, "session click handlers", 8);
	show(/sidebar\.settings|settingsArea/i, 250, "settings area", 4);
	show(/data-pane/i, 200, "data-pane attribute", 6);
	show(/conversation.*input|input.*conversation/i, 200, "conversation input", 6);
	show(/sessionListRender|sessionList.*item|renderSession|SessionItem|SessionRow/i, 200, "session item render", 6);
}
