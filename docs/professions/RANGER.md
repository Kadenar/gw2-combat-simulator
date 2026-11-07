# Ranger code navigation

Pets, companion commands, weapon state, and shared resources. This guide locates the family owners. Skill declarations,
trait definitions, and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/ranger/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/ranger/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/ranger/build/) owns defaults, validation, attributes, and the headless
  context.
- [core/module.ts](../../js/games/gw2/professions/ranger/core/module.ts) registers Core contributions. Each elite has
  its own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/ranger/core/state.ts) and each elite's `state.ts` own runtime state and
  public projections.
- [core/skills/](../../js/games/gw2/professions/ranger/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/ranger/core/traits/) contain Core declarations. Elite declarations live
  under their specialization.
- [app/](../../js/games/gw2/professions/ranger/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                          | Start here                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Pet execution                 | [core/mechanics/pets.ts](../../js/games/gw2/professions/ranger/core/mechanics/pets.ts)                     |
| Pet attributes                | [core/mechanics/pet-attributes.ts](../../js/games/gw2/professions/ranger/core/mechanics/pet-attributes.ts) |
| Druid Avatar and Astral Force | [specializations/druid/](../../js/games/gw2/professions/ranger/specializations/druid/)                     |
| Soulbeast merge state         | [specializations/soulbeast/](../../js/games/gw2/professions/ranger/specializations/soulbeast/)             |
| Untamed unleash and ambushes  | [specializations/untamed/](../../js/games/gw2/professions/ranger/specializations/untamed/)                 |
| Galeshot Cyclone Bow          | [specializations/galeshot/](../../js/games/gw2/professions/ranger/specializations/galeshot/)               |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/ranger/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/ranger/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
