# Thief code navigation

Initiative, stealth, stolen skills, and weapon state. This guide locates the family owners. Skill declarations, trait
definitions, and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/thief/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/thief/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/thief/build/) owns defaults, validation, attributes, and the headless context.
- [core/module.ts](../../js/games/gw2/professions/thief/core/module.ts) registers Core contributions. Each elite has its
  own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/thief/core/state.ts) and each elite's `state.ts` own runtime state and
  public projections.
- [core/skills/](../../js/games/gw2/professions/thief/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/thief/core/traits/) contain Core declarations. Elite declarations live
  under their specialization.
- [app/](../../js/games/gw2/professions/thief/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                                 | Start here                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Core resource policies               | [core/mechanics/resources.ts](../../js/games/gw2/professions/thief/core/mechanics/resources.ts) |
| Steal and trait dispatch             | [core/mechanics/steal.ts](../../js/games/gw2/professions/thief/core/mechanics/steal.ts)         |
| Daredevil dodges and physical skills | [specializations/daredevil/](../../js/games/gw2/professions/thief/specializations/daredevil/)   |
| Deadeye Mark and malice              | [specializations/deadeye/](../../js/games/gw2/professions/thief/specializations/deadeye/)       |
| Specter shroud and Shadow Force      | [specializations/specter/](../../js/games/gw2/professions/thief/specializations/specter/)       |
| Antiquary artifacts                  | [specializations/antiquary/](../../js/games/gw2/professions/thief/specializations/antiquary/)   |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/thief/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/thief/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
