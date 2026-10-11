# Test ownership

Tests mirror the source tree under `js/`:

- `browser/` uses `*.test.js` for the game-neutral `#browser` layer (registry, worker harness, page integration, and
  shell) and `*.spec.js` for Playwright browser and layout checks.
- `kernel/` covers game-neutral runtime contracts, including event queue ordering.
- `ui/` covers game-neutral presentation primitives, including rotation editors, insertion cursors, warnings, and ammo
  display.
- `games/gw2/app/` covers GW2 application composition and user-facing workflows, plus the saved-preset benchmarks in
  `games/gw2/app/benchmarks/`.
- `games/gw2/platform/` covers GW2 platform contracts, including condition resolution, observation windows, and
  equipment procs. Its `events/`, `effects/`, `execution/`, `resolver/`, `skills/`, and `profession-definition/`
  directories cover the corresponding platform owners; `architecture/platform-ownership.test.mjs` enforces their import
  boundaries.
- `games/gw2/professions/` covers cross-profession contracts, while `games/gw2/professions/<profession>/` owns
  profession behavior.
- `games/gw2/integrations/logs/` covers combat-log reconstruction: `evtc/`, `dps-report/`, and `wingman/` for each
  source, and `shared/` for source-neutral rotation rules.
- `architecture/` covers import aliases and cross-package dependency boundaries.
- `scripts/` covers command-line and authoring tools.
- `fixtures/`, `helpers/`, and `typecheck/` contain shared test support and compile-time contracts. Import them through
  the `#tests/` alias (for example `#tests/helpers/dom.js`) so moving a test never changes its support imports.

Place new tests under the narrowest directory that owns the behavior. Keep shared support in the existing support
directories instead of duplicating it under an owner.

Pages and release CI run each of the nine profession directories in a named step with its own JUnit report. The separate
shared profession contracts step runs `tests/games/gw2/professions/*.test.js`. A failed step does not skip the remaining
test groups, but any failed check still blocks deployment or release asset publication.

GW2 palette, timeline, chart, result, and icon views belong in `games/gw2/app/`, even when their exported names describe
shared UI. Neutral `#ui/` primitives belong in `ui/`. View tests can reuse `helpers/dom.js` to capture markup without
browser nodes.

A shared engine contract stays under `games/gw2/platform/` even when a profession simulation helper supplies the
scenario. API snapshot transforms and metadata generation belong in `scripts/profession-api-snapshot.test.mjs`; build
migration and cross-profession contracts remain under `games/gw2/professions/`.

## Choosing validation

For profession, engine, or data changes, run focused Node tests and relevant build/type checks. Browser tests cover
native interactions, focus, layout, workers, and module loading; run the affected browser files for UI changes. Keep
formula and profession matrices in Node tests. `npm run check` does not launch browsers; `npm run check:all` includes
the full browser suite for integration/release validation.

Follow [AGENTS.md](../AGENTS.md#testing-policy): test scheduling, cooldowns, resources, state transitions, causal order,
observation windows, loading, migration, and validation. Do not add cast-time/Quickness calibration, interrupt-commit or
retained-lockout tests, or standalone hit-timestamp, damage-tick, pulse-count, and native-packet schedule checks. Player
health is always full in combat tests; variable health belongs only to isolated attribute previews. Target-health
behavior remains in scope.

Preserve focused engine and trait assertions when moving cases. Saved-preset checks cover loading and simulation;
numerical regressions compare only total DPS with at most 1% relative error. Keep preset warnings visible.
