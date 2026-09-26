# Programmatic simulation API

Use the simulator without opening or configuring the browser UI by calling `simulateGw2` directly. This is the same
headless path used by profession tests such as `tests/games/gw2/professions/engineer/weapons-and-kits.test.js`.

The usual programmatic call supplies these inputs:

```js
simulateGw2({ profession, rotation, config, observationPolicy });
```

- `profession` is a profession family or an executable profession contract. Families resolve Core plus the elite
  selected by `config.specialization`.
- `rotation` is an ordered array of skill casts and simulator commands.
- `config` contains final attributes and combat assumptions.
- `observationPolicy` is an optional caller-owned resolution boundary. It defaults to the entered rotation timeline.
- `damageDiagnostics: true` optionally attaches `damageCalculation` to resolved damage events in detailed output. It
  defaults to false and is an execution option, never a saved build setting.

The call is synchronous and returns the complete simulation result by default. Optional `output: 'score'` returns only
aggregate metrics and warnings for callers such as the optimizer; `onPhase` optionally reports phase timings. It does
not read browser state, local storage, form controls, or equipment selections.

Damage diagnostics retain pre-hit target health, owner stats, the effective coefficient multiplier, base damage,
critical/outgoing factors, and unrounded damage with its rounding rule. Existing event fields retain activation,
authored coefficient, critical chance, and resolved weapon strength. Flat and independent-summon formulas retain their
actual inputs. Capture makes no additional modifier queries or random draws. The event log expands these facts when
present, including the six-decimal simulation timestamp and effective phase; its usual activation grouping is not a
complete execution trace.

Score output suppresses report collections and diagnostics. Both outputs execute the same runtime once, with the same
state transitions and random draws. Detailed diagnostics capture the actual hit calculations and critical-sigil
eligibility, claim, and suppression decisions. They do not predict effects or rerun the simulation.

The optional profiler reports `preparation`, `execution`, and `reporting` durations, once each per call.

Timeline seconds are canonicalized to the nearest microsecond. At a shared timestamp, condition sampling and payouts
finish before ordinary strikes. Observation cutoffs include eligible work exactly at the cutoff and exclude later
microseconds; use an explicit observation tail to include effects delayed beyond the final cast.

## Run a standalone script

The repository requires Node.js 24.11 or newer. Install dependencies and compile the TypeScript modules first:

```powershell
npm install
npm run build
```

Create `run-engineer.mjs` in the repository root:

```js
import { prepareSimulationConfig } from './tests/helpers/simulation-config.js';
import { simulateGw2 } from '#gw2/platform/index.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';

const baseConfig = Object.freeze({
  selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Supply Crate'],
  selectedMorphSkillIds: [77103, 77203, 76954],
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  boons: {},
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 }
  }
});

function simulate(specialization, rotation, overrides = {}) {
  const config = prepareSimulationConfig(baseConfig, {
    ...overrides,
    specialization
  });

  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config
  });
}

const result = simulate('Core', ['Grenade Kit', 'Grenade', { type: 'wait', durationMs: 1000 }], {
  stats: { power: 2500 },
  boons: { might: 25, fury: true, quickness: true }
});

console.table({
  rotationEndTime: result.rotationEndTime,
  observationEndTime: result.observationEndTime,
  combatEndTime: result.combatEndTime,
  totalDamage: Math.round(result.totalDamage),
  dps: Math.round(result.dps),
  strikeDamage: Math.round(result.strikeDamage),
  conditionDamage: Math.round(result.conditionDamage)
});

console.table(
  skillBreakdownRows(result).map((row) => ({
    skill: row.name,
    casts: row.casts,
    hits: row.hits,
    damage: Math.round(row.total),
    dps: Math.round(row.dps)
  }))
);

if (result.warnings.length > 0) {
  console.warn('Simulation warnings:', result.warnings);
}
```

Run it with:

```powershell
node ./run-engineer.mjs
```

Run `npm run build` again after changing simulator source.

## How module imports resolve

Scripts and tests use the package aliases declared in `package.json`. Node resolves these aliases to compiled modules
under `dist/js`; TypeScript and Vite resolve them to source modules. No custom loader or registration flag is required.

Use the same aliases in headless scripts kept inside the repository:

```js
import { simulateGw2 } from '#gw2/platform/index.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
```

Build before running so Node executes the current compiled modules.

## The reusable wrapper pattern

Profession tests define a base config once and merge small overrides for each simulation. `prepareSimulationConfig`
(`tests/helpers/simulation-config.js`) provides the shared version of that merge. It is a test-only helper, not a
platform export — standalone scripts outside `tests/` should import it by relative path or inline the equivalent merge:

```js
function simulate(specialization, rotation, overrides = {}) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: prepareSimulationConfig(baseConfig, {
      ...overrides,
      specialization
    })
  });
}
```

It merges `stats`, `boons`, and `target` independently. When an override explicitly supplies `target.conditions`, that
condition set replaces the base set. This prevents an ordinary override such as `{ stats: { power: 2500 } }` from
deleting every other base stat.

The current profession tests reuse `createProfessionSimulator()` from `tests/helpers/profession-simulation.js`, which
calls this same config helper and forwards an optional observation policy.

Use an explicit merge for other nested profession-specific values, such as Thief `deterministicChoices`, when individual
keys should inherit from the base config.

## Rotation format

The rotation is processed from beginning to end. Each entry can use a compact skill name or a canonical command:

```js
const rotation = [
  'Grenade Kit', // cast by skill name
  5882, // cast by numeric skill ID
  { type: 'cast', skillId: 5882 }, // explicit cast
  { type: 'cast', skillId: 62797, releaseAtCharges: 3 }, // charged release target
  { type: 'wait', durationMs: 1000 }, // explicit delay
  { type: 'combat-start' }, // DPS/display reference marker
  { type: 'cooldown-reset' } // reset for isolated experiments
];
```

An explicit cast can also include:

```js
{
  type: "cast",
  skillId: 5882,
  concurrentOffsetMs: 100,
  interruptAfterMs: 500,
  doubleEdgeOutcome: "backfire", // Antiquary risky-recast result
}
```

`doubleEdgeOutcome` is consulted only when an Antiquary Double Edge skill is recast while recharging. Ready casts always
succeed, and an omitted outcome defaults to `"success"`.

Names are convenient, but IDs are safer for long-lived scripts. Inspect the complete application catalog when finding
IDs:

```js
console.table(engineerProfession.catalog.skills.map(({ id, name }) => ({ id, name })));
```

Use `engineerProfession.resolveRuntime({ specialization: 'Core' }).catalog` to inspect only the active runtime catalog.

Unknown, unavailable, or mistimed skills can produce warnings instead of the result the caller expected. Always inspect
`result.warnings`.

## Observation policy

Rotation duration and observation duration are separate. By default, combat observation stops at the end of the entered
commands:

```js
observationPolicy: {
  kind: 'rotation';
}
```

Use a finite tail to observe delayed packets, conditions, fields, summons, or upkeep after the final command without
adding a player action:

```js
observationPolicy: { kind: "tail", durationMs: 5000 }
```

Use an absolute simulation-clock boundary when the caller is intentionally requesting a fixed-clock simulation:

```js
observationPolicy: { kind: "absolute", endTimeMs: 97_450 }
```

The absolute timestamp cannot precede rotation end. Durations and timestamps must be finite and non-negative. Target
death clips every mode. An explicit `wait` remains part of the player-command timeline and increases `rotationEndTime`;
an observation tail does not.

Saved benchmark or imported-log metadata must not choose an observation policy. Logs and saved benchmark metrics are
comparison targets. Benchmark runners use the default rotation boundary, matching the interactive simulator.

## Common configuration fields

The direct API consumes resolved combat values. It does not calculate stats from armor, upgrades, runes, or infusions.

| Field                                      | Purpose                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `specialization`                           | `Core` or the exact elite-specialization name                                                     |
| `selectedTraitIds`                         | Active trait IDs                                                                                  |
| `selectedSkills`                           | Equipped heal, utility, and elite skill names                                                     |
| `primaryWeapon`, `secondaryWeapon`         | First weapon set                                                                                  |
| `weaponSet2Primary`, `weaponSet2Secondary` | Second weapon set                                                                                 |
| `startingWeaponSet`                        | `1` or `2`                                                                                        |
| `stats`                                    | Baseline/fallback power, precision, ferocity, condition damage, expertise, and related attributes |
| `weaponSetStats`                           | Optional two-entry stat array selected dynamically with the active weapon set                     |
| `boons`                                    | Might stacks and boolean boon assumptions                                                         |
| `target`                                   | Armor, health, movement, defiance, and existing conditions                                        |
| `sigilSets`, `relic`, `food`               | Optional common GW2 effects                                                                       |
| `randomness`                               | Resolution mode and seed; both modes use seeded proc rolls                                        |

Professions also accept their own resource and loadout fields. Existing tests are the most direct examples:

- Engineer: `selectedMorphSkillIds`
- Mesmer: `initialResource`
- Necromancer: initial Life Force and specialization resources
- Revenant: `selectedLegends`, `startingLegend`, and `initialEnergy`
- Thief: `initialInitiative`, `initialShadowForce`, and `deterministicChoices`

Start with the base config near the top of the relevant profession test, then remove fields your scenario does not use.

## Loading a profession dynamically

Use the registry when the profession is selected by a command-line argument or configuration file:

```js
import { loadProfession } from '#gw2/app/profession-registry.js';
import { simulateGw2 } from '#gw2/platform/index.js';

const profession = await loadProfession('engineer');
if (!profession) throw new Error('Unknown profession');

const result = simulateGw2({
  profession,
  rotation: ['Grenade Kit', 'Grenade'],
  config: {
    specialization: 'Core',
    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
    stats: { power: 2000, precision: 1500, ferocity: 500 },
    target: { armor: 2597 }
  }
});
```

Registered IDs are `elementalist`, `mesmer`, `necromancer`, `ranger`, `thief`, `engineer`, `guardian`, `warrior`, and
`revenant`. Each profession still needs an appropriate config; loading the contract does not create a build or copy UI
defaults.

## Reading the result

The commonly useful result fields are:

| Field                                       | Meaning                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `rotationEndTime`                           | End of the entered rotation, in absolute timeline seconds                                   |
| `observationEndTime`                        | Requested observation end, including any tail, in seconds                                   |
| `combatEndTime`                             | Target death or observation end, in seconds                                                 |
| `combatStartTime`, `hasExplicitCombatStart` | Precast/combat boundary and whether a marker supplied it                                    |
| `dpsStartTime`, `dpsWindow`                 | Reference time and measured DPS window                                                      |
| `firstHitTime`, `lastHitTime`, `deathTime`  | Damage and target-death timing                                                              |
| `totalDamage`, `dps`                        | Overall result                                                                              |
| `strikeDamage`, `conditionDamage`           | Damage split                                                                                |
| `breakdown`, `conditionBreakdown`           | Raw contribution data                                                                       |
| `casts`                                     | Aggregate cast counts                                                                       |
| `events`, `resolvedEvents`                  | Dispatched packets (including attempted misses/precasts) and committed combat reports       |
| `warnings`                                  | Invalid or constrained rotation behavior                                                    |
| `planningState`                             | Observed continuation at `atSeconds`: cooldowns, ammo, weapon set, and profession resources |
| `combatState`                               | Detached profession state at the combat boundary; not a complete player snapshot            |
| `randomness`                                | Actual resolution mode and seed                                                             |

All boundary times and both state projections' `atSeconds` values use absolute timeline seconds. Planning continues
through the requested horizon after target death; combat effects stop at `combatEndTime`. Both projections come from the
same live state at their respective boundaries. Cooldown `readyAt` and `remaining` values retain milliseconds; ammo
recharge timestamps retain seconds. The editor obtains rotation/insertion state through `rotationPlanningStateAt`,
excluding observation tails when appending.

The old `duration`, `endState`, top-level `profession`, and standalone `snapshot` result fields are removed. Use
`combatState.profession` for resolved effects and `planningState.profession` for observed resources. Neither projection
is a resumable checkpoint. Combat records may retain expiry timestamps; evaluate active effects at
`combatState.atSeconds`, never at the later planning time.

Use `skillBreakdownRows(result)` for a stable per-skill table instead of reimplementing aggregation over raw events.

`dpsWindow` ends at target death or the selected observation boundary, so an explicit observation tail can make it
longer than `rotationEndTime`.

For UI-equivalent formatted data, the existing transforms are also callable headlessly:

```js
import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { resultSummaryMetrics } from '#gw2/app/results/model.js';

console.table(resultSummaryMetrics(result));
console.table(simulationEventLogRows(result, null, engineerProfession));
```

## Deterministic and stochastic runs

Both modes use seeded rolls for critical-proc eligibility, secondary proc chances, and combo attempts. Both use average
critical damage. Deterministic mode uses midpoint weapon strength:

```js
randomness: { mode: "deterministic", seed: 1 }
```

Stochastic mode additionally samples weapon strength per activation:

```js
randomness: { mode: "stochastic", seed: 42 }
```

The default seed is `1`. The application saves the player's chosen seed in `assumptions.simulationSeed` and converts it
to `config.randomness.seed`. Identical inputs and seed reproduce the same result within a simulator revision. One run in
either mode represents one set of proc outcomes, not an average across seeds. Scripts that compare random outcomes
should run multiple seeds and summarize their results, as done by
`js/games/gw2/app/simulation/random-distribution/random-distribution.ts`.

## Current API status

This repository is marked `private` and does not publish a package export for the simulator. The module paths above are
internal repository paths, so scripts using them should be kept with or pinned to a compatible simulator revision. No
web server is required for headless execution.
