# Generic Combo Finisher Implementation Handoff

Handoff date: 2026-08-13

## Goal

Move Guild Wars 2 combo fields, finishers, successful-combo reactions, and universal combo outcomes out of profession-specific code and into the shared `js/platform/gw2/` scheduler/resolver pipeline.

The implementation must preserve the two-phase simulator architecture:

- the scheduler needs prediction events so later casts can observe combo-derived boons, auras, conditions, and profession state;
- the resolver must remain authoritative so cancelled packets, dead targets, and invalid summon attacks do not create actual combo effects.

The neutral `js/platform/engine/` package should gain only generic event/catalog type support. Guild Wars 2 field and finisher rules belong under `js/platform/gw2/`.

## Approved direction

Implement explicit semantic events and shared policy:

1. `combo_field` records a field occurrence and lifetime.
2. `combo_finisher` records one finisher interaction attempt and an explicit field binding.
3. `combo` records one successful interaction and is the only generic trait/relic reaction trigger.
4. The scheduler processes fields and finishers chronologically and emits prediction-only combo results.
5. Prediction results remain visible to scheduler facts but are removed from the resolver stream.
6. The resolver processes the same semantic events and emits the authoritative result.
7. A shared 9-by-4 outcome definition table materializes universal GW2 effects.

This follows the existing critical-sigil pattern documented in `docs/professions/ELEMENTALIST-TEMPEST-PARITY-HANDOFF.md`: scheduler predictions support chronology and rotation legality, while resolver-created events own numeric results.

## Field binding decision

The shared subsystem must **not infer spatial field selection from temporal overlap**.

The simulator has no positions, paths, radii, or field-entry events. A field being active at a finisher timestamp does not prove that the field and finisher occupy the same area. This matters when a build has different field types in different locations, such as a Reaper with active Dark and Ice fields.

Every `combo_finisher` attempt therefore needs an explicit binding supplied by its producer:

```ts
type ComboFieldBinding =
  | { readonly kind: "field-id"; readonly fieldId: string }
  | { readonly kind: "field-type"; readonly fieldType: ComboFieldType }
  | { readonly kind: "none" };
```

Binding rules:

1. `field-id` selects exactly one recorded field occurrence. It must be active at the interaction timestamp.
2. `field-type` is an explicit simulation assumption that the finisher interacts with that type. The resolver may select the oldest active occurrence of the same type only for attribution.
3. `none` means the field interaction is unknown or intentionally excluded. It produces no combo outcome.
4. A missing binding is invalid authoring. Catalog/event validation should reject it rather than silently choosing an active field.
5. The shared implementation must never choose between different active field types.
6. One finisher attempt can resolve against at most one field.

Field bindings may come from explicit skill mechanics, an existing profession assumption such as a permanent Ice field, or a future build/rotation assumption. Adding spatial controls to the rotation editor is not part of this implementation.

### Migration compatibility

Do not add a generic `first-active`, `oldest-active`, or `own-field-first` fallback.

If a profession needs temporary parity while its fixtures are updated, keep the compatibility choice in that profession's migration adapter and have the adapter emit a concrete `field-id` binding. Mark it as temporary and do not expose it through the shared resolver contract.

Ambiguous cases should conservatively emit no outcome and one deduplicated warning, for example:

```text
Combo field binding is unspecified for Gravedigger at 12.440s; no combo resolved.
```

## How Elementalist currently selects a field

### Native Elementalist

`js/professions/elementalist/core/rules.ts` appends every completed field to `activeComboFields` and emits an `elementalist.combo-field` event.

`js/professions/elementalist/core/resolver.ts` then:

1. removes entries where `expiresAt <= finisher.at`;
2. calls `activeComboFields.find(...)`;
3. returns the first inserted field that has started and not expired.

Consequences:

- field location is not modeled;
- all temporally active fields are implicitly treated as reachable;
- insertion order decides between different active types;
- the field lifetime is half-open: `[startsAt, expiresAt)`;
- only Elementalist-owned recorded fields participate, so owner priority is not implemented.

### Upstream Elementalist reference

`reference-repos/Elementalist-Simulator/js/sim/mechanics/sim-combo-resolution.js`
iterates combat fields in stored order. It returns the first active
non-permanent field, or the last active permanent field when no non-permanent
field is available.

This also assumes that temporal activity implies spatial overlap.

### Reaper overlap warning

Core Necromancer Dark combos and Reaper Ice combos are separate scheduler/resolver handlers. When both field clocks are active, a qualifying finisher can be observed independently by both handlers. The generic migration must not preserve double resolution; it must require one binding and produce at most one `combo` event.

## Non-goals

- Do not implement coordinates, range, projectile paths, or field radii.
- Do not infer the first field entered from field creation time.
- Do not add a combo-field picker to the rotation UI in this change.
- Do not model allied fields unless a caller emits an explicit synthetic `combo_field` and binds a finisher to it.
- Do not add player-health or condition-cleanse simulation solely for Water or Light combo results.
- Do not move GW2 outcome policy into profession modules.
- Do not preserve simultaneous multi-field outcomes from duplicated profession handlers.

## Canonical types

Add normalized field and finisher types to `js/platform/gw2/types.d.ts` or a dedicated imported declaration module:

```ts
type ComboFieldType =
  | "Dark"
  | "Ethereal"
  | "Fire"
  | "Ice"
  | "Light"
  | "Lightning"
  | "Poison"
  | "Smoke"
  | "Water";

type ComboFinisherType = "Blast" | "Leap" | "Projectile" | "Whirl";
```

Do not carry the overloaded `finisherValue` contract into new code. Split it into:

- `chance`: success probability for one attempt;
- `attempts`: repeated independent attempts, primarily projectile packets;
- `applications`: outcome packets from one success, primarily Whirl bolts;
- `successfulCombos`: deliberate multiple successful finishers, such as authored double Blasts.

Legacy catalog data can be normalized at assembly time, but new skill/effect definitions should author these fields directly.

## Semantic event contracts

### `combo_field`

```ts
interface ComboFieldEvent extends SimulationEventBase<"combo_field"> {
  readonly fieldId: string;
  readonly fieldType: ComboFieldType;
  readonly expiresAt: number;
  readonly ownerId: string;
  readonly ownerActorType: SimulationActorType;
  readonly activationId?: string;
}
```

Rules:

- `at` is the inclusive start timestamp.
- `expiresAt` is exclusive and must be greater than `at`.
- `fieldId` identifies an occurrence, not a skill definition.
- `ownerId` is separate from display-oriented `source`.
- Synthetic assumed fields use the same event type and an explicit assumption source.

### `combo_finisher`

```ts
interface ComboFinisherEvent extends SimulationEventBase<"combo_finisher"> {
  readonly attemptId: string;
  readonly finisherType: ComboFinisherType;
  readonly fieldBinding: ComboFieldBinding;
  readonly effectAt: number;
  readonly chance: number;
  readonly applications: number;
  readonly successfulCombos: number;
  readonly parentEventOrder?: number;
}
```

Rules:

- `at` is the field interaction/binding timestamp.
- `effectAt` is when the outcome lands. It may be later than `at`.
- movement and projectile finishers may bind while crossing a field and apply their effect later;
- `attemptId` must be stable across scheduler and resolver passes;
- chance is clamped to `[0, 1]` during validation, not silently at resolution;
- zero-damage and non-damage finishers must be representable without inventing a positive strike.

### `combo`

```ts
interface ComboEvent extends SimulationEventBase<"combo"> {
  readonly comboId: string;
  readonly attemptId: string;
  readonly fieldId: string;
  readonly fieldType: ComboFieldType;
  readonly finisherType: ComboFinisherType;
  readonly fieldSourceId: SkillId;
  readonly bindingKind: ComboFieldBinding["kind"];
  readonly applicationCount: number;
}
```

Rules:

- emit only after a binding is validated and the chance succeeds;
- dispatch `combo.resolved` once per successful combo, not once per Whirl bolt;
- materialized outcome events inherit finisher attribution and carry field attribution separately;
- the event remains useful even when a semantic result, such as healing or cleansing, has no numeric subsystem yet.

## Catalog normalization

Update the canonical catalog boundary rather than teaching every consumer about aliases.

Current code uses inconsistent fields:

- `fieldDuration`;
- `comboFieldDuration`;
- generic skill `duration`;
- `comboFieldStartMs`;
- `finisherType` with inconsistent casing;
- `finisherValue` as chance, count, or applications.

Add canonical `comboFields` and `comboFinishers` metadata to skills/effects. Preserve legacy aliases only in a normalization adapter with validation warnings.

Per-packet finishers belong on the exact effect/tick that interacts with a field. Skill-level fallback should be removed after migration because it can attach one finisher to every packet of a multi-hit skill.

## Scheduler design

Create `js/platform/gw2/scheduler/combo-materializer.ts` rather than adding combo state to profession scheduler state.

Responsibilities:

1. Chronologically observe `combo_field` and `combo_finisher` events through scheduler tasks.
2. Maintain scheduler-local active field occurrences only for binding validation.
3. Resolve the binding carried by the finisher event; never search across field types.
4. Evaluate deterministic/stochastic chance with stable `attemptId`-keyed streams.
5. Emit a predicted `combo` event and predicted universal outcome events.
6. Mark predicted results with `schedulerPrediction: "combo-result"`.
7. Allow ordinary scheduler observers to see predicted buffs, conditions, auras, controls, and profession reactions.

Compose this materializer beside the existing GW2 trigger materializer in `createGw2SchedulerPolicy()`.

Use scheduled tasks rather than immediate recursive observation. Skill effects are often emitted before the scheduler clock reaches their timestamp; task execution is the existing mechanism that restores chronological order.

## Resolver design

Create `js/platform/gw2/resolver/combo-resolution.ts`.

Responsibilities:

1. Maintain common resolver combo state under `Gw2ResolverRuntime`, not `context.profession`.
2. Register `combo_field` occurrences and lazily remove expired fields.
3. Validate the exact binding on each `combo_finisher`.
4. Ignore an unbound or inactive binding and record a deduplicated warning where appropriate.
5. Apply the stored or reproducible chance decision.
6. Enqueue one `combo` event per successful combo at `effectAt`.
7. Materialize the outcome definition into common resolver events.

Modify `js/platform/gw2/declarative-simulation.ts` to remove scheduler-predicted combo results from the resolver stream, while retaining `combo_field` and `combo_finisher` semantic events.

Do not recompute field selection from all active fields during resolution. The resolver validates the binding already present on the finisher attempt.

## Probability policy

### Stochastic mode

Roll once per independent attempt using a stream derived from the stable attempt ID:

```text
gw2.combo:<attemptId>
```

This keeps combo outcomes stable when unrelated traits or equipment begin consuming random values.

### Deterministic mode

For the first implementation, retain discrete expected-progress behavior for compatibility. Key progress by at least:

```text
field type + finisher type + semantic outcome
```

Do not use one global projectile accumulator. Progress earned for a Fire projectile must not later produce an Ice or Ethereal result.

The scheduler and resolver must use the same deterministic rule and stable attempt order. A later change may move suitable damaging conditions to fractional expected applications, but that is outside this handoff.

## Universal outcome definitions

Create `js/platform/gw2/combo-definitions.ts` with one validated definition for every field/finisher pair.

| Field     | Blast           | Leap          | Projectile    | Whirl           |
| --------- | --------------- | ------------- | ------------- | --------------- |
| Dark      | Area Dark Aura  | Dark Aura     | Life steal    | Leeching Bolts  |
| Ethereal  | Area Chaos Aura | Chaos Aura    | Confusion     | Confusing Bolts |
| Fire      | Area Might      | Fire Aura     | Burning       | Burning Bolts   |
| Ice       | Area Frost Aura | Frost Aura    | Chilled       | Chilling Bolts  |
| Light     | Area cleanse    | Light Aura    | Cleanse       | Cleansing Bolts |
| Lightning | Area Swiftness  | Dazing Strike | Vulnerability | Brutal Bolts    |
| Poison    | Area Weakness   | Weakness      | Poisoned      | Poison Bolts    |
| Smoke     | Area Stealth    | Stealth       | Blindness     | Blinding Bolts  |
| Water     | Area Healing    | Healing       | Regeneration  | Healing Bolts   |

Definitions should describe semantic results before converting them to event types. Suggested result kinds:

- `boon`;
- `condition`;
- `aura`;
- `control`;
- `strike` or `life-steal`;
- `healing`;
- `cleanse`;
- `stealth`.

Materialize supported results into existing common events. Keep unsupported healing/cleanse semantics on the `combo` event for reporting instead of silently dropping the successful combo.

## Reactions and equipment

Add `combo.resolved` to the shared resolver reaction registry.

Migrate:

- Catalyst Elemental Epitome and Elemental Synergy;
- Steamshrieker and other field/finisher-sensitive relics;
- Bloodstone Blast handling;
- profession traits that react to successful combinations rather than the resulting condition/control.

Temporarily dispatch `blast-combo.resolved` from a successful Blast `combo` event so existing relic code can migrate incrementally.

Remove unconditional `blast_combo` emission from Guardian and Ranger handlers. A Blast finisher without a bound active field is not a successful combo and must not advance Bloodstone.

## Aura handling

Introduce a common semantic aura event or adapter rather than making the combo subsystem emit `elementalist.aura`.

Elementalist may react to a common aura event and update its profession-specific active-aura state. Other professions should be able to receive the same universal aura without importing Elementalist code.

Do not make universal aura creation depend on the selected profession.

## Suggested file changes

### New files

- `js/platform/gw2/combo-definitions.ts`
- `js/platform/gw2/combo-events.ts`
- `js/platform/gw2/scheduler/combo-materializer.ts`
- `js/platform/gw2/resolver/combo-resolution.ts`
- `tests/platform/gw2/combo-contract.test.js`
- `tests/platform/gw2/combo-scheduler.test.js`
- `tests/platform/gw2/combo-resolution.test.js`

### Shared files to modify

- `js/platform/engine/events.ts`
- `js/platform/engine/catalog.ts`
- `js/platform/engine/types.d.ts`
- `js/platform/gw2/types.d.ts`
- `js/platform/gw2/scheduler/policy.ts`
- `js/platform/gw2/declarative-simulation.ts`
- `js/platform/gw2/resolver/event-handlers.ts`
- `js/platform/gw2/resolver/reaction-registry.ts`
- `js/platform/gw2/resolver/runtime-state.ts`
- `js/platform/gw2/relic-rules.ts`

Avoid modifying the neutral scheduler state machine unless the semantic event contract exposes a concrete missing primitive.

## Migration order

### Phase 1: contract and characterization

1. Add characterization tests for current Elementalist first-active behavior.
2. Add a Reaper Dark-plus-Ice overlap fixture and record whether both current handlers fire.
3. Add the canonical types, event validation, and definition completeness tests.
4. Add explicit field bindings to test helpers; do not enable shared outcomes yet.

### Phase 2: shared vertical slice

1. Implement field registration, binding validation, and one field type end-to-end.
2. Use Fire Projectile and Fire Blast as the first slice because they cover chance, conditions, boons, and Bloodstone gating.
3. Verify scheduler prediction and resolver-authoritative output match.
4. Verify a cancelled/invalid attempt leaves only scheduler predictions, which are filtered before numeric resolution.

### Phase 3: complete the universal table

1. Add all 36 field/finisher definitions.
2. Add common aura semantics.
3. Preserve unsupported heal/cleanse outcomes as semantic records.
4. Add `combo.resolved` and the temporary Blast compatibility adapter.

### Phase 4: profession migration

Migrate in this order:

1. Elementalist, because it has the broadest current implementation and explicit field events.
2. Engineer, because it currently splits fields/projectiles and Blast resolution across phases.
3. Guardian and Ranger, removing unconditional Blast markers.
4. Necromancer and Reaper, replacing separate Dark/Ice clocks and preventing double resolution.
5. Warrior, Mesmer, and Revenant embedded cases.
6. Thief and remaining professions, which should gain outcomes through canonical metadata without new profession combo handlers.

### Phase 5: delete compatibility code

Remove:

- profession `activeComboFields` state;
- profession projectile progress counters;
- hard-coded Dark/Ice field timers;
- hard-coded Whirl skill-ID maps after counts move to metadata;
- profession field scans over `context.events`;
- unconditional `blast_combo` events;
- Elementalist `applyComboEffect()` and generic field lookup;
- temporary `blast-combo.resolved` dispatch after all consumers use `combo.resolved`.

## Required tests

### Binding and ambiguity

- An explicitly bound active field resolves.
- An explicitly bound expired field does not resolve.
- A type binding ignores active fields of other types.
- Two different active field types with `fieldBinding: none` produce no outcome.
- One finisher attempt never resolves against both Dark and Ice.
- Multiple active fields of the bound type produce one outcome; oldest same-type occurrence is used only for attribution.
- Missing binding fails event/catalog validation.

### Timing

- Field start is inclusive.
- Field expiry is exclusive.
- A same-time field starts before a bound finisher when event priority requires it.
- Field selection occurs at `combo_finisher.at` and outcome application at `effectAt`.
- A field may expire between interaction and effect application without invalidating an already-bound attempt.

### Packet semantics

- Zero-coefficient Blast and Leap finishers resolve.
- A pure movement/non-damage finisher resolves.
- Multi-hit Blast and Leap skills deduplicate by attempt ID.
- Projectile attempts resolve per projectile.
- Whirl applications do not multiply `combo.resolved` reactions.
- Authored double Blasts dispatch two successful combo reactions.

### Randomness

- Fixed stochastic seeds reproduce.
- Different seeds vary for partial-chance projectiles.
- Unrelated random consumers do not shift combo rolls.
- Deterministic progress does not transfer between field types or outcomes.

### Causality and reactions

- Invalid or replaced summon attacks do not create resolver outcomes.
- Target death prevents later authoritative outcomes.
- Scheduler prediction events cannot contribute numeric resolver damage or conditions.
- Bloodstone advances only on a successful bound Blast.
- Steamshrieker inspects the successful `combo` payload rather than profession field state.
- Catalyst reactions fire once per successful combo.

### Cross-profession regressions

Retain or migrate the existing focused tests for:

- Elementalist zero-damage finishers and Steamshrieker;
- Engineer Shred Fire projectiles and Blast relic behavior;
- Guardian Whirling Light;
- Ranger Ice projectile finishers;
- Necromancer/Reaper Chilling and Leeching Bolts;
- Warrior Lightning Leap Dazing Strike;
- Mesmer Confounding Bolts.

## Acceptance criteria

- All native professions use the same shared combo field/finisher resolver.
- The shared resolver never chooses among different active field types.
- Every successful combo has one canonical `combo` event with field and finisher attribution.
- One finisher attempt resolves against no more than one field.
- Scheduler predictions affect later scheduling but cannot create resolver totals.
- All 36 universal field/finisher pairs have validated semantic definitions.
- Blast relics require an actual successful combo.
- Zero-damage and non-damage finishers work without special profession code.
- Summon finishers use finisher ownership/attribution and obey resolver causality.
- Profession-local combo field scans, progress counters, and outcome matrices are removed.
- `npm run check` and the full test suite pass.

## Working-tree warning

At handoff creation, the repository contains extensive uncommitted scheduler, resolver, Elementalist, and UI changes. Implement this work in a separate reviewable series and preserve unrelated edits.

The current build passes. A focused combo test run passes 10 of 11 selected tests; the existing Spellbreaker test fails its Winds of Disenchantment boon-removal assertion (`0 !== 5`) under the current scheduler working tree. Establish whether that baseline regression is resolved before using the full combo suite as an implementation gate.

## Verification commands

Format every touched supported file:

```powershell
npx prettier --write <touched-files>
```

Run the shared and profession combo coverage after building:

```powershell
npm run build
node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none tests/platform/gw2/combo-contract.test.js tests/platform/gw2/combo-scheduler.test.js tests/platform/gw2/combo-resolution.test.js
npm test
npm run check
```
