# Running a simulation from Node

`simulateGw2` runs the same synchronous runtime used by the application. These are internal repository APIs. The linked
TypeScript declarations describe the current inputs and outputs.

## Run a script

Install dependencies, then run `npm run build:modules`. Keep scripts in the repository so the aliases in
[package.json](../../package.json) resolve to compiled modules. Rebuild after source changes.

Save this as `run-engineer.mjs` in the repository root and run `node run-engineer.mjs`:

```js
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';

// Start with base attributes so runtime bonuses are applied once.
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
```

For dynamic profession selection, use `loadProfession` from
[profession-registry.ts](../../js/games/gw2/profession-registry.ts).

## Running a saved build

A saved build needs a build-context binding before simulation. This example loads one manifest entry and its separate
rotation. Save it in the repository root and run it with Node after building modules.

```js
import { readFile } from 'node:fs/promises';

import { loadBuildContext } from '#gw2/build-context/load.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Load the preset pair through its manifest so the build and rotation stay associated.
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson('data/gw2/builds/engineer/manifest.json');
const preset = manifest[0].presets[0];
const savedBuild = await readJson(preset.build);
const savedRotation = await readJson(preset.rotation);
const binding = await loadBuildContext('engineer');
const build = binding.toApplicationBuild({ ...savedBuild, rotation: savedRotation.rotation });
const context = binding.createBuildContext({
  build,
  patch: binding.profession.resolvePatch({ id: 'current' }),
  transitionDelays: normalizeTransitionDelays(undefined)
});
const result = simulateGw2({
  profession: binding.profession,
  rotation: build.rotation,
  config: context.simulationConfig()
});

console.log({ dps: result.dps, totalDamage: result.totalDamage, warnings: result.warnings });
```

[Build-context types](../../js/games/gw2/build-context/types.ts) describe the binding and borrowed inputs. Create a new
context when those inputs change.

## Input and output owners

| Need                             | Source                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Run options and output overloads | [options.ts](../../js/games/gw2/platform/simulation/options.ts), [simulate.ts](../../js/games/gw2/platform/simulation/simulate.ts)   |
| Shared configuration             | [config.ts](../../js/games/gw2/platform/simulation/config.ts)                                                                        |
| Attribute seeds                  | [attributes/inputs.ts](../../js/games/gw2/platform/attributes/inputs.ts)                                                             |
| Saved build shapes and decoding  | [builds/types.ts](../../js/games/gw2/platform/builds/types.ts), [codec.ts](../../js/games/gw2/platform/builds/codec.ts)              |
| Result fields and units          | [results/types.ts](../../js/games/gw2/platform/results/types.ts)                                                                     |
| Warning formatting               | [diagnostics.ts](../../js/games/gw2/platform/results/diagnostics.ts)                                                                 |
| Display aggregation              | [skill-breakdown.ts](../../js/games/gw2/app/results/skill-breakdown.ts), [results/model.ts](../../js/games/gw2/app/results/model.ts) |

## Rotation commands

[builds/rotation.ts](../../js/games/gw2/platform/builds/rotation.ts) owns command types and normalization. Use its
current `RotationCommand` definition for casts, waits, combat markers, and optional controls. Saved-build selection and
direct run configuration are separate shapes; follow the build-context conversion rather than passing saved JSON
directly as `config`.

## Observation boundaries

[kernel/execution/observation.ts](../../js/kernel/execution/observation.ts) defines rotation, tail, and absolute
policies. [Observation-window tests](../../tests/games/gw2/platform/simulation/observation-windows.test.js) demonstrate
cutoff behavior. [Planning state](ROTATION_STATE_SNAPSHOT.md) describes editor observations and their code owners.

## Randomness

[simulation-random.ts](../../js/kernel/core/simulation-random.ts) owns seeded modes and streams.
[critical-damage-mode.ts](../../js/games/gw2/platform/combat/critical-damage-mode.ts) owns critical-damage policy
normalization; [randomness-assumptions.ts](../../js/games/gw2/platform/builds/randomness-assumptions.ts) owns saved
defaults and controls. Set policies explicitly when a comparison depends on them.

## Boss encounters

[combat/state/encounter.ts](../../js/games/gw2/platform/combat/state/encounter.ts) defines encounter inputs and
execution. [boss-scenarios/simulation.ts](../../js/games/gw2/app/boss-scenarios/simulation.ts) converts browser scenario
plans to those inputs. The [wiki](../../wiki/Boss-Scenarios.md) explains the user workflow.
