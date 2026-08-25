// lib/index.js — dsh-hotkey node half.
//
// Empty plugin body: all behavior ships in the browser bundle exported from
// "./client" (discovered via the package.json `dsh.client` declaration).
// This entry exists so the bundle appears as a host Loader entry, which the
// client-injection scan requires — same pattern as
// @deepseek-ai/dsh-client-ui-commands ("the empty apply exists so the plugin
// appears in the host cordis.yml / Loader").

/** Host plugin body — no host-side behavior for the hotkey plugin. */
function apply() {}

export { apply };
