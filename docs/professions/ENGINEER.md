# Engineer code navigation

Kits, toolbelt skills, turrets, and weapon state. This guide locates the family owners. Skill declarations, trait
definitions, and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/engineer/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/engineer/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/engineer/build/) owns defaults, validation, attributes, and the headless
  context.
- [core/module.ts](../../js/games/gw2/professions/engineer/core/module.ts) registers Core contributions. Each elite has
  its own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/engineer/core/state.ts) and each elite's `state.ts` own runtime state
  and public projections.
- [core/skills/](../../js/games/gw2/professions/engineer/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/engineer/core/traits/) contain Core declarations. Elite declarations
  live under their specialization.
- [app/](../../js/games/gw2/professions/engineer/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                               | Start here                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Kits and toolbelt                  | [core/mechanics/](../../js/games/gw2/professions/engineer/core/mechanics/)                                                         |
| Scrapper gyros and combo reactions | [specializations/scrapper/](../../js/games/gw2/professions/engineer/specializations/scrapper/)                                     |
| Holosmith Forge and heat           | [specializations/holosmith/](../../js/games/gw2/professions/engineer/specializations/holosmith/)                                   |
| Mechanist mech execution           | [specializations/mechanist/mechanics/mech.ts](../../js/games/gw2/professions/engineer/specializations/mechanist/mechanics/mech.ts) |
| Amalgam morphs and Evolve          | [specializations/amalgam/](../../js/games/gw2/professions/engineer/specializations/amalgam/)                                       |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/engineer/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/engineer/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
