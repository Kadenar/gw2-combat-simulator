# Simulator modules

This is a **code ownership guide** for the Guild Wars 2 combat simulator. Use it when you know what you want to change
but not which module or directory should own the change.

For how the simulator works (layers, phases, profession contracts, events, timing), see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Repository map

| Path                                  | Purpose                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `js/kernel/`                          | Game-neutral clock, collections, numeric helpers, randomness, event-stream, queue, and observation contracts |
| `js/ui/`                              | Game-neutral simulation view models and reusable DOM/rotation primitives                                     |
| `js/browser/`                         | Game-neutral page entry, game plug-in boundary (browser and worker), page/host integration, and shell        |
| `js/games/gw2/platform/`              | Shared Guild Wars 2 formulas, resolver logic, data, gear, relics, and simulation engine                      |
| `js/games/gw2/professions/`           | Profession-owned builds, skills, state, mechanics, traits, resolver behavior, and UI                         |
| `js/games/gw2/app/`                   | GW2 build editor, rotation workspace, browser lifecycle, and presentation adapters                           |
| `js/games/gw2/integrations/logs/`     | EVTC, dps.report, and gw2wingman parsing and rotation reconstruction                                         |
| `js/games/gw2/integrations/keybinds/` | Optional GW2 keybind import                                                                                  |
| `js/games/gw2/integrations/patches/`  | Patch-preview manifest, authoring model, and optional browser UI                                             |
| `data/games.json`                     | Canonical runtime game-data roots                                                                            |
| `data/gw2/builds/`                    | Saved GW2 build presets                                                                                      |
| `data/gw2/rotations/`                 | Saved GW2 rotation presets                                                                                   |
| `tests/`                              | Unit, integration, architecture, browser, and regression tests                                               |
| `scripts/`                            | Build, data generation, analysis, audit, and authoring tools                                                 |
| `docs/cleanup/`                       | Proposed simplifications that are not implemented yet                                                        |

```text
build + rotation
      ↓
profession application/runtime
      ↓
simulateGw2()
      ↓
unified runtime: commands, tasks, and combat reactions
      ↓
simulation result
      ↓
shared application views
```

## Where should my change go?

| You're adding or changing...                                          | Usually belongs in...                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Skill coefficient, hit count, condition, boon, timing, cooldown, etc. | Owning `skills/index.ts` or `skills/<group>.ts`                                  |
| Shared mechanic data used by several skills                           | The module's `profiles.ts`                                                       |
| Profession runtime resource or state                                  | The module's `state.ts`                                                          |
| Skill availability rule                                               | An `availability` hook in the owning mechanic or `hooks.ts`                      |
| Resource gain/spend/regeneration                                      | `mechanics/<resource>.ts` (for example `mechanics/life-force.ts`)                |
| Cast lifecycle behavior or delayed work                               | A cast hook or named task in the owning mechanic, assembled in `hooks.ts`        |
| Declarative trait modifier                                            | Core `traits/<trait-line>.ts` or elite `traits/index.ts` through `defineTrait()` |
| Complex trait proc or imperative behavior                             | Definition-local callbacks or `traits/behavior.ts` / concept helpers             |
| Custom scheduled event definitions                                    | Core `events.ts` or the mechanic file that emits them                            |
| Combat reaction or custom resolved event                              | The owning mechanic, registered under `hooks.reactions` / `hooks.eventHandlers`  |
| Profession UI, palette, skill-bar, or active-state display            | The module's `presentation.ts`                                                   |
| Trait and skill tooltip text                                          | `professions/<profession>/app/tooltips.ts`                                       |
| New reusable GW2 mechanic                                             | `js/games/gw2/platform/`                                                         |
| Generic scheduling primitive unrelated to GW2                         | `js/kernel/`                                                                     |
| Game-neutral browser shell behavior                                   | `js/browser/`                                                                    |
| GW2 browser behavior                                                  | `js/games/gw2/app/`                                                              |
| Shared presentation/view-model behavior                               | `js/ui/`                                                                         |
| Source-neutral log reconstruction within the GW2 integration          | `js/games/gw2/integrations/logs/shared/`                                         |
| EVTC parsing or evidence inference                                    | `js/games/gw2/integrations/logs/evtc/`                                           |
| dps.report / Elite Insights parsing or inference                      | `js/games/gw2/integrations/logs/dps-report/`                                     |
| gw2wingman log fetch/reshape (rules stay in `dps-report/`)            | `js/games/gw2/integrations/logs/wingman/`                                        |
| Upcoming balance changes                                              | Patch-preview system                                                             |
| Build defaults, normalization, and validation                         | Profession `build/build.ts`                                                      |
| New profession page/registry entry                                    | `js/games/gw2/profession-registry.ts`                                            |

The main rule is:

> Put behavior with the layer that owns the underlying game concept.

Traits use `defineTrait()` under their Core or elite `traits/` directory and register once through the module's
`traitDefinitions`. Core trait-line files own their definitions, and the Core `traits/index.ts` collects them in
execution order. Each elite's `traits/index.ts` owns all its definitions and its registration array. Definitions own
profiles, rules, triggers, hooks, and build effects. Short callbacks stay beside the definition; substantial or
externally called behavior lives in `traits/behavior.ts` or a cohesive concept file, which mechanics import directly
without importing definitions. Generated `data.traits` continues to own selection metadata.

Do not move profession-specific mechanics into shared platform code just because several files need them. Likewise, do
not duplicate shared GW2 behavior inside individual professions.

## Browser shell (`js/browser/`)

`js/browser/` owns the game-neutral page entry, the game plug-in boundary, page/host integration, and the shell.
Game-specific browser behavior belongs under its game package; GW2 uses `js/games/gw2/app/`.

| Path           | Responsibility                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `entry.ts`     | Page script: startup watchdog and bootstrap call                                                          |
| `bootstrap.ts` | Resolves the active game and content and starts its app                                                   |
| `game/`        | Game plug-in boundary: contracts and `GameContentAddress`, registry, worker driver, and worker harness    |
| `page/`        | Host integration: iframe embed support, modal dismissal and embed-aware positioning, and hosting redirect |
| `shell/`       | Result rendering, rotation workspace (config drawer, focus mode), and floating DPS badge                  |

Non-type imports:

| Folder              | May import                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `js/ui/shared/`     | nothing in `#ui`, `#browser`, or `#gw2`.                                                                 |
| `js/ui/results/`    | `js/ui/shared/`, other `js/ui/results/` files.                                                           |
| `js/ui/rotation/`   | `js/ui/shared/`, other `js/ui/rotation/` files. **Not** `js/ui/results/`.                                |
| `js/browser/page/`  | other `js/browser/page/` files (`dialog.ts` → `embed.ts`). Nothing else in `#browser`, `#ui`, or `#gw2`. |
| `js/browser/game/`  | other `js/browser/game/` files; lazy `import('#gw2/…')` only in `registry.ts` and `worker-driver.ts`.    |
| `js/browser/shell/` | `#ui`, `js/browser/page/`, `js/browser/game/contracts.ts` (types). No `#gw2`.                            |
| `js/browser/` root  | `js/browser/page/`, `js/browser/game/`.                                                                  |

`shell/` → `game/` is type-only (`GameContentAddress`), so no module in `game/` ever loads shell code.

## GW2 application (`js/games/gw2/app/`)

The root holds only the composition root; everything else lives in one folder per page area. `profession-app.ts`
coordinates the current GW2 browser application.

| Module                     | Responsibility                                     |
| -------------------------- | -------------------------------------------------- |
| `session-controls.ts`      | Session import/export, reset, and rotation history |
| `profession-app.ts`        | Session class; implements `ProfessionAppState`     |
| `create-runtime.ts`        | Connects application builds to `simulateGw2()`     |
| `define-profession-app.ts` | Composes preview-aware profession browser adapters |
| `types.ts`                 | Application state contracts                        |

| Folder           | Owns                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page/`          | Page chrome shared by the landing page and every profession page: `entry.ts` (the `<script>` in `index.html` and `templates/profession.html`), navigation, tutorial, icon fallback |
| `shared/`        | Leaf helpers: HTML, equipment pickers/labels/icons, result clock formatting, simulation tooltips                                                                                   |
| `build/`         | Build editor, panels, build state, workspace tabs, and saved builds                                                                                                                |
| `import-export/` | Build and rotation import/export, with log importers under `import-export/logs/`                                                                                                   |
| `rotation/`      | Rotation builder: palette, timeline, editing, state snapshot, comparison, warnings                                                                                                 |
| `results/`       | Result models, skill breakdown, summary metrics, charts, event log, and Analysis panel                                                                                             |
| `simulation/`    | Baseline simulation, modifier contributions, RNG distribution, and build-to-simulation config                                                                                      |
| `optimizer/`     | Gear optimizer and relic comparison, including their views, runners, and contracts                                                                                                 |

The lazy roster and build-template identities live in `js/games/gw2/profession-registry.ts`, shared by the browser,
workers, and tooling. Equipment UI used by both build panels and the optimizer lives in
`shared/equipment/{picker,labels,icons}.ts`.

Non-type imports inside `js/games/gw2/app/`:

| Folder           | May import                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/`        | platform, `#ui`, `#kernel`, `app/types.ts`. **No other app folder.**                                                                                                                        |
| `simulation/`    | `shared/`, other `simulation/` files. No `build/`, `optimizer/`, `results/`, `rotation/`, `import-export/`, or `page/`.                                                                     |
| `optimizer/`     | `shared/`, `build/panels/attributes.ts`, `results/model.ts`, `#gw2/profession-registry.ts`, other `optimizer/` files.                                                                       |
| `results/`       | `shared/`, `simulation/` types, `rotation/timeline/model.ts` (timeline projections for the idle metric), `rotation/context.ts` (`professionPlanningState`).                                 |
| `import-export/` | `shared/`, `build/state/`, `build/types.ts`, `#gw2/profession-registry.ts` (build-template identities), integrations.                                                                       |
| `build/`         | `shared/`, `import-export/`, `#gw2/profession-registry.ts`, `rotation/timeline/view.ts` (presets repaint), feature session defaults in `rotation/` and `results/state.ts` (workspace tabs). |
| `rotation/`      | `shared/`, `results/`, `import-export/rotation-import-dialog.ts`, `build/types.ts`.                                                                                                         |
| `page/`          | `shared/`, `#gw2/profession-registry.ts`, `rotation/timeline/preferences.ts`, `#browser`.                                                                                                   |
| root             | anything.                                                                                                                                                                                   |

`rotation/comparison.ts` and `rotation/timeline/view.ts` import each other. Both edges are calls inside functions, so
load order is safe; don't add top-level code in either file that calls into the other.

`types.ts` composes feature-owned state contracts into `ProfessionAppState`. Library selection and undo live in
`build/library/state.ts`; editing/history and timeline filters live in `rotation/editing/state.ts` and
`rotation/timeline/state.ts`; result ordering lives in `results/state.ts`. Workspace tabs compose these owners' session
defaults, keeping transient drag/loading state and shared overlay preferences outside tab capture. Optional modifier,
RNG, and relic result status lives beside each feature's job contracts and composes into `ProfessionAppResult`.

`rotation/comparison-state.ts` owns reference transitions, result admission, and swaps. `ProfessionApp` coordinates
their simulation scheduling, revisions, focus, and rendering. State-default modules do not import views or the app
class, so workspace persistence can use them without constructing the UI.

### `build/`

Build authoring and persistence: `editor.ts`, `state/` (persistence, skill selection, and workspace tabs), `library/`
(standard presets and named saved builds), and `panels/` (gear, traits, attributes, skills, assumptions, proc rates,
simulation settings, metadata, and workspace tabs). Build and rotation file, chat-code, and log import live in the
sibling `import-export/` directory.

`library/controller.ts` initializes the catalog and binds browsing and save interactions; `view.ts` owns markup,
dialogs, filters, and selection feedback. `model.ts` derives catalog labels and filter values without the DOM.
`actions.ts` coordinates loading, destination validation, replacement, and undo; `assets.ts` loads preset bundles.
`storage.ts` owns the durable My Builds snapshots, independently of open tabs in `state/workspace.ts`. Consumers import
these owners directly.

This layer may translate a build into application state, but it must not implement profession combat mechanics. Fixed
slot-loadout contracts and views come directly from `platform/builds/slot-loadout.ts`; profession presentation exposes
that typed contract, including optional palette placement and child actions.

`state/skill-selection.ts` owns selectable slot-skill queries as well as selection normalization. Both the skill panel
and isolated damage planner consume this owner, keeping selection logic independent of panel DOM code.

Attribute previews use `profession-presentation/attribute-preview.ts` contracts. Core, the selected elite, and family
presentation contribute controls, optional static-trait suppression before recalculation, and detached query-state
preparation. `build/attribute-effects.ts` retains common controls and normalization; `build/buffed-attributes.ts` owns
the isolated query lifecycle and result assembly. Profession owners handle private state, configuration, and synthetic
events. Preview player health never becomes a saved build assumption or simulation input.

### `rotation/`

| Module            | Responsibility                                               |
| ----------------- | ------------------------------------------------------------ |
| `builder.ts`      | Rotation-builder render orchestration                        |
| `comparison.ts`   | Reference-rotation comparison                                |
| `context.ts`      | Cross-feature rotation context and palette planning state    |
| `hotkeys.ts`      | Rotation hotkeys (GW2 keybind import lives in integrations)  |
| `warnings.ts`     | Rotation warnings strip                                      |
| `editing/`        | Rotation mutations, history, and entry editors               |
| `palette/`        | Palette state, resources, rendering, and interaction         |
| `timeline/`       | Timeline model, rendering, interaction, and display controls |
| `state-snapshot/` | Insertion-aware state queries and active-state rendering     |

`timeline/preferences.ts` owns persisted size, timing emphasis, dead time, transition delays, and proc-overlay
visibility. These preferences keep their storage keys and stay separate from simulation inputs. Profession-specific
rotation presentation comes from profession UI hooks rather than being hard-coded here.

Profession presentation owns weapon-variant grouping and selected utility variants, action ordering, automatic timeline
markers, mechanic badges and explanations, chart application identity, and optional trait-proc overlays. The shared
application aligns timestamps, places markers against executed steps, renders projections, and persists overlay choices
using profession-declared storage keys. These display preferences remain independent of saved builds and simulation
configuration. Presentation list callbacks compose Core, the active specialization, and family contributions; weapon
grouping uses the first owning specialization/Core/family callback, including an explicit unlabelled-bar result.

### `simulation/` and `optimizer/`

`simulation/build-config.ts` translates application builds into engine configuration. `baseline/`,
`modifier-contributions/`, and `random-distribution/` each keep their views, runners, workers, and contracts together.
`optimizer/` owns `view.ts`, `gear/`, and `relic-comparison/` on the same pattern. Consumers import the owning module
directly. `simulation/settings.ts` owns the browser simulation settings contract and persistence, independently of saved
build assumptions and workspace tabs. `build/panels/simulation-settings.ts` mounts the controls using that shared owner.

Use `runner.ts`, `worker.ts`, and `panel.ts` for feature-local roles and descriptive names for everything else (for
example `optimizer/gear/search.ts`, `fast-search.ts`, `search-space.ts`). These modules orchestrate simulation work;
they never own profession mechanics.

Shared pieces already exist and should stay outside individual feature directories:

- Worker lifecycle: `js/browser/game/worker-harness.ts` (`ManagedWorkerBatch`, `createGameWorkerEndpoint`). Baseline,
  modifier, and RNG workers use the default game driver; `js/games/gw2/worker-driver.ts` loads and caches preview-aware
  profession engines without browser adapters. The optimizer still loads its adapter for build and attribute work.
- Config and runtime: `createProfessionRuntime` in `create-runtime.ts`, `simulation/build-config.ts`
  (`deterministicSimulationConfig`), and the shared `simulateGw2` engine. Exact and fast optimizer searches share
  `createOptimizerEvaluator` and `scoreOptimizerRange`; relic comparison reuses `buildChartSeries` from `results/`.

Scheduling stays feature-specific: modifiers debounce and defer to RNG work, RNG partitions reproducible seed ranges,
the optimizer keeps worker state across search rounds, baseline execution coalesces edits through one persistent worker,
and relic comparison runs one deferred main-thread simulation. A general analysis-runner abstraction is not needed.

### Patch-preview authoring UI

`js/games/gw2/integrations/patches/app/` reads patch-authoring metadata exposed by native professions and lets
developers author the active preview without editing most of the manifest by hand. See
[PATCH-PREVIEW.md](./PATCH-PREVIEW.md).

### `results/`

GW2 result adapters own event ordering and profession event-log descriptor normalization. The neutral event log receives
prepared rows for rendering, filtering, CSV export, and mounting. `charts/` owns both time-series and hit-timeline
models/views, including condition payout attribution and empowered pulse presentation.

`view.ts` projects simulation output into section-specific models and composes their mounts for Summary, Workspace, and
Analysis. The shell clears each host once; section mounts append without replacing their siblings. `summary-view.ts`
owns metric disclosures, `random-distribution-view.ts` owns RNG status and controls, and
`modifier-contributions-view.ts` owns independently refreshed modifier rows. `charts/section-view.ts` owns chart loading
status and mounting; it receives the same health breakpoints used by the summary.

`breakdown/model.ts` owns columns, sorting, damage shares, and condition grouping. `breakdown/view.ts` renders the
combined skill/condition card and owns its selection state. `breakdown/inspectors.ts` renders expanded skill details and
condition dialogs using the existing hit-timeline view. Sorting preserves the selected skill identity, and modifier
completion updates only its own host so charts and expanded rows remain mounted.

## Neutral kernel and UI

`js/kernel/` contains primitives that make sense for any deterministic simulator: monotonic clock helpers, collections,
generic arithmetic (`core/numeric.ts` owns `clamp` and `roundHalfToEven`), seeded randomness, stable event queues
(`events/queue.ts`), caller-owned event-stream identity, and observation windows. It must not import application or game
packages.

| `js/ui/` path | Responsibility                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `results/`    | Shell-facing simulation view contracts, section mounting, and generic event-log rendering/export |
| `rotation/`   | Rotation warnings, insertion cursor, ammo display, and floating/duration editors (`editing/`)    |
| `shared/`     | DOM, HTML escaping, select-option markup, error, and dropdown-search helpers                     |

A `js/ui/` file lives in the folder with the same name as the `js/games/gw2/app/` folder that consumes it. GW2 adapts
its output through `js/games/gw2/app/results/view.ts`. Neutral UI must not name GW2 skills, resources, or profession
flags. Dependencies point from game presentation to `js/ui/`, never the reverse, and profession presentation reaches the
application through explicit UI hooks.

## GW2 engine and platform (`js/games/gw2/platform/`)

The engine is part of the GW2 package because its skills, effects, state, and profession contracts use GW2-shaped
inputs. Game-neutral clocks, queues, and random streams stay in `js/kernel/`. The
[platform directory map](../../js/games/gw2/platform/README.md) lists each domain and its placement rules. Paths below
are relative to `js/games/gw2/platform/`.

### Engine

| Module                                               | Responsibility                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `simulation/simulate.ts`                             | Canonical `simulateGw2()` entry point                                                                             |
| `simulation/runtime.ts`                              | Per-run service construction and binding                                                                          |
| `simulation/coordinator.ts`                          | Single queue, clock progression, causal scope, and stop decisions                                                 |
| `execution/cast-execution.ts`                        | Readiness, acceptance, reservation ownership, lockouts, and completion                                            |
| `resolver/effect-delivery.ts`                        | Admission, deferred preparation, target gates, and reaction settlement                                            |
| `profession-definition/runtime-hooks.ts`             | Explicit mechanic contribution surface and ordered composition                                                    |
| `profession-definition/runtime-context.ts`           | Narrow author capabilities; selected content for effect ownership and read-only profession state for cast details |
| `results/project-runtime.ts`                         | Projection of settled damage, score, and detailed results                                                         |
| `execution/cast-lifecycle.ts`                        | Reservation identity/storage primitive used by cast execution                                                     |
| `execution/effect-commit.ts`                         | Effect scheduling and interruption filtering                                                                      |
| `execution/cooldowns.ts`                             | Cooldown and ammo state transitions                                                                               |
| `events/actors.ts`                                   | Shared actor types and validation vocabulary                                                                      |
| `effects/authoring.ts`                               | Effect constructors and authored packet readers                                                                   |
| `effects/materializer.ts`                            | Pure effect expansion                                                                                             |
| `skills/catalog.ts`                                  | Immutable catalog assembly and indexing                                                                           |
| `profession-definition/assemble-module-catalog.ts`   | Native Core/elite catalog ownership and assembly                                                                  |
| `profession-definition/profession.ts`                | Native Core/elite selection, state/modifier composition, and lazy UI                                              |
| `profession-definition/compiler/compile-contract.ts` | Runtime hook normalization and query-contract resolution                                                          |
| `profession-presentation/`                           | UI composition, normalization, and presentation types                                                             |
| `builds/profession-build.ts`                         | Build callback validation and defaults                                                                            |
| `resolver/handler-registry.ts`                       | Exclusive resolver event-handler ownership                                                                        |
| `results/combat-result.ts`                           | Resolver score and detailed report construction                                                                   |
| `results/planning-state.ts`                          | Detached public planning state at the observation boundary                                                        |

Native modules are the only profession composition input. `defineNativeProfession` shares each selected Core/elite
catalog, state factory, and compiled modifiers between `resolveProfession` queries and `runtimeFor` execution.
Application catalogs keep all specializations; runtime catalogs use validated ownership fragments so elite-authored
shared weapon skills stay available. Module presentation is bound only when the application requests `ui`, so headless
simulation never initializes presentation factories.

If a new abstraction would still make sense in a non-GW2 simulator, consider `js/kernel/`; otherwise keep it here.

Contracts follow their functional owners: accepted casts in `execution/cast-contracts.ts`, compiled profession hooks in
`profession-definition/runtime-contract.ts`, family composition in `profession-definition/family-contract.ts`, public
outputs in `results/types.ts`, and run requests in `simulation/options.ts`. Skill validation lives in
`skills/validation.ts`; effect schemas and validation live in `effects/`.

Gameplay history lives in `combat/history/executed-facts.ts`, with separate reader and recording capabilities.
`results/resolved-events.ts` clips detached condition observations without mutating live applications. Effect duration
rounding and expiry belong to `effects/timing.ts`; the shared action tick belongs to `combat/action-tick.ts`.

Isolated damage measurement belongs to `skill-damage/`: inputs and payload contracts in `types.ts`, work selection in
`occurrence-driver.ts`, execution in `run-occurrence.ts`, and measurements/variants/cache in `measure-occurrences.ts`.
Presentation consumes these contracts rather than owning calculation inputs.

### Shared GW2 behavior

This layer owns behavior shared by several professions: strike and condition damage, attributes, weapon strength, boons
and target state, sigils, relics, profession module assembly, and modifier rules.

| Module                            | Responsibility                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `events/`, `effects/`, `skills/`  | Event contracts, authored effects, and immutable skill catalogs                         |
| `profession-definition/`          | Stable profession authoring APIs, catalog assembly, metadata, and mechanic declarations |
| `combat/modifiers.ts`             | Declarative scalar modifier system                                                      |
| `builds/attributes.ts`            | Shared attribute calculations                                                           |
| `builds/codec.ts`                 | Build normalization and validation                                                      |
| `combat/formulas.ts`              | Pure strike/condition formulas and stat conversions, preserving calculation units       |
| `combat/critical-procs.ts`        | Critical-proc kernel: seeded critical outcomes, secondary proc rolls, and ICD claims    |
| `combat/boons.ts`                 | Standard boon metadata, shared stack queries, duration pools, and grant recording       |
| `execution/cast-timing.ts`        | Cast timing and cast-relative packet scaling                                            |
| `equipment/weapons/strength.ts`   | Weapon-strength profiles                                                                |
| `equipment/sigils/loadout.ts`     | Sigil selection, modifier aggregation, and configured weapon-set lookup                 |
| `equipment/sigils/runtime.ts`     | Sigil state initialization, pending hit effects, and swap/control/strike procs          |
| `equipment/sigils/severance.ts`   | Severance buff queries and critical modifiers                                           |
| `equipment/`                      | Gear, consumable, relic, sigil, and weapon data                                         |
| `combat/state/targets.ts`         | Target assumptions                                                                      |
| `builds/selected-traits.ts`       | Shared selected-trait lookup                                                            |
| `combat/state/event-ownership.ts` | Player/summon/effect ownership rules                                                    |

Builds and public simulation configuration use readable sigil and relic names. Equipment catalogs resolve those names to
item IDs for runtime rule dispatch, cooldown keys, and proc source attribution; display labels stay name-based.

Combat queries select visible state and equipment, formulas and modifiers calculate, and resolver handlers commit
effects and dispatch reactions:

- Query contracts: `combat/query/combat-query.ts` and `timeline-index.ts`. Event payloads, validation, and the shared
  damage-diagnostic contract: `events/events.ts`.
- Internal work payloads and lifetime ownership: `simulation/work-contract.ts`; validated construction:
  `simulation/internal-work.ts`. Hit diagnostics, condition applications, and mutable runtime types live with
  `resolver/hit-resolution.ts`, `resolver/condition-resolution.ts`, and `resolver/runtime-state.ts`; shared
  event/result/reaction contracts stay in `resolver/types.ts`.
- `execution/` owns reusable rotation, reservation, cooldown, ammo, and interruption services; `resolver/` owns hit and
  condition calculation and reaction services; `simulation/runtime.ts` composes them into one live loop.
- `results/result-queries.ts` reads detached results and planning boundaries (critical-chance strikes, buff state);
  report construction, planning-state projection, and input-rate reporting (`results/rotation-apm.ts`) live in
  `results/`.
- `skills/balance-profiles.ts` owns catalog profile lookup; `combat/query/runtime-query.ts` owns event-to-skill lookup
  without depending on resolver implementations.
- `execution/transition-lockouts.ts` owns bar-transition timing, `execution/autoattack-chains.ts` owns live chain
  transitions, and `skills/autoattack-chain-index.ts` indexes catalog chains.

Profession definitions expose weapon eligibility as `weaponSkillMatchesSet`, used by both scheduling and the application
adapter. Family-specific matching lives in `professions/<profession>/build/weapon-matching.ts`; it is not part of
`ProfessionUiContract`.

One runtime interleaves command acceptance with internal work and combat events. Availability, cast duration, cooldowns,
ammo, resources, strike damage, conditions, target health, and triggered effects share one live state. See
[Architecture](./ARCHITECTURE.md#runtime-and-simulation) and [Event clock](./SIMULATION-EVENT-CLOCK.md).

## Profession modules (`js/games/gw2/professions/<profession>/`)

Each profession is a **Core module plus one module per elite specialization**. Core is always present; exactly one elite
module is active for an elite build. `defineNativeProfession()` composes them into the executable profession.

### Layout

```text
<profession>/
  profession.ts            native profession contract; re-exports catalog.ts
  catalog.ts               Core-first module tuple and assembled catalog
  types.ts                 shared family types; composes module state types
  family-state.ts          optional: helpers combining Core and elite state (Mesmer, Revenant, Thief)
  family-presentation.ts   optional: family-level presentation (Elementalist)
  app/                     app-definition.ts and tooltips.ts
  build/                   build.ts, attributes.ts, weapon-matching.ts where needed
  data/                    generated metadata, ids.ts, module-data.ts, traits-data.ts, pure helpers shared with integrations
  core/
    module.ts              manifest only
    state.ts               <Profession>CoreState next to its factory
    hooks.ts               cast hooks, tasks, and reactions
    modifiers.ts           modifier rules and imperative modify* callbacks
    profiles.ts            balance profiles
    presentation.ts
    skills/  mechanics/  traits/
  specializations/<name>/
    module.ts  state.ts  hooks.ts  profiles.ts  presentation.ts  skills/  traits/
    mechanics/  modifiers.ts  types.ts        when the specialization needs them
```

No other files belong at the profession root. `catalog.ts` stays separate from `profession.ts` because `profession.ts`
imports `build/`, and `build/` reads the catalog at module load; merging them creates an initialization cycle.

Code outside a profession folder imports only `profession.js`, `app/app-definition.js`, `build/build.js`,
`build/attributes.js`, `types.js`, `data/**`, and `profiles.js` files. Log integrations import helpers from `data/`,
never `profession.js`, so lazy log chunks don't load the whole profession graph. Tests are exempt. The shared
`professions/shared/` helpers are not a profession. `eslint.config.js` and
`tests/architecture/profession-layout.test.js` enforce this layout.

### Module manifest

Each `core/` or `specializations/<name>/` folder is one module. Its `module.ts` is a manifest: imports plus one exported
`defineNativeModule(...)` call. The meaning of each section is described in
[ARCHITECTURE.md](./ARCHITECTURE.md#native-profession-modules).

```ts
export const berserkerModule = defineNativeModule({
  traitDefinitions: warriorBerserkerTraits,
  id: 'Berserker',
  data: createWarriorModuleData('Berserker', {
    skillMechanics: BERSERKER_SKILL_MECHANICS,
    balanceProfiles: BERSERKER_BALANCE_PROFILES
  }),
  state: { create: berserkerState.create, project: createPublicStateProjector(BERSERKER_PUBLIC_STATE_PROJECTION) },
  modifiers: { modifyAttributes, modifierRules: slicingMaelstromModifiers },
  hooks: berserkerHooks,
  presentation: berserkerUi
});
```

Ownership rules for the sections:

- **`data`**: skill mechanics, balance profiles, synthetic action skills, trait and weapon metadata, and autoattack
  chains contributed by this module. Modules never import their profession's completed catalog; they contribute data
  upward and receive the completed catalog only through composition or presentation boundaries.
- **`state`**: one `create` factory and an optional `project` function that builds the detached public planning state.
  Do not put temporary runtime mechanics into application build state just because the UI needs to show them.
- **`modifiers` and `hooks`**: `modifiers.ts` assembles modifier rules and `modify*` callbacks; `hooks.ts` assembles
  availability, cast, recharge, resource, task, event, and reaction callbacks. All hooks receive the same live state and
  clock. Only `module.ts` imports `hooks.ts`; helpers shared with other modules or presentation live in `mechanics/` or
  `traits/`. Module validation rejects unknown fields, including retired `execution` and `resolution` sections.
- **`presentation`**: palette groups, skill-bar groups, resource displays, active-state snapshot items, timeline and
  event-log presentation, and palette availability messages. Use a `bind…Ui(catalog)` factory (for example
  `bindGuardianCoreUi`) when the UI needs the completed catalog. Presentation reads simulation state and must not
  reproduce combat rules. Palette availability is the current exception; see
  [PALETTE-RUNTIME-AVAILABILITY.md](../cleanup/PALETTE-RUNTIME-AVAILABILITY.md).

### Profession file roles

| File or folder                             | Owns                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `data/<profession>-api-metadata.ts`        | Generated identity and presentation metadata from the GW2 API. Never coefficients or conditions.           |
| `data/<profession>-supplemental-skills.ts` | Identity and presentation for skills missing from the API snapshot                                         |
| `data/ids.ts`                              | Skill and trait ID constants; Engineer, Ranger, Revenant, and Warrior generate theirs from `scripts/data/` |
| `data/traits-data.ts`                      | The only export of the flattened runtime `TRAITS`                                                          |
| `data/module-data.ts`                      | Generated metadata selection, catalog transforms, and module data options                                  |
| `skills/index.ts`, `skills/<group>.ts`     | Authoritative ID-keyed declarative skill fields, grouped by weapon, slot family, or another GW2 concept    |
| `skills/actions.ts`                        | Profession-owned synthetic actions (Core modules)                                                          |
| `profiles.ts`                              | Balance profiles shared by several skills or mechanics; patch previews edit these directly                 |
| `state.ts`                                 | Module state, its factory, and its public projection                                                       |
| `hooks.ts`                                 | Cast hooks, named tasks, and reactions for behavior that declarative effects cannot express                |
| `modifiers.ts`                             | The module's modifier rules plus imperative `modify*` attribute and damage callbacks                       |
| `mechanics/<concept>.ts`                   | Systems whose state or lifecycle spans casts, skills, traits, or events (`life-force.ts`, `pets.ts`, …)    |
| `mechanics/resources.ts`                   | Profession resource policies, where a profession needs them                                                |
| `events.ts`                                | Custom scheduled event definitions shared by several Core mechanics                                        |
| `traits/`                                  | Trait definitions and supporting behavior (see below)                                                      |
| `presentation.ts`                          | Profession presentation hooks                                                                              |
| `app/tooltips.ts`                          | Simulation tooltip descriptions and facts for traits and special skills                                    |
| `execution/`                               | Mesmer Core only: shatter, flip, phantasm, and effect commitment and packet emission                       |

Traits:

- Core: one definition file per implemented trait line; `traits/index.ts` registers definitions in their existing order.
- Elites: `traits/index.ts` owns every definition and the single registration array consumed by `module.ts`.
- Optional `traits/behavior.ts` or concept files own substantial callbacks, proc dispatch, and helpers called by
  mechanics. They contain no definitions and do not import definition files.

Mechanics use GW2 concept names (`shatters.ts`, `continuum-split.ts`, `pets.ts`, `life-force.ts`, `attunements.ts`).
Generic `rules.ts`, `handlers.ts`, and `resolver.ts` ownership files are retired. A cohesive `availability.ts` is fine
when it expresses one module's cast gate; split unrelated behavior into a named mechanic, skill family, or trait line.
Shared strike and condition resolution stays in `js/games/gw2/platform/resolver/`.

### Folder size

The filenames above are ownership conventions, not required placeholders. A small specialization stays compact:

```text
specializations/berserker/
├── module.ts
├── hooks.ts
├── profiles.ts
├── state.ts
├── presentation.ts
├── skills/index.ts
└── traits/
    ├── index.ts
    └── behavior.ts
```

A larger Core module groups by GW2 concept:

```text
core/
├── module.ts
├── hooks.ts
├── modifiers.ts
├── profiles.ts
├── state.ts
├── presentation.ts
├── skills/
│   ├── index.ts
│   ├── slot-skills.ts
│   └── weapons/axe.ts, greatsword.ts, …
├── mechanics/
│   ├── life-force.ts
│   ├── minions.ts
│   └── shroud-lifecycle.ts
└── traits/
    ├── index.ts
    └── <trait-line>.ts
```

Split large mechanics into descriptive files when that makes ownership clearer. Do not split just to make professions
look symmetrical, and do not default to one file per skill or trait. Files such as `mechanics/shroud-lifecycle.ts`,
`mechanics/tomes.ts`, or `mechanics/illusions/` are preferable to a growing generic `rules.ts`.

### Core versus specialization

Put a mechanic in **Core** when it applies regardless of the active elite (Warrior adrenaline, Elementalist attunements,
Thief initiative, Revenant energy). Put it in the elite module when the specialization owns it (Berserker Berserk,
Bladesworn Dragon Trigger, Reaper shroud behavior, Mechanist Jade Mech, Firebrand tomes). A specialization may reuse
Core helpers, but Core must not depend on specialization modules.

### `profession.ts` and `catalog.ts`

`catalog.ts` declares the Core-first module tuple and assembles the catalog with
`assembleNativeApplicationCatalog(<profession>NativeModules, options)`. `profession.ts` re-exports it and creates the
native profession contract:

```ts
export const warriorProfession = defineNativeProfession({
  id: 'warrior',
  name: 'Warrior',
  requireEquippedSlotSkills: true,
  build: {
    createBuildDefaults: createWarriorBuildDefaults,
    migrateBuild: migrateWarriorBuild,
    validateBuild: validateWarriorBuild
  },
  modules: warriorNativeModules,
  catalog: WARRIOR_NATIVE_CATALOG_OPTIONS
});
```

Engine and headless callers import `#gw2/professions/<profession>/profession.js` without loading browser code. See
[PROGRAMMATIC-SIMULATION.md](./PROGRAMMATIC-SIMULATION.md).

### Application definition (`app/`)

`app/app-definition.ts` owns browser-facing profession assembly: attribute calculation wiring, simulation config extras,
persistence settings, active patch-preview decoration, and adapter construction. `app/tooltips.ts` owns simulation
tooltips. Keep both separate from the engine-facing `profession.ts`.

### Build persistence

Profession build defaults, profession-specific normalization (`normalizeExtra`), extra fields, and validation belong in
`professions/<profession>/build/build.ts`. Shared build contracts live in `platform/builds/` (`assumptions.ts`,
`codec.ts`, `slot-loadout.ts`); shared randomness assumptions live in `platform/builds/randomness-assumptions.ts`.
Profession code owns only fields unique to that profession (starting attunement, initial initiative, selected legends,
starting life force, profession-specific skill selections). Do not duplicate common gear, sigil, relic, or weapon
normalization.

## Integrations

### Log analyzers (`js/games/gw2/integrations/logs/`)

```text
logs/
├── shared/       normalized action/result contracts, catalog and profile lookup, player selection, replay timeline
├── evtc/         raw ArcDPS: decompression, binary parsing, player detection, EI finder port, proc observations
├── dps-report/   Elite Insights JSON parsing and reconstruction
└── wingman/      gw2wingman fetch and reshape into the dps.report document
```

Adapters do not import implementation code from one another, except that `wingman/` reshapes its document into the
`dps-report/` shape and calls `dps-report/` for every reconstruction rule. Add new EI JSON rules to `dps-report/` so
both URL importers share them. The simulator engine contains no log-specific assumptions; reconstructed actions become
ordinary simulator rotations before execution. See [EVTC-ROTATION-RECONSTRUCTION.md](../EVTC-ROTATION-RECONSTRUCTION.md)
and, for the planned shared back end, [LOG-IMPORTER-CONSOLIDATION.md](../cleanup/LOG-IMPORTER-CONSOLIDATION.md).

### Patch previews (`js/games/gw2/integrations/patches/`)

Patch previews are sparse overlays on profession-owned data. A preview patches a value where it already lives: skill
fields in `skills/`, profile values in `profiles.ts`, modifier parameters in declarative modifier rules, and behavior in
ordinary patch-aware code. The local authoring application lives in `patches/app/`. See
[PATCH-PREVIEW.md](./PATCH-PREVIEW.md).

## Adding things

### A new mechanic

1. **Who owns it?** All professions → platform. One profession → Core. One specialization → that specialization.
2. **Is it data or behavior?** Skill and effect numbers → `skills/`. Shared mechanic values → `profiles.ts`. Runtime
   state → `state.ts`. Execution behavior → the owning skill, trait, or mechanic file. Presentation → `presentation.ts`.
3. **Which phase owns it?** Before or during a cast, or delayed state → cast hook or named task. Damage, condition, or
   result reaction → combat reaction.
4. **Does it already have a source of truth?** Extend existing state, events, or profiles rather than creating parallel
   copies. For example, if a timed buff already exists in the event timeline, the UI reads that timeline instead of
   keeping its own timer.

### A new elite specialization

Create `professions/<profession>/specializations/<specialization>/` with only the files it needs, declare its module
with `defineNativeModule()`, and add it to `catalog.ts` after Core. Also update generated data where required, build
specialization metadata, tests, and the profession document under `docs/professions/`.

### A new profession

Follow [Adding another profession](./ARCHITECTURE.md#adding-another-profession), using the layout above and an existing
native profession as the reference rather than a new composition pattern.

## Tests

Tests live next to the subsystem they validate: `tests/kernel/`, `tests/ui/`, `tests/browser/`,
`tests/games/gw2/{app,platform,professions,integrations/logs}/`, `tests/architecture/`, `tests/scripts/`, and
`tests/typecheck/`. Prefer focused contract tests over large snapshots.

For profession mechanics, test the smallest meaningful contract: availability, a state transition, a resource change, a
modifier result, event emission, a resolver reaction, or a UI projection. Preset tests confirm that saved builds still
load and simulate. Architecture and typecheck tests enforce cross-module ownership and composition.

## Ownership principles

1. **Keep profession behavior with its profession.**
2. **Keep specialization-only behavior with its specialization.**
3. **Move code to `js/games/gw2/platform/` only when it represents reusable Guild Wars 2 behavior.**
4. **Put shared declarations in their owning platform domain; keep runtime composition in `simulation/`.**
5. **Keep browser concerns in `app`.**
6. **Keep `module.ts` and `profession.ts` focused on composition.**
7. **Prefer descriptive files over oversized generic files.**
8. **Do not create empty files to satisfy a folder convention.**
9. **Do not duplicate an existing source of truth.**
10. **Keep headless engine imports independent of browser application code.**

## Mechanic lifecycle ownership

Bladesworn's `mechanics/dragon-trigger.ts` owns charge scheduling, availability, release capture, packet scaling, and
expiry. `dragon-trigger-state.ts` supplies its one state factory; the module state composes that fragment while keeping
the public projection stable. Release records belong to each run and are queried through the owner. `gunsaber.ts` owns
bar transitions and their consequences; `flow.ts` owns regeneration. Hooks only coordinate their required order.

Holosmith's `mechanics/photon-forge.ts` contributes its own initialization, actions, tasks, and heat event registration.
The neighboring availability, state, and trait modules remain its named collaborators. Mesmer's
`core/mechanics/illusions/lifecycle.ts` owns illusion/resource assembly and recurring task registration, replacing the
former runtime controller. Ordinary skill payloads, balance profiles, and trait rewards remain with their existing
owners.
