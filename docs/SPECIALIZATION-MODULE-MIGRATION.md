# Elite-specialization module migration

## Objective

Replace each profession-wide runtime "god contract" with a composition of:

1. one always-active profession core module; and
2. at most one active elite-specialization module.

Migrate one profession at a time. Migrated and legacy professions must run
through the same application and simulation entry points during the migration.

This is primarily a separation-of-concerns change. It must not alter damage,
timing, cooldowns, resources, build persistence, palettes, event logs, or public
simulation results.

In this document, "elite specialization" means the active elite mechanic such
as Deadeye or Antiquary. It does not mean every selectable core trait line.

## Current problem

Native professions currently export one normalized contract containing every
elite specialization:

- state factories allocate fields for inactive specializations;
- availability and UI functions switch on specialization names;
- task, event, skill-handler, and modifier registries contain inactive logic;
- authoritative skill-mechanics objects contain the entire profession; and
- changing one elite specialization can affect the profession-wide contract.

Thief is the clearest pilot. Its runtime state simultaneously contains malice,
shadow force, Daredevil endurance behavior, and Antiquary artifact state.

Splitting a large file into smaller imports is useful, but insufficient. The
active runtime contract must also exclude inactive specialization behavior.

## Non-goals

Do not combine this migration with:

- balance changes or mechanic corrections;
- build-schema changes;
- skill, trait, task, event, or handler ID renames;
- application redesign;
- unrelated JavaScript-to-TypeScript conversion;
- dynamic-import or bundle-splitting work;
- extracting core trait lines into independently activated modules; or
- moving profession behavior into `platform/engine` or `platform/gw2`.

Static imports are acceptable initially. Runtime composition and source
ownership are the first goals; lazy loading can be considered separately.

## Compatibility strategy

Keep `defineProfession()` and `NormalizedProfessionContract` working for every
legacy profession.

Introduce an additive family contract:

```ts
export interface ProfessionFamilyContract<
  TProfessionState extends object = SchedulerRecord,
> extends NormalizedProfessionContract<TProfessionState> {
  readonly resolveRuntime: (
    config: Readonly<SchedulerConfig>,
  ) => Readonly<NormalizedProfessionContract<TProfessionState>>;
}

export type ProfessionSource<TProfessionState extends object = SchedulerRecord> =
  | NormalizedProfessionContract<TProfessionState>
  | ProfessionFamilyContract<TProfessionState>;
```

The exact names may change if a clearer repository convention exists, but the
compatibility behavior must remain:

```ts
export function resolveProfessionRuntime(
  profession: ProfessionSource,
  config: Readonly<SchedulerConfig>,
): Readonly<NormalizedProfessionContract> {
  return typeof profession.resolveRuntime === "function"
    ? profession.resolveRuntime(config)
    : profession;
}
```

Resolve the active contract once before scheduler and resolver construction:

```ts
const runtimeProfession = resolveProfessionRuntime(profession, config);
```

The scheduler, resolver, combat query, end-state projection, and profession
hooks for that pass must all receive the same resolved contract. Do not resolve
different contract instances independently for the scheduling and resolution
phases.

Missing or `"Core"` specialization selects only the core module. An unknown
non-empty elite-specialization name should fail with a useful error instead of
silently selecting Core.

## Family contract versus runtime contract

A profession family has two responsibilities that must remain distinct.

### Family/application surface

The application still needs a complete catalog to:

- render all specialization choices;
- edit and validate builds;
- inspect skills and traits while the user changes a build;
- migrate saved builds; and
- expose profession-wide assumptions that are filtered by specialization.

The family contract therefore retains the complete application-facing catalog,
build codec, and specialization manifest.

### Active simulation surface

`resolveRuntime(config)` returns a normalized contract containing only:

- profession core mechanics; and
- the selected elite-specialization module, if any.

Its executable registries must not contain inactive specialization task
handlers, event handlers, event reactions, skill handlers, modifiers, state
factories, or UI contributions.

The family object may dispatch application UI callbacks to the selected module,
but it must not reimplement specialization behavior with another central
`switch`.

## Proposed source layout

Use the same shape for each migrated profession:

```text
js/professions/<profession>/
  core/
    module.ts
    state.ts
    skills.ts
    handlers.ts
    rules.ts
    ui.ts
  specializations/
    <elite-one>/
      module.ts
      state.ts
      skills.ts
      handlers.ts
      rules.ts
      ui.ts
    <elite-two>/
      ...
  family.ts
  catalog.ts
  definition.ts
```

Only create files a profession actually needs. A purely declarative
specialization does not need empty handler or state files.

`definition.ts` remains the stable external import and exports the profession
family under the existing profession export name. This avoids changing the
application registry and external imports while each profession migrates.

Follow the repository's current source format. Do not create `.js` siblings
beside `.ts` sources, and do not commit generated `dist/` output.

## Module contract

A specialization module owns a complete vertical slice:

```ts
export const antiquaryModule = defineProfessionModule({
  id: "Antiquary",
  state: {
    create: createAntiquaryState,
    project: projectAntiquaryState,
  },
  catalog: {
    skillMechanics: ANTIQUARY_SKILL_MECHANICS,
    extraSkills: ANTIQUARY_EXTRA_SKILLS,
    skillHandlers: antiquarySkillHandlers,
  },
  attributeRules: antiquaryAttributeRules,
  castRules: antiquaryCastRules,
  schedulerHooks: antiquarySchedulerHooks,
  resolverHooks: antiquaryResolverHooks,
  ui: antiquaryUi,
  assumptionControls: antiquaryAssumptionControls,
});
```

This is an illustrative shape, not a requirement to duplicate
`ProfessionDefinition`. Keep module fragments narrow and let the family
composer produce the existing normalized runtime contract.

An elite-specialization module may import:

- its profession's core public API;
- stable profession IDs and inert identity metadata;
- `platform/engine`;
- `platform/gw2`; and
- shared application view-model types where needed.

It must not import sibling elite-specialization modules.

The family composition root is the only profession module that knows the full
elite-specialization roster.

## State isolation

Do not continue shallow-merging every specialization into one flat state
object. Use an explicit core state and a discriminated specialization state:

```ts
interface ThiefRuntimeState {
  core: ThiefCoreState;
  specialization:
    | { kind: "Core"; state: Record<string, never> }
    | { kind: "Daredevil"; state: DaredevilState }
    | { kind: "Deadeye"; state: DeadeyeState }
    | { kind: "Specter"; state: SpecterState }
    | { kind: "Antiquary"; state: AntiquaryState };
}
```

Specialization adapters should expose only:

- the shared engine context;
- the profession core state or a narrow core-mechanics API; and
- that specialization's own state slice.

Do not give a specialization a type containing sibling state. For example,
Antiquary code must be unable to reference Deadeye malice at compile time.

Keep the existing public `endState.profession` shape during the first migration
unless a separate breaking change is approved. `projectEndState` can flatten or
otherwise adapt internal core/specialization state to the current public
result.

## Composition rules

The family composer must define and test deterministic merge behavior.

### Hooks

- Compose core hooks before specialization hooks unless explicit hook order
  says otherwise.
- Preserve the existing `{ id, order, handler }` ordering behavior.
- Reject duplicate hook IDs within the resolved contract.

### Registries

- Merge task handlers, event handlers, and skill handlers.
- Reject duplicate registry keys unless the module declares an explicit,
  validated replacement.
- Do not use object-spread ordering as an implicit override policy.

### Catalog fragments

- A resolved runtime catalog contains core skills plus active specialization
  skills.
- Preserve stable skill IDs, names, handler IDs, and canonical effect shapes.
- Reject accidental duplicate skill IDs.
- Model intentional profession-action or skill replacements explicitly.
  Do not recreate a family-wide specialization switch in availability logic.

### UI and assumptions

- Concatenate list contributions such as resource views, palette groups, skill
  bar groups, and assumption controls.
- Compose availability predicates so every active predicate must allow the
  skill.
- Keep single-owner callbacks, such as ordinary weapon matching, on the core
  module unless the active specialization explicitly decorates them.
- Inactive specialization UI contributions must not appear in the resolved
  runtime UI.

### Attributes and modifiers

- Compose core modifier hooks with active specialization modifier hooks.
- Preserve current modifier order and additive/multiplicative bucket behavior.
- Do not move specialization predicates into shared GW2 modifier code.

### Caching

Resolved contracts are immutable and may be cached by specialization name.
Repeated resolution of the same family and specialization should return an
equivalent, preferably identical, contract.

## Infrastructure phase

Complete this additive infrastructure before extracting profession behavior:

1. Add family/module types without changing existing profession definitions.
2. Add `resolveProfessionRuntime()` with legacy fallback.
3. Resolve once at the canonical GW2 simulation entry point.
4. Ensure direct scheduler or resolver entry points either receive an already
   resolved contract or perform the same documented normalization.
5. Add family-composition validation for duplicate IDs and registry keys.
6. Add architecture tests proving an unchanged legacy profession still runs.
7. Document the new contract in `docs/ARCHITECTURE.md` and `docs/MODULES.md`.

Do not migrate multiple professions as part of the infrastructure phase.

## Per-profession migration playbook

Repeat this process for exactly one profession at a time.

### 1. Establish parity

- Run the profession test file and platform architecture tests before edits.
- Record failures already present in the working tree.
- Identify public end-state fields, event types, handler IDs, task IDs,
  assumptions, palette groups, and build defaults that must remain stable.

### 2. Inventory ownership

Classify every profession-owned behavior as:

- core;
- one elite specialization; or
- genuinely shared between core and several elite specializations.

Classify by actual game availability, skill/trait metadata, and tests, not only
by the current filename. Existing filenames may already conflate concepts.

### 3. Split inert mechanics data

- Move the large skill-mechanics object into core and specialization fragments.
- Preserve every entry byte-for-byte where practical.
- Compose the current full application catalog from those fragments.
- Add a coverage assertion showing that no mechanic entry was lost or
  duplicated.

This step should not change runtime behavior.

### 4. Extract executable modules

For each elite specialization, move its:

- state;
- state projection;
- cast availability;
- skill handlers;
- scheduled tasks;
- resolver handlers and reactions;
- attribute/modifier rules;
- assumptions; and
- UI resource and palette contributions.

Remove the corresponding branches and registrations from the profession core.

### 5. Compose active runtime contracts

- Core builds resolve to core only.
- Elite builds resolve to core plus exactly one elite module.
- Validate that inactive registries and state are absent.
- Keep the family-level application catalog and build codec stable.

### 6. Preserve external behavior

- Keep build schema and storage keys unchanged.
- Keep rotation commands and skill names unchanged.
- Keep event/task/handler namespaces unchanged.
- Keep public result projection unchanged.
- Keep deterministic and stochastic simulation behavior unchanged.

### 7. Remove obsolete dispatch

Delete central `switch`, lookup, or `if specialization === ...` logic after its
behavior is owned by modules. A small specialization lookup in `family.ts` is
expected; executable mechanic branching outside the active module is not.

### 8. Verify and stop

Run:

```powershell
npm test -- tests/<profession>.test.js tests/platform-architecture.test.js
npm test
npm run check
```

Fix failures caused by the migration. Do not begin another profession in the
same change.

## Thief pilot boundaries

Use Thief as the first migrated profession.

### Core Thief

Core should own:

- initiative and regeneration;
- baseline endurance;
- stealth and Revealed;
- baseline Steal and stored stolen skills;
- common weapon, dual-wield, autoattack-chain, and weapon-swap state;
- common slot skills;
- common trait behavior; and
- common state events and public projection.

### Daredevil

Daredevil should own:

- increased endurance capacity;
- dodge replacements and their effects;
- Daredevil-only traits and modifiers; and
- Daredevil UI/resource differences.

### Deadeye

Deadeye should own:

- Deadeye's Mark and its stolen-skill set;
- marked-target state;
- malice and Maleficent Seven;
- Kneel/rifle stance behavior;
- malicious stealth-attack replacements; and
- Deadeye-only traits, modifiers, resources, and UI.

### Specter

Specter should own:

- Siphon;
- shadow-force generation, capacity, and drain;
- Shadow Shroud entry, exit, bar replacement, and skills; and
- Specter-only traits, resources, availability, and UI.

### Antiquary

Antiquary should own:

- Skritt Swipe;
- artifact draw state and assumptions;
- artifact slots, uses, Reshuffle, and Double Edge;
- artifact-specific handlers, tasks, reactions, and summons;
- Antiquary-only traits and modifiers; and
- Antiquary resource, palette, and skill-bar UI.

Review mixed files carefully. For example, a file whose name mentions
Antiquary may also contain baseline weapon or condition behavior and must be
split by actual ownership.

## Required tests

### Framework tests

Add tests covering:

- legacy contracts pass through unchanged;
- Core resolves to the core module only;
- each known elite specialization resolves to core plus that module;
- unknown specializations fail clearly;
- hook ordering remains deterministic;
- duplicate hook, task, event, skill-handler, and skill IDs are rejected;
- repeated resolution is stable;
- the scheduler and resolver use the same resolved contract; and
- the complete family catalog remains available to the application.

### Profession-isolation tests

For every migrated specialization, assert that the resolved contract excludes
sibling behavior. For example, an Antiquary runtime must not contain:

- Deadeye malice state;
- Specter shadow-force state;
- Daredevil-only state;
- Deadeye or Specter task/skill handlers;
- sibling resolver handlers or reactions; or
- sibling resource and palette views.

Prefer positive registry/state assertions over tests that inspect source text.
An optional import-boundary test may additionally reject direct imports between
sibling specialization directories.

### Parity tests

Existing profession tests are characterization tests for this migration. Do
not rewrite expected values merely to make the refactor pass. If an existing
expectation is wrong, handle that correction separately.

Add focused parity coverage for:

- damage totals and condition totals;
- cast and cooldown timing;
- final resources;
- scheduled events;
- public end-state projection;
- palette and resource views;
- build encode/decode round trips; and
- deterministic-choice behavior.

## Definition of done for one profession

A profession is migrated only when:

- its stable `definition` export now represents a family;
- runtime resolution selects core plus no more than one elite module;
- internal state contains no inactive specialization slice;
- executable registries contain no inactive specialization entries;
- specialization modules do not import siblings;
- family-level central mechanic switches have been removed;
- the full build-editor catalog still works;
- existing public output and persistence contracts remain compatible;
- its focused tests, the complete test suite, and `npm run check` pass; and
- architecture documentation identifies it as migrated.

Do not mark the overall migration complete until every native profession uses
the family contract. Elementalist should be evaluated separately because its
current adapter and simulator architecture differ from the shared native
profession path.

## Agent handoff checklist

Before editing:

- inspect the current working tree and preserve unrelated user changes;
- read `docs/ARCHITECTURE.md`, `docs/MODULES.md`, and the profession document;
- inspect current source extensions and TypeScript build inclusion;
- run the focused baseline tests; and
- state which single profession is in scope.

During implementation:

- keep infrastructure additive;
- preserve stable IDs and public shapes;
- make module ownership explicit;
- add validation instead of silent override behavior;
- avoid sibling specialization imports; and
- do not start a second profession.

At handoff:

- list created module boundaries;
- identify any remaining specialization branches and why they remain;
- report focused, full-suite, and check results;
- call out pre-existing failures separately; and
- name the next profession without beginning its migration.
