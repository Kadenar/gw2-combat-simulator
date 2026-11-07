# Guardian code navigation

Virtues, symbols, weapon state, and their trait reactions. This guide locates the family owners. Skill declarations,
trait definitions, and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/guardian/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/guardian/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/guardian/build/) owns defaults, validation, attributes, and the headless
  context.
- [core/module.ts](../../js/games/gw2/professions/guardian/core/module.ts) registers Core contributions. Each elite has
  its own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/guardian/core/state.ts) and each elite's `state.ts` own runtime state
  and public projections.
- [core/skills/](../../js/games/gw2/professions/guardian/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/guardian/core/traits/) contain Core declarations. Elite declarations
  live under their specialization.
- [app/](../../js/games/gw2/professions/guardian/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                          | Start here                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Core virtues                  | [core/mechanics/virtues.ts](../../js/games/gw2/professions/guardian/core/mechanics/virtues.ts)         |
| Spear illumination expiry     | [core/mechanics/spear.ts](../../js/games/gw2/professions/guardian/core/mechanics/spear.ts)             |
| Dragonhunter physical virtues | [specializations/dragonhunter/](../../js/games/gw2/professions/guardian/specializations/dragonhunter/) |
| Firebrand tomes and pages     | [specializations/firebrand/](../../js/games/gw2/professions/guardian/specializations/firebrand/)       |
| Willbender movement virtues   | [specializations/willbender/](../../js/games/gw2/professions/guardian/specializations/willbender/)     |
| Luminary Radiant Forge        | [specializations/luminary/](../../js/games/gw2/professions/guardian/specializations/luminary/)         |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/guardian/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/guardian/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
