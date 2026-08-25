// verify-bundle.cjs — structural verification of the dsh-hotkey bundle
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const clientSrc = fs.readFileSync(path.join(ROOT, "lib", "client.js"), "utf8");
const idxSrc = fs.readFileSync(path.join(ROOT, "lib", "index.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const patch = fs.readFileSync(path.join(ROOT, "cordis.patch.yml"), "utf8");
const core = fs.readFileSync(path.join(ROOT, "lib", "core.mjs"), "utf8");

let ok = true;
const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + "  " + name); if (!cond) ok = false; };

// client.js wrapper structure
check("client.js contains ModuleLoader.load", clientSrc.includes("window.__ModuleLoader__.load({"));
check("client.js id is dsh-hotkey", /id:\s*"dsh-hotkey"/.test(clientSrc));
check("client.js ends with });", clientSrc.trimEnd().endsWith("});"));
check("client.js exports {name, inject:[slots,locale], apply}", clientSrc.includes('inject: ["slots", "locale"]'));
check("client.js has CORE-BEGIN marker", clientSrc.includes("/* CORE-BEGIN"));
check("client.js has CORE-END marker", clientSrc.includes("/* CORE-END */"));

// index.js
check("index.js exports apply", /export\s+\{[^}]*apply/.test(idxSrc));

// core.mjs pure module
check("core.mjs is ESM (export keyword)", core.includes("export function") || core.includes("export const"));

// package.json contract
check("pkg.name dsh-hotkey", pkg.name === "dsh-hotkey");
check("pkg has dsh.bundle.patch", pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === "./cordis.patch.yml");
check("pkg has dsh.client.platform web", pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === "web");
check("pkg exports ./client", pkg.exports && pkg.exports["./client"] && pkg.exports["./client"].default === "./lib/client.js");
check("pkg exports . resolves to index", pkg.exports["."] === "./lib/index.js" || (pkg.exports["."] && pkg.exports["."].default === "./lib/index.js"));

// cordis.patch.yml shape (mirrors dsh-chat-import's known-good file)
check("patch has - insert:", patch.includes("- insert:"));
check("patch has id: hotkey", patch.includes("id: hotkey"));
check("patch has name: dsh-hotkey", patch.includes("name: dsh-hotkey"));
check("patch has no em-dash/non-ascii comment chars", !/[^\x00-\x7F]/.test(patch));

console.log(ok ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(ok ? 0 : 1);