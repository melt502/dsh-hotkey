// Inspect a dsh-better-sidebar client bundle without embedding a machine path.
// Usage: node tools/inspect-better-sidebar.mjs <path-to-client.js>
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? process.env.DSH_BETTER_SIDEBAR_CLIENT;
if (!path) {
	console.error("Usage: node tools/inspect-better-sidebar.mjs <path-to-client.js>");
	process.exitCode = 1;
} else {
	const s = readFileSync(path, "utf8");
	console.log("total lines:", s.split("\n").length, "len:", s.length);

	function show(pat, label, max = 12) {
		console.log("=== " + label + " ===");
		let m, n = 0;
		pat.lastIndex = 0;
		while ((m = pat.exec(s)) !== null && n < max) {
			const lineNo = s.slice(0, m.index).split("\n").length;
			console.log("L" + lineNo + ": " + s.slice(Math.max(0, m.index - 70), m.index + 130).replace(/\n/g, " "));
			n++;
			if (m.index === pat.lastIndex) pat.lastIndex++;
		}
		if (n === 0) console.log("(none)");
		console.log("");
	}

	show(/sessionRow/g, "sessionRow class");
	show(/sessionList/g, "sessionList");
	show(/aria-label/g, "aria-label (first 8)", 8);
	show(/sidebarCol|centerCol|detailsCol/g, "column col markers");
	show(/contentEditable|contenteditable/g, "contenteditable");
	show(/textarea/g, "textarea");
	show(/data-dsh-/g, "data-dsh-* attrs", 10);
	show(/composer/g, "composer", 6);
	show(/approve|批准|同意/g, "approval", 8);
}
