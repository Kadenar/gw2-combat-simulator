# Warrior code navigation

Adrenaline, bursts, weapon state, and shared trait reactions. This guide locates the family owners. Skill declarations,
trait definitions, and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/warrior/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/warrior/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/warrior/build/) owns defaults, validation, attributes, and the headless
  context.
- [core/module.ts](../../js/games/gw2/professions/warrior/core/module.ts) registers Core contributions. Each elite has
  its own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/warrior/core/state.ts) and each elite's `state.ts` own runtime state
  and public projections.
- [core/skills/](../../js/games/gw2/professions/warrior/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/warrior/core/traits/) contain Core declarations. Elite declarations live
  under their specialization.
- [app/](../../js/games/gw2/professions/warrior/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                               | Start here                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Core adrenaline                    | [core/mechanics/adrenaline.ts](../../js/games/gw2/professions/warrior/core/mechanics/adrenaline.ts)   |
| Berserker mode and Rage skills     | [specializations/berserker/](../../js/games/gw2/professions/warrior/specializations/berserker/)       |
| Spellbreaker counter and tether    | [specializations/spellbreaker/](../../js/games/gw2/professions/warrior/specializations/spellbreaker/) |
| Bladesworn Flow and Dragon Trigger | [specializations/bladesworn/](../../js/games/gw2/professions/warrior/specializations/bladesworn/)     |
| Paragon commands and Motivation    | [specializations/paragon/](../../js/games/gw2/professions/warrior/specializations/paragon/)           |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/warrior/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/warrior/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
