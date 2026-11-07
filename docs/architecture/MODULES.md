# Simulator module map

Use this map to find the owner of a change. [Architecture](ARCHITECTURE.md) follows a run; the
[glossary](../GLOSSARY.md) explains project terms. The linked code determines current behavior.

## Repository map

| Area                                            | Location                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| Game-neutral scheduling and calculation helpers | [js/kernel/](../../js/kernel/)                      |
| Shared browser loading, shell, and workers      | [js/browser/](../../js/browser/)                    |
| Game-neutral views and DOM helpers              | [js/ui/](../../js/ui/)                              |
| Shared GW2 services                             | [platform/](../../js/games/gw2/platform/)           |
| Profession content and mechanics                | [professions/](../../js/games/gw2/professions/)     |
| Headless build binding                          | [build-context/](../../js/games/gw2/build-context/) |
| GW2 browser application                         | [app/](../../js/games/gw2/app/)                     |
| Physical bindings and activity analysis         | [input/](../../js/games/gw2/input/)                 |
| External formats and patch previews             | [integrations/](../../js/games/gw2/integrations/)   |
| Saved builds and rotations                      | [data/gw2/](../../data/gw2/)                        |

Import enforcement lives in [eslint.config.js](../../eslint.config.js) and
[architecture tests](../../tests/architecture/). Consult those files for allowed dependencies and type-import handling.

## Application owners

Paths below are relative to [app/](../../js/games/gw2/app/).

| Change                                | Start here                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session composition                   | [profession-app.ts](../../js/games/gw2/app/profession-app.ts), [define-profession-app.ts](../../js/games/gw2/app/define-profession-app.ts)           |
| Build editing and tabs                | [build/](../../js/games/gw2/app/build/), especially `state/` and `library/`                                                                          |
| Attribute preview                     | [attribute-effects.ts](../../js/games/gw2/app/build/attribute-effects.ts), [buffed-attributes.ts](../../js/games/gw2/app/build/buffed-attributes.ts) |
| Skill-damage preview                  | [build/skill-damage/](../../js/games/gw2/app/build/skill-damage/)                                                                                    |
| Rotation editing and cursor queries   | [rotation/](../../js/games/gw2/app/rotation/), especially `builder.ts`, `context.ts`, and `cursor-preview.ts`                                        |
| Palette and active state              | [palette/](../../js/games/gw2/app/rotation/palette/), [state-snapshot/](../../js/games/gw2/app/rotation/state-snapshot/)                             |
| Results and charts                    | [results/](../../js/games/gw2/app/results/)                                                                                                          |
| Simulation jobs and settings          | [simulation/](../../js/games/gw2/app/simulation/)                                                                                                    |
| Gear search and relic comparison      | [optimizer/](../../js/games/gw2/app/optimizer/)                                                                                                      |
| Benchmark pages                       | [page/benchmarks/](../../js/games/gw2/app/page/benchmarks/)                                                                                          |
| Boss scenario editing and compilation | [boss-scenarios/](../../js/games/gw2/app/boss-scenarios/)                                                                                            |
| File and log import                   | [import-export/](../../js/games/gw2/app/import-export/)                                                                                              |
| Patch selection and comparison        | [patch-preview/](../../js/games/gw2/app/patch-preview/)                                                                                              |
| Standalone patch editor               | [patch-authoring/](../../js/games/gw2/app/patch-authoring/)                                                                                          |
| Keybinding editor                     | [input-profile/](../../js/games/gw2/app/input-profile/)                                                                                              |

Feature folders keep their runners, workers, models, and views together. The shared worker lifecycle is in
[worker-harness.ts](../../js/browser/game/worker-harness.ts).

## GW2 engine and platform

| Change                                                       | Start here                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Run options, construction, and clock advancement             | [simulation/](../../js/games/gw2/platform/simulation/)                                               |
| Casts, cooldowns, resources at acceptance, chains, and flips | [execution/](../../js/games/gw2/platform/execution/)                                                 |
| Packet delivery, strikes, and conditions                     | [resolver/](../../js/games/gw2/platform/resolver/)                                                   |
| Effect declarations and emission                             | [effects/](../../js/games/gw2/platform/effects/)                                                     |
| Combat formulas, state, resources, and procs                 | [combat/](../../js/games/gw2/platform/combat/)                                                       |
| Live attribute and multiplier queries                        | [combat-calculation/](../../js/games/gw2/platform/combat-calculation/)                               |
| Build attributes                                             | [attributes/](../../js/games/gw2/platform/attributes/)                                               |
| Saved build and rotation shapes                              | [builds/](../../js/games/gw2/platform/builds/)                                                       |
| Skills, catalogs, and declaration validation                 | [skills/](../../js/games/gw2/platform/skills/)                                                       |
| Equipment and combos                                         | [equipment/](../../js/games/gw2/platform/equipment/), [combos/](../../js/games/gw2/platform/combos/) |
| Profession compilation and capabilities                      | [profession-definition/](../../js/games/gw2/platform/profession-definition/)                         |
| Profession UI composition                                    | [profession-presentation/](../../js/games/gw2/platform/profession-presentation/)                     |
| Isolated skill measurement                                   | [skill-damage/](../../js/games/gw2/platform/skill-damage/)                                           |
| Result projection and queries                                | [results/](../../js/games/gw2/platform/results/)                                                     |

The [platform guide](../../js/games/gw2/platform/README.md) provides further navigation. The data-copy helper lives in
[kernel/core/clone.ts](../../js/kernel/core/clone.ts); its [performance audit](../audits/CLONE-PERFORMANCE.md) is
historical evidence.

## Profession file roles

Paths are relative to a family under [professions/](../../js/games/gw2/professions/).

| File or folder                  | Role                                                               |
| ------------------------------- | ------------------------------------------------------------------ |
| `profession.ts`, `catalog.ts`   | Family composition and collected module content                    |
| `build/`                        | Build codec, attributes, loadout eligibility, and headless context |
| `data/`                         | Identities and maintained selection data                           |
| Core or elite `module.ts`       | Registration of the owner's contributions                          |
| Core or elite `state.ts`        | State factory and public projection                                |
| Core or elite `skills/`         | Skill declarations and intrinsic behavior                          |
| Core or elite `traits/`         | Trait definitions and supporting behavior                          |
| Core or elite `mechanics/`      | State and lifecycle logic spanning activations                     |
| Core or elite `hooks.ts`        | Callback registration and sequencing                               |
| Core or elite `presentation.ts` | Palette, resources, timeline, and snapshot contributions           |
| `app/`                          | Browser adapter and simulation tooltips                            |
| `state-ids.ts`                  | Public planning identities                                         |

Each [profession guide](../professions/) links to its specific owners. Read the relevant registration and callers to
determine execution order; this map does not reproduce it.

## Integrations and checks

[Log adapters](../../js/games/gw2/integrations/logs/) share normalization under `shared/rotation/`.
[Patch integrations](../../js/games/gw2/integrations/patches/) bind authored changes to native professions. Other
integration folders own chat codes, keybind formats, and asset loading.

[Tests](../../tests/) follow subsystem ownership. [Scripts](../../scripts/README.md) cover build tooling and analysis.
Use [AGENTS.md](../../AGENTS.md) for validation requirements.
