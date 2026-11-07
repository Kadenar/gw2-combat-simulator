# Elementalist code navigation

Attunements, conjures, summoned elementals, and elemental weapon state. This guide locates the family owners. Skill
declarations, trait definitions, and their callers describe current behavior.

## Entry points

- [profession.ts](../../js/games/gw2/professions/elementalist/profession.ts) composes the family;
  [catalog.ts](../../js/games/gw2/professions/elementalist/catalog.ts) collects its modules.
- [build/](../../js/games/gw2/professions/elementalist/build/) owns defaults, validation, attributes, and the headless
  context.
- [core/module.ts](../../js/games/gw2/professions/elementalist/core/module.ts) registers Core contributions. Each elite
  has its own `module.ts`.
- [core/state.ts](../../js/games/gw2/professions/elementalist/core/state.ts) and each elite's `state.ts` own runtime
  state and public projections.
- [core/skills/](../../js/games/gw2/professions/elementalist/core/skills/) and
  [core/traits/](../../js/games/gw2/professions/elementalist/core/traits/) contain Core declarations. Elite declarations
  live under their specialization.
- [app/](../../js/games/gw2/professions/elementalist/app/) binds the browser adapter and tooltips; Core and elite
  `presentation.ts` files contribute views.

## Mechanic owners

| Area                                     | Start here                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Attunements and recharge                 | [core/mechanics/attunements.ts](../../js/games/gw2/professions/elementalist/core/mechanics/attunements.ts) |
| Attunement gating across Core and Weaver | [family-state.ts](../../js/games/gw2/professions/elementalist/family-state.ts)                             |
| Tempest overloads                        | [specializations/tempest/](../../js/games/gw2/professions/elementalist/specializations/tempest/)           |
| Weaver dual attunements                  | [specializations/weaver/](../../js/games/gw2/professions/elementalist/specializations/weaver/)             |
| Catalyst spheres and energy              | [specializations/catalyst/](../../js/games/gw2/professions/elementalist/specializations/catalyst/)         |
| Evoker familiars                         | [specializations/evoker/](../../js/games/gw2/professions/elementalist/specializations/evoker/)             |

Read the relevant `hooks.ts`, trait registrations, and callers when changing reaction order or lifetime behavior. The
[shared module map](../architecture/MODULES.md#profession-file-roles) explains the file roles without duplicating their
rules.

## Presets and validation

The [build manifest](../../data/gw2/builds/elementalist/manifest.json) identifies saved presets and rotations.
[Profession tests](../../tests/games/gw2/professions/elementalist/) cover behavior and composition. Use
[AGENTS.md](../../AGENTS.md) for simulation scope and validation policy; shared run settings are located by the
[programmatic guide](../architecture/PROGRAMMATIC-SIMULATION.md#randomness).
