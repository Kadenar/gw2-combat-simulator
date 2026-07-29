# Mesmer native-architecture migration

Status: **Implemented**

Design basis: repository state at commit `46026d3` on July 28, 2026. Re-run
the baseline audit if the implementation branch has moved materially.

## 1. Purpose

Migrate Mesmer's internal design and simulation implementation to the same
native-profession architecture used by Guardian, Necromancer, Engineer,
Revenant, and Thief.

This is an internal, behavior-preserving migration. Mesmer already uses the
shared application shell, profession contract, build codec, scheduler,
resolver, modifier system, and result model. The migration must replace its
remaining profession-owned all-skills scheduler with:

- shared declarative effect scheduling for ordinary skills;
- stable-ID catalog handlers for exceptional skills;
- profession hooks for genuinely cross-cutting lifecycle behavior;
- namespaced typed tasks for chronological future state changes;
- stable IDs for every runtime decision.

The migration must not change coefficients, timings, supported builds, public
results, persisted builds, or UI behavior unless a separately documented bug
is proven by a focused regression test.

## 2. Executive decision

Do not rewrite Mesmer or change the platform engine.

Keep these existing boundaries:

- `js/professions/mesmer/definition.js`
- `js/professions/mesmer/app/app-definition.js`
- `js/professions/mesmer/build.js`
- `js/professions/mesmer/build-attributes.js`
- `js/professions/mesmer/attribute-rules.js`
- `js/professions/mesmer/state.js`
- `js/professions/mesmer/resolver/event-handlers.js`
- the shared `simulateGw2()` pipeline

Refactor the implementation behind:

- `js/professions/mesmer/catalog.js`
- `js/professions/mesmer/mechanics/contract.js`
- `js/professions/mesmer/mechanics/skill-mechanics.js`
- `js/professions/mesmer/mechanics/runtime.js`
- `js/professions/mesmer/mechanics/specific/*`
- `js/professions/mesmer/ui.js`
- the Mesmer test organization and migration oracle

The final dispatch model is:

```text
normalized rotation command with skillId
                 |
                 v
       shared platform scheduler
                 |
        +--------+---------+
        |                  |
        v                  v
declarative effects   catalog handler
for ordinary skills   for exceptional behavior
        |                  |
        +--------+---------+
                 |
                 v
 namespaced tasks / canonical events
                 |
                 v
         shared GW2 resolver
                 |
                 v
 canonical result and endState.profession
```

## 3. Current-state audit

At the design baseline:

- Mesmer has 137 canonical catalog skills.
- No Mesmer skill has a registered catalog handler.
- `mesmerCatalog.skillHandlers.size` is zero.
- `scheduleMesmerSkill()` returns `true` for every Mesmer cast.
- The shared scheduler therefore does not materialize Mesmer's declarative
  effects.
- `specific/skill-effects.js` reimplements strike, condition, pulse, packet,
  phantasm, and resource scheduling for the complete profession.
- Simulation decisions still depend on `skill.name`, name-keyed shatter and
  instrument tables, name-keyed flip parents, and textual resource reasons.
- Per-simulation controllers are stored in a module-level `WeakMap`.
- Mesmer's UI adapter does not expose contextual palette-availability hooks.
- `tests/mesmer-oracle.test.js` computes both `expected` and `actual` by
  calling the same current implementation. It proves determinism, not migration
  parity.

By comparison, the other native professions register explicit handler
strategies and allow the shared scheduler to own unconditional declarative
effects.

### 3.1 Already aligned

Do not churn code that is already aligned:

- The registry identifies Mesmer as a native profession.
- The page uses the shared `js/app/app.js` shell.
- `defineProfession()` owns the engine-facing contract.
- `defineProfessionApp()` owns browser composition.
- `createGw2BuildCodec()` owns common persisted-build normalization.
- `simulateGw2()` owns scheduling, resolution, and result construction.
- Resolver-only Mesmer state starts chronologically rather than from a final
  scheduler snapshot.
- Custom events and tasks are Mesmer-namespaced.
- Public profession state is projected under `endState.profession`.

## 4. Goals

1. Let the shared scheduler emit every unconditional Mesmer effect that fits
   the canonical effect schema.
2. Register every exceptional cast through a stable `handlerId` and an
   explicit augment or replace strategy.
3. Remove display-name-driven behavior from the simulation runtime.
4. Remove the module-level runtime `WeakMap`.
5. Preserve exact event chronology, interruption behavior, resources,
   cooldowns, ammo, actor ownership, damage, and public end state.
6. Make UI availability use the same pure predicates as scheduler
   availability.
7. Give Mesmer the same supplemental-data, trait-coverage, documentation, and
   profession-test organization used by newer native professions.
8. Remove Mesmer-specific exemptions from architectural conformance tests.

## 5. Non-goals

- Do not redesign the shared scheduler, resolver, or handler contract.
- Do not migrate Elementalist.
- Do not change game-balance facts, coefficients, durations, packet timing,
  cooldowns, or trait behavior.
- Do not add new Mesmer feature coverage during the structural migration.
- Do not move clone, phantasm, Mirage, instrument, or Continuum mechanics into
  `platform/`.
- Do not change the build schema version.
- Do not change the `gw2-mesmer-simulator-v2` storage key.
- Do not remove support for legacy display-name rotations without an explicit
  boundary migration.
- Do not mass-format unrelated files.

## 6. Required invariants

Every implementation phase must preserve the following:

### 6.1 Timing and ordering

- Cast start, full cast end, interrupted end, recharge anchor, effect anchor,
  and fixed/cast-scaled timing remain unchanged.
- Same-timestamp ordering remains deterministic.
- Core cast completion commits cooldown and ammo before Mesmer completion
  work that reads or modifies them.
- Events after an interrupted cast are removed unless the canonical effect
  explicitly persists or the current Mesmer rule clamps a condition to the
  interrupt boundary.
- Concurrent casts cannot observe resources or flips before their actual
  availability timestamp.

### 6.2 State

- Engine state owns time, cooldowns, ammo, skill uses, active weapon set,
  pending events, and `state.profession`.
- Mesmer resource and mechanic state remains under `state.profession`.
- Resolver state remains chronological and minimal.
- Public result state contains no controller objects, maps requiring custom
  serialization, or resolver-only counters.

### 6.3 Identity

- Runtime behavior uses numeric skill and trait IDs.
- Names are presentation labels only.
- Legacy name lookup is allowed only in import, migration, UI selection, and
  compatibility test boundaries.
- Custom task and event types begin with `mesmer.`.

### 6.4 Ownership

- Direct unconditional effects belong in `skill-mechanics.js`.
- Runtime-dependent skill behavior belongs in catalog handlers.
- Cross-cutting cast lifecycle behavior belongs in profession hooks.
- Future state changes belong in typed tasks.
- Resolver reactions handle reactions to resolved standard events; they do not
  replace standard GW2 event handlers.

## 7. Target module layout

```text
js/professions/mesmer/
  app/
    app-definition.js
  data/
    ids.js
    mesmer-api-metadata.js
    mesmer-supplemental-skills.js   # new
    trait-coverage.js               # new
    traits-data.js
  mechanics/
    availability.js
    contract.js
    handler-mechanics.js            # new when pure handler tables are needed
    skill-mechanics.js
    specific/
      handlers.js                   # new catalog-facing registry
      actions.js                    # optional extraction from profession-actions
      continuum.js
      expected-procs.js
      flips.js                      # optional pure flip state helpers
      illusions.js
      mirage.js
      phantasms.js                  # optional extraction from skill-effects
      profession-actions.js
      resources.js
      shatters.js                   # optional extraction from profession-actions
      trait-rules.js
  resolver/
    event-handlers.js
  attribute-rules.js
  build-attributes.js
  build.js
  catalog.js
  definition.js
  state.js
  ui.js
```

The optional feature files should be created only when they produce clear
ownership boundaries. File size alone is not justification for an abstraction.

Delete `mechanics/runtime.js` after all consumers accept explicit context or
explicit dependencies.

## 8. Catalog and data design

### 8.1 Generated metadata

`data/mesmer-api-metadata.js` remains generated identity and presentation data.
It must not become authoritative for:

- coefficients;
- damaging conditions;
- exact packet timing;
- profession resource behavior;
- handler selection.

### 8.2 Supplemental skills

Create `data/mesmer-supplemental-skills.js` for positive-ID terrestrial skills
omitted or inadequately represented by the API snapshot.

Move identity fields for API-omitted ambushes and flip children out of
`MESMER_EXTRA_SKILLS`, including as applicable:

- name;
- description;
- icon;
- type;
- slot;
- weapon;
- specialization;
- environment;
- API relationship metadata.

Keep simulation facts for those IDs in `MESMER_SKILL_MECHANICS`.

Simulator-only negative-ID actions such as weapon swap, Mirage dodge, and
Continuum Shift may remain explicit extra skills, following the native
profession convention for synthetic actions.

### 8.3 Stable mechanic metadata

Replace name-keyed runtime tables with ID-keyed facts or explicit skill fields.
Examples:

```js
{
  [ID.MIND_WRACK]: {
    handlerId: "mesmer.shatter",
    mesmerMechanic: {
      kind: "shatter",
      resourceKind: "clone",
      slot: 1,
    },
    effects: [],
  },
}
```

The exact `mesmerMechanic` shape remains profession-owned. Do not widen the
shared catalog schema for Mesmer-only facts.

Use stable IDs for:

- shatter and bladesong classification;
- instrument slots;
- control and blind behavior;
- Peitha and Aristocracy triggers;
- Clarity producers and consumers;
- phantasm identities and timing lookup;
- flip parent/child relationships;
- signet reset exclusions;
- special recharge and ammo rules;
- resource gain causes that affect behavior.

Textual `reason`, `sourceSkill`, and `detail` fields may still be emitted for
display, but must not be read back to decide mechanics.

### 8.4 Duplicate display names

Mesmer currently has duplicate-name skill families:

- Axes of Symmetry
- Lingering Thoughts
- Bladecall
- Lively Lute
- Harmonious Harp

Internal rotations and mechanics must use IDs. Replace accidental
`skillNameCollision: "last"` behavior with an explicit legacy-name resolver at
the application/build migration boundary.

The resolver must use specialization and canonical alias metadata to select an
ID. Add positive and negative tests for every duplicate family. Do not silently
pick whichever record was inserted last.

## 9. Handler design

### 9.1 Registry

Create `mechanics/specific/handlers.js`:

```js
import {
  augmentSkillHandler,
  replaceSkillHandler,
  skillHandler,
  SKILL_HANDLER_MODES,
} from "../../../../platform/engine/skill-handlers.js";

export const mesmerSkillHandlers = Object.freeze({
  "mesmer.weapon-swap": replaceSkillHandler(handleWeaponSwap),
  "mesmer.mirage-dodge": replaceSkillHandler(handleMirageDodge),
  "mesmer.shatter": replaceSkillHandler(handleShatter),
  "mesmer.phantasm": replaceSkillHandler(handlePhantasm),
});
```

Register it in `catalog.js`:

```js
createCanonicalCatalog({
  generated,
  mechanics,
  extraSkills,
  skillHandlers: mesmerSkillHandlers,
  // ...
});
```

### 9.2 Strategy rules

Use `augment` when the canonical `effects` array remains authoritative and the
handler only:

- prepares cast-local state;
- observes emitted effects;
- adds a dependent event;
- adds completion work without replacing the base profile.

Use `replace` when the handler owns the complete emitted profile. Replacing
skills must declare `effects: []`.

Use dynamic `resolveMode` only when the same skill legitimately alternates
between a declarative and replaced profile based on runtime state. Do not use
dynamic mode as a shortcut for incomplete migration.

### 9.3 Candidate handler families

| Handler ID | Likely strategy | Responsibility |
| --- | --- | --- |
| `mesmer.weapon-swap` | replace | Toggle set and emit canonical weapon-set event |
| `mesmer.mirage-dodge` | replace | Spend endurance/ammo semantics and grant cloak |
| `mesmer.continuum-shift` | replace | Restore the active Continuum snapshot |
| `mesmer.shatter` | replace | Resource-scaled core/Chronomancer shatters |
| `mesmer.bladesong` | replace | Blade reservation, packets, and cast-end spend |
| `mesmer.instrument` | replace | Note/instrument state and resource scaling |
| `mesmer.crescendo` | replace | Instrument-dependent elite profile |
| `mesmer.phantasm` | replace | Summon, attack packets, conversion, repeat |
| `mesmer.ambush` | replace | Player and clone ambush behavior |
| `mesmer.resource-skill` | augment | Clone/blade/note generation around base effects |
| `mesmer.flip` | augment or replace | Parent/child availability and parent cooldown changes |
| `mesmer.clarity` | augment | Produce or consume Clarity and alter dependent behavior |
| `mesmer.signet-reset` | augment | Reset eligible cooldown/ammo after commitment |
| `mesmer.tracked-hits` | augment | Flying Cutter/Cutter Burst-style thresholds |

The implementing agent must classify skills by mechanics, not assign a unique
handler to every skill.

### 9.4 Completion-time work

Shared handler phases run while the cast is being scheduled. They must not
publish future state early.

When a mechanic must run only after cooldown/ammo commitment:

1. schedule a Mesmer-namespaced task for `effectiveEnd`;
2. give it a priority later than core cast completion (`-100`);
3. perform the state mutation in the task handler;
4. retain the current interruption guard.

Alternatively, a genuinely cross-cutting completion rule may remain in
`onCastComplete`, provided it dispatches by stable ID or mechanic metadata and
does not rematerialize ordinary effects.

Do not add a new shared handler phase unless the existing handler/task model is
proven insufficient by a focused test.

## 10. Incremental compatibility bridge

The migration must remain runnable after every handler family.

Introduce an explicit transitional set:

```js
const LEGACY_MESMER_SKILL_IDS = new Set([
  // Initially every skill still owned by the current Mesmer scheduler.
]);

function scheduleMesmerSkill(_context, skill) {
  return LEGACY_MESMER_SKILL_IDS.has(skill.id);
}
```

Rules:

1. A skill is either legacy-owned or migrated, never both.
2. Do not attach a new handler until the skill is ready to leave the legacy
   path.
3. When removing an ID from the set, also prevent
   `completeMesmerSkill()` from emitting its old profile.
4. Cross-cutting hooks may still observe migrated skills.
5. Delete the set and `scheduleSkill` hook when it becomes empty.

The final `mesmerCastRules` should contain availability and modifier hooks, not
an all-skills scheduling hook.

## 11. Runtime and state design

### 11.1 Remove the runtime registry

The current module-level `WeakMap` hides dependencies and requires consumers to
recover runtime state indirectly.

Replace controller lookups with one of:

- direct scheduler context;
- direct `context.state.profession`;
- pure helper arguments;
- small per-cast state returned by a handler's `beforeEffects`;
- serializable state stored under `state.profession`;
- typed task payloads containing stable IDs and primitive data.

Do not place functions or controller instances in `state.profession`.

### 11.2 State categories

Keep these state categories profession-owned:

- active clones and clone attack ownership;
- numeric blades or notes;
- pending resource gains;
- tracked skill-hit windows;
- trait internal cooldowns and progress;
- active instruments;
- Continuum snapshot and expiry;
- active flips;
- autoattack-chain progress;
- Clarity, Mirage Cloak, ambush, and Time Bomb windows;
- expected Bloodsong and Sharper Images progress.

Review each field during migration:

- retain it if future casts or public state require it;
- move derived display-only data to projection;
- keep resolver-only counters in resolver state;
- delete fields made redundant by canonical events or shared engine state.

### 11.3 Typed tasks

Retain namespaced tasks for chronological behavior:

- `mesmer.clone-attack`
- `mesmer.resource-gain`
- `mesmer.expected-proc`
- `mesmer.blade-spend`
- `mesmer.continuum-expire`
- `mesmer.infinite-forge`
- `mesmer.signet-ether-relock`
- `mesmer.signet-illusions-passive`

Task payloads should use skill IDs, trait IDs, resource amounts, timestamps, and
small serializable descriptors. Do not use display names as task routing keys.

## 12. Scheduler and resolver responsibilities

### 12.1 Scheduler

The scheduler owns:

- castability and retry timestamps;
- cooldown/ammo commitment;
- weapon-set legality;
- declarative effect scheduling;
- Mesmer resource changes that affect future castability;
- Continuum snapshots/restoration;
- flip and ambush availability;
- expected-proc work that changes later scheduler state.

### 12.2 Resolver

The shared resolver owns:

- standard strike and condition resolution;
- target health and death;
- sigils, relics, food, and common combat rules;
- condition ticks and damage totals.

Mesmer resolver reactions own only reactions to standard events, such as
Ineptitude. Mesmer must not register handlers for platform-owned event types.

Continue using minimal time-zero resolver state. Do not seed the resolver from
the scheduler's final Mesmer snapshot.

## 13. Availability and UI alignment

Extract pure availability queries usable by both scheduler and UI:

- build/specialization availability;
- active Mirage ambush weapon and window;
- autoattack-chain next skill;
- flip armed/ready/expired state;
- minimum blade/note/clone requirements;
- Continuum Shift availability.

`ui.js` must expose:

```js
{
  paletteGroups,
  resourceViews,
  isPaletteSkillAvailable,
  paletteSkillUnavailableMessage,
  eventLogRow,
}
```

The UI is advisory; scheduler validation remains authoritative. Both must use
the same underlying pure predicates so disabled styling and scheduler errors do
not disagree.

Convert `MECHANIC_SKILLS` and palette construction to stable skill IDs.

No HTML page redesign is required. Mesmer already uses the shared shell.

## 14. Trait coverage and documentation

Add `data/trait-coverage.js` using
`validateTraitCoverageManifest()`.

Every one of Mesmer's 108 catalog traits must be classified as:

- implemented;
- partially implemented, with per-effect dispositions;
- out of model, with a concrete reason;
- pending only when the repository's coverage policy permits it.

Implemented effects require focused test references. Do not mark a trait
implemented because it appears in a trait list or a broad build test.

Replace or fold `docs/RESEARCH.md` into `docs/MESMER.md` so Mesmer documentation
matches other native professions. Preserve useful source notes, modeling
assumptions, timing confidence, and known limitations. Remove unrelated
profession statements from Mesmer documentation.

## 15. Test strategy

### 15.1 Replace the false oracle

Before moving production behavior, replace the current self-comparison oracle
with checked-in expected results.

Recommended layout:

```text
tests/
  fixtures/
    mesmer-migration/
      simple-strike-condition.json
      concurrent-cooldown.json
      interrupt-and-instant.json
      weapon-swap-chain.json
      flip-and-ammo.json
      clone-shatter.json
      chronophantasma.json
      virtuoso-expected-procs.json
      mirage-ambush.json
      troubadour-instruments.json
      continuum.json
      relic-and-public-state.json
  mesmer-oracle.test.js
```

Each fixture should contain:

- canonical ID-based rotation;
- explicit simulation config overrides;
- normalized expected steps;
- normalized scheduled and resolved events;
- cooldowns and ammo;
- active weapon set;
- public profession end state;
- duration and DPS window;
- strike, condition, total damage, and DPS.

Compare identity, timestamps, event ordering, state, warnings, and counts
exactly. Use a narrow relative tolerance only for calculated damage fields.

Golden fixtures must be generated once from the accepted pre-migration
implementation, reviewed, and checked in. Tests must never regenerate expected
values during a normal run.

### 15.2 Focused handler tests

For every migrated family, add:

- positive behavior;
- negative availability or trait case;
- interruption case where applicable;
- exact boundary timestamp case;
- actor/source ownership assertion;
- resource/cooldown/ammo assertion;
- parity fixture coverage.

### 15.3 Required high-risk cases

Explicitly cover:

- serial and concurrent cooldown waiting;
- shatter resource reservation, spend, refund, and zero-resource rejection;
- same-timestamp resource gain followed by shatter;
- interrupted phantasm before and after its summon threshold;
- Chronophantasma repeat and conversion;
- Virtuoso expected bleeding and Bloodsong thresholds;
- clone replacement and cancellation of future clone attacks;
- Mirage Cloak expiry exactly at an ambush command;
- Infinite Horizon clone ambushes;
- flip delay, expiry, ammo, and in-flight parent rules;
- Signet of the Ether delayed relock;
- Signet of Illusions passive interval and reset exclusions;
- Continuum manual and automatic restoration;
- weapon swap and sigil ordering;
- explicit combat start and target death;
- duplicate-name legacy rotation migration.

### 15.4 Conformance tests

Update the registry-driven architecture suite so Mesmer is no longer exempt.
Assert:

- all handler IDs resolve to normalized strategies;
- replace handlers have empty effect lists;
- custom events and tasks are Mesmer-namespaced;
- production mechanics do not branch on display names;
- Mesmer no longer imports `mechanics/runtime.js`;
- `scheduleSkill` is absent after final migration;
- all palette IDs exist;
- trait coverage contains every catalog trait;
- build defaults migrate and validate;
- an ID-based representative rotation runs through `simulateGw2()`;
- public profession state contains only serializable projection data.

Avoid brittle source-text assertions when a behavior or catalog assertion can
prove the same contract. A small import-boundary source check is acceptable for
preventing display-name dispatch from returning.

## 16. Delivery phases

Each phase should be a separate reviewable commit or pull request and end with
a passing relevant suite.

### Phase 0: lock behavior

Work:

1. Record the current full test baseline.
2. Replace the false oracle with checked-in golden results.
3. Convert oracle rotations to stable skill IDs.
4. Add missing high-risk chronology fixtures.

Exit criteria:

- fixtures do not call the production simulator to construct expected values;
- running the oracle twice produces the same checked-in expectations;
- no production behavior changes.

### Phase 1: normalize identity and catalog inputs

Work:

1. Add `mesmer-supplemental-skills.js`.
2. Separate supplemental identity from mechanics.
3. Introduce ID-keyed mechanic metadata.
4. Add the explicit legacy duplicate-name resolver and tests.
5. Add an empty `mesmerSkillHandlers` registry to the catalog.
6. Add the transitional legacy skill-ID set.

Exit criteria:

- catalog contents and public behavior are unchanged;
- all runtime table conversions completed in this phase have stable-ID tests;
- legacy name imports remain compatible.

### Phase 2: migrate simple and common actions

Work:

1. Move ordinary declarative skills to shared scheduling.
2. Migrate weapon swap, Mirage dodge, and Continuum Shift.
3. Migrate generic autoattack-chain completion and flip bookkeeping to
   stable-ID helpers.
4. Remove migrated IDs from the legacy set.

Exit criteria:

- simple skills no longer pass through `handleGenericSkill()`;
- shared scheduler tests prove canonical timing and interruption;
- golden parity remains unchanged.

### Phase 3: migrate resources, traits, and tracked hits

Work:

1. Migrate clone/blade/note gains.
2. Migrate Clarity producers and consumers.
3. Migrate Flying Cutter/Cutter Burst and similar tracked-hit mechanics.
4. Migrate control, blind, weakness/vulnerability, Peitha, and trait triggers
   to canonical effects, event observation, or stable-ID handlers.
5. Replace behavioral checks on textual resource reasons with stable cause IDs.

Exit criteria:

- no migrated resource behavior reads a display string;
- same-timestamp gains affect later castability correctly;
- expected-proc fixtures remain exact.

### Phase 4: migrate shatters and instruments

Work:

1. Migrate core and Chronomancer shatters.
2. Migrate Virtuoso bladesongs and cast-end blade spending.
3. Migrate Troubadour instruments and Crescendo.
4. Migrate shatter/instrument ammo and recharge modifiers to ID metadata.
5. Preserve Continuum exclusions and restoration semantics.

Exit criteria:

- all profession-mechanic casts use registered handlers;
- resource reservation/refund tests pass;
- no shatter or instrument routing uses names.

### Phase 5: migrate phantasms and Mirage

Work:

1. Migrate finite phantasm summon/attack/conversion handlers.
2. Preserve measured packet endpoints and Chronophantasma.
3. Migrate Phantasmal Blades, Bountiful Blades, Fencer's Finesse, and
   phantasm resource conversions.
4. Migrate player and clone ambush behavior.
5. Preserve clone task cancellation and Infinite Horizon ordering.

Exit criteria:

- `specific/skill-effects.js` no longer owns the generic profession profile;
- phantasm and ambush golden fixtures match exactly;
- all remaining legacy IDs are identified and justified.

### Phase 6: remove the compatibility scheduler

Work:

1. Migrate the final legacy skills.
2. Delete `LEGACY_MESMER_SKILL_IDS`.
3. Delete `scheduleMesmerSkill` and the `scheduleSkill` hook.
4. Delete unused generic controller code.
5. Replace runtime lookups with explicit context.
6. Delete `mechanics/runtime.js`.
7. Simplify `contract.js` to hook composition and task registration.

Exit criteria:

- shared scheduler owns ordinary effects;
- catalog handlers own exceptional skill behavior;
- no all-skills Mesmer scheduler remains;
- no module-level runtime registry remains.

### Phase 7: UI, coverage, tests, and documentation

Work:

1. Add shared scheduler/UI availability predicates.
2. Add palette availability messages.
3. Add complete trait coverage.
4. Consolidate tests into `tests/mesmer.test.js` where profession-specific.
5. Keep shared architecture/UI tests profession-neutral.
6. Add `docs/MESMER.md`.
7. Update `docs/ARCHITECTURE.md` and `docs/MODULES.md`.
8. Remove Mesmer-specific conformance exceptions.

Exit criteria:

- Mesmer conforms to every native-profession contract;
- documentation matches the implemented module boundaries;
- full repository checks pass.

## 17. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Same damage total but different event order | Compare complete normalized events, not only totals |
| Shared effects scheduled earlier than old Mesmer state mutation | Keep future mutations in typed tasks and test boundary timestamps |
| Double emission during incremental migration | Enforce exclusive legacy-vs-handler ownership per skill ID |
| Interrupted phantasms change behavior | Preserve summon threshold and effective-end fixtures before refactoring |
| Expected procs stop affecting later castability | Keep scheduler-visible expected-proc tasks and exact threshold tests |
| Duplicate display names select the wrong specialization variant | Add an explicit specialization-aware legacy resolver |
| Continuum restores engine-owned state incorrectly | Keep the unaffected-ID list and test cooldown/ammo/weapon swap separately |
| Handler registry becomes another monolith | Group handlers by mechanic family and keep the registry declarative |
| Platform gains Mesmer-only fields | Keep profession metadata nested and profession-owned |
| Structural work hides balance corrections | Reject coefficient/timing changes from migration commits |

## 18. Agent execution rules

The implementing agent must:

1. Read `docs/ARCHITECTURE.md`, `docs/MODULES.md`, this document, and the
   shared skill-handler contract before editing production code.
2. Inspect `git status` before every phase.
3. Preserve unrelated and pre-existing changes.
4. Never reset, revert, or mass-format user-owned work.
5. Add or update parity protection before changing a mechanic family.
6. Migrate one coherent family at a time.
7. Use `apply_patch` for manual edits.
8. Keep rotations ID-based inside new production and fixture code.
9. Prefer existing platform primitives; add a platform capability only when
   at least two professions need the exact same rule.
10. Stop and document a blocker if behavior cannot be preserved without
    changing the shared contract.
11. Report any proven pre-existing bug separately from the structural
    migration.
12. Keep every intermediate commit runnable and reviewable.

## 19. Verification commands

Run focused checks after every phase:

```powershell
node --test --test-isolation=none `
  tests/mesmer-oracle.test.js `
  tests/data.test.js `
  tests/rotation.test.js `
  tests/resolver-architecture.test.js `
  tests/platform-architecture.test.js `
  tests/app-ui.test.js
```

Run the full repository gate before completing a phase:

```powershell
npm test
npm run check
```

Also load `mesmer.html` through the local server and manually verify:

- build restoration;
- specialization changes;
- both weapon sets;
- profession palette;
- disabled action explanations;
- resource display;
- representative Core, Chronomancer, Mirage, Virtuoso, and Troubadour
  rotations;
- import/export compatibility.

## 20. Definition of done

The migration is complete only when all of the following are true:

- [ ] Ordinary Mesmer effects are scheduled by the shared scheduler.
- [ ] Every exceptional skill uses a registered stable-ID handler.
- [ ] Mesmer has no unconditional `scheduleSkill` hook.
- [ ] Simulation behavior does not branch on display names.
- [ ] Textual reasons are presentation-only.
- [ ] `mechanics/runtime.js` and the runtime `WeakMap` are removed.
- [ ] Completion-only state changes remain chronological.
- [ ] Shatters, bladesongs, instruments, phantasms, ambushes, flips, and
      Continuum preserve their accepted behavior.
- [ ] Scheduler and UI availability share pure predicates.
- [ ] Supplemental skills are separated from simulation mechanics.
- [ ] Every trait has a validated coverage disposition.
- [ ] The Mesmer oracle compares against checked-in expectations.
- [ ] Mesmer-specific tests are organized under a clear profession suite.
- [ ] Architecture conformance no longer exempts Mesmer.
- [ ] Persisted builds and the existing storage key remain compatible.
- [ ] No Mesmer branches were added to platform code.
- [ ] Focused and full test gates pass.
- [ ] `docs/MESMER.md`, `docs/ARCHITECTURE.md`, and `docs/MODULES.md` describe
      the final implementation accurately.
