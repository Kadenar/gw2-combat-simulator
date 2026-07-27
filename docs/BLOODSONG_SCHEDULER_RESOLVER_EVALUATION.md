# Bloodsong, Scheduler, and Resolver Evaluation

## Research order and scope

Sections 1 through 9 were completed without opening
`docs/MESMER_SKILL_EFFECTS_MIGRATION.md`. The comparison in section 10 was
added only after the independent findings had been recorded.

This evaluation covers the shared engine, shared GW2 scheduler/resolver,
Mesmer, Guardian, and Necromancer. Elementalist is intentionally excluded.
No engine changes are made by this document.

## 1. Executive finding

The Bloodsong failure is not a missing Sigil of Earth or Sigil of Geomancy
special case. It is a causal-boundary error in the current two-pass design.

Bloodsong is implemented twice:

- During scheduling,
  `js/professions/mesmer/mechanics/expected-procs.js` advances the
  scheduler-owned `bloodsongProgress` and queues blade gains. This is the only
  implementation that can affect later cast availability, blade spending, and
  the public Mesmer end state.
- During resolution,
  `handleMesmerConditionEvent()` in
  `js/professions/mesmer/resolver/event-handlers.js` sees every successfully
  resolved bleeding application, including Earth and Geomancy, but only
  advances a fresh resolver-owned counter. On reaching five it subtracts five
  and grants nothing.

Native skill bleeding crosses the scheduler boundary, so the scheduler-side
tracker sees it. Jagged Mind and Sharper Images do not cross as condition
events, but `expected-procs.js` predicts their bleeding from scheduled damage
events. Earth and Geomancy are created later by
`js/platform/gw2/resolver/event-handlers.js`, after scheduling and cast
validation have ended. The scheduler therefore cannot count them.

The correct long-term fix is to make the scheduled event stream **causally
complete** before resolution: any proc or reaction that can affect later
scheduling state must be materialized during the scheduling phase as a
canonical event. The resolver should evaluate those events, not discover new
schedule-relevant causes.

For this issue, shared GW2 sigil triggers should be materialized by a generic
GW2 scheduler extension. Mesmer should then count canonical bleeding events
once, regardless of whether the source is a skill, trait, sigil, relic, or a
future shared mechanic.

## 2. Current data flow

The relevant current paths are:

```text
Native skill bleeding
  -> scheduler condition event
  -> Mesmer onEventScheduled
  -> expected-proc task
  -> scheduler Bloodsong counter
  -> scheduler resource task
  -> blade is available to later casts
  -> resolver applies the same condition

Jagged Mind / Sharper Images bleeding
  -> scheduler damage event
  -> Mesmer onEventScheduled
  -> expected-proc task predicts critical bleeding
  -> scheduler Bloodsong counter and blade
  -> resolver damage reaction independently creates the actual bleeding

Earth / Geomancy bleeding
  -> scheduler damage or weapon_set event
  -> no bleeding event exists during scheduling
  -> resolver detects the sigil proc
  -> resolver applies bleeding
  -> resolver Bloodsong counter reaches/subtracts thresholds
  -> no resource event and no scheduler-visible blade
```

The last path explains both reported sigils:

- Earth is produced inside `handleCriticalSigils()` after resolver-time hit
  context and expected critical progress are evaluated.
- Geomancy is produced inside `handleSwapSigils()` when the resolver processes
  `weapon_set` or `sigil_swap`.

`createGw2ConditionResolution()` already has the right generic observation
point for resolved conditions: `onConditionApplied` fires for direct and
resolver-generated conditions. The problem is timing, not condition-source
recognition. By then the rotation has already been scheduled.

## 3. Reproduced failures

### Sigil of Earth

Configuration:

- Virtuoso, zero initial blades
- Bloodsong selected
- 100% expected critical chance
- Sigil of Earth on the active set
- five `Flying Cutter` casts separated enough to satisfy Earth's two-second
  internal cooldown
- `Bladesong Harmony` immediately after the fifth hit

Observed current result:

- five resolved `Sigil of Earth — Bleeding` applications
- resolver `bloodsongProgress` returns to `0`, proving it counted and consumed
  the five-stack threshold
- no `resource` event with reason `Bloodsong`
- Mesmer end resource remains `0`
- `Bladesong Harmony` is rejected with
  `Bladesong Harmony requires at least one blade.`

This proves that adding a resource only to resolver output would be
insufficient. The resource must exist before the later cast is validated.

### Sigil of Geomancy

A weapon swap into Geomancy followed by high-critical-chance Phantasmal
Swordsman attacks produces:

- one resolved Geomancy bleeding application
- nine Sharper Images bleeding applications in the inspected time window
- ten total bleeding stacks, which should yield two Bloodsong blades
- only one scheduler-created Bloodsong resource event

The scheduler counter ends with four unconsumed stacks because it saw only the
nine predicted Sharper Images applications. The resolver counter ends at zero
because it saw all ten, but the resolver does not grant the missing blade.

## 4. Why this is an architectural issue

The scheduled stream currently means two different things:

1. a chronology used to decide castability and profession resources; and
2. an incomplete set of combat causes that the resolver expands with sigils,
   relics, food, and profession reactions.

That split is safe only when resolver-generated effects cannot feed back into
cast timing, availability, cooldowns, ammo, or profession resources.
Bloodsong disproves that assumption.

The same class of bug can recur whenever:

- a shared sigil, relic, food, or future equipment effect applies a condition
  that a profession mechanic observes;
- a resolver-time profession trait creates an event that another
  schedule-relevant profession rule observes;
- Guardian gains a schedule-relevant resource from an on-hit or on-condition
  effect;
- Necromancer gains or spends life force in response to a resolver-created
  hit, condition, minion effect, or equipment proc; or
- a future profession gates casts on any state derived from resolved combat
  events.

Guardian's Justice/Ashes reactions and Necromancer's critical/condition trait
reactions already demonstrate that the resolver creates secondary combat
effects. They do not currently feed scheduler-gated resources in the same way,
but they make a targeted Mesmer-only sigil fix a poor foundation.

## 5. Additional weaknesses exposed by Bloodsong

### Two Bloodsong state machines

The scheduler and resolver each start with independent
`bloodsongProgress` fields. Their results can diverge while tests still pass
because `projectMesmerEndState()` projects the scheduler resource state and
ignores the resolver counter.

The resolver implementation consuming five stacks without producing a blade
is not a complete Bloodsong implementation. It currently acts as an invisible
counter.

### Critical bleeding is predicted separately from its application

`expected-procs.js` predicts Jagged Mind and Sharper Images bleeding directly
from scheduled hits. `trait-rules.js` independently creates those conditions
during resolution. The scheduler's `baseCriticalChance()` and the resolver's
`query.critical()` are separate calculations.

The two calculations currently overlap, but the resolver also knows about
timestamped buffs, active-set state, runtime state, Severance, and compiled
profession modifiers. Any future difference changes blade generation without
necessarily changing the resolved bleeding in the same way.

### `onEventScheduled` is not equivalent to “condition applied”

A scheduled condition can later be excluded by combat-start or encounter
bounds. Conversely, a resolver-created condition can be genuinely applied
without ever being scheduled. Bloodsong currently uses both meanings in its
two implementations.

Target death is already a broader limitation of an offline scheduled
rotation, but precombat filtering and proc creation are avoidable
inconsistencies.

## 6. Recommended ownership rule

Adopt this invariant:

> Before the scheduler-to-resolver handoff, the event stream must contain every
> event whose existence can affect future scheduling state. The resolver may
> calculate numeric results and numeric-only derivatives, but it must not
> discover a new event that could have changed an earlier cast decision.

This keeps the scheduler/resolver paradigm:

- **Scheduler and timeline materializer:** decides what happens and when,
  including deterministic expected procs, condition applications, resource
  gains, and state transitions used by later commands.
- **Resolver:** calculates strike damage, condition duration/ticks/damage,
  target-health outcomes, reporting, and other values that do not alter the
  already-decided rotation.

The neutral engine must remain GW2-agnostic. Shared proc materialization
belongs under `js/platform/gw2/scheduler`, injected into
`platform/engine/scheduler` through a generic scheduler-extension or policy
contract.

## 7. Recommended implementation shape

### A. Add a generic GW2 trigger materializer

Create a shared GW2 scheduler component that:

- observes canonical `damage`, `weapon_set`, `sigil_swap`, `control`, and
  other trigger events;
- schedules typed work at the trigger timestamp instead of resolving a
  future hit immediately when that hit is first emitted;
- owns common chronological proc state such as combat-active state, sigil
  internal cooldowns, expected-critical progress, Doom pending state, and the
  active weapon set;
- emits ordinary canonical `damage`, `condition`, `buff`, and `proc` events
  for triggered effects; and
- is composed with every non-legacy GW2 profession without importing a
  profession module.

Typed tasks are important. A persistent attack can emit a future hit before
later rotation commands have scheduled earlier weapon swaps or buffs.
Evaluating the proc at `event.at`, when the scheduler clock reaches that time,
preserves chronology.

The engine can support this without learning GW2 terms by adding ordered,
opaque scheduler-extension hooks/task handlers alongside the profession
hooks. Alternatively, the existing scheduler policy can grow equivalent
generic lifecycle hooks. Mutable GW2 proc state should be owned by that
per-simulation extension, not by Mesmer.

### B. Share expected-hit facts

Factor critical chance and other trigger facts needed by both phases into one
timestamp-aware query service. The materializer should not copy
`baseCriticalChance()` or damage formulas.

The materializer needs expected critical chance, actor ownership, active
sigils, and relevant timed buffs. It does not need final strike damage.
The resolver can consume the same facts when calculating expected damage.

### C. Make sigil proc events explicit

Move Earth, Geomancy, and the other event-generating sigil decisions out of
`platform/gw2/resolver/event-handlers.js` and into the materializer.
The resolver should consume the emitted proc strike/condition events exactly
once. It should not trigger the same sigil a second time.

This should be done for the sigil trigger family rather than special-casing
only Earth and Geomancy. Air, Torment, Blight, Doom, Hydromancy, Energy, and
Severance share trigger state and ordering.

### D. Collapse Mesmer bleeding tracking to one path

Materialize Jagged Mind and Sharper Images condition applications before the
handoff using the shared expected-hit facts. Then simplify Mesmer:

- all real/predicted bleeding exists as canonical `condition` events;
- one scheduler-side Bloodsong reducer listens for bleeding applications;
- every five stacks queue one existing Mesmer resource task;
- remove hit-to-bleeding prediction from `expected-procs.js`;
- remove or convert the resolver Bloodsong counter into a non-authoritative
  assertion; and
- retain the existing resource controller for blade caps, reporting, and
  same-timestamp task ordering.

Bloodsong remains profession-owned. The platform materializer only guarantees
that shared GW2 causes are represented generically.

### E. Apply the invariant to Guardian and Necromancer incrementally

After the sigil/Bloodsong fix, inventory resolver reactions that enqueue
damage, conditions, or buffs:

- Guardian Justice, Ashes, and trait damage/buffs;
- Necromancer Barbed Precision, Dhuumfire, Demonic Lore, Deathly Chill,
  Chilling Darkness, and other queued trait effects; and
- shared relic/food effects.

Move event-generating reactions to the materialization phase when their output
could participate in another causal rule. Leave numeric-only modifiers in the
resolver. This avoids waiting for a second Bloodsong-style bug before making
the ownership boundary consistent.

## 8. Approaches not recommended

### Add Earth/Geomancy checks to Mesmer

This duplicates shared sigil rules, internal cooldowns, active-set logic, and
critical calculations in a profession module. Guardian, Necromancer, and
future professions would need the same repair.

### Grant a blade only in the resolver

This can repair an end-state number or log entry but cannot make a later
Bladesong valid, change its blade count, or alter subsequent scheduling.

### Copy resolver sigil logic into the scheduler and keep both authoritative

This creates the same drift already present between `baseCriticalChance()` and
`query.critical()`. Proc occurrence must have one owner.

### Move all skill scheduling into the resolver

If resource-gated casts are still decided before resolution, the feedback
problem remains. If casts are also deferred, the current scheduler/resolver
contract is effectively replaced rather than repaired. Numeric resolution
does not need to own rotation scheduling to solve this issue.

### Re-run scheduler and resolver until results stabilize

An iterative feedback pass is expensive and difficult to reason about:
newly-valid casts can change timing, proc counts, cooldowns, and the next
iteration's resource grants. Convergence and warning semantics would require a
new contract. Chronological materialization is simpler and deterministic.

## 9. Verification and migration plan

### Regression tests first

Add tests that prove behavior, not just final counters:

1. Five Earth bleeding applications with Bloodsong produce one Bloodsong
   resource event, and an immediately following one-blade Bladesong is valid.
2. Four other bleeding stacks plus one Geomancy stack cross the threshold at
   the correct timestamp.
3. Geomancy uses only the destination weapon set and respects combat-active
   state and its internal cooldown.
4. Earth uses player-hit ownership, expected-critical accumulation, active-set
   sigils, and its internal cooldown.
5. Without Bloodsong, neither sigil grants a blade.
6. Native skill bleeding, Jagged Mind, and Sharper Images retain current
   blade timing and damage.
7. Same-timestamp trait/sigil bleeding has a documented stable order.
8. Guardian and Necromancer sigil damage/conditions retain current output.

### Suggested delivery sequence

1. Add the failing Earth and Geomancy tests.
2. Add the generic scheduler-extension seam and chronology tests.
3. Factor the shared expected-hit query.
4. Materialize the complete sigil trigger family and remove resolver-side
   duplicate triggering.
5. Materialize Mesmer critical trait conditions and reduce Bloodsong to one
   scheduler-owned condition reducer.
6. Run Mesmer oracle/parity tests plus Guardian, Necromancer, resolver,
   scheduler-temporal, architecture, and full test suites.
7. Audit the remaining event-generating resolver reactions against the causal
   completeness invariant.

### Compatibility implications

- The scheduled event stream will gain explicit proc-generated events. Tests
  and fixtures that compare exact stream contents will need intentional
  updates.
- `procSteps` should be derived from explicit proc events without duplicates.
- Event `source`, `sourceId`, `actorType`, `triggeredBy`, active weapon set,
  and insertion order must be preserved so damage modifiers and UI grouping
  remain stable.
- Existing condition duration and damage calculations should remain in the
  resolver; only condition occurrence moves earlier.
- Event-schema versioning is needed only if required fields or meanings
  change. Adding already-valid canonical events does not by itself require a
  schema change.

The independent recommendation is therefore a scheduler-side, shared GW2
causal materialization layer, not a Mesmer-specific sigil patch and not a
wholesale move of resource-sensitive mechanics into the resolver.

## 10. Comparison with `MESMER_SKILL_EFFECTS_MIGRATION`

_Added after the independent evaluation._

The migration document's 2026-07-26 amendment reaches the same core diagnosis
and target architecture as this independent review. It materially corroborates
rather than overturns sections 1 through 9.

### Points of agreement

Both evaluations conclude that:

- resolver-created Earth and Geomancy bleeding cannot grant a
  scheduler-owned blade in time to affect a later cast;
- `handleMesmerConditionEvent()` sees the bleeding but is non-authoritative
  and incomplete because it consumes thresholds without creating resources;
- granting or displaying the blade only after resolution is not a fix;
- sigil proc selection and canonical event production must occur on the
  scheduler clock, while strike and condition damage math stays in the
  resolver;
- delayed hits require chronological tasks at impact time rather than proc
  decisions when a future event is first emitted;
- the GW2 implementation belongs in a shared platform scheduler extension or
  policy seam, not in Mesmer or the neutral engine;
- scheduler and resolver must share one critical-context calculation before
  critical sigils move;
- resolver-side sigil synthesis must be deleted as each trigger family moves,
  or the simulator will double-apply effects;
- Bloodsong should have one scheduler-authoritative progress path; and
- the correction should be separate from the legacy Mesmer
  skill-effects-to-declarative migration.

The two independent reproductions also agree on the important behavioral
acceptance criterion: a sigil-earned blade must make a subsequent Bladesong
castable. A final end-state resource assertion is too weak.

### Useful details added by the migration amendment

The amendment identifies several concrete safeguards that should be adopted:

1. Move swap sigils before critical sigils. Geomancy, Doom, and Hydromancy can
   establish the scheduler-policy task/state seam without first solving the
   harder expected-critical-context problem.
2. Preserve the Virtuoso specialization guard from the scheduler Bloodsong
   path. The resolver copy currently checks only the trait.
3. Replace use of the timeline `EPSILON` as a stack-progress tolerance with a
   domain-specific numeric tolerance.
4. Include dynamic Fury/Might, active-set Accuracy, Severance, profession
   modifiers, delayed hits, and Necromancer target-condition critical rules in
   scheduler/resolver critical-context differential tests.
5. Explicitly test precombat filtering, exact ICD boundaries, two simultaneous
   proc sigils, destination-set swap selection, ownership metadata, proc icons,
   and `4 + 2` / eleven-stack Bloodsong carryover.
6. Treat the existing Thousand Cuts timing assertion as a separate baseline
   problem. This review independently encountered the same current failure:
   the test expects the first packet at `0.05`, while the worktree emits it at
   `0`.

These details strengthen the implementation and test sequence in section 9.

### Difference in breadth

The migration amendment is deliberately limited to sigil ownership and
Bloodsong cleanup. This review recommends applying the causal-completeness
invariant more broadly after that work:

- materialize Jagged Mind and Sharper Images condition events instead of
  maintaining independent hit-to-Bloodsong predictions;
- audit shared relic/food event production; and
- audit Guardian and Necromancer resolver reactions that enqueue secondary
  damage, conditions, or buffs.

Those broader moves should not be bundled into the Bloodsong fix. They are a
follow-up architecture audit prompted by the same failure mode. Resolver
reactions that only alter numeric resolution can remain where they are.

### Reconciled recommendation

Use the amendment's narrower pull-request ordering within the independent
target architecture:

1. Lock current sigil parity and the new failing Bloodsong/castability cases.
2. Extract and differentially test one shared critical-context service.
3. Add the generic scheduler-policy observation/task seam.
4. Move swap-triggered sigils and delete their resolver synthesis.
5. Move critical-triggered sigils and delete their resolver synthesis.
6. Remove the resolver Bloodsong counter/reaction and consolidate Mesmer
   bleeding tracking.
7. Separately audit other resolver-created causal events against the invariant
   in section 6.

The other document therefore does not reveal a reason to migrate skill effects
into the resolver or weaken the scheduler/resolver boundary. Its amendment
supports the same conclusion: preserve the two phases, but make the scheduled
stream causally complete before numeric resolution.
