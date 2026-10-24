# AGENTS.md

Rules for coding agents (Claude Code, Codex, Cursor, …) working in this repo.

## What this is

A Tampermonkey/Violentmonkey userscript that draws a live overlay of
9router (the self-hosted AI router, `npm i -g 9router`) combo chains on top of a 9router dashboard.
It runs in the dashboard's own origin and reads the dashboard's `/api/*` endpoints with the
viewer's session cookie. It has no backend, no dependencies, and sends nothing to any other host.

## Layout

```
src/core.js         overlay (data loading, chain resolution, rendering); exposes
                    globalThis.NineRouterComboViz.create() -> { open, close, toggle, isOpen }
src/userscript.js   shell: host detection, floating button, Alt+Shift+C, menu commands
src/header.txt      userscript metadata block; {{version}} comes from package.json
build.mjs           concatenates header + core + shell into dist/
dist/9router-combo-visualizer.user.js   built file, committed (install + @updateURL target)
```

## Commands

- `npm run build`: rebuild `dist/` after any change in `src/`.
- `npm run check`: syntax-check sources and fail if `dist/` is stale. Run it before every commit.

## Conventions

- **Plain browser JavaScript, no dependencies, no bundler, no framework.** The output must stay a
  single readable `.user.js` that people can audit before installing.
- **Never hardcode a dashboard host, IP or port** in code, docs or examples. Detection happens at
  runtime (title hint or allowlist, then an `/api/combos` probe). Use `http://<your-9router>:20128`
  as the placeholder in docs.
- **Read-only:** the overlay only issues `GET` requests and opens the usage `EventSource`. Never
  add calls that change 9router state (POST/PUT/DELETE, provider tests, model tests).
- **No secrets in the UI or repo:** never render or log API keys, tokens or provider credentials.
  `/api/providers` returns more than the overlay needs, so pick fields explicitly.
- **Everything inside a shadow root** so the dashboard's CSS cannot leak in and ours cannot leak
  out. Colours are CSS variables with a `prefers-color-scheme: dark` override.
- **Escape every API string** with `esc()` before it goes into `innerHTML`.
- Match the existing style: 2-space indent, double quotes, small pure helpers, short comments
  explaining why rather than what.

## Releasing

1. Bump `version` in `package.json` for every user-visible change (Tampermonkey only updates
   when `@version` grows). `X.Y` marks a timeframe, not the kind of change: every release inside
   it, feature or fix, bumps only `Z` (0.5.0 → 0.5.1 → 0.5.2). The maintainer decides when a new
   timeframe starts and `Y` (or `X`) goes up; never bump them on your own.
2. `npm run build && npm run check`.
3. Commit `src/`, `package.json` and `dist/` together in the release commit.
4. Push `main`. Installed copies pick it up via `@updateURL`.

## Git

- **Granular commits:** one logical change per commit (e.g. a CSS fix, a new strategy, the
  version bump plus rebuild). Do not mix refactors with behaviour changes.
- Imperative English subject ≤ 72 chars, a body when the reason is not obvious.
- `Co-Authored-By` trailers are fine; never add session trailers (e.g. `Claude-Session:`).
- Small changes go straight to `main`; use a branch + PR for larger reworks.
- Commit or push only when the maintainer asks.

## Testing changes

There is no test suite; verify in a real dashboard:

1. Serve the repo locally: `python3 -m http.server 8765 --bind 127.0.0.1`.
2. In a logged-in dashboard tab, run in the console:
   ```js
   await new Promise((ok) => { const s = document.createElement("script");
     s.src = "http://127.0.0.1:8765/src/core.js?" + Date.now(); s.onload = ok; document.head.appendChild(s); });
   window.v = NineRouterComboViz.create(); v.open();
   ```
3. For the shell, open `http://127.0.0.1:8765/dist/9router-combo-visualizer.user.js` and let
   Tampermonkey install it (remove the GitHub-installed copy first to avoid running both).

Check at least, in the Cards, Tree and Flow views: a nested combo, a round-robin combo, an empty
combo, a combo with an unknown prefix or a reference to a missing combo, connection details on
click, collapsing a nested combo (Tree/Cards) or highlighting its routes (Flow), dragging to pan a Tree/Flow wider and taller than the window
(a drag must not toggle the node it started on), light and dark mode, and the stream reconnect state.

## 9router API contract

Endpoints used (all `GET`, cookie auth), verified against 9router v0.5.109:

| Endpoint | Fields relied on |
|---|---|
| `/api/combos` | `combos[].name`, `.kind`, `.models[]` (entries are `prefix/model`, a combo name, or a model alias) |
| `/api/settings` | `comboStrategy`, `comboStrategies[name].fallbackStrategy` |
| `/api/providers` | `connections[]`: `provider`, `name`, `priority`, `isActive`, `testStatus`, `errorCode`, `backoffLevel`, `rateLimitedUntil`, `modelLock_<model>`, `lastError`, `lastUsedAt`, `providerSpecificData.prefix` |
| `/api/provider-nodes` | `nodes[]`: `id`, `name`, `prefix` |
| `/api/models/alias` | `aliases` (bare name → `provider/model`) |
| `/api/usage/stream` | SSE: `byModel{rawModel,provider,requests,lastUsed}`, `pending.byModel`, `activeRequests`, `recentRequests`, `totalRequests` |

Known strategies: `fallback`, `round-robin`, `random`, `smart`, `fusion` (see `STRATEGY` in
`src/core.js`). An unknown strategy renders as a generic parallel group.

### Refreshing the alias snapshot

`ALIAS` in `src/core.js` is a snapshot of 9router's built-in provider catalog. 9router does not
expose it over the API. To refresh it after a 9router upgrade, run on the 9router host:

```sh
cd "$(npm root -g)/9router/app/.next-cli-build/server/chunks"
cat *.js | grep -oE '\{id:"[a-z0-9-]+",[^{}]{0,120}alias:"[^"]+"(,aliases:\[[^]]*\])?(,uiAlias:"[^"]+")?'
```

Map every `alias`, `uiAlias` and `aliases[]` value that differs from `id` to that `id`, update
the version note above the constant, and mention the 9router version in the commit.

## Known limitations

- Traffic is attributed per model and provider, not per combo: the usage stream does not say
  which combo a request came through.
- "serves now" is a prediction from connection health, not a trace of the router's decision.
  Sticky round-robin state and smart/fusion scoring are not visible over the API.
