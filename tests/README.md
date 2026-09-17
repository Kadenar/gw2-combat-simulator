# Test ownership

Tests mirror the source tree under `js/`:

- `app/` covers the game-neutral `#app` layer: game registry, bootstrap, worker harness, page/host integration, and
  shell.
- `kernel/` covers game-neutral runtime contracts, including event queue ordering.
- `ui/` covers game-neutral presentation primitives, including rotation editors, insertion cursors, warnings, and ammo
  display.
- `games/gw2/app/` covers GW2 application composition and user-facing workflows, plus the saved-preset benchmarks in
  `games/gw2/app/benchmarks/`.
- `games/gw2/platform/` covers GW2 platform contracts, including condition resolution, observation windows, and equipment
  procs; `games/gw2/platform/engine/` covers engine contracts such as event resolution and scheduler ordering.
- `games/gw2/professions/` covers cross-profession contracts, while `games/gw2/professions/<profession>/` owns profession
  behavior.
- `games/gw2/integrations/logs/` covers combat-log reconstruction: `evtc/`, `dps-report/`, and `wingman/` for each
  source, and `shared/` for source-neutral rotation rules.
- `architecture/` covers import aliases and cross-package dependency boundaries.
- `browser/` covers the built application's browser and layout behavior.
- `scripts/` covers command-line and authoring tools.
- `fixtures/`, `helpers/`, and `typecheck/` contain shared test support and compile-time contracts. Import them through
  the `#tests/` alias (for example `#tests/helpers/dom.js`) so moving a test never changes its support imports.

Place new tests under the narrowest directory that owns the behavior. Keep shared support in the existing support
directories instead of duplicating it under an owner.

Pages and release CI run each of the nine profession directories in a named step with its own JUnit report. The separate
shared profession contracts step runs `tests/games/gw2/professions/*.test.js`. A failed step does not skip the remaining test
groups, but any failed check still blocks deployment or release asset publication.

GW2 palette, timeline, chart, result, and icon views belong in `games/gw2/app/`, even when their exported names describe
shared UI. Neutral `#ui/` primitives belong in `ui/`. View tests can reuse `helpers/dom.js` to capture markup without browser
nodes.

Mesmer's `chronomancer.test.js`, `mirage.test.js`, `virtuoso.test.js`, and `troubadour.test.js` cover their
specialization behavior. `weapon-skills.test.js`, `slot-skills.test.js`, and `shared-traits.test.js` cover behavior used
across specializations; clone attack scheduling belongs in `autoattacks.test.js`, and relic interactions belong in
`conditions-and-relics.test.js`. A shared engine contract stays under `games/gw2/platform/` when it uses a profession simulation
helper only to supply a small scenario.

API snapshot transforms, fixture-backed fetching, and metadata generation belong in
`scripts/profession-api-snapshot.test.mjs`. Build migration and cross-profession contracts remain under `games/gw2/professions/`.

Preserve focused engine and trait assertions when moving cases. Saved-preset checks cover loading and simulation;
numerical regressions compare only total DPS with at most 1% relative error. Keep preset warnings visible.
