# Mesmer skill-effects migration

This document defines the transition from Mesmer's legacy
`createSkillEffectController()` / `handleGenericSkill()` path to the same
declarative-effect and explicit-handler model used by Guardian and
Necromancer.

The migration is intentionally incremental. Mesmer has enough timing,
resource, phantasm, and interruption behavior that a flag-day rewrite would
make regressions difficult to isolate.

## Goal

At the end of the migration:

- ordinary strike, condition, control, blind, boon, and buff applications are
  declared in `mechanics/skill-mechanics.js` through canonical `effects`;
- exceptional skills reference stable `handlerId` values registered by
  `mechanics/handlers.js`;
- completion-time state changes remain completion-time state changes;
- cross-cutting trait behavior lives in named lifecycle hooks or resolver
  reactions rather than a generic per-skill function;
- `scheduleMesmerSkill() => true`, `createSkillEffectController()`, and
  `handleGenericSkill()` are removed;
- Mesmer produces the same public simulation results and event semantics unless
  a separate, explicitly reviewed behavior correction is made.

This is an architecture migration, not a balance or mechanics correction.

## Current state

At the time this document was written:

- `MESMER_SKILL_MECHANICS` contains 123 skill entries;
- no Mesmer skill has a non-empty canonical `effects` array;
- 66 entries use the legacy top-level `damage` field;
- 22 entries use the legacy top-level `conditions` field;
- no Mesmer skill has a `handlerId`;
- `scheduleMesmerSkill()` always returns `true`, which suppresses the platform
  scheduler's declarative-effect expansion for every Mesmer skill;
- `handleGenericSkill()` contains ordinary damage and conditions, phantasms,
  clone/blade/note gains, Clarity, cooldown resets, tracked-hit behavior, and
  trait effects in one completion-time function.

The relevant call path is:

```text
platform scheduler reserves cast
  -> Mesmer scheduleSkill returns true
     -> platform does not schedule skill.effects
  -> platform cast-complete task
     -> completeMesmerCast()
        -> completeMesmerSkill()
           -> handleGenericSkill()
```

Guardian instead allows the platform scheduler to expand ordinary effects and
uses `handlerId` only for behavior that requires imperative state or custom
events.

## Non-negotiable invariants

Each migration pull request must preserve all of the following unless its scope
explicitly identifies and tests an intended behavior change:

1. Cast steps, warnings, cooldowns, ammo, and end-state projections.
2. Event type, timestamp, order, priority, and packet count.
3. `source`, `sourceId`, `actorType`, `skillId`, and `skillName`.
4. Strike coefficient per packet, critical eligibility, weapon identity, and
   weapon strength.
5. Condition name, stacks, duration, source ownership, and application time.
6. Resource gain time, amount, replacement behavior, and reason.
7. Trait-proc names, source skills, details, and internal cooldowns.
8. Quickness timing, Alacrity recharge, interruption behavior, concurrent-cast
   behavior, and active weapon-set behavior.
9. Phantasm attack, Chronophantasma repeat, conversion, and Virtuoso blade-gain
   ordering.
10. Continuum Split snapshot and restoration behavior.

Do not combine timing corrections, coefficient changes, trait fixes, or event
renames with a routing conversion. Those changes need separate commits and
tests after parity is established.

## Target architecture

### Declarative-only skills

Skills whose simulated behavior is a fixed collection of effects should contain
canonical effects and no handler:

```js
[ID.BLADECALL]: {
  implemented: true,
  activation: 0.75,
  cooldown: 5,
  effects: [
    strike(1.5, {
      hits: 3,
      weapon: "Dagger",
    }),
  ],
},
```

The existing `activation` field can remain during this migration. Converting
all activation times to `castTimeMs` is a separate cleanup.

### Declarative effects plus an exceptional handler

A skill may use both declarative effects and a handler. A catalog handler that
returns `false` or `undefined` allows the platform scheduler to emit the
declared effects:

```js
[ID.MIND_THE_GAP]: {
  implemented: true,
  handlerId: "mesmer.clarity-grant",
  effects: [
    strike(/* fixed strike data */),
  ],
},
```

Use this for skills with ordinary damage plus an exceptional resource,
cooldown, or profession-state transition.

### Handler-owned skills

A handler should return `true` only when it completely replaces declarative
effect scheduling. This is appropriate for behavior whose event count, timing,
ownership, or coefficient depends on runtime state.

Expected handler-owned areas include:

- phantasm summons and Chronophantasma repeats;
- clone and blade conversions with measured phantasm timing;
- shatters and Troubadour instruments;
- Mirage ambush behavior;
- Continuum Split and Continuum Shift;
- dynamic tracked-hit attacks when they cannot be expressed as fixed effects.

Handlers must be grouped by mechanic, not collected into a replacement generic
handler:

```text
mechanics/
  handlers.js          handler registry only
  phantasms.js         phantasm scheduling and conversion
  special-skills.js    Clarity, signet resets, and isolated skill state
  cast-traits.js       scheduler lifecycle trait behavior
  resources.js         clone, blade, and note state
```

Existing feature modules should be reused where their ownership is already
clear. Do not move unrelated code solely to match the example names above.

### Cross-cutting behavior

Behavior that applies to a category of casts or emitted events is not a skill
handler:

- cast-start or cast-complete rules belong in ordered scheduler hooks;
- behavior triggered by a resolved hit, condition, control, or blind belongs in
  resolver reactions;
- delayed scheduler state transitions belong in typed Mesmer tasks;
- availability remains in Mesmer cast rules.

Preserve current semantics before improving them. For example, Fencer's
Finesse currently derives stacks from completed skill damage groups. Moving it
to a per-hit reaction may be more natural, but that is a behavior change unless
the resulting event stream and stack timing are identical.

## Handler timing rule

Catalog skill handlers participate in the profession's `scheduleSkill` hook.
The platform invokes that hook synchronously inside `cast()` immediately after
it has:

1. accepted the cast;
2. calculated `start`, `fullEnd`, and `effectiveEnd`;
3. reserved its cooldown/ammo and in-flight state; and
4. emitted the cast's `action` event.

At that point, the scheduler clock is still at `start`. `fullEnd` and
`effectiveEnd` are future timestamps available on the handler context; passing
those values does not mean the scheduler has advanced to either time.

For a one-second cast beginning at `0.000`, the sequence is:

```text
state.time = 0.000
  reserve cast and calculate effectiveEnd = 1.000
  call onCastStart
  call catalog handler through scheduleSkill       <- handler runs here
  schedule declarative effects unless handled
  enqueue platform.cast-complete for 1.000

later, when the scheduler advances to 1.000
  spend ammo or establish the cooldown
  call onCastComplete                               <- completion runs here
```

This difference is observable. If the catalog handler immediately grants
Clarity, resets a cooldown, adds a blade, or arms a flip, a concurrent cast
starting at `0.200` can see that state even though the original one-second cast
has not completed. The current legacy `handleGenericSkill()` path performs
those mutations from `onCastComplete`, so moving them directly into a catalog
handler would make them happen early.

Therefore:

- schedule-time handlers may emit future events or enqueue typed tasks;
- cast-start state may be mutated immediately when that is the real mechanic;
- completion-time cooldown, resource, flip, and profession-state mutations must
  stay in `onCastComplete` or a task scheduled for the appropriate timestamp;
- a handler must not mutate completion-time state early merely because
  `context.effectiveEnd` is available.

This distinction matters for interrupted and concurrent casts.

## Legacy-to-canonical mapping

| Legacy Mesmer field or behavior | Canonical destination |
| --- | --- |
| `damage[].coefficient`, `hits` | `strike()` or `strikeTimeline()` |
| `damage[].interval` | `intervalMs`, `atMsList`, or explicit strike ticks |
| `packetOffsets` | explicit strike ticks or several fixed effects |
| `conditions[]` | `condition()`, `conditionTimeline()`, or `repeatedCondition()` |
| `pulseCount` interpolation | explicit effect timeline ending at the base cast duration |
| fixed control/blind name sets | `control()` / `blind()` effects |
| `resource.mode === "add"` or `"fill"` | completion hook or resource task |
| phantasm resource mode | phantasm handler |
| `requiredTrait` damage group | a focused handler or a reviewed conditional-effect extension |
| `boonlessCoefficient` | a focused handler or scheduler policy; do not duplicate two strikes |
| `trackedHitDamage` | dedicated tracked-hit handler/state module |
| Clarity grant/consume | named spear behavior and reservation state |
| signet cooldown resets | completion-time special-skill handlers |
| heal-skill trait procs | ordered cast-complete trait hook |

Timing translations require care:

- legacy default damage occurs at cast completion;
- legacy `delay` is relative to cast completion;
- legacy `timingOrigin: "castStart"` is relative to cast start;
- canonical `atMs` and tick times are relative to cast start;
- canonical `atCastEndOffsetMs` is relative to full cast completion;
- the GW2 scheduler scales cast-bound timings under Quickness only when the
  effect timeline is recognized as ending at the base cast duration.

Do not mechanically convert seconds to milliseconds without first identifying
the timing origin.

## Migration strategy

### Phase 0: establish a real parity baseline

Before changing production routing:

1. Inventory every skill that is read by `handleGenericSkill()`, including
   dynamic fields such as `resource`, `packetOffsets`, `pulseCount`,
   `trackedHitDamage`, `boonlessCoefficient`, and `requiredTrait`.
2. Classify each skill as:
   - declarative-only;
   - declarative plus handler;
   - fully handler-owned;
   - explicit no-op because its relevant effects are outside the simulator.
3. Create fixed baseline fixtures for the scheduled and resolved event streams.
4. Cover at least one representative of every legacy branch.

The existing `mesmer-oracle.test.js` calls the same implementation twice. It
checks determinism, but it is not an old-versus-new migration oracle. Before the
first conversion, either:

- store normalized golden results produced by the legacy path; or
- keep the legacy effect path callable from a test-only parity harness and run
  old and new routes independently.

Do not enable both routes in one production simulation. That would hide
duplicate emissions behind changed totals and ordering.

Recommended golden fixture groups:

- simple single-hit and multi-hit weapon skills;
- a cast-time pulse and a post-cast persistent attack;
- a damaging condition and repeated condition applications;
- a control and blind skill;
- interrupted channel with and without `applyConditionsOnInterrupt`;
- Quickness and both weapon sets;
- each phantasm timing family, with and without Chronophantasma;
- Bountiful Blades, Phantasmal Haste, Phantasmal Blades, and Compounding Power;
- Core clone creation, Virtuoso blade conversion, and Troubadour notes;
- Mind the Gap plus every Clarity consumer;
- Signet of the Ether and Signet of Illusions;
- Method of Madness and Fencer's Finesse;
- `trackedHitDamage` across multiple casts;
- Continuum Split replay and manual restoration.

### Phase 1: add a per-skill routing seam

The current blanket `scheduleMesmerSkill() => true` prevents incremental
migration. Replace it with a temporary explicit route.

One acceptable staging mechanism is a Mesmer-specific mechanics field:

```js
function usesLegacySkillEffects(skill) {
  return skill.effectModel !== "declarative";
}

export function scheduleMesmerSkill(_context, skill) {
  return usesLegacySkillEffects(skill);
}
```

Only converted skills receive `effectModel: "declarative"`. Unconverted skills
continue to suppress platform effects.

At completion, call the legacy data-effect path only for legacy skills. Shared
post-cast behavior such as flip arming, Mirage post-cast handling, control/blind
trait reactions, and relic event emission must still run for both routes.

Do not scatter `effectModel` checks throughout feature modules. Keep the
temporary decision at the scheduling and legacy-dispatch boundaries.

Add an architecture test that rejects:

- a declarative-routed skill that has neither effects nor an intentional
  handler/no-op classification;
- a legacy-routed skill whose canonical effects are non-empty, because those
  effects would currently be suppressed;
- an unknown `handlerId`.

This phase should not convert any skill or change any event.

### Phase 2: split the legacy catch-all by responsibility

Before changing the data format, extract the existing branches into focused
functions while retaining identical call order:

1. Clarity consumption reservation.
2. Phantasm summon, attack, repeat, and conversion.
3. Legacy base damage packet scheduling.
4. Tracked-hit damage.
5. Legacy condition scheduling.
6. Clone/blade/note resource gains.
7. Isolated skill state such as Clarity grants and signet resets.
8. Cast-category trait effects.

This phase creates reviewable ownership boundaries and lets later pull requests
delete one legacy adapter at a time. It must not rename events or alter
timestamps.

`clarityConsumed` is currently returned from `handleGenericSkill()` and affects
later control handling. Move it into the existing per-reservation
`castDetails` record so named handlers and post-cast rules can consume the same
decision without depending on a generic function return value.

### Phase 3: migrate fixed declarative skills

Start with skills that have:

- only player-owned fixed strikes and/or fixed conditions;
- no resource changes;
- no phantasm source;
- no special name branch;
- no `requiredTrait`, `boonlessCoefficient`, `trackedHitDamage`, or custom
  interruption rule;
- no unusual packet timing.

For each small batch:

1. Add canonical effects to the ID-keyed mechanics entry.
2. Retain the legacy `damage`/`conditions` data temporarily for the parity
   harness.
3. Mark the production route declarative.
4. Compare scheduled events, resolved events, end state, and totals.
5. Remove the legacy fields only after that skill's baseline is locked.

Use small batches grouped by timing shape, not by weapon. A single-hit batch is
easier to validate than converting an entire weapon containing several timing
models.

### Phase 4: migrate fixed timelines, conditions, control, and blind

Convert increasingly complex fixed behavior in this order:

1. Fixed multi-hit packets at cast completion.
2. Cast-bound channels whose final packet occurs at cast completion.
3. Post-cast repeated strikes.
4. Explicit packet-offset timelines.
5. Repeated condition applications.
6. Control and blind effects.

For every timeline, test normal speed, Quickness, and interruption. Verify that
the canonical scheduler's coefficient splitting matches the legacy
`addDamage()` behavior: a total coefficient across `hits` becomes one equal
coefficient per emitted hit unless explicit tick coefficients are supplied.

When a legacy timeline cannot be represented without changing its timing
origin or Quickness behavior, leave it handler-owned. Do not extend the platform
effect schema for one Mesmer skill unless the capability is profession-neutral
and has tests at the platform layer.

### Phase 5: move exceptional skill state to explicit handlers

Create `mechanics/handlers.js` and register it from `mesmer/catalog.js`, matching
the canonical catalog contract used by Guardian.

Use stable namespaced handler IDs and skill IDs rather than display-name
branching. Suggested responsibilities include:

```text
mesmer.clarity-grant
mesmer.clarity-consumer
mesmer.signet-phantasm-reset
mesmer.signet-profession-reset
mesmer.tracked-hit
mesmer.phantasm
```

These names are illustrative; prefer one handler per shared mechanic rather
than one handler per skill when the behavior is genuinely shared.

For skills with fixed damage plus exceptional state, allow declarative effects
to run and return `false` from the catalog handler. Apply state changes from the
proper completion hook or typed task.

Replace name comparisons with `MESMER_SKILL_IDS` during this phase. Do not turn
the registry into another switch over `skill.name`.

### Phase 6: isolate and migrate phantasm behavior

Phantasms should remain imperative because their behavior depends on:

- resource type and specialization;
- Clarity and Bountiful Blades phantasm count;
- Phantasmal Haste timing;
- measured per-phantasm attack and conversion endpoints;
- Chronophantasma repeat timing and multiplier;
- Virtuoso-specific blade conversion hits;
- source ownership and phantasm weapon-strength categories;
- Phantasmal Blades, Fencer's Finesse, and Compounding Power.

Move this behavior into a dedicated phantasm module and register a
`mesmer.phantasm` handler for phantasm skills. The handler may fully own their
effects and return `true`.

Do not flatten measured phantasm attack timings into ordinary skill effects.
They describe summon-owned actions and conversions, not a fixed player skill
timeline.

Required parity checks include exact attack packets, conditions, repeat events,
conversion events, trait procs, blade/clone gains, and the special phantasm
weapon-strength values.

### Phase 7: move cross-cutting traits and event reactions

After ordinary effects no longer pass through the legacy adapter, move trait
logic to its correct lifecycle:

- Method of Madness: ordered cast-complete hook for healing skills.
- Fencer's Finesse cast-derived stacks: ordered post-cast hook until a
  separately reviewed hit-reaction migration proves equivalent.
- Danger Time, Delayed Reactions, Dazzling, Ineptitude, and similar
  control/blind behavior: resolver reactions or explicit scheduled events,
  according to their current ownership.
- Phantasm-only traits: phantasm module.
- resource-on-hit expected procs: existing expected-proc task/reaction path.

Trait hooks must consume emitted event metadata or stable skill IDs. They must
not reintroduce a generic scan of legacy `skill.damage`.

### Phase 8: remove the compatibility path

After the final skill is migrated:

1. Remove the temporary `effectModel` field and route check.
2. Remove `scheduleMesmerSkill()` if no remaining Mesmer-wide schedule hook is
   required.
3. Remove all production reads of legacy top-level skill `damage` and
   `conditions` fields. Nested illusion attack definitions may retain their own
   purpose-specific data.
4. Remove `createSkillEffectController()` and `skill-effects.js`.
5. Remove its runtime construction and dependency injection from
   `mechanics/contract.js`.
6. Ensure every exceptional skill has an explicit stable handler or named
   lifecycle owner.
7. Update `ARCHITECTURE.md` and `MODULES.md`.
8. Add an architecture test preventing a blanket Mesmer schedule override or a
   new generic skill-effects controller.

## Testing procedure

Run focused tests after every migration batch:

```powershell
node --test --test-isolation=none `
  tests/data.test.js `
  tests/mesmer-oracle.test.js `
  tests/rotation.test.js `
  tests/resolver-architecture.test.js `
  tests/scheduler-temporal.test.js `
  tests/platform-architecture.test.js
```

Then run the complete validation suite:

```powershell
npm run check
npm test
```

The parity comparison should treat non-damage fields as exact. Floating-point
damage values may use the existing relative tolerance, but coefficients,
timestamps, stacks, packet counts, and state transitions should remain exact.

## Pull request boundaries

Keep changes reviewable:

- one routing-seam pull request;
- one behavior-preserving function extraction pull request;
- several declarative batches grouped by timing shape;
- separate exceptional-state and phantasm pull requests;
- one compatibility-removal pull request.

Every pull request should list:

- skill IDs migrated;
- old classification and new classification;
- affected timing shapes;
- parity fixtures added;
- legacy branches deleted;
- any known skills still routed through the compatibility path.

Avoid mixing generated API refreshes, skill-data corrections, or unrelated
profession work into these pull requests.

## Rollback strategy

Until Phase 8, rollback is per skill:

1. restore its legacy `damage`/`conditions` data if it was removed;
2. remove its declarative-route marker;
3. remove or detach its new handler;
4. rerun the parity and full test suites.

The old and new paths must never both emit production effects for the same
cast. The temporary route must make ownership mutually exclusive.

## Completion criteria

The migration is complete when:

- the platform scheduler handles all fixed Mesmer skill effects;
- every runtime-dependent skill has an explicit namespaced handler or feature
  lifecycle hook;
- no Mesmer-wide hook suppresses declarative effects for all skills;
- no generic function scans every skill's damage, conditions, resources,
  special names, and traits;
- `skill-effects.js` has been deleted;
- exact event/state parity fixtures pass for all identified behavior classes;
- `npm run check` and `npm test` pass;
- architecture documentation describes Mesmer as declarative-with-explicit-
  handlers rather than as a compatibility exception.
