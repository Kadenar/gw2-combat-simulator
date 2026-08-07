# Elite-specialization family migration specification

> Status: complete for Engineer, Guardian, Mesmer, Necromancer, Revenant, and
> Thief. This document is retained as migration history. Elementalist remains
> outside the family architecture pending a separate review.

## Purpose

This document is the repeatable specification for converting one native
profession from a profession-wide runtime contract into:

1. one always-active Core module; and
2. at most one active elite-specialization module.

The six native families now satisfy this specification through the shared
native authoring layer. The procedure remains as history and as a checklist
for future family migrations; Elementalist is explicitly excluded.

This is a separation-of-concerns migration. Unless separately approved, it must
not change damage, timing, cooldowns, resources, build persistence, selectable
skills, UI output, event logs, stochastic behavior, or public simulation
results.

Normative terms such as **must**, **must not**, and **should** describe
acceptance requirements.

## Migration status

| Profession | Status | Notes |
| --- | --- | --- |
| Necromancer | Complete | Reference family: Core, Reaper, Scourge, Harbinger, Ritualist |
| Mesmer | Complete | Family: Core, Chronomancer, Mirage, Virtuoso, Troubadour |
| Guardian | Complete | Family: Core, Dragonhunter, Firebrand, Willbender, Luminary |
| Engineer | Complete | Family: Core, Scrapper, Holosmith, Mechanist, Amalgam |
| Revenant | Complete | Family: Core, Herald, Renegade, Vindicator, Conduit |
| Thief | Complete | Family: Core, Daredevil, Deadeye, Specter, Antiquary |
| Elementalist | Separate review | Standalone application and custom simulation architecture |

Only one row may be in progress at a time. Finish its validation and update
this table before beginning another profession.

## Goals

A migrated profession must provide:

- a stable family/application contract containing the complete build-editor
  catalog;
- an active runtime contract containing Core plus zero or one selected elite;
- state that allocates no inactive elite fields;
- registries containing no inactive elite handlers, tasks, or reactions;
- source files whose ownership matches runtime ownership;
- deterministic module composition with duplicate validation; and
- compatibility facades only where an existing external import or application
  surface requires them.

Splitting files without excluding inactive runtime behavior is not a migration.
Likewise, runtime filtering without moving source ownership out of mixed
profession-wide files is incomplete.

## Non-goals

Do not combine a profession migration with:

- balance changes or mechanic corrections;
- build-schema or storage-key changes;
- skill, trait, task, event, or handler ID renames;
- unrelated application redesign;
- dynamic imports or bundle splitting;
- unrelated JavaScript-to-TypeScript conversion;
- extraction of individual Core trait lines into runtime modules; or
- movement of profession policy into `platform/engine` or `platform/gw2`.

If a characterization test is wrong, correct it in a separate, explicit change
or document why the correction is inseparable from the migration.

## Existing platform contract

The native authoring infrastructure already exists. Do not create a second
composition system or call the engine family builders from profession code.

- `defineNativeModule()` validates and freezes one typed vertical slice.
- `defineNativeProfession()` derives the application and runtime catalogs,
  compiles modules to the engine family boundary, and caches
  Core-plus-active-elite runtime contracts.
- `createNativeModuleData()` selects generated metadata for one owner while
  retaining locally authored skill mechanics, handlers, traits, and catalog
  exceptions.
- `assembleNativeApplicationCatalog()` derives the complete application
  catalog from the same Core-first module tuple.
- `defineProfessionModule()` and `defineProfessionFamily()` remain engine
  compilation boundaries, not native profession authoring APIs.
- `resolveProfessionRuntime()` passes legacy contracts through and resolves
  family contracts.
- scheduler, resolver, and canonical simulation entry points normalize the
  same family source before constructing state.
- module composition rejects duplicate skill, trait, specialization, hook,
  task-handler, event-handler, skill-handler, and weapon-hand ownership.

Missing or `"Core"` specialization selects Core alone. Unknown non-empty elite
names must fail clearly.

Do not resolve separate runtime instances for scheduling and resolution during
one simulation pass.

## Family surface versus runtime surface

These surfaces have different responsibilities and must remain distinct.

### Family/application surface

The family retains the complete profession catalog and build behavior needed
to:

- render every supported specialization;
- edit, migrate, and validate builds;
- inspect all selectable skills and traits;
- construct application palettes; and
- preserve stable imports from `definition.ts`.

Family-level facades may know the complete elite roster. They must not become
the runtime implementation of elite mechanics.

### Active runtime surface

`resolveRuntime(config)` contains only:

- the Core catalog, state, handlers, hooks, rules, and UI; and
- the selected elite module's contributions, if one is selected.

An inactive elite must contribute no:

- state fields;
- skill, task, or event handlers;
- resolver reactions;
- cast or scheduler hooks;
- modifier rules;
- assumptions;
- resource views;
- palette groups; or
- skill-bar groups.

## Required source shape

Use this conceptual layout:

```text
js/professions/<profession>/
  core/
    module.ts
    state.ts
    skills.ts
    handlers.ts
    mechanics.ts
    rules.ts
    ui.ts
  specializations/
    <elite>/
      module.ts
      state.ts
      skills.ts
      handlers.ts
      mechanics.ts
      rules.ts
      ui.ts
      <feature>.ts
  modules.ts
  family.ts
  catalog-data.ts
  catalog.ts
  definition.ts
  handlers.ts
  resolver.ts
  state.ts
  ui.ts
  mechanics/
    skill-mechanics.ts
```

The named roles are more important than exact filenames. Do not create a
one-line forwarding file merely to satisfy the diagram. A role file must own
data or behavior. Additional feature files should be placed inside the owning
Core or elite directory.

Follow the profession's current source format. Do not create `.js` siblings
beside `.ts` sources and do not commit generated `dist/` output.

## File responsibilities

### `module.ts`

`module.ts` is composition only. It wires local exports into
`defineNativeModule()`:

```ts
export const eliteModule = defineNativeModule({
  id: "Elite",
  data: createNativeModuleData({
    id: "Elite",
    generatedSkills: PROFESSION_API_SKILLS,
    skillMechanics: ELITE_SKILL_MECHANICS,
    handlers: eliteSkillHandlers,
    traits: PROFESSION_TRAITS,
    specializations: PROFESSION_SPECIALIZATIONS,
  }),
  state: {
    scheduler: createEliteState,
    resolver: createEliteResolverState,
    project: projectEliteEndState,
  },
  mechanics: {
    modifiers: eliteModifierRules,
    availability: eliteAvailability,
    castLifecycle: eliteCastLifecycle,
    reactions: eliteReactions,
  },
  presentation: eliteUi,
});
```

Omit genuinely unused properties. Do not put mechanics, state mutation, or
specialization branching directly in `module.ts`.

### `state.ts`

Owns the mutable fields and factories for that slice. An elite `state.ts` must
not type or initialize sibling state.

### `skills.ts`

Owns raw declarative skill mechanics, measured cast timings, and local extra
skill definitions. It must not be a wrapper around assembled catalog data.

The local skill mechanics are passed through `data` in `module.ts`. The full
application catalog is derived from modules and never imports raw mechanics
separately.

### `handlers.ts`

Owns the slice's skill-handler registry and exposes its task/event/reaction
registries. Put substantial behavior in named feature files and assemble it
here.

### `mechanics.ts`

Owns formulas and configuration consumed by multiple handlers in the same
slice: triggered-effect coefficients, summon profiles, trait proc profiles,
state-machine constants, and similar data.

Data used by exactly one feature may live beside that feature instead. Do not
create another broad mixed-ownership mechanics bucket.

### `rules.ts`

Owns attribute declarations, cast rules, recharge/ammo modifiers, scheduler
hooks, and other rule fragments belonging to the slice.

### `ui.ts`

Owns resource views, palette groups, skill bars, availability messages, and
assumptions contributed by the slice. It must not reproduce runtime mechanics.

### Root facades

Root facades exist only for stable imports or the complete application surface:

- `modules.ts` is the only file that knows the complete elite module roster.
- `family.ts` passes that tuple to `defineNativeProfession()`.
- `catalog-data.ts` owns inert generated inputs and exceptional catalog options.
- `catalog.ts` exports `assembleNativeApplicationCatalog(modules, options)`.
- `mechanics/skill-mechanics.ts` may normalize and merge module-owned raw skill
  fragments only as a compatibility surface.
- public end-state projection remains in Core state ownership.
- root `resolver`, full-state factory, and UI dispatch facades are removed;
  runtime resolution and application UI composition are platform-owned.

Core and elite feature files must not import executable application facades.
`module.ts` imports inert inputs from `catalog-data.ts`, never the assembled
root catalog. A facade must not regain executable ownership.

## Dependency rules

The permitted direction is:

```text
platform
  ↑
profession Core
  ↑
active elite
  ↑
family/application composition
```

Therefore:

- Core may import platform and profession-wide identity data.
- An elite may import platform, stable profession data, and Core public APIs.
- An elite must not import a sibling elite.
- Core must not import an elite.
- Runtime feature files must not import root application handler, resolver,
  state, or UI facades.
- `module.ts` may import inert generated data and options from
  `catalog-data.ts`.
- `skills.ts` must not import `catalog.ts`; this would reverse catalog
  ownership and commonly creates a cycle.
- `catalog.ts` imports the shared module tuple and assembles the application
  catalog; module files must not import it.

Use architecture tests to enforce these boundaries.

## Ownership decision procedure

Classify every field, function, constant, mechanic entry, event, and UI
contribution by runtime availability, not by its current filename.

Apply these questions in order:

1. Can the behavior execute in a Core runtime?
   - Yes: Core owns it.
2. Can the behavior execute for several elites because of a profession-wide
   unlock such as Weaponmaster Training?
   - Yes: Core owns the shared skill or primitive.
3. Does the behavior require one active elite mechanic, trait, state field, or
   profession bar?
   - Yes: that elite owns it.
4. Is it a pure primitive used by Core and elites, with no elite policy?
   - Yes: Core may own and expose it.
5. Is it an elite rule reacting to a Core event?
   - The elite owns the reaction. Core emits or dispatches a neutral lifecycle
     signal; composed hooks register the elite behavior.
6. Is it used by two sibling elites but not Core?
   - Do not make the siblings import each other. Extract a narrow
     profession-wide primitive only if it is genuinely policy-free; otherwise
     keep separate local implementations.

The API `specialization` field is evidence, not the ownership rule. For
example, an elite-introduced weapon skill available profession-wide through
Weaponmaster Training remains Core runtime data.

## State contract

Runtime state uses explicit Core and active-specialization storage:

```ts
interface ProfessionRuntimeState {
  core: CoreState;
  specialization:
    | { kind: "Core"; state: Record<string, never> }
    | { kind: "EliteOne"; state: EliteOneState }
    | { kind: "EliteTwo"; state: EliteTwoState };
}
```

The existing compatibility adapter may expose active fields through a flat
view while mechanics are migrated, but it must not allocate inactive sibling
state.

During the initial migration:

- preserve existing build schema and persistence keys;
- preserve the public `endState.profession` shape;
- use explicit projection to supply compatibility fields where required;
- ensure snapshots clone only Core and active elite state; and
- prevent elite types from referencing sibling fields.

## Skill mechanics and catalog ownership

The root skill table must become a composition facade, not the source owner.

Each slice exports its raw mechanics and timing data:

```ts
export const ELITE_BASE_SKILL_MECHANICS = Object.freeze({
  [ID.ELITE_SKILL]: {
    implemented: true,
    effects: [],
    handlerId: "profession.elite-skill",
  },
});

export const ELITE_QUICKNESS_CAST_TIMES_MS = Object.freeze({
  [ID.ELITE_SKILL]: 640,
});
```

The owning module contributes those mechanics with generated identity data:

```ts
export const eliteModule = defineNativeModule({
  id: "Elite",
  data: createNativeModuleData({
    id: "Elite",
    generatedSkills: PROFESSION_API_SKILLS,
    skillMechanics: ELITE_SKILL_MECHANICS,
    specializations: PROFESSION_SPECIALIZATIONS,
  }),
  state: { scheduler: createEliteState },
});
```

`modules.ts` owns one Core-first module tuple. `catalog.ts` passes that tuple to
`assembleNativeApplicationCatalog()`. The assembler derives both the complete
application catalog and each active runtime fragment, so there is no separate
ownership map or hand-maintained slice function.

Requirements:

- preserve each mechanics entry and measured timing;
- move local extra skills with their owner;
- retain one stable full application-facing catalog export;
- keep shared normalization in one place;
- reject duplicate IDs;
- prove that module contributions lose or duplicate no mechanics;
- keep all profession-wide weapon skills in Core, regardless of original elite
  introduction; and
- do not let runtime modules import the aggregate facade.

A large Core `skills.ts` is acceptable when Core legitimately owns many shared
weapon skills. Split further by weapon or feature only when it improves local
maintainability without obscuring runtime ownership.

## Handler mechanics and executable behavior

A mixed root `handler-mechanics` object is not acceptable runtime ownership.

For every entry:

- move Core-only formulas to `core/mechanics.ts`;
- move elite-only formulas to that elite's `mechanics.ts`;
- co-locate single-consumer data with its handler where clearer;
- remove dead compatibility fields found during the move; and
- update consumers to import only their Core or local mechanics.

A root handler-mechanics facade is allowed only when an established
application-facing consumer requires the complete data set. No runtime module
may import it. Prefer deleting it when no such consumer exists.

Move executable behavior with its data:

- skill handler strategies;
- cast availability and replacement logic;
- typed scheduler tasks;
- custom resolver event handlers;
- reactions to standard GW2 events;
- state transitions;
- summon and transform behavior; and
- trait-triggered effects.

Pure shared primitives may remain in Core. Functions containing an elite trait
check, elite state access, elite ID branch, or elite coefficient belong to that
elite.

### Cross-slice reactions

Core must not implement an elite trait merely because that trait reacts to a
Core skill.

Use composed control flow:

1. Core exposes a neutral lifecycle signal or narrow registration API.
2. The active elite registers a scheduler hook or resolver reaction.
3. Core dispatches the signal without naming the elite.
4. No callback is installed in Core-only or sibling runtimes.

This preserves both directions: Core remains elite-neutral and the elite can
decorate Core behavior when active.

## Rules and modifiers

Move each elite's:

- declarative modifier rules;
- cast-duration and recharge modifiers;
- ammo changes;
- availability predicates;
- scheduler lifecycle hooks; and
- resolver-time damage or condition rules.

Core retains profession-wide rules and the single modifier-rule compiler.
Composition merges Core plus active-elite declarations before compilation so
the GW2 additive and multiplicative buckets remain unchanged.

Do not leave generic-looking functions in a root rule file when they encode
one elite's IDs or policy. Generic naming does not make behavior shared.

Prefer the phase-explicit native helpers for recurring mechanics:

- scheduler availability and lifecycle: `skillAvailability()` and
  `afterSkillEffects()`;
- resolved standard events: `onResolvedDamage()`, `onResolvedControl()`,
  and `onResolvedBlind()`;
- player critical procs: `onResolvedPlayerCriticalHit()`, which consumes the
  canonical stochastic critical result and accumulates deterministic expected
  progress; and
- handler declarations: `augmentSkill()` and `replaceSkill()`; modifier-rule
  arrays are already typed and need no wrapper.

These helpers require stable IDs and preserve explicit ordering. Do not add a
helper merely to rename a one-off callback. Complex typed scheduler tasks,
custom resolver event types, compound state machines, and exceptional
cooldown/ammo policies should remain in the low-level `castRules`,
`schedulerHooks`, or `resolverHooks` escape hatches. The escape hatch must
still be phase-specific and owner-local.

## UI composition

The family application UI may dispatch to Core plus the selected elite, but:

- Core UI must not switch between elite bars or resources;
- each elite owns its profession bar, resources, assumptions, and availability
  messages;
- list contributions concatenate deterministically;
- availability predicates all receive a chance to reject;
- inactive elite contributions remain absent; and
- single-owner callbacks stay in Core unless an active elite explicitly
  decorates them.

UI dispatch is not permission to centralize simulation logic.

## Deterministic composition

Composition must:

- run hooks by explicit order, with stable declaration order as the tie-break;
- reject duplicate hook IDs;
- reject duplicate task, event, and skill-handler keys;
- reject duplicate skill, trait, and specialization IDs;
- preserve explicit augment/replace skill-handler modes;
- preserve stable event and handler namespaces;
- include Core plus exactly one elite catalog fragment; and
- cache equivalent runtime contracts by specialization.

Object spread order is not an override policy.

## Migration procedure

Repeat the following for exactly one profession.

### Phase 0: declare scope

- Update the status table to mark one profession in progress.
- Do not edit another profession except for shared additive infrastructure
  strictly required by the active migration.
- Record unrelated dirty files and avoid overwriting them.

### Phase 1: establish a baseline

Run the profession tests, family/framework tests, architecture tests,
`npm run check`, and the full suite.

Record:

- passing counts;
- existing failures and exact mismatches;
- benchmark/template outputs;
- public state fields;
- build defaults and storage keys;
- registered skill/task/event handler IDs;
- event types and projection shapes; and
- UI resource, palette, and skill-bar output.

Do not attribute an existing dirty-tree failure to the migration.

### Phase 2: build an ownership inventory

Create a temporary working inventory with at least:

| Item | Current location | Runtime owner | Consumers | Destination | Compatibility required |
| --- | --- | --- | --- | --- | --- |
| State field | | | | | |
| Skill mechanics entry | | | | | |
| Handler/mechanics profile | | | | | |
| Hook/rule | | | | | |
| Event/task | | | | | |
| UI contribution | | | | | |

Search actual consumers. Do not classify by directory name alone.

Specifically inventory:

- state factories and snapshot/projection code;
- skill mechanics and measured timings;
- extra/supplemental skills;
- handler-mechanics entries;
- skill handlers and handler IDs;
- scheduler task handlers and task IDs;
- resolver custom handlers and standard-event reactions;
- attribute and cast rules;
- specialization branches in generic helpers;
- UI callbacks and assumptions; and
- tests importing mixed aggregate files.

### Phase 3: scaffold the family slices

- Create Core and elite directories.
- Create composition-only `module.ts` files.
- Keep `definition.ts` as the stable export.
- Create `modules.ts` as the only full-roster module and keep `family.ts` as
  profession composition.
- Establish state fragments and compatibility projection.
- Resolve Core and every elite before moving behavior, using temporary
  delegation only when necessary.

Temporary delegation must be removed before completion.

### Phase 4: migrate skill mechanics

- Move raw skill entries and measured timings into owner `skills.ts` files.
- Move extra skills to their owner.
- Keep profession-wide weapon families in Core.
- Keep a root skill-mechanics aggregate only for stable compatibility imports.
- Put `createNativeModuleData({ id: "Owner", ... })` in `module.ts`.
- Derive the application catalog from the Core-first module tuple.
- Remove catalog imports from `skills.ts`.
- Add no-loss/no-duplicate coverage.

This phase should be behavior-neutral.

### Phase 5: migrate handler mechanics

- Split the mixed formula/configuration table.
- Update every consumer to import local or Core data.
- Delete the aggregate if no application consumer requires it.
- Remove obsolete fields only after confirming they have no consumers.
- Add architecture guards against aggregate runtime imports.

### Phase 6: migrate executable vertical slices

For one elite folder at a time, move:

- state mutation;
- handlers;
- tasks;
- events and reactions;
- availability;
- transforms, summons, or profession actions;
- scheduler hooks; and
- trait behavior.

After each elite:

- run focused behavior tests;
- assert siblings remain absent from its runtime; and
- remove the corresponding central branch.

### Phase 7: migrate rules and UI

- Move modifier declarations and exceptional rule hooks.
- Keep the single rule compiler in Core.
- Move elite resources, palettes, skill bars, assumptions, and availability
  messages.
- Keep root rule/UI modules as thin compatibility or application facades only.

### Phase 8: remove obsolete ownership

Delete:

- central executable specialization switches;
- obsolete `mechanics/specific` ownership buckets;
- mixed aggregate handler-mechanics tables;
- profession-wide event-handler aggregators used by active runtimes;
- forwarding `skills.ts` wrappers;
- temporary delegation; and
- stale imports, exports, comments, and tests.

Permitted root branching is limited to:

- family roster lookup;
- application catalog slicing;
- application UI dispatch; and
- compatibility projection.

Every remaining specialization branch must be listed in the handoff with a
specific reason.

### Phase 9: validate and stop

Run:

```powershell
npm run build
node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none `
  tests/professions/<profession>/<profession>.test.js `
  tests/professions/profession-family.test.js `
  tests/platform/platform-architecture.test.js
npm run check
npm test
git diff --check
```

Fix migration-caused failures. Report baseline failures separately with exact
values. Do not begin the next profession in the same change.

## Required tests

### Framework behavior

Maintain coverage proving:

- legacy contracts pass through unchanged;
- Core resolves without an elite;
- every known elite resolves as Core plus that elite;
- unknown elites fail clearly;
- resolution is cached and stable;
- scheduler and resolver use the same runtime;
- hook order is deterministic;
- duplicate registries and catalog IDs fail; and
- the family retains the complete application catalog.

### Runtime isolation

For Core and every elite, assert:

- sibling state fields are absent;
- sibling skill handlers are absent;
- sibling task and event handlers are absent;
- sibling resolver reactions are absent;
- sibling modifier declarations are absent;
- sibling resources and palette groups are absent; and
- only Core plus the selected elite's skills and traits are present.

Prefer runtime assertions over source-text assertions.

### Source ownership

Architecture tests must additionally assert:

- Core imports no elite;
- elites import no siblings;
- runtime feature files import no executable application facade;
- each `module.ts` imports inert inputs from `catalog-data.ts`, not
  `catalog.ts`;
- each `skills.ts` owns raw mechanics and imports no root catalog;
- the root skill-mechanics file declares no individual skill behavior;
- runtime handlers import local/Core mechanics, not an aggregate
  handler-mechanics table;
- obsolete mixed ownership directories are removed; and
- each declared vertical-slice role exists and has a real owner.

### Mechanics coverage

Assert that:

- module skill-mechanics keys are disjoint;
- their union equals the pre-migration mechanics key set;
- measured timing keys remain unchanged;
- implemented skills still reference registered handlers;
- extra skills remain in the complete catalog;
- intentional replacements and chains remain valid; and
- profession-wide unlocks remain available in every appropriate runtime.

### Behavioral parity

Retain or add focused coverage for:

- strike and condition totals;
- cast, channel, cooldown, and ammo timing;
- profession resources;
- transform and weapon-bar transitions;
- summons and delayed events;
- deterministic and stochastic procs;
- public end-state projection;
- build encode/decode round trips;
- palettes, resources, and skill bars; and
- benchmark/template outputs.

Do not update expected values solely to make the refactor pass.

## Definition of done for one profession

A profession is migrated only when:

- `definition.ts` exports a family under the stable profession name;
- Core and every supported elite have explicit vertical-slice ownership;
- runtime resolution selects Core plus no more than one elite;
- inactive state and registries are absent;
- raw skill and handler mechanics are no longer mixed at the profession root;
- module `skills.ts` files own data rather than forwarding catalog calls;
- Core imports no elite and elites import no siblings;
- elite reactions to Core behavior use composition rather than Core policy;
- central executable specialization switches are removed;
- the complete application catalog and build codec remain stable;
- public persistence and result contracts remain compatible;
- no mechanics or timing entries were lost or duplicated;
- focused tests and `npm run check` pass;
- the full suite has no new failures;
- architecture documentation and the status table are updated; and
- the next profession has not been started.

## Lessons established by Necromancer

These are requirements derived from the reference migration:

1. **Vertical slices include data.** Moving handlers and state is insufficient
   while skill mechanics or triggered-effect profiles remain mixed.
2. **A forwarding `skills.ts` has no value.** It becomes meaningful only when
   it owns raw mechanics, timings, or extra skills. Catalog slicing belongs in
   `module.ts`.
3. **Runtime ownership beats API labels.** Weaponmaster-style unlocks can make
   an elite-introduced weapon a Core runtime concern.
4. **The full catalog is a facade, not a runtime.** Application composition may
   merge every module; active simulation may not.
5. **Aggregate handler data creates real coupling.** Local handlers should not
   import formulas for every sibling elite.
6. **Cross-cutting elite traits still belong to the elite.** A neutral Core
   signal plus an active-module hook avoids a Core-to-elite dependency.
7. **Core baselines may be reused downward.** An elite may import a genuinely
   profession-wide Core primitive, such as a shared summon baseline.
8. **Compatibility adapters are temporary boundaries, not ownership.** They
   preserve public state while internal allocation becomes isolated.
9. **Both runtime and source isolation need tests.** Either one alone permits
   the architecture to regress.
10. **Pre-existing failures must be recorded exactly.** A dirty benchmark or
    template mismatch must not be hidden by unrelated expectation changes.

## Handoff template

At the end of each profession migration, report:

```text
Profession:
Core ownership:
Elite modules:
Application-only facades retained:
Shared Core primitives imported by elites:
Remaining specialization branches and reasons:
Files/directories removed:
Focused tests:
Full-suite result:
Check result:
Pre-existing failures:
Next profession (not started):
```
