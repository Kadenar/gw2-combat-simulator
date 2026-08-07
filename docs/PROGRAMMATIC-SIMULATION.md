# Programmatic simulation API

Use the simulator without opening or configuring the browser UI by calling
`simulateGw2` directly. This is the same headless path used by profession tests
such as `tests/professions/engineer/engineer.test.js`.

The programmatic API accepts three inputs:

```js
simulateGw2({ profession, rotation, config });
```

- `profession` is an executable profession contract.
- `rotation` is an ordered array of skill casts and simulator commands.
- `config` contains final attributes and combat assumptions.

The call is synchronous and returns the complete simulation result. It does not
read browser state, local storage, form controls, or equipment selections.

## Run a standalone script

Node.js 20 or newer is required. Install dependencies and compile the
TypeScript modules first:

```powershell
npm install
npm run build
```

Create `run-engineer.mjs` in the repository root:

```js
import {
  prepareSimulationConfig,
} from "./js/platform/engine/prepare-config.js";
import { simulateGw2 } from "./js/platform/gw2/simulate.js";
import {
  skillBreakdownRows,
} from "./js/platform/ui/result-tables.js";
import {
  engineerProfession,
} from "./js/professions/engineer/definition.js";

const baseConfig = Object.freeze({
  selectedSkills: [
    "Healing Turret",
    "Grenade Kit",
    "Throw Mine",
    "Rifle Turret",
    "Supply Crate",
  ],
  selectedMorphSkillIds: [77103, 77203, 76954],
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000,
  },
  boons: {},
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 },
  },
});

function simulate(specialization, rotation, overrides = {}) {
  const config = prepareSimulationConfig(
    baseConfig,
    { ...overrides, specialization },
  );

  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config,
  });
}

const result = simulate(
  "Core",
  [
    "Grenade Kit",
    "Grenade",
    { type: "wait", durationMs: 1000 },
  ],
  {
    stats: { power: 2500 },
    boons: { might: 25, fury: true, quickness: true },
  },
);

console.table({
  duration: result.duration,
  totalDamage: Math.round(result.totalDamage),
  dps: Math.round(result.dps),
  strikeDamage: Math.round(result.strikeDamage),
  conditionDamage: Math.round(result.conditionDamage),
});

console.table(skillBreakdownRows(result).map(row => ({
  skill: row.name,
  casts: row.casts,
  hits: row.hits,
  damage: Math.round(row.total),
  dps: Math.round(row.dps),
})));

if (result.warnings.length > 0) {
  console.warn("Simulation warnings:", result.warnings);
}
```

Run it with:

```powershell
node --import ./scripts/testing/register-dist-loader.mjs ./run-engineer.mjs
```

Run `npm run build` again after changing simulator source.

## Why the loader is required

Tests import source-looking `.js` paths and register a loader that redirects
compiled TypeScript modules into `dist/js`. It also redirects imports back to
`js` when a dependency is a JavaScript-only source module that is not copied
into `dist`.

For that reason, a headless script should use source-looking imports:

```js
import { simulateGw2 } from "./js/platform/gw2/simulate.js";
import {
  engineerProfession,
} from "./js/professions/engineer/definition.js";
```

Run it after building:

```powershell
node --import ./scripts/testing/register-dist-loader.mjs ./run-engineer.mjs
```

Importing `dist/js/platform/gw2/simulate.js` directly is not sufficient. The
compiled module graph still references JavaScript-only modules, and Node needs
the loader to resolve those files from the source tree.

## The reusable wrapper pattern

Profession tests define a base config once and merge small overrides for each
simulation. `prepareSimulationConfig` provides the shared version of that merge:

```js
function simulate(specialization, rotation, overrides = {}) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: prepareSimulationConfig(
      baseConfig,
      { ...overrides, specialization },
    ),
  });
}
```

It merges `stats`, `boons`, and `target` independently. When an override
explicitly supplies `target.conditions`, that condition set replaces the base
set. This prevents an ordinary override such as `{ stats: { power: 2500 } }`
from deleting every other base stat.

The manual merge used in `engineer.test.js` remains valid:

```js
config: {
  ...baseConfig,
  ...overrides,
  specialization,
  stats: { ...baseConfig.stats, ...(overrides.stats || {}) },
  target: { ...baseConfig.target, ...(overrides.target || {}) },
}
```

Use an explicit merge for other nested profession-specific values, such as
Thief `deterministicChoices`, when individual keys should inherit from the base
config.

## Rotation format

The rotation is processed from beginning to end. Each entry can use a compact
skill name or a canonical command:

```js
const rotation = [
  "Grenade Kit",                            // cast by skill name
  5882,                                     // cast by numeric skill ID
  { type: "cast", skillId: 5882 },          // explicit cast
  { type: "wait", durationMs: 1000 },        // explicit delay
  { type: "combat-start" },                  // DPS/display reference marker
  { type: "cooldown-reset" },                // reset for isolated experiments
];
```

An explicit cast can also include:

```js
{
  type: "cast",
  skillId: 5882,
  concurrentOffsetMs: 100,
  interruptAfterMs: 500,
}
```

Names are convenient, but IDs are safer for long-lived scripts. Inspect the
active catalog when finding IDs:

```js
console.table(
  engineerProfession.catalog.skills.map(({ id, name }) => ({ id, name })),
);
```

Unknown, unavailable, or mistimed skills can produce warnings instead of the
result the caller expected. Always inspect `result.warnings`.

## Common configuration fields

The direct API consumes resolved combat values. It does not calculate stats
from armor, upgrades, runes, or infusions.

| Field | Purpose |
| --- | --- |
| `specialization` | `Core` or the exact elite-specialization name |
| `selectedTraitIds` | Active trait IDs |
| `selectedSkills` | Equipped heal, utility, and elite skill names |
| `primaryWeapon`, `secondaryWeapon` | First weapon set |
| `weaponSet2Primary`, `weaponSet2Secondary` | Second weapon set |
| `startingWeaponSet` | `1` or `2` |
| `stats` | Final power, precision, ferocity, condition damage, expertise, and related attributes |
| `boons` | Might stacks and boolean boon assumptions |
| `target` | Armor, health, movement, defiance, and existing conditions |
| `sigilSets`, `relic`, `food` | Optional common GW2 effects |
| `randomness` | Deterministic or seeded stochastic resolution |
| `duration` | Optional simulation horizon in seconds |

Professions also accept their own resource and loadout fields. Existing tests
are the most direct examples:

- Engineer: `selectedMorphSkillIds`
- Mesmer: `initialResource`
- Necromancer: initial Life Force and specialization resources
- Revenant: `selectedLegends`, `startingLegend`, and `initialEnergy`
- Thief: `initialInitiative`, `initialShadowForce`, and
  `deterministicChoices`

Start with the base config near the top of the relevant profession test, then
remove fields your scenario does not use.

## Loading a profession dynamically

Use the registry when the profession is selected by a command-line argument or
configuration file:

```js
import {
  loadProfession,
} from "./js/app/profession/registry.js";
import { simulateGw2 } from "./js/platform/gw2/simulate.js";

const profession = await loadProfession("engineer");
if (!profession) throw new Error("Unknown profession");

const result = simulateGw2({
  profession,
  rotation: ["Grenade Kit", "Grenade"],
  config: {
    specialization: "Core",
    stats: { power: 2000, precision: 1500, ferocity: 500 },
    target: { armor: 2597 },
  },
});
```

Registered IDs are `mesmer`, `elementalist`, `guardian`, `necromancer`,
`engineer`, `revenant`, and `thief`. Each profession still needs an appropriate
config; loading the contract does not create a build or copy UI defaults.

## Reading the result

The commonly useful result fields are:

| Field | Meaning |
| --- | --- |
| `duration` | Resolved simulation duration in seconds |
| `dpsStartTime`, `dpsWindow` | Reference time and measured DPS window |
| `firstHitTime`, `lastHitTime`, `deathTime` | Damage and target-death timing |
| `totalDamage`, `dps` | Overall result |
| `strikeDamage`, `conditionDamage` | Damage split |
| `breakdown`, `conditionBreakdown` | Raw contribution data |
| `casts` | Aggregate cast counts |
| `events`, `resolvedEvents` | Scheduler and resolver timelines |
| `warnings` | Invalid or constrained rotation behavior |
| `endState` | Ending time, cooldowns, ammo, weapon set, and profession resources |
| `randomness` | Actual resolution mode and seed |

Use `skillBreakdownRows(result)` for a stable per-skill table instead of
reimplementing aggregation over raw events.

For UI-equivalent formatted data, the existing transforms are also callable
headlessly:

```js
import {
  resultSummaryMetrics,
} from "./js/app/rotation/result-model.js";
import {
  simulationEventLogRows,
} from "./js/app/rotation/event-log.js";

console.table(resultSummaryMetrics(result));
console.table(simulationEventLogRows(result, null, engineerProfession));
```

## Deterministic and stochastic runs

Deterministic resolution is appropriate for repeatable comparisons:

```js
randomness: { mode: "deterministic", seed: 1 }
```

For a reproducible sampled run:

```js
randomness: { mode: "stochastic", seed: 42 }
```

One stochastic run is not a distribution. Scripts that compare random outcomes
should run multiple seeds and summarize their results, as done by
`js/app/simulation/random-distribution.ts`.

## Current API status

This repository is marked `private` and does not publish a package export for
the simulator. The module paths above are internal repository paths, so scripts
using them should be kept with or pinned to a compatible simulator revision.
No web server is required for headless execution.
