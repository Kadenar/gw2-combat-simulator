# Simulator API reference for agents

Use this map to run simulations and locate the component that owns a change. Follow [AGENTS.md](../../AGENTS.md). Paths
below are relative to `js/games/gw2/` unless stated otherwise; TypeScript source is authoritative.

## Run a simulation

Requires Node 24.11+ and installed dependencies. Run `npm run build:modules` after source changes. Repository scripts
import `.js` paths through `#gw2/`, `#kernel/`, and `#ui/`; Node loads compiled `dist/js/` modules. These are internal
repository APIs. Keep scripts inside the repository and pinned to its revision.

```js
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';

// Supply base attributes so the runtime can apply profession and combat bonuses once.
const result = simulateGw2({
  profession: engineerProfession,
  rotation: ['Grenade Kit', 'Grenade'],
  config: {
    specialization: 'Core',
    selectedSkillIds: [5805],
    attributeInputs: baseAttributeInputs({ power: 2500, precision: 1500 }),
    target: { armor: 2597 },
    randomness: { mode: 'deterministic', seed: 1 }
  },
  observationPolicy: { kind: 'tail', durationMs: 1000 }
});
console.log({ dps: result.dps, warnings: result.warnings });
```

## Inputs and outputs

- `simulateGw2(options)` is synchronous; `platform/simulation/options.ts` declares run options.
- `profession`: import `<name>Profession` from `professions/<name>/profession.ts`. `runtimeFor(config)` selects Core
  plus the configured elite; `.catalog` exposes the family's full skill catalog.
- `config`: `Gw2Config` in `platform/simulation/config.ts`; includes specialization, attribute inputs, boons, target,
  traits, slot skills, weapons, equipment effects, profession assumptions, and randomness.
- `baseAttributeInputs(base, alternate?)` creates both weapon-set seeds for direct callers. Supply base attributes, not
  totals already including profession or temporary bonuses. `config.stats` is not a supported field.
- Saved builds differ from run configs: `selectedSkillIds` is slot-keyed in builds and a flat ID array in configs.
  Omitted run loadouts permit sandbox casts; `[]` equips no slot skills. Preserve catalog ID types.
- `rotation`: ordered skill names, numeric IDs, or canonical `RotationCommand` objects from
  `platform/builds/rotation.ts`. Prefer `{ type: 'cast', skillId }` for persistent scripts. Other commands:
  `{ type: 'wait', durationMs }`, `{ type: 'combat-start' }`, `{ type: 'cooldown-reset' }`. Use
  `normalizeRotation(input, catalog, { strict: true })` to reject malformed input.
- `observationPolicy`: `{ kind: 'rotation' }` (default), `{ kind: 'tail', durationMs }`, or
  `{ kind: 'absolute', endTimeMs }`; an absolute boundary cannot precede rotation end. Target death clips combat.
- Default detailed output: `Gw2SimulationResult` in `platform/results/types.ts`; includes `dps`, `totalDamage`,
  `strikeDamage`, `conditionDamage`, `warnings`, `steps`, `resolvedEvents`, breakdowns, and `planningState`.
- `output: 'score'` returns `Gw2SimulationScore`: aggregate metrics and warnings without report histories.
  `damageDiagnostics: true` captures actual damage calculations in detailed events; it is never saved in builds.
- Inspect `warnings` on every run; each is a `{ message, at?, rotationIndex? }` diagnostic, and
  `formatSimulationDiagnostic` renders it as text. Planning snapshots are detached observations, not resumable runtime checkpoints.
- Live timestamps and result boundaries use seconds; authored `*Ms`, step `start`/`end`, and cooldown projections use
  ms.
- Player health is always 100%; only isolated attribute previews may vary it. Target health remains modeled.

## Component ownership

- `js/kernel/`: game-neutral clock, queue, seeded randomness, and observation contracts; imports no GW2 or UI code.
- `platform/simulation/`: `runtime.ts` assembles a run; `coordinator.ts` owns the single queue, clock, and execution
  loop.
- `platform/execution/`: cast admission, cooldowns, ammo, resources at cast time, chains, and rotation traversal.
- `platform/resolver/`: ordered packet delivery, strikes, conditions, combos, and reactions on the shared clock.
- `platform/effects/`: declarations, validated emissions, and action dispatch; `platform/events/` defines event
  contracts.
- `platform/combat/`: formulas and live combat state, resources, targets, and executed facts used by mechanics.
- `platform/builds/` and `platform/equipment/`: build codecs, validation, rotation commands, and equipment rules;
  `platform/attributes/` owns attribute seeds and calculation. `app/simulation/build-config.ts` exposes `createGw2SimulationConfig(...)` for application build conversion.
- `platform/profession-definition/`: `defineNativeProfession(...)` in `profession.ts` compiles native modules;
  `runtime-hooks.ts` defines hook contributions, and `mechanic-context.ts` defines query/combat/lifecycle capabilities.
- `professions/<name>/`: owns `profession.ts`, `catalog.ts`, `build/`, `core/`, and `specializations/`
  content/mechanics. Author through supplied contexts; shared platform code must not import profession implementations
  or application code.
- `platform/combat-calculation/` shares calculations across live combat and previews; `platform/skill-damage/` measures
  isolated occurrences through the same runtime. `platform/profession-presentation/` owns preview presentation
  contracts.
- `platform/results/`: optional reporting, result queries, and detached planning views; reporting must not drive
  gameplay.
- `js/browser/`, `js/ui/`, and `app/`: browser composition, neutral views, GW2 persistence, workers, and presentation.
- `integrations/`: log import, keybinds, and patch overlays; `data/gw2/` at repository root holds saved presets.

## Validate changes

- Format touched supported files with `npx prettier --write --ignore-path .gitignore <touched-files>` so Markdown is not
  skipped by the bulk-format exclusions; never edit generated `dist/` output.
- Engine/profession/data: build modules, run relevant `node --test <test-files>`, and `npm run typecheck` as
  appropriate.
- UI/browser integration: run relevant `npx playwright test <test-files>`; `npm run check` excludes browser tests.
- Follow repository test restrictions: test focused behavior contracts; preset numeric regressions cover total DPS only
  (maximum 1% relative error). Do not silence warnings or add compatibility paths without explicit approval.
- Further detail: [ownership](../../js/games/gw2/platform/README.md), [modules](MODULES.md),
  [event ordering](SKILL-EVENT-ORDERING.md), and [programmatic usage](PROGRAMMATIC-SIMULATION.md).
