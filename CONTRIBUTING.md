# Contributing

Thanks for taking an interest. Bug reports about a shortcut that does not fire
are especially useful — include the output of `window.__DSH_HOTKEY__.probe()`.

## Getting set up

There are no build steps and no dev dependencies. The browser bundle in
`lib/client.js` is hand-written and served to the DSH web GUI as-is.

```sh
git clone https://github.com/melt502/dsh-hotkey.git
cd dsh-hotkey
npm test
```

To run it against a live DSH Desktop, link the checkout into the `web` profile:

```powershell
dsh plugin --profile web add "link:<absolute path to this checkout>"
```

Restart DSH Desktop after adding the bundle. Afterwards, edits to
`lib/client.js` reach the GUI on page refresh.

## Tests

Four suites, all on Node builtins:

```sh
npm run test:core      # combo parsing, matching, conflicts, core/client drift
npm run test:harness   # ModuleLoader factory + apply() activation in a vm
npm run test:bundle    # package.json / cordis.patch.yml / bundle structure
npm run test:dom       # fake-DOM integration for the actions and key handling
npm run check          # syntax-only pass over the browser bundle
```

Run the suites individually rather than `node --test test/`, which can trip
over child-process restrictions on Windows.

## Conventions

- **Tabs** for indentation in JavaScript, two spaces in JSON and YAML, LF
  endings. `.editorconfig` and `.gitattributes` encode this.
- `lib/core.mjs` holds pure, dependency-free logic and is mirrored verbatim into
  the `CORE-BEGIN` / `CORE-END` region of `lib/client.js`. Change one and the
  drift test fails, so **change both**.
- An action returns `true` only when it actually performed something. The key
  handler calls `preventDefault()` only on a `true` result, so returning `false`
  correctly lets the app's own binding run.
- Every service-backed action needs a DOM fallback. Services such as `layout`
  are provided inside an effect and may be absent when the plugin activates.
- Availability shown in the settings page means "has any executable path",
  service **or** DOM — not merely that a service object exists.

## Adding an action

1. Add the executor near its peers in `lib/client.js`.
2. Register it in the `ACTIONS` table with an `id`, a default combo (`def`, or
   `null` to ship unbound), a `group`, and `zh` / `en` labels.
3. Extend `refreshAvailability()` so the settings page reports it honestly.
4. Export it from `_test()` and add a case to `test/dom.test.mjs`.
5. Update the table in `README.md` and add a `CHANGELOG.md` entry.

## Pull requests

Keep the diff focused, make sure `npm test` passes, and describe what you
verified in a live DSH window — the DOM fallbacks depend on the host's real DOM,
which no fake-DOM test can fully stand in for.
