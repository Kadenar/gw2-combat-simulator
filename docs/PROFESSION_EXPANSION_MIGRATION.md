# Native profession expansion migration

## Purpose

Prepare the Mesmer/Guardian/Necromancer architecture for additional native
professions without copying the remaining persistence, registration, data
generation, resolver-state, and presentation debt.

The combat kernel does not need a rewrite. The migration should preserve the
existing scheduler, canonical catalog, GW2 policy, resolver, modifier system,
attribute pipeline, and result schema.

After the required phases below, a new profession should be addable by
supplying profession-owned data, mechanics, state, rules, UI views, build
defaults, and one registry entry. It should not require branches in
`platform/engine`, `platform/gw2`, or the shared application shell.

## Current state

Mesmer, Guardian, and Necromancer already share:

- `defineProfession()` and its ordered hook contract
- `createCanonicalCatalog()` and the canonical millisecond timing schema
- the platform scheduler and typed task queue
- the GW2 scheduler policy and event factory
- the shared GW2 resolver and modifier-rule compiler
- shared attribute assembly and build finalization
- `createProfessionRuntime()` and `createGw2AppAdapter()`
- canonical rotation commands and result state

The current suite passes 416 tests, and the static check validates 262
JavaScript files. A profession-neutral test fixture also runs end to end
without importing Mesmer.

The remaining differences are primarily extension-surface debt:

| Area | Current difference | Risk when adding professions |
| --- | --- | --- |
| Build persistence | Three large, partly duplicated codecs with different validation behavior | Every profession copies hundreds of lines and schema behavior drifts |
| Resolver state | Mesmer starts minimal state, Guardian starts from the scheduler's final snapshot, and Necromancer starts fresh and replays state events | Time-varying mechanics can accidentally read future state |
| Resolver context | Runtime exposes both root fields and a legacy-compatible `state` alias | New code can depend on the wrong callback shape |
| Registration | Options, routes, loaders, HTML, landing cards, and CSS are separately maintained | A profession requires scattered edits and can be partially registered |
| Module loading | `composition.js` eagerly imports Mesmer as the default | Every native profession page loads Mesmer unnecessarily |
| API snapshots | Guardian and Necromancer use near-duplicate generators; Mesmer has no equivalent command | Another generator will copy filtering and alias inconsistencies |
| Skill routing | Mesmer still has a large name-driven scheduling contract; Guardian and Necromancer use stable-ID handlers | There are two conflicting implementation patterns |
| Event presentation | Shared UI hardcodes Mesmer phantasm/instrument event types | New custom events require more shared UI branches |
| Conformance tests | Several shared checks manually enumerate professions | A new profession can be omitted from architectural checks |

## Scope

### Required before profession implementation is scaled

1. Extract a shared native GW2 build codec.
2. make resolver state initialization and callback context explicit.
3. replace split registration with one lazy profession manifest.
4. parameterize the API snapshot generator.
5. add registry-driven profession conformance tests.

### Follow-up work that must not block the next profession

1. Migrate Mesmer's remaining name-based skill dispatch to stable IDs.
2. move profession event-log formatting behind the UI contract.
3. migrate Elementalist from its reference engine if and when that work is
   independently justified.

## Non-goals

- Do not rewrite the scheduler or resolver.
- Do not merge profession-owned state machines into the platform.
- Do not move profession predicates or mechanics into shared GW2 modules
  merely because their file shapes are similar.
- Do not make Elementalist migration a prerequisite for another native
  profession.
- Do not change coefficients, timings, trait behavior, or supported skills as
  incidental cleanup.
- Do not change existing local-storage keys or exported build schema without
  explicit migrations.
- Do not introduce name-based runtime behavior in new code.

## Migration principles

1. Preserve behavior before improving structure. Add characterization tests
   before changing state handoff or build migration behavior.
2. Stable IDs drive simulation. Display names are allowed only at UI,
   import/export, and legacy rotation migration boundaries.
3. Resolver state must be chronological. It must never begin with
   end-of-rotation values that are visible to earlier events.
4. Shared modules own generic workflow; professions own predicates, resources,
   mechanics, and exceptional transformations.
5. Keep each phase independently reviewable. Do not combine this migration
   with implementation of a new profession.
6. Preserve unrelated and in-progress work. Inspect `git status` before every
   phase and do not reset or mass-format files outside that phase.

## Phase 0: lock down behavior

Before structural changes:

1. Run:

   ```powershell
   npm test
   npm run check
   ```

2. Add regression fixtures for any behavior touched by the phase.
3. Record existing build migration inputs and outputs for all three native
   professions.
4. Add chronological resolver-state tests for:
   - a profession state change between two damage events;
   - an initial configured resource;
   - a scheduler-emitted state transition;
   - resolver-owned counters that must not be overwritten by later scheduler
     state events;
   - end-state projection.

The initial migration PR must be behavior-preserving unless a failing
characterization test demonstrates an existing time-travel bug.

## Phase 1: shared native build codec

### Target

Add a shared factory such as:

```text
js/platform/gw2/build-codec.js
```

The exact name may change, but it belongs in `platform/gw2` because it
normalizes the common GW2 build schema and may depend on shared gear, weapon,
sigil, relic, and rotation modules. It must not import a profession.

Suggested interface:

```js
createGw2BuildCodec({
  professionId,
  schemaVersion,
  catalog,
  createDefaults,
  migrations,
  normalizeExtra,
  validateExtra,
  legacyGearAliases,
})
```

The result should provide:

```js
{
  migrateBuild,
  validateBuild,
  toApplicationBuild,
}
```

### Common responsibilities

Move the following behavior out of profession build modules:

- candidate shape and profession-ID validation
- unsupported/future schema rejection
- explicit ordered schema migrations
- gear-slot merging and prefix validation
- legacy gear-prefix aliases
- main-hand/off-hand/two-handed weapon normalization
- weapon-set sigil normalization
- relic validation
- infusion validation and clamping
- specialization existence, trait-selection format, uniqueness, count, and
  maximum-one-elite validation
- healing/utility/elite skill-slot normalization
- exclusion of flip children and simulator-excluded skills
- starting weapon set normalization
- target health and armor normalization
- canonical rotation normalization by stable skill ID
- conversion back to the application's compatibility rotation shape
- removal of obsolete fields such as global `sigils` and
  `selectedSkillIds`

### Profession-owned responsibilities

Keep these in profession configuration or hooks:

- default gear, weapons, traits, skills, consumables, and assumptions
- Mesmer's historical version migrations and storage compatibility
- Guardian's `initialTomePages`
- Necromancer's `initialResource` and `initialBlight`
- future profession-specific resource fields
- additional validation that is genuinely profession-specific

### Required behavior decisions

Normalize these differences instead of preserving accidental divergence:

1. All professions reject a schema version newer than the supported version.
2. All professions validate weapon handedness against the profession catalog,
   not only the global weapon table.
3. All professions require exactly three unique specialization lines and at
   most one elite specialization.
4. All canonical rotation casts must reference a known catalog skill.
5. All selected slot skills must be implemented, selectable, have the correct
   slot type, and not be a flip child.
6. Invalid input is sanitized only where the existing import contract expects
   sanitization; wrong-profession and future-version builds remain errors.

### Compatibility requirements

- Keep `schemaVersion: 3` until a real schema change requires version 4.
- Keep the Mesmer storage key `gw2-mesmer-simulator-v2`.
- Keep Guardian and Necromancer storage keys unchanged.
- Keep exported build and rotation file shapes unchanged.
- Preserve every existing migration fixture.

### Tests

Add a shared codec test matrix covering:

- null and malformed input
- wrong profession
- versions 0 through 3
- a future version
- legacy global sigils
- invalid and two-handed weapon pairs
- duplicate or multiple elite specializations
- invalid selected skill types and flip children
- unknown rotation skill IDs
- invalid relics and gear prefixes
- extra profession resource fields
- build-to-application rotation conversion

Then run every existing Mesmer, Guardian, Necromancer, attribute, app-state,
and import/export test.

## Phase 2: explicit chronological resolver state

This phase is correctness-sensitive and must be a separate change.

### Target callback shapes

Use one documented state path per phase:

- scheduler hooks and skill handlers:
  `context.state.profession`
- resolver event handlers and reactions:
  `context.profession`
- runtime modifier rules:
  `context.runtime.profession`

Do not expose a synthetic resolver `context.state` merely to retain an
undocumented compatibility shape. Migrate production resolver callbacks and
tests, then remove `reactionContext()` and the runtime `state` alias from
`js/platform/gw2/declarative-simulation.js`.

If maintaining one identical path across scheduler and resolver is preferred,
make that path a real documented contract rather than a compatibility object.
Do not retain two equally valid public paths.

### Target state initialization rule

The resolver must start from time-zero state, never the scheduler's final
profession snapshot.

Use:

```js
resources: {
  createProfessionState, // scheduler time-zero state
  createResolverState,   // resolver time-zero state
  projectEndState,
}
```

`createResolverState(config)` must not require the completed scheduler result.
It may return:

- a minimal resolver-only state when scheduler-dependent effects have already
  been materialized as events; or
- a complete time-zero profession state when resolver modifiers read that
  state.

The scheduler snapshot remains useful for diagnostics and public projection,
but it must not seed earlier resolver events.

### Profession migrations

#### Mesmer

Mesmer already starts with minimal resolver state. Preserve that model.
Continue materializing scheduler-visible clone, blade, expected-proc, and
Continuum effects as canonical events or typed tasks.

#### Necromancer

Necromancer already starts from a fresh full state and replays
`necromancer.state` events. Preserve the chronological replay model.

Refine it so state events carry only the state needed at resolution when
practical. Do not let a scheduler snapshot overwrite resolver-owned progress
such as internal cooldowns or expected-proc counters.

#### Guardian

Guardian currently clones the scheduler's ending snapshot and resets selected
fields. Replace this with time-zero resolver state.

Make Guardian events perform the required chronological transitions:

- virtue activation and refresh
- tome equip/stow and page spending
- Ashes charges and trigger time
- Radiant Forge enter/exit
- any resolver-visible timed trait state

The existing no-op Guardian state-event handlers should either apply a real
transition or be removed if no resolver behavior needs the event.

### End-state projection

Clarify `projectEndState` so a profession does not have to guess which phase
owns the public value.

A recommended signature is:

```js
projectEndState({
  config,
  schedulerContext,
  schedulerState,
  resolverState,
})
```

The shared result still owns:

- time
- cooldowns
- ammo
- active weapon set

The profession projection owns only `endState.profession`.

### Tests

Add tests proving:

1. a state change at `t=5` cannot affect damage at `t=1`;
2. a state change affects damage after `t=5`;
3. same-timestamp state and damage events follow explicit priority/order;
4. initial Blight, tome pages, and Mesmer resources are correct at `t=0`;
5. Guardian Ashes cannot trigger before it is applied;
6. resolver-only counters survive later profession state events;
7. public end state contains no resolver-only implementation bookkeeping.

## Phase 3: one lazy profession manifest

### Target

Create one application-owned registry, for example:

```text
js/app/profession-registry.js
```

Each entry should contain enough metadata for routing, application bootstrap,
the selector, and the landing page:

```js
{
  id,
  name,
  route,
  themeClass,
  specializationSummary,
  loadProfession,
  loadAppAdapter, // null for a standalone legacy application
}
```

Loader functions must use explicit dynamic imports so paths remain statically
discoverable.

### Required changes

1. Replace the separate maps in `composition.js` and
   `profession-selector.js` with registry lookups.
2. Remove the eager Mesmer imports and `activeProfession*` defaults from
   `composition.js`.
3. Make the active adapter explicit during application bootstrap.
4. Add `data-profession="mesmer"` to the Mesmer page so it no longer relies
   on a default adapter.
5. Update `app-state.js` helpers to require an adapter instead of importing a
   Mesmer default.
6. Populate profession selectors from the registry.
7. Populate landing-page profession cards from registry metadata, or generate
   them through one shared renderer.
8. Apply the theme class from registry metadata.
9. Preserve Elementalist as a standalone route with no native app adapter
   until it is migrated.

### Acceptance criteria

- Loading Guardian or Necromancer does not import Mesmer modules.
- A registry entry cannot have a selector option without a route.
- Native entries require both a profession loader and app-adapter loader.
- Unknown profession IDs fail clearly instead of silently opening Mesmer.
- Existing routes and browser-local storage remain unchanged.
- Adding a native profession requires one registry entry, one page or generic
  page route, and profession-owned files.

### Tests

Drive selector, route, composition, and adapter tests from the registry rather
than hardcoded arrays. Add a test that inspects the Guardian and Necromancer
module graph or composition source to prevent a new eager Mesmer dependency.

## Phase 4: parameterized API snapshot generator

### Target

Extract the shared fetch, traversal, filtering, and serialization logic from:

```text
scripts/update-guardian-api-data.mjs
scripts/update-necromancer-api-data.mjs
```

Suggested structure:

```text
scripts/
  lib/
    gw2-profession-snapshot.mjs
  update-profession-api-data.mjs
```

Suggested command:

```powershell
node scripts/update-profession-api-data.mjs --profession Guardian
```

Keep the existing npm commands as compatibility wrappers and add a Mesmer
refresh command.

### Common generator behavior

- always request English data explicitly
- fetch profession, specialization, trait, and skill metadata
- associate elite training skills with their specialization
- associate weapon skills with weapons and elite specializations
- walk `next_chain` and `flip_skill` references
- apply one canonical terrestrial/downed/spear filter
- retain flags needed by profession-specific filtering
- normalize recharge, count recharge, ammo, chain, and flip fields
- normalize same-name API aliases deterministically
- sort all emitted collections deterministically
- write presentation and identity metadata only

### Extension hooks

The generator may accept small per-profession configuration for:

- explicit excluded IDs
- canonical same-name alias IDs
- mode aliases
- weapon exclusions
- exceptional API defects

API-omitted skills remain in profession-owned supplemental files. Generated
metadata must never overwrite supplements or
`mechanics/skill-mechanics.js`.

### Tests

Move transformation logic into pure functions and test it with checked-in API
fixtures. Network access must not be required for the normal test suite.

Test:

- linked chains and flips
- underwater/downed filtering
- land spear handling
- elite specialization assignment
- duplicate-name aliases
- deterministic output ordering
- output exclusion of coefficients and damaging-condition facts

## Phase 5: registry-driven profession conformance

Add a reusable conformance suite for every native registry entry.

At minimum, verify:

### Definition and catalog

- stable lowercase profession ID
- matching registry and definition IDs
- canonical catalog lookups
- unique skill IDs
- all selectable skills are implemented
- all handler IDs resolve to functions
- custom event types and task types are profession-namespaced
- no profession registers a platform-owned event handler
- canonical timing fields only
- valid weapon-hand metadata
- valid trait and specialization metadata

### Build contract

- defaults migrate and validate
- build profession matches the definition
- schema round-trip is stable
- rotations normalize to stable IDs
- wrong-profession and future-version builds fail

### Runtime and resolver

- an empty or simple rotation runs through `simulateGw2()`
- end state has the canonical shared fields
- profession state appears only under `endState.profession`
- warnings and unknown custom events fail predictably

### UI and application

- palette groups return arrays with unique IDs
- resource views return validated arrays
- every palette skill ID exists in the catalog
- adapter IDs match profession IDs
- storage keys and filenames are unique
- a route exists

Update `tests/platform-architecture.test.js` so new native professions are
discovered from the registry rather than appended manually to several arrays.

## Phase 6: migrate Mesmer to stable-ID skill handlers

This can proceed incrementally after the required migration phases.

### Target

Mesmer should register complex cast behavior through
`catalog.skillHandlers`, matching Guardian and Necromancer.

`scheduleSkill` should remain only for cross-cutting lifecycle behavior that
cannot be attached to a specific skill handler.

### Work

1. Add handler IDs to the relevant entries in
   `mesmer/mechanics/skill-mechanics.js`.
2. Build a `mesmerSkillHandlers` registry keyed by handler ID.
3. Replace `skill.name === ...` branches with stable skill IDs or explicit
   mechanic metadata.
4. Replace name-keyed shatter, instrument, control, blind, and flip decisions
   with ID-keyed maps or mechanic fields.
5. Replace `skillsByName` runtime lookups with `skillsById` where the lookup
   affects simulation.
6. Split feature-specific lifecycle work out of the large Mesmer contract
   only where doing so improves ownership; file size alone is not a reason to
   create abstractions.
7. Retain name lookup only for display and legacy import boundaries.

### Safety

Run the Mesmer oracle matrix after each handler family is migrated. Do not
combine coefficient or timing corrections with this structural work.

## Phase 7: profession-owned custom event presentation

Add an optional UI hook such as:

```js
ui.eventLogRow(context, event)
```

It should return either `null` or a presentation descriptor:

```js
{
  type,
  description,
  className,
  order,
  flags,
}
```

The shared renderer should:

1. format all common platform events itself;
2. delegate unknown namespaced events to the profession hook;
3. ignore unpresented state-only events;
4. preserve stable event ordering.

Move Mesmer phantasm and instrument formatting out of
`js/app/rotation-ui.js` and into `mesmer/ui.js`.

Do not place HTML strings in simulation events. Events remain simulation data;
the UI hook owns presentation and escaping.

## Elementalist boundary

Elementalist remains a direct reference-engine port behind a
`defineProfession()` adapter. It does not use the native canonical catalog,
scheduler, resolver, attribute hooks, or shared application adapter.

During this migration:

- keep it registered as a standalone route;
- do not include it in native profession conformance tests;
- do include it in route/selector existence tests;
- do not introduce new Elementalist dependencies into native platform code;
- do not copy Elementalist architecture into another profession.

A future Elementalist migration should be its own design and implementation
effort.

## Recommended change sequence

Keep these as separate, reviewable changes:

1. **Build codec and migration matrix**
2. **Resolver context and chronological state handoff**
3. **Lazy profession registry and generated selectors**
4. **Shared API snapshot generator**
5. **Registry-driven conformance tests**
6. **First additional native profession**
7. **Incremental Mesmer stable-ID migration**
8. **Custom event presentation hook**

API research and mechanics data collection for the next profession can happen
in parallel with steps 1 through 5. Its application and persisted build layer
should wait for those steps so it uses the final extension surface.

## Definition of done

The required migration is complete when:

- all current tests and static checks pass;
- existing builds and storage keys still load;
- Mesmer, Guardian, and Necromancer results remain within their existing exact
  regression expectations;
- resolver callbacks have one documented state path;
- no resolver starts from a scheduler end-state snapshot;
- all native professions use the shared build codec;
- all profession metadata refreshes use one generator;
- one registry drives options, routes, loaders, and adapters;
- non-Mesmer pages do not load Mesmer modules;
- native profession conformance is registry-driven;
- the documented process for adding another profession requires no changes to
  the scheduler, resolver, shared GW2 rules, or shared UI for ordinary
  mechanics.

## Final verification

Run:

```powershell
npm test
npm run check
```

Also perform browser smoke tests for:

- `mesmer.html`
- `guardian.html`
- `necromancer.html`
- `elementalist.html`
- the landing-page selector
- build import/export
- rotation import/export
- modifier-contribution workers
- direct loading and switching between every profession route

