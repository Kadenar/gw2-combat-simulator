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

| You're adding or changing...                                          | Usually belongs in...                                                                  |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Skill coefficient, hit count, condition, boon, timing, cooldown, etc. | Owning `skills/index.ts` or `skills/<group>.ts`                                        |
| Shared mechanic data used by several skills                           | The module's `profiles.ts`                                                             |
| Profession runtime resource or state                                  | The module's `state.ts`                                                                |
| Skill availability rule                                               | An `availability` hook in the owning mechanic or `hooks.ts`                            |
| Resource gain/spend/regeneration                                      | `mechanics/<resource>.ts` (for example `mechanics/life-force.ts`)                      |
| Cast lifecycle behavior or delayed work                               | A cast hook or named task in the owning mechanic, assembled in `hooks.ts`              |
| Declarative trait modifier                                            | Core `traits/<trait-line>/index.ts` or elite `traits/index.ts` through `defineTrait()` |
| Complex trait proc or imperative behavior                             | Definition-local callbacks or supporting files inside the owning trait-line folder     |
| Custom scheduled event definitions                                    | Core `events.ts` or the mechanic file that emits them                                  |
| Combat reaction or custom resolved event                              | The owning mechanic, registered under `hooks.reactions` / `hooks.eventHandlers`        |
| Profession UI, palette, skill-bar, or active-state display            | The module's `presentation.ts`                                                         |
| Trait and skill tooltip text                                          | `professions/<profession>/app/tooltips.ts`                                             |
| New reusable GW2 mechanic                                             | `js/games/gw2/platform/`                                                               |
| Generic scheduling primitive unrelated to GW2                         | `js/kernel/`                                                                           |
| Game-neutral browser shell behavior                                   | `js/browser/`                                                                          |
| GW2 browser behavior                                                  | `js/games/gw2/app/`                                                                    |
| Shared presentation/view-model behavior                               | `js/ui/`                                                                               |
| Source-neutral log reconstruction within the GW2 integration          | `js/games/gw2/integrations/logs/shared/`                                               |
| EVTC parsing or evidence inference                                    | `js/games/gw2/integrations/logs/evtc/`                                                 |
| dps.report / Elite Insights parsing or inference                      | `js/games/gw2/integrations/logs/dps-report/`                                           |
| gw2wingman log fetch/reshape (rules stay in `dps-report/`)            | `js/games/gw2/integrations/logs/wingman/`                                              |
| Upcoming balance changes                                              | Patch-preview system                                                                   |
| Build defaults, normalization, and validation                         | Profession `build/build.ts`                                                            |
| New profession page/registry entry                                    | `js/games/gw2/profession-registry.ts`                                                  |

Put behavior with the layer that owns the underlying game concept.

Traits use `defineTrait()` under their Core or elite `traits/` directory and register once through the module's
`traitDefinitions`. Core `traits/<line>/index.ts` files own their definitions, and the Core `traits/index.ts` collects
them in execution order. Each elite's `traits/index.ts` owns all its definitions and its registration array. Definitions
own profiles, rules, compiled triggers, value hooks, admitted lifetime handlers and build effects. Small helpers stay
beside the definitions when their callers can load them without a dependency cycle. Substantial behavior and helpers
that need a separate dependency boundary live in supporting files within the same trait-line folder. Calling a helper
externally does not by itself justify another file. Generated `data.traits` continues to own selection metadata.

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

Root modules compose the application; feature folders own individual page areas. `profession-app.ts` coordinates the
current GW2 browser application.

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

`../build-context/` translates canonical builds into cached attributes and detached engine configuration. `baseline/`,
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
  profession engines without browser adapters. The optimizer loads `optimizer/gear/context.ts` for headless build
  calculation and search metadata.
- Config and runtime: `createProfessionRuntime` in `create-runtime.ts`, `../build-context/simulation-config.ts`
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

### Main entry points

| Owner                         | Responsibility                                                         |
| ----------------------------- | ---------------------------------------------------------------------- |
| `simulation/simulate.ts`      | Public `simulateGw2()` entry                                           |
| `simulation/runtime.ts`       | Per-run service construction                                           |
| `simulation/coordinator.ts`   | One queue, clock, causal scope, and advancement loop                   |
| `execution/cast-execution.ts` | Cast admission, reservations, and completion                           |
| `execution/cooldowns.ts`      | Private cooldown, ammo, and recharge state                             |
| `resolver/effect-delivery.ts` | Packet admission, target gates, and reaction settlement                |
| `profession-definition/`      | Native modules, trait authoring, compilation, and runtime capabilities |
| `combat-calculation/`         | Effective combat values from state, equipment, and profession rules    |
| `skill-damage/`               | Isolated skill measurement using the shared runtime and formulas       |
| `results/`                    | Detached combat/planning output, queries, and optional reports         |

The [platform ownership guide](../../js/games/gw2/platform/README.md) owns the detailed domain and capability map.
[Architecture](./ARCHITECTURE.md#runtime-and-simulation) explains composition; the
[event clock](./SIMULATION-EVENT-CLOCK.md) defines scheduling and observation contracts. Prefer those sources over
adding another engine inventory here.

Builds and public configuration use readable sigil/relic names; equipment catalogs resolve runtime IDs. Profession
weapon eligibility lives in `build/weapon-matching.ts` and the runtime contract, shared by scheduling and application
adapters. It is not a UI-only rule.

## Profession modules (`js/games/gw2/professions/<profession>/`)

Each profession is a **Core module plus one module per elite specialization**. Core is always present; exactly one elite
module is active for an elite build. `defineNativeProfession()` composes them into the executable profession.

### Layout

```text
<profession>/
  profession.ts            native profession contract; re-exports catalog.ts
  catalog.ts               Core-first module tuple and assembled catalog
  types.ts                 shared family types; composes module state types
  family-state.ts          optional: shared state queries (Elementalist, Mesmer, Revenant, Thief)
  family-presentation.ts   optional: family-level presentation (Elementalist, Necromancer)
  family-mechanics.ts      optional: Mesmer family mechanic construction
  family-resources.ts      optional: Mesmer resource construction shared by Core and elites
  resource-rules.ts        optional: Warrior family resource and burst selection
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

Keep module-local behavior inside its owning Core or elite directory. The family files above are explicit
composition/query exceptions, not places for individual skill or trait implementations. `catalog.ts` stays separate from
`profession.ts` because `profession.ts` imports `build/`, and `build/` reads the catalog at module load; merging them
creates an initialization cycle.

Code outside a profession folder imports only `profession.js`, `app/app-definition.js`, `build/build.js`, `types.js`,
`data/**`, and `profiles.js` files. Log integrations import helpers from `data/`, never `profession.js`, so lazy log
chunks don't load the whole profession graph. Tests are exempt. The shared `professions/shared/` helpers are not a
profession. `eslint.config.js` enforces these import boundaries.

Each profession's `app/app-definition.ts` binds its catalog and trait selector through `shared/build-attributes.ts`'s
`createProfessionBuildAttributeRules`; the shared evaluator owns attribute calculations. Concrete `GuardianRuntime` and
`WarriorRuntime` types live in their profession's `types.ts`, while query-only and resolver contracts retain their
narrower capabilities.

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
  attributes: berserkerAttributes,
  modifiers: { modifierRules: slicingMaelstromModifiers },
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
  clock. Only `module.ts` imports `hooks.ts`; shared helpers live with their owning skill, mechanic, or trait. Manifests
  register assembled contributions rather than adding reactions or modifier ordering themselves. Module validation
  rejects unknown fields, including retired `execution` and `resolution` sections.
- **`presentation`**: palette groups, skill-bar groups, resource displays, active-state snapshot items, timeline and
  event-log presentation, and palette availability messages. Use a `bind…Ui(catalog)` factory (for example
  `bindGuardianCoreUi`) when the UI needs the completed catalog. Presentation reads simulation state and must not
  reproduce combat rules. Palette availability is the current exception.

### Profession file roles

| File or folder                             | Owns                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `data/<profession>-api-metadata.ts`        | Generated identity and presentation metadata from the GW2 API. Never coefficients or conditions.                 |
| `data/<profession>-supplemental-skills.ts` | Identity and presentation for skills missing from the API snapshot                                               |
| `data/ids.ts`                              | Skill and trait ID constants; Engineer, Ranger, Revenant, and Warrior generate theirs from `scripts/data/`       |
| `data/traits-data.ts`                      | The only export of the flattened runtime `TRAITS`                                                                |
| `data/module-data.ts`                      | Generated metadata selection, catalog transforms, and module data options                                        |
| `skills/index.ts`, `skills/<group>.ts`     | Authoritative skill declarations and intrinsic runtime helpers, grouped by weapon, slot family, or skill concept |
| `skills/actions.ts`                        | Profession-owned synthetic actions (Core modules)                                                                |
| `profiles.ts`                              | Balance profiles shared by several skills or mechanics; patch previews edit these directly                       |
| `state.ts`                                 | Module state, its factory, and its public projection                                                             |
| `hooks.ts`                                 | Registration and explicit sequencing of skill, trait, and mechanic callbacks                                     |
| `modifiers.ts`                             | The module's modifier rules plus imperative `modify*` attribute and damage callbacks                             |
| `mechanics/<concept>.ts`                   | Systems whose state or lifecycle spans casts, skills, traits, or events (`life-force.ts`, `pets.ts`, …)          |
| `mechanics/resources.ts`                   | Profession resource policies, where a profession needs them                                                      |
| `events.ts`                                | Custom scheduled event definitions shared by several Core mechanics                                              |
| `traits/`                                  | Trait definitions and supporting behavior (see below)                                                            |
| `presentation.ts`                          | Profession presentation hooks                                                                                    |
| `app/tooltips.ts`                          | Simulation tooltip descriptions and facts for traits and special skills                                          |
| `execution/`                               | Mesmer Core only: shatter, flip, phantasm, and effect commitment and packet emission                             |

Traits:

- Core: one folder per implemented trait line, with definitions and small helpers in `<line>/index.ts`;
  `traits/index.ts` registers definitions in their existing order.
- Elites: `traits/index.ts` owns every definition and the single registration array consumed by `module.ts`.
- Supporting files belong inside their trait-line folder. Each elite's `traits/` directory already represents one trait
  line, so it needs no redundant nested folder. Use descriptive names for substantial behavior or a necessary dependency
  boundary; do not create a separate file for every trait.
- Shared pure queries across lines stay directly under Core `traits/`. New trait producers use compiled triggers;
  trait-only dispatch files and per-simulation listener registries are retired. Supporting files must not import their
  own `index.ts` when that index imports them. Consumers may import helpers directly from a line's `index.ts` when the
  dependency graph remains acyclic.

Mechanics use GW2 concept names (`shatters.ts`, `continuum-split.ts`, `pets.ts`, `life-force.ts`, `attunements.ts`).
Generic `rules.ts`, `handlers.ts`, and `resolver.ts` ownership files are retired. A cohesive `availability.ts` is fine
when it expresses one module's cast gate; split unrelated behavior into a named mechanic, skill family, or trait line.
Shared strike and condition resolution stays in `js/games/gw2/platform/resolver/`.

### Runtime ownership and composition

A skill owns its baseline effects, action handlers, and skill-specific lifecycle. Traits own the policy changes to those
effects, including eligibility, replacement rewards, duration, and sharing. A skill may import a trait policy; untraited
skill execution must not depend on a trait dispatcher. A mechanic fires ordered trigger points around intrinsic work,
capturing the accepted cast/cause and any pre-transition values its listeners require. Each point declares the complete
listener order, including Core and elite listeners when needed. `fireTrigger` runs synchronously, so nested boundaries
settle before the firing mechanic continues. Trait handlers live beside their definitions; the maintained
[profession guides](../professions/) describe each family's owners and ordering boundaries.

New trait rewards, counters, armed states and recurring-loop startup register under `triggers`. Platform stages use
`{ on: 'castCommit', ... }` or resolver stage names; mechanic points use `onTriggerPoint(point, reaction)` to bind the
declared input type. Raw `{ on: point, ... }` registration is rejected. Each declaration chooses `emit`, `invoke` or
`run`; the compiler checks selection before predicates and proc claims. Declarative point delivery requires a cause.
Boundary inputs carry only their actual accepted identity, time and captured values, without a generic event envelope.

`trait.hooks` contains supported value policies and supplied-state import. `prepareEvent` and `modifyEffects` receive
query capabilities, while `initialize` receives only state, configuration, catalog, selection and time. New emission or
scheduling is unavailable through those contexts. `trait.lifetime` contains admitted task/event delivery, cast
capture/settlement, charge consumption through `reserveRecharge`, and retained aura/buff/damage reactions. It cannot
register startup or arbitrary resolver stages. Existing work retains its own ownership, expiry and stopping rules; an
explicit lifetime declaration does not authorize unrelated new rewards.

`traitTriggers: false` removes all compiled stage/point producers, including implicit-minor declarations. Value rules,
intrinsic mechanics, supplied state and explicitly admitted lifetime delivery remain available. Trait modifier rules
normally receive compiler selection gates, with an explicit `requiresSelection: false` exception for already-created
effects. Trait `attributes`/`grantedAttributes` and module `attributes` declarations feed the shared attribute
evaluator. Imperative modifier hooks remain under the module's modifier contract; `TraitHooks` does not expose
`modifyAttributes`.

When an owner exports a complete `RuntimeHooks` contribution, register it with `composeRuntimeHooks` rather than copying
selected fields or spreading whole hook objects. The composer preserves notification/transform ordering and rejects
duplicate named task, event, and action handlers. Spreading handler maps before composition hides duplicate keys; use
separate contributions when owners should remain independent. Use ordered mechanic trigger points where trait callbacks
must interleave intrinsic work. Trait value/lifetime contributions run before explicit module hooks, and Core runs
before the selected elite. Compiled point listeners instead follow the mechanic's profession-wide order list. Moving a
callback between those locations requires reviewing phase, selection and ordering. Profession-level hooks retain their
full mechanic capabilities; the restricted trait API does not replace them.

Ordinary trait profiles and triggered skills use `emitTraitProfile` or `invokeTraitSkill`, both backed by the shared
materializer. Stateful choices and real custom delivery remain with their owner: finite charges, captured windows,
copied boons, pet/summon ownership, field cadence and imperative preview variants. Do not rebuild ordinary profile
fields or attribution in another local emitter.

Substantial resource lifecycles belong in `mechanics/resources.ts` or a named mechanic, including capacity, recovery,
depletion, and wake scheduling. A small self-contained policy can remain inline; no placeholder file is required.
Scrapper and Reaper can rely on trait expansion without a separate `hooks.ts`.

Dependency tests should protect independent loading and prevent owners or state queries from importing hook/module
assembly. `tests/helpers/profession-source-graph.js` supplies a shared value-import traversal for focused boundaries; it
follows reexports and ignores type-only dependencies.

### Folder size

These filenames describe ownership, not required placeholders. Keep small specializations compact; split large mechanics
by GW2 concept when it clarifies ownership. Prefer `mechanics/tomes.ts` or `mechanics/illusions/` to a growing generic
`rules.ts`. Do not create one file per trait or skill solely to make profession layouts symmetrical.

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
ordinary simulator rotations before execution. See
[EVTC-ROTATION-RECONSTRUCTION.md](../EVTC-ROTATION-RECONSTRUCTION.md).

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

### GW2 build context

`js/games/gw2/build-context/` composes canonical builds with native profession attribute declarations and patch balance.
`load.ts` caches profession module loading through the registry; `create.ts` binds the synchronous factory and owns at
most one calculation per weapon set per context. `simulation-config.ts` assembles common inputs from equipment seeds,
never finalized profession totals. Each `professions/<name>/build/context.ts` binds the codec, preview-aware profession,
attribute calculator, and typed starting-resource mapping. The browser adapter consumes that binding directly.

`integrations/assets.ts` contains JSON fetching and rotation payload decoding shared by browser and headless request
loaders. Export dialogs remain in `app/import-export/files.ts`.
