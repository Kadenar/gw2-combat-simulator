# Programmatic simulation API

`simulateGw2` runs the same synchronous combat runtime used by the application without a browser or server. These are
internal repository APIs; keep scripts in this repository and pinned to its revision. For a compact ownership map, see
the [agent API reference](AGENT-API-REFERENCE.md).

## Run a script

Requires Node.js 24.11+ and installed dependencies. Run `npm run build:modules` before running scripts and after source
changes. Package aliases such as `#gw2/` resolve to compiled `dist/js/` modules in Node and TypeScript source in Vite.

Save this example as `run-engineer.mjs` in the repository root, then run `node run-engineer.mjs`:

```js
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';

// Supply base attributes so profession and temporary bonuses are applied once by the runtime.
const result = simulateGw2({
  profession: engineerProfession,
  rotation: ['Grenade Kit', 'Grenade'],
  config: {
    specialization: 'Core',
    selectedSkillIds: [5805],
    attributeInputs: baseAttributeInputs({ power: 2500, precision: 1500, ferocity: 500 }),
    boons: { might: 25, fury: true, quickness: true, alacrity: true },
    target: { armor: 2597, conditions: { Vulnerability: 25 } },
    randomness: { mode: 'deterministic', seed: 1 }
  },
  observationPolicy: { kind: 'tail', durationMs: 1000 }
});

console.log({ dps: result.dps, totalDamage: result.totalDamage, warnings: result.warnings });
console.table(skillBreakdownRows(result));
```

For dynamic selection, import `loadProfession` from `#gw2/profession-registry.js` and await
`loadProfession('engineer')`. Registry IDs are lowercase profession names. Loading a profession supplies its catalog and
runtime factory; it does not load a saved build or UI defaults.

## Running a saved build

Use the profession-bound build context to decode a saved build and calculate its simulation inputs without an app
adapter. Supply explicit patch and transition settings; the codec remains the saved-input normalization boundary.

```js
import { loadBuildContext } from '#gw2/build-context/load.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

const module = await loadBuildContext('engineer');
const build = module.toApplicationBuild(savedBuild);
const context = module.createBuildContext({
  build,
  patchId: 'current',
  transitionDelays: normalizeTransitionDelays(undefined)
});
const attributes = context.attributes(1);
const result = simulateGw2({
  profession: context.profession,
  rotation: build.rotation,
  config: context.simulationConfig()
});
```

The context borrows immutable inputs for one calculation. Make a new context after editing a build, settings, patch, or
excluded modifier. Repeated attribute requests reuse at most two results; each config call returns detached nested
values. The selected patch must be `current` or the bound preview ID. Baseline and comparison owners may apply
`deterministicSimulationConfig()`; build-context itself preserves the build's randomness settings.

## Configuration

The entry point is `platform/simulation/simulate.ts`; run options live in `platform/simulation/options.ts` and
configuration in `platform/simulation/config.ts`, relative to `js/games/gw2/`.

| Input               | Purpose                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| `profession`        | Profession source whose `runtimeFor(config)` selects Core plus the configured elite     |
| `rotation`          | Ordered skill names, numeric IDs, or canonical commands                                 |
| `config`            | Attributes, equipment effects, loadout, profession assumptions, and target state        |
| `observationPolicy` | Optional resolution boundary; defaults to the rotation end                              |
| `output`            | `'detailed'` (default) or `'score'` for metrics and warnings without report histories   |
| `damageDiagnostics` | Capture actual damage calculations in detailed events; defaults to false                |
| `collectChartData`  | Set false to omit chart histories from detailed output                                  |
| `onPhase`           | Optional callback receiving `preparation`, `execution`, and `reporting` durations in ms |

`config.attributeInputs` contains two weapon-set seeds before profession and temporary contributions. Use
`baseAttributeInputs(base, alternate?)` for direct scenarios; omitted attributes use level-80 base values and the
alternate set defaults to the first. Do not pass already calculated totals or the obsolete `stats`/`weaponSetStats`
fields. Canonical builds produce equipment seeds through `build-context/simulation-config.ts`.

Common configuration fields:

| Field                                                           | Purpose                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `specialization`, `selectedTraitIds`                            | Active Core/elite and traits                                                            |
| `selectedSkillIds`                                              | Flat array of equipped slot-skill catalog IDs                                           |
| `primaryWeapon`, `secondaryWeapon`                              | First weapon set                                                                        |
| `weaponSet2Primary`, `weaponSet2Secondary`, `startingWeaponSet` | Alternate weapons and initial set (`1` or `2`)                                          |
| `initialResource`, `professionAssumptions`                      | Starting resources and profession-specific loadout/state                                |
| `boons`, `target`                                               | Permanent boon assumptions and target armor, health, movement, defiance, and conditions |
| `sigilSets`, `relic`, `precastRelics`, `food`, `utility`        | Common equipment effects                                                                |
| `randomness`, `criticalDamageMode`                              | Seed, simulation mode, and deterministic critical-damage policy                         |

Profession build adapters in `professions/<name>/build/` map saved build fields into run configuration. For example,
selected legends and morph skills belong in run `professionAssumptions`, not top-level config. Saved builds store
`selectedSkillIds` by slot with `null` for empty slots; run configs use a flat array preserving numeric/string ID types.
Omitting that run field permits sandbox casts; `[]` equips no slot skills.

The shared build codec converts legacy `selectedSkills` names to catalog IDs during import, rejecting unknown or
ambiguous names. Direct simulation configs require IDs; exports contain only the canonical field.

Player health is fixed at 100%. Isolated attribute previews may vary it, but saved builds and combat runs may not.
Target health remains modeled. For test fixtures, `tests/helpers/profession-simulation.js` and
`tests/helpers/simulation-config.js` provide test-only setup helpers.

## Boss encounters

Supply `config.encounter` to run a phase plan through the same combat runtime. `EncounterConfig`, `EncounterPhase`, and
`EncounterPhaseTarget` are defined in `platform/combat/state/encounter.ts`. This configuration is separate from saved
build assumptions; the browser's scenario document owns the encounter inputs alongside its own build and rotation.

- `phases` is an ordered array with unique phase IDs. A `boss` phase supplies `playerTargetId`, `targets`, and
  `durationSeconds` (`null` for a health-gated phase, a positive duration for a timed window).
- Each target supplies `id`, `name`, `maximumHealth`, `armor`, `hitboxWidth`, `groupDps`, `endHealthPercent`,
  `startHealthPercent`, and `entryHealthLossPercent`. Group DPS excludes the player. A null starting percentage
  preserves the target's current health; an explicit percentage starts a replacement bar or transformation. A changed
  maximum health requires an explicit starting percentage. `entryHealthLossPercent` applies an authored health loss on
  phase entry without adding player damage.
- A `split` or `intermission` phase supplies `id`, `kind`, and a non-negative `durationSeconds`. Both block damage;
  splits permit rotation commands, while intermissions hold commands until their deadline. The live clock continues
  advancing cooldowns, resources, and effect expiry.
- `repeatFrom` is null for a finite plan or the ID of the phase to repeat from. Repeating plans require a timed boss
  window so the cycle can advance by time.

The runtime seeds health, armor, and hitbox size from the first selected encounter target and updates them on target
transitions. Targets retain separate health pools; player attacks stay on the selected target even when it reaches its
phase gate before the other targets. Group damage is accounted for separately from player damage. Without an explicit or
inherited combat boundary, encounters start combat at time zero. The normal observation policy still limits the run;
supplying an encounter does not extend a rotation automatically until the boss dies.

For saved browser scenarios, `app/boss-scenarios/model.ts` validates the document against the supported boss and
difficulty. `scenarioSimulation()` in `app/boss-scenarios/simulation.ts` compiles the authored plan;
`withScenarioConfig(config, draft)` also applies the browser's boss assumptions (four allies, no automatic player-boon
sharing with summons, and a defiant target). All scenario analysis jobs use that same configuration.

`result.encounter` reports target health, current phase, defeat state, transition estimates, and observed phases with
player/group damage and player DPS. Its `overallDps` includes splits and intermissions in elapsed time. It can describe
an incomplete encounter when observation ends first. The browser workflow is documented in
[Boss scenarios](../../wiki/Boss-Scenarios.md).

## Rotation commands

```js
const rotation = [
  'Grenade Kit',
  { type: 'cast', skillId: 5882 },
  { type: 'wait', durationMs: 1000 },
  { type: 'combat-start' },
  { type: 'cooldown-reset' }
];
```

Names are convenient for experiments; canonical IDs are preferable for persisted scripts. Inspect
`engineerProfession.catalog.skills` for the full family catalog, or
`engineerProfession.runtimeFor({ specialization: 'Core' }).catalog` for the active runtime.

`RotationCommand` in `platform/builds/rotation.ts` defines optional cast controls: `offTarget`, `impactDelayMs`,
`concurrentOffsetMs`, `interruptAfterMs`, `releaseAtCharges`, `releaseDelayMs`, and `doubleEdgeOutcome`. Use them only
when the skill or import scenario supports that behavior. Antiquary Double Edge recasts default to success unless
explicitly set to `'backfire'`; ready casts always succeed.

Use `normalizeRotation(input, catalog, { strict: true })` to reject malformed input. Unavailable or mistimed actions can
produce simulation warnings; inspect `result.warnings` on every run. Each warning is a diagnostic record with a
`message` and, when known, its absolute time `at` (seconds) and authored `rotationIndex`; use
`formatSimulationDiagnostic` from `platform/results/diagnostics.ts` for plain-text output.

## Observation boundaries

| Policy                                   | Meaning                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `{ kind: 'rotation' }`                   | Stop at the end of entered commands (default)                              |
| `{ kind: 'tail', durationMs: 5000 }`     | Observe delayed effects after the final command without adding an action   |
| `{ kind: 'absolute', endTimeMs: 97450 }` | Observe to a fixed simulation-clock boundary, no earlier than rotation end |

Durations must be finite and non-negative. Target death clips combat effects in every mode. An explicit wait extends
`rotationEndTime`; an observation tail does not. Saved benchmark and imported-log metadata are comparison targets and
must not choose the observation window; benchmark runners use the default rotation boundary.

The clock canonicalizes seconds to microseconds. Eligible work exactly at the cutoff is included; later work is not. See
[event ordering](SKILL-EVENT-ORDERING.md) for equal-time phases.

## Results and diagnostics

`Gw2SimulationResult` and `Gw2SimulationScore` in `platform/results/types.ts` define the outputs. Both execute the same
runtime and random draws; score output omits histories, planning projections, and diagnostics.

| Detailed result                                                          | Meaning                                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `totalDamage`, `dps`, `strikeDamage`, `conditionDamage`                  | Damage totals and measured DPS                                                    |
| `rotationEndTime`, `observationEndTime`, `combatEndTime`                 | Command end, requested horizon, and combat cutoff                                 |
| `combatStartTime`, `hasExplicitCombatStart`, `dpsStartTime`, `dpsWindow` | Precombat boundary and DPS measurement window                                     |
| `firstHitTime`, `lastHitTime`, `deathTime`                               | Damage and target-death boundaries                                                |
| `steps`, `events`, `resolvedEvents`                                      | Scheduled actions, dispatched packets, and committed combat reports               |
| `breakdown`, `conditionBreakdown`, `casts`                               | Aggregated source/condition contributions and cast counts                         |
| `planningState`                                                          | Detached cooldowns, ammo, effects, weapon set, availability, and profession state |
| `warnings`, `randomness`                                                 | Run warnings and actual mode/seed                                                 |

Boundary times and `planningState.atSeconds` use absolute seconds. Step `start`/`end` and cooldown `readyAt`/`remaining`
use milliseconds; ammo recharge timestamps use seconds. Planning can continue through the requested horizon after target
death, while combat ends at `combatEndTime`. Planning projections are observations, not resumable checkpoints. See
[rotation state](ROTATION_STATE_SNAPSHOT.md) for insertion/continuation queries.

Use `skillBreakdownRows(result)` for per-skill display aggregation. Entries own their source, parent, actor, label, and
icon metadata; a null `skillId` intentionally represents an effect without catalog identity. For UI-equivalent rows, use
`simulationEventLogRows` from `app/results/event-log.ts` and `resultSummaryMetrics` from `app/results/model.ts`.

`damageDiagnostics: true` attaches `damageCalculation` to detailed damage events, capturing the actual pre-hit target
health, owner attributes, coefficient multiplier, base damage, critical/outgoing factors, and rounding. It adds no
modifier queries or random draws. Outgoing multipliers are aggregates, not per-modifier contribution lists. The browser
capture/export workflow is described in [Reading results](../../wiki/Reading-Results.md).

## Randomness

Both modes use seeded rolls for critical-proc eligibility, secondary procs, and combo attempts:

- `randomness: { mode: 'deterministic', seed: 1 }` uses midpoint weapon strength. Critical damage defaults to averaged;
  `criticalDamageMode: 'rolled'` makes damage follow the sampled critical outcomes.
- `randomness: { mode: 'stochastic', seed: 42 }` samples weapon strength per activation and always uses rolled critical
  damage, regardless of `criticalDamageMode`.

The default seed is `1`. Builds persist it as `assumptions.simulationSeed`, with the critical policy in
`assumptions.criticalDamageMode`. Identical inputs and seeds reproduce outcomes within the same implementation. A single
deterministic run is one proc sample, not the expected value across trials; use a seed distribution to assess variation.
For controlled comparisons, keep the seed and observation policy fixed.
