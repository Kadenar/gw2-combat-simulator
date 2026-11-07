# Mesmer code navigation

Illusions, shatters, weapon state, and shared trait reactions. This guide locates the family owners. Skill declarations,
trait definitions, and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/mesmer/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/mesmer/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/mesmer/build/) owns defaults, validation, attributes, and the headless
  context.
- [core/module.ts](../../js/games/gw2/professions/mesmer/core/module.ts) registers Core contributions. Each elite has
  its own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/mesmer/core/state.ts) and each elite's `state.ts` own runtime state and
  public projections.
- [core/skills/](../../js/games/gw2/professions/mesmer/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/mesmer/core/traits/) contain Core declarations. Elite declarations live
  under their specialization.
- [app/](../../js/games/gw2/professions/mesmer/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                             | Start here                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Illusion ownership and execution | [core/mechanics/illusions/](../../js/games/gw2/professions/mesmer/core/mechanics/illusions/)         |
| Family resource binding          | [family-resources.ts](../../js/games/gw2/professions/mesmer/family-resources.ts)                     |
| Chronomancer Continuum actions   | [specializations/chronomancer/](../../js/games/gw2/professions/mesmer/specializations/chronomancer/) |
| Mirage cloak and ambushes        | [specializations/mirage/](../../js/games/gw2/professions/mesmer/specializations/mirage/)             |
| Virtuoso blades and bladesongs   | [specializations/virtuoso/](../../js/games/gw2/professions/mesmer/specializations/virtuoso/)         |
| Troubadour instruments           | [specializations/troubadour/](../../js/games/gw2/professions/mesmer/specializations/troubadour/)     |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/mesmer/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/mesmer/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
