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
The Bloodsong/sigil defect documented in the 2026-07-26 amendment is a separate
behavior-correction workstream with its own pull request boundaries.

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

The resolver-reaction rule has one important exception: if a triggered effect
can change later resource availability or cast scheduling, its causal decision
must occur on the scheduler clock. See
`Amendment: Bloodsong and sigil proc ownership (2026-07-26)`.

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

## Amendment: Bloodsong and sigil proc ownership (2026-07-26)

This amendment records a mechanics defect discovered while auditing Virtuoso
Bloodsong and clarifies the scheduler/resolver ownership rule that the migration
must preserve. It is a separate behavior-correction workstream. Do not combine
it with a batch of legacy-to-declarative skill conversions.

### Executive decision

The current two-pass model cannot correctly grant a scheduler-owned resource
from a proc first created during resolution. Sigil proc **selection and event
production** must move early enough for the scheduler to observe their effects.
Strike and condition **damage resolution** should remain in the resolver.

This does not authorize a direct copy of `handleCriticalSigils()` into
`scheduler/policy.js`. The resolver currently supplies timestamp-aware critical
chance and runtime state that the scheduler's Mesmer-specific
`baseCriticalChance()` helper does not reproduce. Moving the handler without
first closing that gap would fix Bloodsong while changing sigil proc counts in
other builds.

The amended ownership rule is:

> A mechanic that can change later cast availability, resource spending, or
> scheduler state must be decided on the scheduler clock, even when its trigger
> is a hit, critical hit, condition, control effect, or weapon swap. The
> resolver consumes the resulting canonical events and calculates their damage.

Resolver reactions remain the correct owner for effects that depend on resolved
damage or target state and cannot affect scheduling.

### Verified defect

The audit was reproduced against the current worktree:

| Scenario | Sigil applications | Scheduler Bloodsong gains | Result |
| --- | ---: | ---: | --- |
| Six Thousand Cuts casts, no proc sigil | 0 bleeding stacks | 0 | Correct |
| Six Thousand Cuts casts, Sigil of Earth | 18 bleeding stacks | 0 | Broken; expected 3 gains and remainder 3 |
| Five qualifying swaps, Sigil of Geomancy | 5 bleeding stacks | 0 | Broken; expected 1 gain |

The practical failure is larger than the final resource display. Two Thousand
Cuts casts produced six Earth bleeding applications, but a later Bladesong was
still rejected with `requires at least one blade`. Granting a blade during the
resolver pass would not repair that rotation because cast availability was
already decided.

The existing scheduler accumulator in
`professions/mesmer/mechanics/expected-procs.js` is correct:

- it adds new bleeding stacks to existing progress;
- it subtracts five instead of resetting to zero;
- its `while` loop supports multiple gains from one application; and
- scheduler tasks make the resulting blade visible to later cast checks.

The missing input is sigil-created bleeding. Mesmer's scheduler observer sees
ordinary scheduled Bleeding events, but critical and swap sigil conditions are
currently synthesized only by
`platform/gw2/resolver/event-handlers.js`.

`handleMesmerConditionEvent()` does not close the gap. It mutates the fresh
Mesmer resolver state created by `createMesmerResolverState()`, subtracts each
completed group of five, and emits no resource event. In the Earth reproduction
the resolver ended with a remainder of three while the scheduler remained at
zero. `projectMesmerEndState()` projects scheduler resources and does not
consume this resolver accumulator.

### Additional audit findings

The following findings should be handled with, or immediately after, the sigil
ownership change:

1. Remove `handleMesmerConditionEvent()` and the resolver
   `bloodsongProgress` field once scheduler-emitted sigil conditions are live.
   Leaving them in place is misleading even though they do not currently alter
   the public end state.
2. Keep the Virtuoso specialization guard in the one authoritative Bloodsong
   path. The resolver copy currently checks only whether the trait was selected.
3. Stop using the timeline `EPSILON` value as a stack-progress tolerance.
   Bloodsong and expected critical accumulators should use a small,
   domain-specific numeric tolerance.
4. Eliminate, or enforce parity between, the independent scheduler and resolver
   expected-critical models used by Jagged Mind and Sharper Images. The same
   divergence that threatens sigil migration can already make scheduler blade
   progress disagree with resolved bleeding.

### Why a wholesale handler move is unsafe

`handleCriticalSigils()` currently advances its deterministic critical
accumulator using `hitContext.critical.chance`. That value is constructed during
resolution and can include:

- dynamic Fury and Might-derived effects at the hit timestamp;
- active weapon-set sigil bonuses;
- profession attribute and critical-chance modifiers;
- resolver-owned target condition state;
- control-sigil state such as Severance; and
- per-event `canCrit` and `noCrit` behavior.

The issue is platform-wide, not Mesmer-only. For example, Necromancer's Target
the Weak critical-chance rule reads the resolver's current condition state.
The Mesmer scheduler's `baseCriticalChance()` is a static approximation and is
not a suitable common replacement.

There is also a timing distinction:

- `onEventScheduled` observes an event when a cast or handler emits it;
- the event may represent a projectile or pulse that lands later;
- buffs, conditions, explicit combat start, and weapon swaps can occur between
  emission and impact; and
- same-timestamp event ordering affects which state is visible to a proc.

Therefore the GW2 scheduler must process sigil candidates chronologically at
their impact timestamp. It must not decide a delayed hit's sigil proc
immediately when that future hit is first emitted.

### Target event flow

The intended flow is:

```text
player damage or swap event is emitted
  -> GW2 scheduler policy queues a chronological sigil candidate
  -> at the candidate timestamp:
       derive the canonical expected critical chance, when required
       advance sigil critical progress and ICD state
       emit a canonical proc marker and damage/condition event
  -> Mesmer observes Sigil of Earth/Geomancy Bleeding
       and queues its existing Bloodsong expected-proc task
  -> Bloodsong resource gain becomes visible to later cast availability

resolver replays the scheduled stream
  -> resolves sigil strike or condition damage
  -> records proc reporting
  -> does not synthesize the sigil effect a second time
```

Sigil events must retain `source: "Sigil"`, an effect actor type, stable
`sourceId`, the triggering skill, and the canonical sigil icon. These fields
prevent player-only and illusion-only reactions from treating a sigil strike as
an ordinary player hit.

### Recommended implementation sequence

#### Sigil phase 0: lock the current parity surface

Before moving production ownership, capture the current correct outputs for:

- Air, Earth, Torment, and Blight critical procs;
- Doom, Geomancy, and Hydromancy swap procs;
- the strict ICD boundary and progress carried across weapon sets;
- two simultaneously equipped proc sigils;
- destination-set selection on weapon swap;
- explicit combat start and precombat events;
- delayed hits that land after a weapon swap; and
- proc-step names, source skills, timestamps, and icons.

These are behavior baselines, not tests that preserve the Bloodsong bug.

The focused audit suite currently has a separate baseline failure:
`Thousand Cuts spreads its ten EVTC packets and Bloodsong triggers` expects the
first packet at `0.05`, while the current worktree emits it at `0`. Resolve or
explicitly rebaseline that discrepancy before treating the suite as a clean
migration oracle.

#### Sigil phase 1: create one critical-context calculation

Extract the common critical-chance construction from
`declarative-simulation.js` into a platform GW2 service that accepts an explicit
timestamp, event, active weapon set, buff view, profession state view, and
target state view.

The scheduler and resolver may adapt different runtime objects into that
service, but the arithmetic and profession modifier hooks must be shared.
Add differential tests requiring the two adapters to return the same chance
for every currently supported profession rule.

The parity matrix must include:

- permanent and timed Fury;
- Mistburn with timed Might;
- Quiet Intensity and Flow of Time;
- active weapon-set critical bonuses;
- Severance;
- Necromancer condition-count modifiers;
- delayed hits across buff and weapon-set changes; and
- non-critical and effect-owned events.

If a resolver-only rule cannot be represented at scheduler time, stop here and
move the required causal state or event production earlier. Do not add a second
approximation merely to make the Earth test pass.

#### Sigil phase 2: add shared chronological scheduler-policy tasks

Extend the neutral scheduler policy contract with ordered event observation and
typed task handlers, or add an equivalent profession-neutral seam. The GW2
policy should own namespaced tasks such as a sigil hit candidate rather than
placing GW2 state in a profession's scheduler state.

Specify and test ordering among:

- the originating hit or swap;
- profession expected-proc tasks;
- the emitted sigil effect;
- Bloodsong's observation of sigil bleeding; and
- the resource gain at the scheduler epsilon after the application.

The policy must also honor explicit combat start and the simulation horizon.

#### Sigil phase 3: move swap-triggered sigils

Move swap-trigger selection and ICD state first because it does not require a
critical-chance calculation. Preserve:

- destination weapon-set selection;
- in-combat gating;
- the strict nine-second boundary;
- Doom's pending next-hit state;
- Geomancy's Bleeding event;
- Hydromancy's strike and Chilled events; and
- proc reporting.

Delete the matching resolver-side event synthesis in the same change. This
phase should make Geomancy contribute to Bloodsong without changing its
condition damage.

#### Sigil phase 4: move critical-triggered sigils

After critical-context parity is proven, move the shared deterministic
critical-progress accumulator and per-sigil ICD state to the GW2 scheduler
policy. Emit canonical events for Air, Earth, Torment, and Blight.

Delete `handleCriticalSigils()` from the resolver in the same change. Retaining
both paths would double strike or condition applications.

This phase should make Earth contribute to Bloodsong while leaving sigil proc
timestamps and damage unchanged.

#### Sigil phase 5: remove obsolete Mesmer resolver state

Remove:

- `handleMesmerConditionEvent()`;
- its `condition` reaction registration if no other behavior uses it; and
- `bloodsongProgress` from `createMesmerResolverState()`.

Introduce a Bloodsong-specific numeric tolerance and keep the specialization
guard in the scheduler tracker. Audit Jagged Mind and Sharper Images against the
new shared critical context and consolidate their duplicate expected-progress
logic where practical.

### Rejected alternatives

#### Grant blades from the resolver

Rejected. It can alter a displayed final count but cannot reopen a Bladesong
that the scheduler already rejected.

#### Add a permanent non-damaging Earth accounting marker

Rejected as the target architecture. It duplicates critical chance, expected
proc progress, ICDs, and weapon-set selection while the resolver continues to
own the damaging application. The two models will drift.

A marker is acceptable only as a short-lived, explicitly tracked stopgap when
its removal is part of the same planned workstream and parity limitations are
documented.

#### Move sigil damage calculations into the scheduler

Rejected. Scheduler ownership is required for causal proc selection and event
production, not for strike formulas, condition duration, ticks, or damage
totals.

### Required acceptance tests

The workstream is complete only when all of the following pass:

1. Eighteen Earth bleeding applications produce three Bloodsong gains and
   leave scheduler progress at three.
2. Five Geomancy applications produce one Bloodsong gain with no remainder.
3. Earth- or Geomancy-generated progress can make a later Bladesong castable.
   A final end-state count alone is not sufficient.
4. Existing direct-bleeding carryover still handles `4 + 2` as one gain with
   remainder one, and one application of eleven stacks produces two gains with
   remainder one.
5. Sigil strike damage, condition damage, application count, duration, and proc
   timestamps match the phase-0 baseline.
6. No sigil effect is emitted by both scheduler and resolver.
7. Critical-proc counts match across dynamic Fury, Severance, target-condition
   modifiers, delayed hits, and weapon swaps.
8. Precombat hits filtered by explicit combat start do not advance sigil or
   Bloodsong state.
9. Exact ICD-boundary, multiple-sigil, source ownership, and proc-icon tests
   pass.
10. The focused Mesmer, resolver architecture, scheduler temporal, internal
    cooldown, Guardian sigil, and full validation suites pass.

### Pull request boundaries

Keep this correction separate from the skill-effects routing migration:

1. Critical-context extraction and parity tests, with no result changes.
2. Scheduler-policy observation/task seam plus swap sigil migration.
3. Critical sigil migration and deletion of resolver synthesis.
4. Mesmer Bloodsong cleanup, duplicate expected-proc consolidation, and final
   architecture documentation.

Each pull request must state whether any scheduled event, resolved event,
damage total, proc timestamp, or cast-availability result intentionally
changes. The only intended functional changes in this workstream are that
sigil-created Bleeding contributes to scheduler-owned Bloodsong progress and
rotations can spend the resulting blades.
