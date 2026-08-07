# Existing Test Failure Inventory

Recorded on 2026-08-07 against branch `consolidation_v6` at `b9b6869`, with
the existing uncommitted working-tree changes included.

## Test status

| Command | Result |
| --- | --- |
| `npm test -- --test-concurrency=1` | **Failed:** 859 tests, 855 passed, 4 failed |
| `npm run check` | **Passed:** build, TypeScript checks, JavaScript syntax checks, and compiled-output checks |

All four consistent failures are top-level tests. The previously failing
nested Mesmer fixtures now pass.

Default-concurrency full runs also intermittently failed one or more native
profession registration/contract tests. Each transient failure passed when
rerun focused, and a serialized full run produced only the five failures below.

The repository's GitHub Pages workflow runs `npm run check`, but does not run
`npm test`. These failures therefore are not currently enforced by CI.

| Test file | Failures | Main area |
| --- | ---: | --- |
| `tests/app-ui.test.js` | 1 | Saved Mesmer benchmark drift |
| `tests/engineer.test.js` | 3 | Amalgam benchmark and proc drift |
| **Total** | **4** | |

## Failure details

### `tests/app-ui.test.js`

#### `template preview DPS matches each deterministic saved rotation`

- The Chronomancer Power preset stores `44,259` DPS in
  `Builds/mesmer/manifest.json`.
- The current deterministic simulation rounds to `43,936` DPS.
- Difference: `-323` DPS (`-0.73%`).
- The saved value was added in commit `2a0fcdf`. Later Mesmer timing and clone
  mechanic changes were committed in `e19c455` and `b9b6869`, but the manifest
  benchmark was not updated or re-baselined.

Likely cause: the saved benchmark is stale relative to current Mesmer
mechanics. This inventory does not determine whether the mechanics or the
benchmark should be changed.

### `tests/engineer.test.js`

#### `power Amalgam hammer Symbiotic preset preserves supplied build and log`

- Saved benchmark: `42,176.5568` DPS.
- Current simulation: `40,274.0818` DPS.
- Difference: `-1,902.4750` DPS.
- Allowed tolerance: `1,500` DPS.
- The simulation emits no warnings. The later assertions for protocol counts,
  Evolve/Flux State counts, and Demolish/Smash timing all match when inspected
  independently.

Likely cause: behavioral drift in the current resolver/native-module
consolidation, not a malformed saved build or rotation. The exact damage owner
was not isolated.

#### `condition alacrity Amalgam benchmark preset preserves supplied build`

- Expected Carbolic Composition applications: `112`.
- Actual applications: `118`.
- The six additional applications align with the six
  `Offensive Protocol: Obliterate` hits. The test's nearby comment discusses
  excluding six Devastator casts, but diagnostics confirm Devastator is already
  excluded from Carbolic Composition.
- The current DPS is `35,849.7792`, which is still inside the test's
  `35,609 +/- 250` tolerance.
- If execution continues past the first failed assertion, bleeding damage is
  also `934,151.92` instead of `929,396.64 +/- 2`.

Likely cause: the expected proc accounting is stale or ownership/reaction
semantics changed during the current Engineer module consolidation. The nearby
test comment no longer explains the observed six-event difference.

#### `condition Amalgam three-kit benchmark preserves the supplied log`

- Expected Nourishment procs: `39` hits for `12,675` damage.
- Actual: `41` hits for `13,325` damage.
- Difference: two extra procs and `650` extra damage.
- Current DPS is `43,490.6668`, inside the test's `43,593 +/- 750` tolerance.
- The tested Obliterate timing remains correct at `640ms` for all six hits.

Likely cause: shared critical-food proc timing changed around strict internal
cooldown boundaries during the current clock/resolver consolidation.

## Recent-change assessment

| Change | Confidence | Failures it explains |
| --- | --- | --- |
| Current uncommitted native-module, resolver, clock, and proc work | Medium | Three Engineer failures |
| Mesmer mechanics changed after the saved `44,259` benchmark | Medium | Chronomancer template-preview DPS failure |

## Resolved in the latest test update

- Accepted the current Swordsman and Duelist phantasm endpoints.
- Accepted Dagger and Scepter clone coefficients of `0.5`.
- Regenerated only `clone-shatter.json` and `interrupt-and-instant.json`; all
  twelve Mesmer migration fixtures now pass.
- Normalized generated Chronophantasma labels to ` - `.
- Accepted the current Duelist repeat, conversion, strike-packet, and Bleeding
  packet timings.
- Accepted the current Warlock endpoints, repeat/conversion timing, and
  Compounding Power trigger timing.
- Accepted the remaining Mage, Berserker, Defender, and Warden endpoints.
- Replaced the blanket catalog-cast/Quickness relationship with the explicit
  correct `1155ms` Phantasmal Defender catalog cast exception. All 27 Mesmer
  data tests now pass.

`docs/PROFESSION_FAMILY_CLEANUP.md` contains an older checkpoint whose listed
failures no longer match this run and which says the Engineer behavior suite was
passing. It should be treated as stale status, not as the current inventory.

## Scope limits

- Default-concurrency runs exposed transient native profession
  registration/contract failures. They pass focused and under serialized full
  execution, so they are tracked as test-order/concurrency flakiness rather
  than consistent failures.
- Investigation stopped at identifying the immediate mismatches and likely
  recent owners; it did not validate which expected values are correct against
  live Guild Wars 2 data.
- Browser fixture files exist under `tests/browser/`, but the repository has no
  automated browser-test command. They were not separately executed.
- Tests run on Node `v24.14.1` and npm `11.11.0`; the package supports Node 20
  or newer.
