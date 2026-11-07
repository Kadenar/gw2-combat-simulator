# Revenant code navigation

Legends, Energy, upkeep, and weapon state. This guide locates the family owners. Skill declarations, trait definitions,
and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/revenant/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/revenant/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/revenant/build/) owns defaults, validation, attributes, and the headless
  context.
- [core/module.ts](../../js/games/gw2/professions/revenant/core/module.ts) registers Core contributions. Each elite has
  its own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/revenant/core/state.ts) and each elite's `state.ts` own runtime state
  and public projections.
- [core/skills/](../../js/games/gw2/professions/revenant/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/revenant/core/traits/) contain Core declarations. Elite declarations
  live under their specialization.
- [app/](../../js/games/gw2/professions/revenant/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                                  | Start here                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Core resource policies                | [core/mechanics/resources.ts](../../js/games/gw2/professions/revenant/core/mechanics/resources.ts) |
| Family cost composition               | [energy-cost.ts](../../js/games/gw2/professions/revenant/energy-cost.ts)                           |
| Herald facets                         | [specializations/herald/](../../js/games/gw2/professions/revenant/specializations/herald/)         |
| Renegade warband skills               | [specializations/renegade/](../../js/games/gw2/professions/revenant/specializations/renegade/)     |
| Vindicator dodges and alliance skills | [specializations/vindicator/](../../js/games/gw2/professions/revenant/specializations/vindicator/) |
| Conduit affinity and Cosmic Wisdom    | [specializations/conduit/](../../js/games/gw2/professions/revenant/specializations/conduit/)       |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/revenant/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/revenant/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
