# Post-migration profession-family cleanup

## Status

This document defines the cleanup phase that follows migration of the shared
native professions to Core-plus-active-elite family composition.

The migrated families in scope are:

- Engineer
- Guardian
- Mesmer
- Necromancer
- Revenant
- Thief

Elementalist is intentionally excluded. It retains its profession-owned
scheduler, resolver, optimizer, and application architecture until a separate
review approves a migration path.

This work must begin from a green migration baseline. It is architectural
cleanup, not another mechanic migration.

## Purpose

The specialization migrations established correct runtime ownership:

- Core is always active;
- no more than one elite module is active;
- inactive elite state and executable registries are absent;
- raw mechanics and handlers are owned by Core or one elite; and
- the application retains a complete profession catalog.

The migrations deliberately retained compatibility infrastructure so each
profession could move without simultaneously redesigning the platform
contract. That infrastructure still presents parts of a profession as one
logical executable entity.

The cleanup should remove that remaining duplication while preserving the
runtime isolation gained by the migrations.

## Current architecture and remaining debt

This section records the state observed after the six family migrations.

### The family definition still requires a full executable profession

`ProfessionFamilyDefinition` currently extends `ProfessionDefinition`.
Consequently, every `family.ts` supplies full-roster resources, attribute
rules, cast rules, scheduler hooks, resolver hooks, and UI in addition to its
Core and elite modules.

`defineProfessionFamily()` calls:

```ts
const applicationSurface = defineProfession(definition);
```

It then separately composes Core plus the selected elite for
`resolveRuntime(config)`.

This creates two representations:

1. a profession-wide executable compatibility contract; and
2. the correctly isolated active runtime contract.

The first representation is why migrated professions still need aggregate
root facades such as:

- `attribute-rules.ts`
- `mechanics/contract.ts`
- `handlers.ts`
- `resolver.ts`
- `state.ts`
- `ui.ts`

Some root files also remain valid application boundaries. They must be
classified by actual consumers before deletion.

### Runtime state still exposes flat compatibility access

The runtime stores family state as:

```ts
{
  core,
  specialization: {
    kind,
    state,
  },
}
```

`createComposedStateAdapter()` wraps that storage in a `Proxy` so existing
mechanics can continue accessing flat fields such as:

```ts
context.state.profession.someField
```

The proxy prevents inactive sibling allocation, but it hides ownership from
call sites and requires special cases in state cloning.

### Application UI composition is duplicated

Several professions implement similar family dispatchers that:

- select Core plus the requested elite;
- normalize Core trait-line names to Core mechanic UI;
- concatenate list callbacks;
- combine availability callbacks; and
- select one callback for scalar or stateful UI behavior.

Mesmer and Thief also retain substantial profession-wide specialization
branching in their root application UI files.

Runtime UI composition exists in `platform/engine/profession.ts`, but it treats
callbacks such as `eventLogRow` as single-owner. That forces some root UI
facades to classify events belonging to multiple elite modules.

### Module state typing remains broad

Many family and module definitions use `SchedulerRecord` as their profession
state type. Runtime isolation is enforced structurally and by tests, but TypeScript
does not consistently prevent an elite implementation from naming fields
outside its own state fragment.

### Build source discovery is stale and manual

At the time of this audit, `tsconfig.build.json` contained:

- 266 explicit include entries;
- 137 entries for the six migrated professions; and
- 60 migrated-profession entries whose source files no longer exist.

New module files may still compile when reached through imports, but an
unreferenced file can be omitted from `dist` without the TypeScript build
reporting it. The explicit list also retains paths from removed
`mechanics/specific`, handler-mechanics, and resolver trees.

### Architecture documentation retains legacy examples

`docs/ARCHITECTURE.md` and `docs/MODULES.md` still describe legacy mixed
mechanics roles and reference removed Mesmer paths. Documentation cleanup
should happen after source boundaries settle so it describes the final
architecture rather than another intermediate state.

### The complete application catalog is intentional

The full profession catalog is not migration debt. The build editor and
application need all supported skills, traits, specializations, weapons, and
presentation metadata.

Likewise, a root `mechanics/skill-mechanics` composition facade may remain when
it is the authoritative input to the complete application catalog. It must
only merge module-owned raw mechanics; it must not regain runtime behavior.

## Goals

The cleanup must:

- make a family an application contract plus a runtime resolver, not a second
  full-roster runtime;
- derive application compatibility behavior from modules where practical;
- remove aggregate executable facades that have no remaining external
  consumer;
- make internal state ownership explicit at call sites;
- centralize generic family UI dispatch and callback composition;
- improve module-local state typing;
- eliminate stale build inputs and detect orphan source files;
- consolidate repeated family-conformance tests; and
- update architecture documentation to describe only the final model.

## Non-goals

Do not combine this cleanup with:

- balance, coefficient, timing, cooldown, or mechanic corrections;
- build-schema or storage-key changes;
- public skill, trait, handler, task, or event ID changes;
- public `endState.profession` shape changes;
- dynamic imports or bundle splitting;
- conversion of Thief from JavaScript to TypeScript;
- redesign of the browser application;
- movement of profession behavior into the shared platform; or
- Elementalist migration.

`defineProfession()` must remain available for ordinary normalized contracts,
test fixtures, and Elementalist. Removing native legacy usage does not justify
removing the simpler platform primitive.

## Target architecture

```text
Application
  |
  +-- family identity, complete catalog, build codec, and application UI
  |
  +-- resolveRuntime(config)
        |
        +-- Core module
        |
        +-- zero or one selected elite module
              |
              +-- isolated catalog fragment
              +-- isolated state fragment
              +-- local handlers, rules, hooks, events, and UI
        |
        +-- normalized executable runtime
              |
              +-- scheduler
              +-- resolver
              +-- public end-state projection
```

The family surface must not need a profession-wide copy of runtime handlers,
rules, hooks, or mutable state merely to satisfy its type.

## Invariants

Every phase must preserve these invariants:

1. `definition.ts` or `definition.js` remains the stable profession export.
2. The family catalog remains complete and stable for the application.
3. Runtime resolution selects Core plus no more than one elite.
4. Unknown elite names fail explicitly.
5. Runtime resolution remains cached and deterministic.
6. Inactive elite state, handlers, hooks, rules, and UI remain absent.
7. Hook order and duplicate-owner validation remain deterministic.
8. Modifier declarations are compiled once into the shared GW2 damage buckets.
9. Public build persistence and result projection remain compatible.
10. Existing benchmark and rotation results do not change.
11. Elementalist behavior and architecture remain untouched.

## Cleanup phases

### Phase 0: establish the post-migration baseline

Before changing platform contracts:

1. Update the migration status document separately so it accurately records
   the six completed families and the Elementalist exception.
2. Run the full build, check, and test suite.
3. Record every pre-existing failure with exact expected and actual values.
4. Confirm every family resolves Core and every supported elite.
5. Confirm each runtime excludes sibling state and registries.
6. Inventory imports of every root compatibility facade.
7. Classify each import as application, test, runtime, or obsolete.

Do not delete a root facade based only on its filename.

Acceptance:

- the baseline is reproducible;
- no profession migration is still in progress; and
- every compatibility export has a known consumer or is marked removable.

### Phase 1: clean source discovery and stale documentation

This is the lowest-risk cleanup and should land first.

#### TypeScript build inputs

Replace the stale profession file enumeration with one of these approaches:

1. include all supported TypeScript sources using reviewed globs and explicit
   exclusions; or
2. generate the source manifest from supported entry points and fail when an
   orphan source file is not emitted.

The chosen approach must:

- include newly added module files without manual list maintenance;
- reject or report missing configured paths;
- detect source files that lack compiled output;
- support the repository's mixed JavaScript and TypeScript professions; and
- avoid compiling temporary or generated files.

Remove all nonexistent migrated-profession entries.

#### Documentation

After source paths are final:

- remove legacy profession-wide mechanics descriptions;
- replace removed path references with Core or elite-owned paths;
- describe the family/application distinction;
- document the internal state contract accurately; and
- keep Elementalist's exception explicit.

Acceptance:

- `npm run check` detects every supported TypeScript source;
- `check-dist` reports no missing output;
- configured source paths all exist; and
- architecture documentation contains no references to removed profession
  trees.

### Phase 2: separate family and runtime contracts

This is the central platform cleanup.

#### Contract direction

`ProfessionFamilyDefinition` should no longer extend the complete executable
`ProfessionDefinition`.

Define the family surface around application responsibilities:

```ts
interface ProfessionFamilyDefinition {
  id: string;
  name: string;
  catalog: CanonicalCatalog;
  build?: ProfessionBuildDefinition;
  core: ProfessionModuleDefinition;
  specializations: Readonly<Record<string, ProfessionModuleDefinition>>;
  ui?: Partial<ProfessionUiContract>;
  simulation?: SchedulerRecord | null;
}
```

The exact type names may differ. The required behavior is:

- the family exposes identity, the complete catalog, build behavior, and
  application UI;
- `resolveRuntime(config)` returns the only executable profession contract;
- scheduler and resolver entry points continue resolving a family before use;
- direct application state creation, if still required, delegates to the
  resolved runtime for the supplied specialization; and
- application inspection does not require a full-roster executable registry.

`defineProfessionFamily()` must stop calling `defineProfession(definition)` on
a definition containing aggregate runtime behavior.

#### Compatibility transition

If external consumers still access normalized executable properties directly
on a family:

1. move those consumers to `resolveRuntime(config)`;
2. retain narrow deprecated delegates only where immediate migration is
   impossible; and
3. add tests proving those delegates do not contain sibling behavior.

Do not retain a complete handler or hook union merely because a test currently
inspects it. Update the test to inspect the appropriate runtime.

Acceptance:

- a new family can be declared without aggregate resources, attribute rules,
  cast rules, scheduler hooks, or resolver hooks;
- the application can still render and edit every specialization;
- all simulations execute a resolved runtime;
- direct scheduler and resolver entry points use the same runtime instance;
  and
- inactive elite executable data cannot be reached through the family surface.

### Phase 3: make UI composition module-native

Create one platform-level application family UI composer. It should receive
Core UI, the elite UI map, the complete catalog, and any explicitly
family-owned application callbacks.

#### Specialization selection

The generic dispatcher must:

- select Core for missing or `"Core"` specialization;
- select Core plus the named elite for an elite specialization;
- treat a named non-elite trait line as Core mechanic UI; and
- handle truly unknown names according to the application contract without
  weakening the runtime's explicit unknown-elite error.

#### Callback composition

Define and test one policy per callback category:

| Callback category | Composition policy |
| --- | --- |
| Palette, resource, skill-bar, and threshold lists | Core followed by active elite; validate IDs and deduplicate where the contract requires uniqueness |
| Palette availability | Every active slice may veto; return the first unavailable result |
| Assumption controls | Merge only controls available to the selected runtime, except explicitly global application controls |
| Event-log row | Ask Core then active elite; first `null` or descriptor wins; `undefined` delegates |
| Selection update | Ask active elite before Core when replacement behavior is expected |
| Timeline presentation | Use an explicitly documented precedence rule |
| Single-owner scalar callbacks | Reject multiple active owners unless composition is explicitly defined |

Move elite event descriptors and availability explanations into the owning
elite UI module. Core must not classify elite events.

Migrate remaining specialization branches out of Mesmer and Thief root UI
files. A root UI file may remain as a thin application composer or for
genuinely cross-module presentation.

Acceptance:

- profession family UI dispatchers no longer duplicate the generic algorithm;
- Core UI imports no elite;
- elite UI imports no sibling;
- every active custom event is described or explicitly suppressed by its
  owner; and
- application UI parity tests pass for Core, every core trait line, and every
  elite.

### Phase 4: remove aggregate executable facades

After the family contract and UI composer no longer require them, clean one
profession at a time.

For each profession, inspect:

- root attribute-rule aggregation;
- root cast-rule and scheduler-hook aggregation;
- root skill-handler aggregation;
- root task and resolver-handler aggregation;
- root full-state factories; and
- root UI specialization switches.

Delete an aggregate when:

- no external stable import requires it;
- the family definition no longer consumes it;
- runtime modules already own every contribution;
- its removal loses no catalog or build-editor data; and
- architecture tests prevent its reintroduction.

If a stable import must remain, reduce it to a clearly named application
facade. It must not be consumed by an active runtime.

Retain:

- stable `definition` exports;
- the complete application catalog;
- build codecs and application adapters;
- module-owned mechanics;
- public end-state projection; and
- a root raw-skill composition facade where the full catalog needs it.

Acceptance:

- each `family` file imports modules, catalog, build behavior, application UI,
  and optional simulation refinement only;
- no `family` file imports a full-roster runtime handler or rule registry;
- no active module imports an application facade; and
- source ownership and runtime ownership agree.

### Phase 5: remove flat internal state access

This is the highest-risk phase and should follow facade removal.

#### Desired internal state

Core mechanics should access Core state explicitly. Elite mechanics should
receive:

- shared engine state;
- typed Core state or a narrow Core API; and
- their own typed elite state.

They must not receive a type containing sibling elite fields.

Possible implementation approaches include:

- explicit `state.profession.core` and
  `state.profession.specialization.state` access;
- module-specific context adapters created during hook composition; or
- typed state accessors that validate the active specialization kind.

Choose one repository-wide convention. Do not leave each profession with a
different state access model.

#### Remove compatibility infrastructure

Once every migrated module uses explicit ownership:

- delete `createComposedStateAdapter()`;
- remove proxy-aware clone branches;
- make ordinary structured cloning sufficient;
- remove flat intersection state types; and
- make invalid specialization-state access fail at compile time and, where
  necessary, at runtime.

Public result projection may continue flattening supported fields:

```text
internal state: explicit Core plus active elite
public result: stable allowlisted endState.profession
```

Changing the public result shape requires a separate versioned proposal.

Acceptance:

- migrated runtime code contains no flat profession-state compatibility
  access;
- no state proxy is created;
- state cloning has no family-specific branch;
- inactive sibling fields remain absent;
- snapshots contain only Core and active elite state; and
- all public end-state characterization tests remain unchanged.

### Phase 6: tighten module typing

Replace broad `SchedulerRecord` state parameters where module-local types are
known.

The type system should express:

- the Core state fragment;
- each elite state fragment;
- the active specialization discriminant;
- which Core primitives an elite may access; and
- the context received by module-local hooks and handlers.

Avoid a generic that requires every module to claim ownership of the complete
profession state. A module state factory should return only its fragment.

Add compile-time fixtures proving:

- Core code cannot reference an elite state field;
- an elite cannot reference a sibling state field;
- an elite can use approved Core state or APIs; and
- module state factories cannot return arrays, primitives, or sibling-shaped
  fragments.

Acceptance:

- family and module declarations no longer default to broad state records when
  a concrete fragment type exists; and
- prohibited cross-module state access fails type checking.

### Phase 7: standardize catalog ownership metadata

The full application catalog remains necessary. This phase only removes
repeated profession-specific ownership classification where doing so improves
clarity.

Consider a common ownership manifest that records:

- runtime owner for every skill;
- owner for every trait and specialization;
- profession-wide weaponmaster availability;
- extra skills and handler IDs; and
- Core-owned weapon families.

The platform or a shared profession helper may then derive:

- Core and elite catalog fragments;
- the complete application catalog;
- no-loss/no-duplicate assertions; and
- ownership diagnostics.

Do not force catalog inversion when generated API metadata is naturally built
as one inert dataset. Runtime ownership matters; the physical origin of inert
identity metadata is secondary.

Acceptance:

- every catalog entity has exactly one runtime owner;
- fragment unions equal the complete application catalog;
- weaponmaster skills remain available in every intended runtime; and
- no module imports a sibling or a complete executable facade.

### Phase 8: consolidate family conformance tests

Create a parameterized family test harness used by all six migrated
professions.

It should verify for Core and every elite:

- cached runtime resolution;
- catalog ownership and complete family catalog union;
- inactive state exclusion;
- inactive skill, task, and event handler exclusion;
- inactive resolver reaction exclusion;
- inactive modifier declaration exclusion;
- active UI contribution inclusion;
- sibling UI contribution exclusion;
- public projection compatibility;
- unknown-specialization failure; and
- duplicate-owner validation.

Keep profession-specific tests for actual mechanics, timing, damage, UI
content, and build behavior.

Replace migration-era source tests with generic architecture rules where
possible. Keep source-boundary checks that prevent:

- Core-to-elite imports;
- sibling imports;
- runtime-to-application-facade imports;
- root ownership of individual elite mechanics; and
- reintroduction of obsolete mixed directories.

Acceptance:

- adding a new family or elite requires registering one conformance fixture,
  not copying a large test block; and
- removing an isolation assertion from one profession cannot silently weaken
  the others.

### Phase 9: finalize documentation

After code cleanup:

- update `docs/ARCHITECTURE.md`;
- update `docs/MODULES.md`;
- mark the specialization migration specification complete or archive its
  procedural sections;
- document the final family and module contracts;
- document the internal and public state distinction;
- document UI callback composition;
- document source discovery; and
- retain the Elementalist exception and its reason.

Acceptance:

- documented paths exist;
- examples use the final contract;
- no documentation calls a migrated profession legacy; and
- no removed compatibility layer is presented as current architecture.

## Recommended change sequence

Use separate, reviewable changes:

1. Build-source and documentation-path hygiene.
2. Parameterized family conformance harness.
3. Family/application contract split.
4. Generic application UI composition.
5. Aggregate facade removal, one profession at a time.
6. Explicit internal state access, one profession at a time.
7. Module state type tightening.
8. Optional catalog ownership standardization.
9. Final architecture documentation.

Do not combine the family contract split and state-proxy removal in one
change. Both affect most professions and have different failure modes.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Family callers depend on executable properties directly | Inventory consumers first; move simulation callers to `resolveRuntime`; retain narrow temporary delegates only when required |
| Hook order changes while removing aggregates | Preserve IDs and order values; compare scheduled and resolved event streams |
| Modifier rules compile more than once | Keep one active compiler owner and test complete contribution lists |
| Core trait-line UI is mistaken for an elite | Resolve elite status from catalog metadata, not from any non-Core string |
| Event-log events fall through to diagnostics | Make event-row composition explicit and test every active custom handler type |
| State ownership changes alter snapshots | Characterize internal snapshots and public projections separately |
| Public end state loses inactive compatibility fields | Keep allowlisted projection stable; treat public shape changes as a separate versioned proposal |
| Thief's JavaScript sources are missed by TypeScript-oriented tooling | Keep source discovery and architecture checks extension-aware |
| Stale files compile through incidental imports only | Add orphan-source and compiled-output checks |
| Cross-cutting changes collide with Elementalist | Exclude its directories and preserve normalized legacy-contract support |

## Validation

Run after every phase:

```powershell
npm run build
npm run check
node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none tests/professions/profession-family.test.js
node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none tests/platform/platform-architecture.test.js
git diff --check
```

For a profession-specific facade or state cleanup, also run that profession's
behavior test file.

Before completing the overall cleanup:

```powershell
npm test
```

Benchmark manifests and expected rotation results must not be changed merely
to make architectural cleanup pass.

## Definition of done

The post-migration cleanup is complete when:

- all six shared native professions declare families without aggregate
  executable compatibility definitions;
- the family surface contains application responsibilities and a runtime
  resolver;
- simulations execute only resolved Core-plus-active-elite contracts;
- generic application UI composition replaces repeated family dispatchers;
- event-log and availability ownership live in Core or the owning elite;
- aggregate runtime facades with no stable consumer are removed;
- internal state uses explicit Core and active-elite access without a proxy;
- module-local state types prevent sibling access;
- the full application catalog remains complete;
- source discovery contains no stale paths and detects orphan sources;
- family conformance coverage is shared and parameterized;
- public builds, UI behavior, simulation results, and end-state projection are
  unchanged;
- architecture documentation describes the final model;
- the full build, check, and test suite pass; and
- Elementalist remains explicitly outside this work.

## Implementation status (2026-08-07)

The architectural work is implemented for Engineer, Guardian, Mesmer,
Necromancer, Revenant, and Thief:

- family definitions are application-only contracts with strict runtime
  resolution;
- generic application UI composition replaces family dispatchers;
- root resolver, state, UI, and mechanic-contract runtime facades are removed;
- runtime state is an ordinary nested Core-plus-active-specialization object;
- mechanics use owner-defined specialization state accessors and no flat proxy
  remains;
- specialization modules register their owner-bound state factory, and
  compile-time fixtures reject Core-to-elite access, sibling access, arrays,
  and primitives;
- family conformance is parameterized;
- TypeScript source discovery uses `js/**/*.ts`; and
- the final architecture is documented in `ARCHITECTURE.md`, `MODULES.md`, and
  `SPECIALIZATION-MODULE-MIGRATION.md`.

Current cleanup gates:

```text
npm run check
tests/professions/profession-family.test.js: 27/27
tests/platform/platform-architecture.test.js: 64/64
state-boundary compile-time fixtures through npm run typecheck
npm test: 882/882
```

The former benchmark, oracle, attribute-provenance, import-boundary, and trait
evidence failure inventory no longer describes the current tree and has been
removed. Optional Phase 7 catalog standardization was intentionally not
performed because it is not required for runtime isolation.
