# Simulator modules

Use this guide to find the module responsible for a change. [Architecture](./ARCHITECTURE.md) explains how modules
combine. The [platform guide](../../js/games/gw2/platform/README.md) describes engine services.

## Repository map

| Path                                      | Owns                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `js/kernel/`                              | Game-neutral clocks, queues, numeric helpers, randomness, and observation |
| `js/ui/`                                  | Game-neutral result and rotation views, DOM helpers                       |
| `js/browser/`                             | Page entry, game boundary, workers, and shared shell                      |
| `js/games/gw2/platform/`                  | Shared GW2 combat, execution, builds, equipment, and simulation           |
| `js/games/gw2/professions/`               | Profession builds, skills, traits, mechanics, and presentation            |
| `js/games/gw2/build-context/`             | Headless build-to-attributes/configuration binding                        |
| `js/games/gw2/app/`                       | GW2 browser composition, editing, persistence, and results                |
| `js/games/gw2/input/`                     | Physical keybindings and input activity analysis                          |
| `js/games/gw2/integrations/`              | Logs, chat codes, keybind import, assets, and patch previews              |
| `data/gw2/builds/`, `data/gw2/rotations/` | Saved presets                                                             |
| `tests/`, `scripts/`                      | Validation and development tooling                                        |

## Where should my change go?

| Change                                                       | Owner                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Skill tuning, effects, costs, or intrinsic behavior          | Owning `skills/<group>.ts`                                   |
| Trait tuning, modifiers, procs, or build effects             | Core `traits/<line>/index.ts` or elite `traits/index.ts`     |
| State or lifecycle spanning several skills/events            | Named `mechanics/<concept>.ts`, with state in `state.ts`     |
| Availability, cast hooks, tasks, or reactions                | Owning mechanic, skill, or trait; registration in `hooks.ts` |
| Profession palette, skill bar, resource display, or snapshot | `presentation.ts`                                            |
| Profession tooltip text                                      | `app/tooltips.ts`                                            |
| Profession build defaults and normalization                  | `build/build.ts`                                             |
| Shared GW2 behavior                                          | Platform domain that owns the concept                        |
| Game-neutral scheduling                                      | `js/kernel/`                                                 |
| Browser editing or presentation                              | GW2 `app/`, or `js/ui/` for game-neutral helpers             |
| Profession registration                                      | `js/games/gw2/profession-registry.ts`                        |

Share behavior in the platform when multiple professions need it. Several callers within one profession do not justify
moving that profession's mechanics into the platform.

## Browser shell and neutral UI

`browser/entry.ts` and `bootstrap.ts` start the active game. `game/` owns plug-in contracts and worker lifecycle;
`page/` owns host integration; `shell/` composes result views and the rotation workspace. `ui/results/` and
`ui/rotation/` supply game-neutral views; `ui/shared/` supplies DOM utilities.

`eslint.config.js` enforces these boundaries for imports other than type imports:

| Folder           | Allowed dependencies within UI/browser/game packages                  |
| ---------------- | --------------------------------------------------------------------- |
| `ui/shared/`     | None                                                                  |
| `ui/results/`    | Itself and `ui/shared/`                                               |
| `ui/rotation/`   | Itself and `ui/shared/`; no `ui/results/`                             |
| `browser/page/`  | Itself                                                                |
| `browser/game/`  | Itself; lazy GW2 imports only in `registry.ts` and `worker-driver.ts` |
| `browser/shell/` | UI and `browser/page/`; game contracts are type-only                  |
| `browser/` root  | `page/` and `game/`                                                   |

Game presentation adapts to neutral UI contracts. Neutral code must not name GW2 skills, resources, or profession flags.

## GW2 application

Paths below are relative to `js/games/gw2/app/`. `profession-app.ts` coordinates the session; `define-profession-app.ts`
assembles browser adapters, and `create-runtime.ts` connects builds to simulation.

| Folder            | Owns                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| `page/`           | Page entry, navigation, tutorials, and benchmark dashboard                     |
| `shared/`         | Leaf HTML, equipment, formatting, and tooltip helpers                          |
| `build/`          | Build editor, panels, selection, workspace tabs, and saved-build library       |
| `import-export/`  | Build/rotation files, chat codes, and log import                               |
| `rotation/`       | Editing, palette, timeline, comparison, warnings, and state snapshots          |
| `results/`        | Result models, summary, breakdowns, charts, event log, and analysis            |
| `simulation/`     | Baseline, modifier-contribution, and RNG jobs; shared simulation settings      |
| `optimizer/`      | Gear search and relic comparison                                               |
| `boss-scenarios/` | Scenario documents, build workspace, plan compilation, and result presentation |
| `input-profile/`  | Binding editor, persistence, and input activity views                          |

Non-type imports between application features:

| Folder           | Allowed app dependencies and exceptions                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `shared/`        | `app/types.ts`; no other app folder                                                      |
| `simulation/`    | Itself and `shared/`                                                                     |
| `optimizer/`     | Itself, `shared/`, `build/panels/attributes.ts`, `results/model.ts`, profession registry |
| `results/`       | `shared/`, rotation timeline model/context; simulation contracts are type-only           |
| `import-export/` | `shared/`, build state/types, registry, integrations                                     |
| `build/`         | `shared/`, import/export, registry, timeline view, rotation/results session defaults     |
| `rotation/`      | `shared/`, results, rotation import dialog, build types                                  |
| `page/`          | `shared/`, registry, timeline preferences, browser                                       |
| Root             | Application composition                                                                  |

`rotation/comparison.ts` and `rotation/timeline/view.ts` call each other inside functions. Do not introduce top-level
calls across that cycle. Feature state-default modules must not import views or the application class.

### State and presentation

`types.ts` composes feature-owned state. Build-library selection/undo belongs in `build/library/state.ts`, rotation
history in `rotation/editing/state.ts`, timeline filters in `rotation/timeline/state.ts`, and result ordering in
`results/state.ts`. Workspace tabs compose those defaults; transient loading/drag state and shared display preferences
remain outside tab capture. Durable saved builds live in `build/library/storage.ts`, separately from open tabs.

Tab activation captures the outgoing session, suspends analysis, installs the destination inputs, restores analysis,
normalizes selections, and resumes work before the browser redraws.

`build/state/skill-selection.ts` owns slot-selection queries and normalization. Isolated attribute controls live in
`build/attribute-effects.ts`; `build/buffed-attributes.ts` owns their query lifecycle. Profession preview hooks prepare
private state. Preview player health never becomes a saved assumption or simulation input.

Profession presentation supplies variants, groups, markers, badges, and event descriptors. Shared views render those
facts without reproducing combat rules. Timeline preferences live in `rotation/timeline/preferences.ts`; snapshot
contracts are documented in [Rotation state snapshots](./ROTATION_STATE_SNAPSHOT.md).

`rotation/palette/input.ts` captures the cursor observation, build/catalog facts, and presentation dependencies once.
The palette model derives tiles, resources, and weapon placement from this captured input. It does not read application
state.

`rotation/cursor-preview.ts` simulates rotation prefixes and candidate commands using the accepted baseline's captured
inputs. It caches prefix results and rejects requests when build and result revisions differ. `rotation/context.ts`
connects it to the analysis snapshot and profession execution adapter.

Cursor movement and edits to the currently rendered revision remain available after simulation failures. Controls from
older revisions cannot edit commands whose indexes have changed. Palette activations and preview calculations require a
result that matches the build. Deferred rotation rendering preserves the previous display while work is pending;
explicit renders clear unavailable state. Comparison metrics retain their last cursor time until a new observation is
ready. Editor candidates use captured commands and leave the palette's cached prefix available for reuse.

Cooldown tooltip labels retain the displayed result's combat origin. Isolated skill-damage previews use the smaller
palette queries without a cursor observation. Warnings use those queries to inspect both equipped weapon sets and their
existing selected-skill inventory, independently of which tiles the current palette displays.

`results/view.ts` composes section models and mounts; `breakdown/` owns skill rows and inspectors, and `charts/` owns
series and hit timelines. Section mounts append to their assigned hosts; independently refreshed analysis must not
replace unrelated charts or expanded rows.

### Skill-damage preview

`build/skill-damage/` keeps the panel, lifecycle, stat calculation, worker runner, and worker entry together.
`lifecycle.ts` owns preparation, measurement requests and accepted results. One instance per profession app retains
preview choices and the last completed result across build tabs. The panel owns HTML, filters, row expansion, focus,
scrolling and the saved disclosure preference.

The lifecycle requests captured inputs only when needed. Closed refreshes, closing the panel and unchanged normalized
values skip capture. `input.ts` returns no input while build attributes are unavailable. Otherwise it copies the build
without rotation commands, copies transition delays and active-trait membership, and retains shared catalog and
calculation-owner references.

Preparation uses the patch key and calculation inputs, excluding rotation. Catalog and calculation-owner identity checks
still detect replaced content. Cleared baseline attributes are reused while those inputs and available controls stay
unchanged. Preview values live only in the completed preparation. Exceptions during control discovery or normalization
leave the previous preparation and cache intact.

Measurement reuse compares the resulting request. A completed result retains its original plan while new work runs.
Closing cancels work but retains preparation, errors and results; reopening resumes unfinished work. Failed plans and
measurements remain suppressed until their inputs change. Attribute errors appear in the stat strip without discarding a
valid measurement plan.

The lifecycle notifies the panel after updating state and before submitting work. Value changes preserve control nodes;
measurement completion updates result-dependent regions. The worker runner owns request ordering and worker reuse. Node
tests exercise lifecycle rules without browser globals and check the panel's rendering separately.

### Simulation jobs and settings

Each simulation or optimizer feature keeps its runner, worker, contracts, and views together. Scheduling remains
feature-specific. Shared worker lifecycle belongs in `js/browser/game/worker-harness.ts`; the GW2 `worker-driver.ts`
loads preview-aware engines without browser adapters. Jobs use the headless build context and shared runtime.

`simulation/settings.ts` owns persisted simulation settings, independently of build assumptions and workspace tabs.
Import/export applies transition-delay metadata there; rotation undo does not roll it back. Settings controls live in
`build/panels/simulation-settings.ts`.

`page/benchmarks/` owns the dashboard, build previews, workspace entry, and comparison tools.
`page/benchmarks/comparison/` owns explicit simulation comparisons; browsing saved dashboard metrics does not launch
simulations. `boss-scenarios/simulation.ts` compiles scenario plans, while `platform/combat/state/encounter.ts` owns
live encounter execution. See [Benchmarks](../../wiki/Benchmarks.md) and [Boss scenarios](../../wiki/Boss-Scenarios.md).

## GW2 engine and platform

The [platform ownership guide](../../js/games/gw2/platform/README.md) maps execution, calculation, and observation
services. `simulation/simulate.ts` is the public entry, `runtime.ts` assembles services, and `coordinator.ts` owns the
single queue and clock. The kernel contains game-neutral scheduling and calculation helpers. See the
[event clock](./SIMULATION-EVENT-CLOCK.md) for scheduling contracts.

`kernel/core/clone.ts` owns `cloneData`, a copy helper for primitive data, plain objects, and dense ordinary arrays with
enumerable data properties, including shared references and cycles. Use native `structuredClone` on the entire graph for
unsupported shapes. Contract exclusions and benchmark evidence are retained in the
[clone performance audit](../audits/CLONE-PERFORMANCE.md).

### GW2 build context

`js/games/gw2/build-context/` prepares canonical builds, caches per-set attributes, and supplies detached engine inputs.
Each profession's `build/context.ts` binds its codec, attribute calculator, preview-aware profession, starting
resources, assumptions, and pure loadout resolver. Browser and headless consumers use the same binding; it never reads
`profession.ui`. Shared assumption defaults live in `professions/shared/build-assumptions.ts`.

### Rotation input activity

`platform/skills/input-controls.ts` owns logical controls; `platform/results/input-trace.ts` projects accepted manual
inputs for reporting. Physical bindings and activity analysis belong in `js/games/gw2/input/`; platform code never
imports that package. Editor routing lives in `app/rotation/hotkeys.ts`, and capture UI in
`app/shared/input-binding-capture.ts`.

## Profession modules

Each profession has Core plus independently selectable elite modules. Core must not depend on elite implementations.
Keep family files for composition and shared queries, and individual mechanics with their owning module.

### Profession file roles

Paths are relative to `professions/<profession>/`, or its owning Core/elite directory where noted.

| File or folder                             | Owns                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `profession.ts`                            | Native profession contract, free of browser dependencies              |
| `catalog.ts`                               | Core-first module tuple and assembled application catalog             |
| `types.ts`                                 | Family contracts and composed module state types                      |
| `data/ids.ts`, `data/trait-lines.ts`       | Stable identities and maintained trait-selection layout               |
| `build/`                                   | Codec, attributes, headless context, and weapon eligibility           |
| `app/app-definition.ts`, `app/tooltips.ts` | Browser adapter and simulation tooltips                               |
| Core/elite `module.ts`                     | Manifest: imports and one `defineNativeModule()` declaration          |
| Core/elite `state.ts`                      | State type, factory, and pure public projector                        |
| Core/elite `skills/`                       | Complete skill declarations and intrinsic behavior grouped by concept |
| Core/elite `hooks.ts`                      | Registration and sequencing of callbacks                              |
| Core/elite `modifiers.ts`                  | Declarative rules and damage-bucket policies                          |
| Core/elite `mechanics/`                    | State/lifecycles spanning skills, traits, or events                   |
| Core/elite `traits/`                       | Trait definitions and supporting behavior                             |
| Core/elite `presentation.ts`               | Palette, resource, timeline, and snapshot contributions               |
| `state-ids.ts`                             | Stable public planning identities                                     |

`catalog.ts` remains separate from `profession.ts` because profession composition imports build code that reads the
catalog during module loading. Modules contribute data upward and must not import the assembled catalog. Presentation
may receive it through a binding factory. Projectors publish stable IDs without mutating their runtime slice; duplicate
IDs fail composition.

`platform/profession-presentation/compose.ts` owns the complete presentation contract. Each callback declares its
composition rule and default there. TypeScript checks every contract member, including optional callbacks, so adding a
callback requires an explicit composition rule. Core, active elite, and family declarations remain partial slices. The
profession initializes the composer lazily when the application first requests presentation.

Code outside a profession imports only its `profession.js`, `app/app-definition.js`, `build/` entry points (including
`build/build.js` and `build/context.js`), `types.js`, `data/**`, `state-ids.js`, and fixed subsystem `profiles.js`
tables. Tests are exempt. Log integrations use `data/` helpers rather than loading the profession graph. ESLint enforces
these boundaries.

Use named mechanics such as `life-force.ts` or `pets.ts`; avoid generic behavior containers and one-file-per-skill/trait
layouts. Small specializations need only the files they use. Shared resource lifecycles belong in a named mechanic or
`mechanics/resources.ts`; small self-contained policies can stay inline.

### Traits and hook composition

Core definitions live in `traits/<line>/index.ts`, collected by `traits/index.ts`. Each elite's `traits/index.ts` owns
its definitions and registration array. Keep small helpers beside definitions and substantial supporting behavior inside
the same trait-line folder. Shared pure queries may live directly under Core `traits/`. Avoid index/helper import
cycles. Definitions register once through `traitDefinitions`; trait selection records supply default profile names.

Author fields in this order where used: `id`, `balance`, `attributes`, `grantedAttributes`, `modifierRules`,
`rechargeRules`, `triggers`, `hooks`, `lifetime`. Preserve rule-array, registration, and spread precedence; field layout
is not execution order. Balance scalars precede effects.

New rewards, counters, and recurring-loop startup use compiled `triggers`. Mechanic points use
`onTriggerPoint(point, reaction)` with typed boundary inputs and a cause. Selection gates precede predicates and proc
claims. Skills own intrinsic behavior; traits own changes to that behavior. Ordered mechanic points allow trait work to
interleave intrinsic work without making untraited execution depend on a trait dispatcher.

`trait.hooks` supplies value policies and imported state; its query/initialization contexts cannot emit or schedule
work. `trait.lifetime` admits delivery and settlement of existing work, not unrelated startup or arbitrary new
reactions. Disabling `traitTriggers` removes producers while retaining value rules and admitted lifetime delivery.
Modifier rules normally receive selection gates; `requiresSelection: false` needs an explicit predicate for
already-created effects. Declare modifiers through rules, not imperative modifier callbacks.

Register complete hook contributions with `composeRuntimeHooks` rather than copying fields or spreading handler maps.
The composer preserves transforms and notifications and rejects duplicate named handlers. Trait value/lifetime hooks
precede module hooks; Core precedes the active elite. Mechanic point listeners follow their explicitly declared order.
Changing a callback's registration location requires reviewing selection, phase, and ordering.

Use `emitTraitProfile` to create profile effects and `invokeTraitSkill` to invoke trait skills. Stateful choices and
custom lifetimes remain with their owner. See [profession guides](../professions/) for family-specific ordering and
exceptions.

### Skill-owned modifiers

Place modifiers after identity/scalar fields and before effects. Default `scope: 'skill'` filters by attributed skill;
`scope: 'profession'` removes that filter while retaining `sourceSkillId`. Profession scope adds no actor or selection
gate. The `when` predicate must define when the rule applies and which actors it affects. Effect-level modifiers cannot
use profession scope.

Skill targets are `strikeDamage`, `conditionDamage`, `criticalChance`, `criticalDamage`, `conditionDuration`, and
`conditionBaseDuration`. Damage uses `multiply` or `damage-additive`; critical/duration targets use `multiply` or `add`.
Strike effects admit strike/critical targets; condition effects admit condition damage/duration targets. Each rule has
one target. Base duration applies before ordinary duration bonuses and their cap.

### Chains and flips

Modules declare ordered chains in `skills/autoattack-chains.ts` through `data.autoattackChains`; assembly derives chain
positions and links. Standalone autoattacks declare `autoattack: true`. Manual sequences may use the chain controller
with `autoattack: false`; chain membership does not imply a flip.

`skills/skill-flips.ts` supplies `data.skillFlips` relationships; assembly derives `flipSkillId` and `flipParentId`. A
parent has one default follow-up; additional commands declare `defaultFollowUp: false`. Missing identities, cycles,
conflicting parents/defaults, chain-internal flips, and links across independently selectable modules are rejected.
Trait, ambush, and loadout variants keep their own metadata.

Declarations identify relationships. Mechanics decide arming, spending, and natural-expiry effects; shared execution
owns windows, uses, identities, and retirement. Planning projects visible windows centrally under
`STATE.AVAILABLE_FLIPS`. Do not duplicate links or window storage in skills, Core state, or presentation.

## Integrations

| Package                   | Owns                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `logs/shared/`            | Normalized contracts, player selection, lookup, and replay timeline       |
| `logs/evtc/`              | ArcDPS parsing and reconstruction                                         |
| `logs/dps-report/`        | Elite Insights JSON reconstruction                                        |
| `logs/wingman/`           | Fetch/reshape into dps.report input; delegates reconstruction there       |
| `keybinds/`, `chat-code/` | External input and build-template decoding                                |
| `patches/`                | Sparse overlays on owning skill/trait declarations and patch-authoring UI |
| `assets.ts`               | Shared JSON/rotation loading for browser and headless consumers           |

Log adapters do not import each other's implementation except Wingman's explicit dps.report delegation. Engine code has
no log-specific assumptions; reconstructed rotations use ordinary simulation. See
[EVTC reconstruction](../EVTC-ROTATION-RECONSTRUCTION.md) and [patch previews](./PATCH-PREVIEW.md).

## Adding things and validating

Add behavior to the module that already owns its data and rules. New elites add a native module after Core in
`catalog.ts`, maintained selection/build metadata, focused tests, and a profession guide. For a new family, follow
[Adding another profession](./ARCHITECTURE.md#adding-another-profession).

Tests mirror their owning subsystem under `tests/`; architecture and typecheck suites enforce boundaries. Follow
[AGENTS.md](../../AGENTS.md) for validation policy and use focused contracts instead of full-result snapshots.
