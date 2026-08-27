# Programmatic simulation

The simulator can run entirely from Node.js without opening the browser UI.

The canonical entry point is:

```js
simulateGw2({
  profession,
  rotation,
  config,
  observationPolicy
});
```

This uses the same scheduler and combat resolver as the interactive simulator.

Headless simulation is useful for:

- comparing rotations or build assumptions;
- writing profession and mechanic tests;
- running parameter sweeps;
- analyzing damage programmatically;
- replaying saved simulator builds;
- running benchmark regressions;
- generating simulation data for other tools.

No web server, DOM, local storage, or browser is required.

## Setup

Node.js **20.19+** is required.

Install dependencies and build the project:

```sh
npm install
npm run build
```

Headless scripts should import the normal source-looking module paths and run through the repository's module loader:

```sh
node --import ./scripts/testing/register-dist-loader.mjs ./simulate.mjs
```

The loader redirects source-facing JavaScript specifiers to compiled TypeScript modules in `dist/js`.

Rebuild after changing simulator source.

---

## Run a simulation directly

For controlled experiments, import a profession contract and call `simulateGw2()` directly.

Create `simulate.mjs` in the repository root:

```js
import { simulateGw2 } from './js/games/gw2/platform/index.js';
import { engineerProfession } from './js/games/gw2/content/professions/engineer/definition.js';

const result = simulateGw2({
  profession: engineerProfession,

  rotation: ['Grenade Kit', 'Grenade', { type: 'wait', durationMs: 1000 }],

  config: {
    specialization: 'Core',

    selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Supply Crate'],

    stats: {
      power: 2500,
      precision: 1500,
      ferocity: 500,
      conditionDamage: 1000,
      expertise: 0
    },

    boons: {
      might: 25,
      fury: true,
      quickness: true
    },

    target: {
      armor: 2597,
      conditions: {
        Vulnerability: 25
      }
    }
  }
});

console.log({
  duration: result.duration,
  damage: Math.round(result.totalDamage),
  dps: Math.round(result.dps),
  strike: Math.round(result.strikeDamage),
  condition: Math.round(result.conditionDamage)
});

if (result.warnings.length) {
  console.warn(result.warnings);
}
```

Run it with:

```sh
node --import ./scripts/testing/register-dist-loader.mjs ./simulate.mjs
```

`simulateGw2()` is synchronous and returns the complete simulation result.

---

## Compare builds or rotations

A common headless use case is running the same scenario repeatedly with small changes.

`prepareSimulationConfig()` makes it convenient to define shared assumptions once and override individual values.

```js
import { prepareSimulationConfig } from './js/games/gw2/platform/engine/config.js';
import { simulateGw2 } from './js/games/gw2/platform/index.js';
import { engineerProfession } from './js/games/gw2/content/professions/engineer/definition.js';

const baseConfig = {
  specialization: 'Core',

  selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Rifle Turret', 'Supply Crate'],

  stats: {
    power: 2500,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0
  },

  boons: {
    might: 25,
    fury: true,
    quickness: true
  },

  target: {
    armor: 2597,
    conditions: {
      Vulnerability: 25
    }
  }
};

function run(rotation, overrides = {}) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: prepareSimulationConfig(baseConfig, overrides)
  });
}

const baseline = run(['Grenade Kit', 'Grenade', 'Grenade']);

const variant = run(['Grenade Kit', 'Grenade', 'Throw Mine', 'Grenade']);

console.table([
  {
    scenario: 'Baseline',
    damage: Math.round(baseline.totalDamage),
    dps: Math.round(baseline.dps)
  },
  {
    scenario: 'Variant',
    damage: Math.round(variant.totalDamage),
    dps: Math.round(variant.dps)
  }
]);

console.log(`DPS difference: ${Math.round(variant.dps - baseline.dps)}`);
```

The same pattern can be used to sweep stats, traits, target assumptions, or entire rotations.

For example:

```js
for (const power of [2000, 2250, 2500, 2750, 3000]) {
  const result = run(['Grenade Kit', 'Grenade'], {
    stats: { power }
  });

  console.log(power, Math.round(result.dps));
}
```

`prepareSimulationConfig()` preserves the other nested `stats`, `boons`, and `target` values while applying the supplied
overrides.

---

## Simulate a saved build without the UI

If you want to reproduce what the interactive application would simulate, use the profession's application adapter
rather than manually recreating its final stats.

This is the same general path used by the repository's preset benchmark tests.

```js
import { readFile } from 'node:fs/promises';

import { loadProfessionAppAdapter } from './js/games/gw2/app/profession/registry.js';

const professionId = 'engineer';

const savedBuild = JSON.parse(await readFile('./build.json', 'utf8'));

const savedRotation = JSON.parse(await readFile('./rotation.json', 'utf8'));

const adapter = await loadProfessionAppAdapter(professionId);

if (!adapter) {
  throw new Error(`Unknown profession: ${professionId}`);
}

const build = adapter.toApplicationBuild({
  ...savedBuild,
  rotation: savedRotation.rotation ?? savedRotation
});

const app = {
  build,
  adapter,
  profession: adapter.profession,
  skillByName: adapter.profession.catalog.skillsByName,
  skillById: adapter.profession.catalog.skillsById,
  attributeWeaponSet: 1
};

// Reproduce the application's derived attributes and profession assumptions.
adapter.recalculate(app);

const config = adapter.simulationConfig(app);

const result = adapter.simulateBuild(build.rotation, config);

console.log({
  profession: adapter.profession.name,
  damage: Math.round(result.totalDamage),
  dps: Math.round(result.dps),
  duration: result.duration
});

if (result.warnings.length) {
  console.warn(result.warnings);
}
```

This approach is preferable when working with exported simulator builds because the application adapter handles:

- equipment-derived attributes;
- selected traits and skills;
- weapon sets;
- profession resources;
- specialization-specific assumptions;
- other configuration normally assembled by the UI.

Use direct `simulateGw2()` calls when you intentionally want to provide resolved combat values yourself.

---

## Rotation format

A rotation is an ordered list of skills and simulator commands.

The simplest form uses skill names:

```js
const rotation = ['Grenade Kit', 'Grenade', 'Throw Mine'];
```

Numeric skill IDs can also be used:

```js
const rotation = [5882, 5806];
```

IDs are generally safer for long-lived scripts because skill names can change.

Common explicit commands include:

```js
const rotation = [
  { type: 'cast', skillId: 5882 },

  { type: 'wait', durationMs: 1000 },

  { type: 'combat-start' },

  { type: 'cooldown-reset' }
];
```

Explicit casts can also describe timing behavior when needed:

```js
{
  type: "cast",
  skillId: 5882,
  concurrentOffsetMs: 100,
  interruptAfterMs: 500,
}
```

You can inspect a profession's available skills programmatically:

```js
console.table(
  engineerProfession.catalog.skills.map(({ id, name }) => ({
    id,
    name
  }))
);
```

Always inspect `result.warnings`; unavailable, invalid, or mistimed actions may otherwise produce a result different
from what the caller intended.

---

## Observe effects after the rotation

By default, simulation resolution ends at the rotation boundary.

That is normally what you want for benchmark-style comparisons.

Sometimes you may want to observe delayed damage, conditions, summons, fields, or other effects after the final player
action.

Use an observation tail:

```js
const result = simulateGw2({
  profession: engineerProfession,
  rotation,
  config,
  observationPolicy: {
    kind: 'tail',
    durationMs: 5000
  }
});
```

An observation tail extends the resolver window without adding an artificial player wait to the rotation.

This is useful for isolated mechanic tests such as:

```text
cast skill
→ stop issuing inputs
→ observe its complete damage/effect lifetime
```

An explicit rotation wait is different:

```js
{ type: "wait", durationMs: 5000 }
```

A wait is part of the player's command timeline and therefore changes the rotation duration.

---

## Read simulation results

The most commonly useful fields are:

| Field                | Meaning                                            |
| -------------------- | -------------------------------------------------- |
| `dps`                | Overall DPS                                        |
| `totalDamage`        | Total resolved damage                              |
| `strikeDamage`       | Strike damage                                      |
| `conditionDamage`    | Condition damage                                   |
| `duration`           | Rotation duration                                  |
| `dpsWindow`          | Window used for DPS calculation                    |
| `casts`              | Aggregate cast counts                              |
| `breakdown`          | Raw skill damage contributions                     |
| `conditionBreakdown` | Condition damage contributions                     |
| `events`             | Scheduled event timeline                           |
| `resolvedEvents`     | Resolved combat timeline                           |
| `endState`           | Final cooldown, ammo, weapon, and profession state |
| `warnings`           | Invalid or constrained simulation behavior         |

For a ready-to-use per-skill breakdown:

```js
import { skillBreakdownRows } from './js/games/gw2/app/presentation/results/result-tables.js';

const rows = skillBreakdownRows(result);

console.table(
  rows.map((row) => ({
    skill: row.name,
    casts: row.casts,
    hits: row.hits,
    damage: Math.round(row.total),
    dps: Math.round(row.dps)
  }))
);
```

Raw `events` and `resolvedEvents` are useful when writing analysis tools or debugging exact simulator behavior.

---

## Deterministic and stochastic simulation

Deterministic mode is appropriate for reproducible build and rotation comparisons:

```js
randomness: {
  mode: "deterministic",
  seed: 1,
}
```

A reproducible stochastic run can instead use:

```js
randomness: {
  mode: "stochastic",
  seed: 42,
}
```

To study RNG distributions, run multiple seeds rather than relying on one stochastic result:

```js
const samples = [];

for (let seed = 1; seed <= 500; seed += 1) {
  const result = run(rotation, {
    randomness: {
      mode: 'stochastic',
      seed
    }
  });

  samples.push(result.dps);
}

samples.sort((a, b) => a - b);

const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;

console.log({
  trials: samples.length,
  mean: Math.round(mean),
  minimum: Math.round(samples[0]),
  maximum: Math.round(samples.at(-1))
});
```

This makes the headless API suitable for custom RNG analysis as well as deterministic benchmarking.

---

## Load professions dynamically

Scripts that accept a profession as input can use the shared registry:

```js
import { loadProfession } from './js/games/gw2/app/profession/registry.js';
import { simulateGw2 } from './js/games/gw2/platform/index.js';

const professionId = process.argv[2] || 'engineer';

const profession = await loadProfession(professionId);

if (!profession) {
  throw new Error(`Unknown profession: ${professionId}`);
}

const result = simulateGw2({
  profession,
  rotation,
  config
});
```

Registered profession IDs are:

```text
elementalist
mesmer
necromancer
ranger
thief
engineer
guardian
warrior
revenant
```

Loading a profession contract does not automatically create a build or derive equipment stats. Use its application
adapter when you need UI-equivalent build processing.

---

## API boundary

The programmatic simulator consumes **resolved simulation configuration**.

A direct `simulateGw2()` call does not:

- read local storage;
- inspect browser form controls;
- calculate a build from the UI;
- automatically derive equipment attributes.

For low-level experiments, provide the required combat configuration directly.

For saved builds and UI-equivalent simulation, use the profession application adapter.

The project is not published as a reusable npm package. `package.json` is marked `private`, and these module paths are
internal repository APIs. Headless scripts should therefore live alongside the repository or be pinned to a compatible
revision.

No browser or web server is required.
