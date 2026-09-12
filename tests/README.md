# Test ownership

Tests follow the same ownership boundaries as the source tree:

- `app/` covers application composition and user-facing workflows.
- `architecture/` covers import aliases and cross-package dependency boundaries.
- `kernel/` covers game-neutral runtime contracts, including event queue ordering.
- `ui/` covers game-neutral presentation primitives, including rotation editors, insertion cursors, warnings, and ammo
  display.
- `platform/engine/` and `platform/gw2/` cover shared engine and GW2 contracts, including condition resolution,
  observation windows, event resolution, and equipment procs.
- `professions/` covers cross-profession contracts, while `professions/<profession>/` owns profession behavior.
- `evtc/`, `dps-report/`, and `log-analyzer/` cover source-specific and shared combat-log reconstruction.
- `browser/` covers the built application's browser and layout behavior.
- `scripts/` covers command-line and authoring tools.
- `fixtures/`, `helpers/`, and `typecheck/` contain shared test support and compile-time contracts.

Place new tests under the narrowest directory that owns the behavior. Keep shared support in the existing support
directories instead of duplicating it under an owner.

Pages and release CI run each of the nine profession directories in a named step with its own JUnit report. The separate
shared profession contracts step runs `tests/professions/*.test.js`. A failed step does not skip the remaining test
groups, but any failed check still blocks deployment or release asset publication.

GW2 palette, timeline, chart, result, and icon views belong in `app/`, even when their exported names describe shared
UI. Neutral `#ui/` primitives belong in `ui/`. View tests can reuse `helpers/dom.js` to capture markup without browser
nodes.

Mesmer's `chronomancer.test.js`, `mirage.test.js`, `virtuoso.test.js`, and `troubadour.test.js` cover their
specialization behavior. `weapon-skills.test.js`, `slot-skills.test.js`, and `shared-traits.test.js` cover behavior used
across specializations; clone attack scheduling belongs in `autoattacks.test.js`, and relic interactions belong in
`conditions-and-relics.test.js`. A shared engine contract stays under `platform/` when it uses a profession simulation
helper only to supply a small scenario.

API snapshot transforms, fixture-backed fetching, and metadata generation belong in
`scripts/profession-api-snapshot.test.mjs`. Build migration and cross-profession contracts remain under `professions/`.

Preserve focused engine and trait assertions when moving cases. Saved-preset checks cover loading and simulation;
numerical regressions compare only total DPS with at most 1% relative error. Keep preset warnings visible.
