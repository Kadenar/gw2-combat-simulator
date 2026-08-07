# Existing Test Failure Inventory

Recorded on 2026-08-07 against branch `consolidation_v6` at `b9b6869`, with
the existing uncommitted working-tree changes included.

## Test status

| Command | Result |
| --- | --- |
| `npm test` | **Failed:** 857 tests, 843 passed, 14 failed |
| `npm run check` | **Passed:** build, TypeScript checks, JavaScript syntax checks, and compiled-output checks |

The 14 failures comprise 12 failed top-level tests and two failed nested
Mesmer fixture cases. The parent Mesmer fixture test is one of the 12 top-level
failures. Repeated full-suite runs produced the same failure list.

The repository's GitHub Pages workflow runs `npm run check`, but does not run
`npm test`. These failures therefore are not currently enforced by CI.

| Test file | Failures | Main area |
| --- | ---: | --- |
| `tests/app-ui.test.js` | 1 | Saved Mesmer benchmark drift |
| `tests/data.test.js` | 3 | Mesmer coefficients and phantasm timing expectations |
| `tests/engineer.test.js` | 3 | Amalgam benchmark and proc drift |
| `tests/mesmer-oracle.test.js` | 3 | Two fixture mismatches plus their failed parent test |
| `tests/rotation.test.js` | 4 | Mesmer phantasm timing and event naming |
| **Total** | **14** | |

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

### `tests/data.test.js`

#### `measured phantasm endpoints match the supplied cast, damage, and spawn table`

The Phantasmal Swordsman timing is different:

```text
expected: [880, 2279, 3600, 5870, 7020]
actual:   [880, 2279, 3600, 6330, 7450]
```

The differing values are the Chronophantasma damage and conversion endpoints.
The current values were committed in `e19c455`; the test still expects the
older endpoints.

#### `supplied player and clone coefficient table is preserved`

- Expected Dagger clone coefficient: `0.7`.
- Actual coefficient: `0.5`.
- The current Dagger clone data also uses a `1.16s` first-attack delay and a
  `1.6s` interval, while the older data used a `0.68s` interval.

The Dagger clone data changed in `b9b6869`, but this expectation was not
updated.

#### `latest supplied weapon, clone, ambush, and trait coefficients are preserved`

- Expected Scepter clone coefficient: `0.3`.
- Actual coefficient: `0.5`.

The Scepter clone coefficient changed in `b9b6869`, but this expectation was
not updated.

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

### `tests/mesmer-oracle.test.js`

#### Nested fixture: `clone creation attacks and shatter`

The checked-in fixture contains the previous Dagger clone model:

- Expected coefficient `0.7`; actual `0.5`.
- Expected first attacks near `0.6801s`; actual near `1.1601s`.
- Expected DPS window `2.3199s`; actual `1.8399s`.
- The slower current interval also produces fewer clone attacks before the
  shatter.

Cause: the fixture was not regenerated after the Dagger clone data change in
`b9b6869`.

#### Nested fixture: `wait combat start interrupt and instant`

- Expected Scepter clone coefficient: `0.3`.
- Actual coefficient: `0.5`.

Cause: the fixture was not regenerated after the Scepter clone data change in
`b9b6869`.

#### Parent: `Mesmer migration fixtures match checked-in expectations`

The parent fails because the two nested fixtures above fail. The other ten
Mesmer migration fixtures pass.

### `tests/rotation.test.js`

#### `Staff 3 converts after Mage Strike finishes and Chronophantasma repeats it first`

The first failure is a missing event lookup. Current Chronophantasma damage
events use the literal text `â€”` in their names, while the test searches for a
real em dash (`—`). The mojibake strings are in
`js/professions/mesmer/core/phantasms.ts` and were introduced in `b9b6869`.

There is also a timing mismatch after accounting for the naming problem:

```text
                         expected   actual
repeat attack             8.1900    8.3300
clone conversion          9.4701    9.6101
```

#### `Compounding Power triggers for both phantasm summons and clone conversion`

```text
expected: [0.88, 5.12, 9.4701]
actual:   [0.88, 5.12, 9.6101]
```

The final proc follows the current Phantasmal Warlock conversion time. The test
still expects the prior timing.

#### `Pistol 4 converts after Illusionary Unload and its Chronophantasma repeat`

```text
                         expected   actual
repeat attack             5.7500    6.0900
clone conversion          6.3501    6.5701
```

The test still expects the previous Phantasmal Duelist Chronophantasma timing.

#### `Phantasmal Duelist uses eight timed unload and bleeding packets`

- The first seven packet times match.
- Expected final strike packet: `2.751s`; actual: `2.960s`.
- The final Bleeding packet also occurs at `2.960s`, rather than the test's
  expected `2.751s`.
- The current timing table places the final packet at the `2400ms` measured
  endpoint after the `560ms` cast, which produces `2.960s`.

Likely cause: the test expectation and the current measured timing table are
out of sync.

## Recent-change assessment

| Change | Confidence | Failures it explains |
| --- | --- | --- |
| `e19c455` changed Chronophantasma damage/conversion timings | High | Swordsman data expectation and several rotation timing expectations |
| `b9b6869` changed Dagger/Scepter clone data | High | Two data tests and both failed Mesmer oracle fixtures |
| `b9b6869` introduced mojibake Chronophantasma labels | High | Staff 3 event lookup failure |
| Current uncommitted native-module, resolver, clock, and proc work | Medium | Three Engineer failures |
| Mesmer mechanics changed after the saved `44,259` benchmark | Medium | Chronomancer template-preview DPS failure |

`docs/PROFESSION_FAMILY_CLEANUP.md` contains an older checkpoint whose listed
failures no longer match this run and which says the Engineer behavior suite was
passing. It should be treated as stale status, not as the current inventory.

## Scope limits

- No fixes or fixture updates were attempted.
- Investigation stopped at identifying the immediate mismatches and likely
  recent owners; it did not validate which expected values are correct against
  live Guild Wars 2 data.
- Browser fixture files exist under `tests/browser/`, but the repository has no
  automated browser-test command. They were not separately executed.
- Tests run on Node `v24.14.1` and npm `11.11.0`; the package supports Node 20
  or newer.
