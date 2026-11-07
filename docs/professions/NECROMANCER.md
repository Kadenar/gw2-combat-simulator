# Necromancer code navigation

Life force, shroud transitions, minions, and weapon state. This guide locates the family owners. Skill declarations,
trait definitions, and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/necromancer/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/necromancer/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/necromancer/build/) owns defaults, validation, attributes, and the headless
  context.
- [core/module.ts](../../js/games/gw2/professions/necromancer/core/module.ts) registers Core contributions. Each elite
  has its own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/necromancer/core/state.ts) and each elite's `state.ts` own runtime
  state and public projections.
- [core/skills/](../../js/games/gw2/professions/necromancer/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/necromancer/core/traits/) contain Core declarations. Elite declarations
  live under their specialization.
- [app/](../../js/games/gw2/professions/necromancer/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                         | Start here                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Core shroud lifecycle        | [core/mechanics/shroud-lifecycle.ts](../../js/games/gw2/professions/necromancer/core/mechanics/shroud-lifecycle.ts) |
| Resources and capacity       | [core/mechanics/resources.ts](../../js/games/gw2/professions/necromancer/core/mechanics/resources.ts)               |
| Reaper shroud                | [specializations/reaper/](../../js/games/gw2/professions/necromancer/specializations/reaper/)                       |
| Scourge shades               | [specializations/scourge/](../../js/games/gw2/professions/necromancer/specializations/scourge/)                     |
| Harbinger Blight and elixirs | [specializations/harbinger/](../../js/games/gw2/professions/necromancer/specializations/harbinger/)                 |
| Ritualist spirits            | [specializations/ritualist/](../../js/games/gw2/professions/necromancer/specializations/ritualist/)                 |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/necromancer/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/necromancer/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
