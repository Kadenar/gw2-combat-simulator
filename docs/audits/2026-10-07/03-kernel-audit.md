# Kernel and execution-consumer audit

Status: initial audit complete; ready for independent review.

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3`.

## Scope and ownership

This review read all nine literal `js/kernel` modules (543 source lines) and traced selected GW2 execution consumers
where primitive contracts meet simulation behavior. Casts, recharge, damage, effects, and profession lifetimes are
platform/profession responsibilities, not literal kernel modules. Cross-scope findings were coordinated with the
platform auditor. There are two medium-severity native cast failures, four low-severity correctness/contract findings,
and one low-severity performance concern. Coverage is exhaustive for the literal kernel; it is not a claim of bug
absence or an exhaustive audit of every importing module.

| Literal kernel module                 | Coverage and result                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/kernel/core/clock.ts`             | Complete: integer-microsecond normalization, safe numeric range, negative zero, finite timestamp rejection, half-open/unbounded windows, EPSILON units; actual readiness/observation callers traced. KERNEL-001/006 are caller/contract mismatches, not evidence that the constant itself is wrong.         |
| `js/kernel/core/collections.ts`       | Complete: map/record entry conversion and stable binary-search insertion after equal keys. Timeline consumers traced; KERNEL-004 occurs after the correctly preserved resolved ordering.                                                                                                                    |
| `js/kernel/core/dynamic-fields.ts`    | Complete: type-only open record declaration; no runtime lifecycle or mutable singleton.                                                                                                                                                                                                                     |
| `js/kernel/core/numeric.ts`           | Complete: clamp, half-even rounding tolerance, finite/coerced/bounded numbers and integer truncation; damage rounding consumers inspected. No new primitive defect established.                                                                                                                             |
| `js/kernel/core/simulation-random.ts` | Complete: frozen normalized configuration, seed coercion/clamping, named stream hashing, per-instance state, probability endpoints and draw consumption. Resolver critical/weapon-strength usage traced and stream isolation exercised. No leaked state reproduced.                                         |
| `js/kernel/core/unvalidated.ts`       | Complete: type-only boundary aliases; validation belongs to consumers.                                                                                                                                                                                                                                      |
| `js/kernel/events/queue.ts`           | Complete: heap construction/insertion/removal, canonical timestamps, private phases, priority/causal/stable ties, inherited causal context, command frontier, mutation guard, identity/predicate cancellation, lazy retention and same-time limit. KERNEL-002 identifies constructor preparation asymmetry. |
| `js/kernel/execution/limits.ts`       | Complete: shared 100,000 limit; actual coordinator/queue enforcement traced, including the one-handler expansion gap in KERNEL-007.                                                                                                                                                                         |
| `js/kernel/execution/observation.ts`  | Complete: policy normalization/freezing, unit conversion, tail addition, invalid endpoints, absolute tolerance; live termination caller traced. KERNEL-006 identifies inconsistent handling.                                                                                                                |

The static kernel-import inventory contains 222 files across the application. The following consumer paths received
direct source review; broad neighboring domains were coordinated with peers rather than assumed covered:

| Consumer area                               | Files and reviewed contracts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single runtime and lifecycle                | Complete reads of `js/games/gw2/platform/simulation/runtime.ts`, `js/games/gw2/platform/simulation/coordinator.ts`, `js/games/gw2/platform/simulation/combat-execution.ts`, `js/games/gw2/platform/simulation/internal-work.ts`, and `js/games/gw2/platform/simulation/runtime-resources.ts`; public `js/games/gw2/platform/simulation/simulate.ts`. Construction per run, clock ownership, command/work interleaving, causal scopes, owner-generation cancellation, internal payload detachment, first damage/death, observation cutoff, output-mode composition, and abort-on-invariant semantics.                                                                                                                                                                                                                                                  |
| Casts and recharge                          | Complete reads of `js/games/gw2/platform/execution/cast-execution.ts`, `js/games/gw2/platform/execution/cooldowns.ts`, `js/games/gw2/platform/execution/rotation-driver.ts`, `js/games/gw2/platform/execution/rotation-cursor.ts`, `js/games/gw2/platform/execution/rotation.ts`, `js/games/gw2/platform/execution/cast-effects.ts`, `js/games/gw2/platform/execution/cast-timing.ts`, `js/games/gw2/platform/execution/skill-cost.ts`, and `js/games/gw2/platform/execution/transition-lockouts.ts`; availability composition and skill flags traced at the finding locations. Acceptance/commit separation, positive-duration versus instant/independent lanes, transformed IDs, interrupt cutoffs, in-flight reservations, recharge anchors, sequential ammo work, reductions/restoration/checkpoints and reset.                                   |
| Recharge and resource arithmetic            | `js/games/gw2/platform/combat/recharge.ts`, `js/games/gw2/platform/combat/action-tick.ts`, `js/games/gw2/platform/combat/resources/pool.ts`, and `js/games/gw2/platform/combat/resources/endurance.ts` read; resource clock/policy interfaces followed selectively. Constant player rate versus received summon Alacrity, 40 ms readiness detection, interval integration, capped values and resource/time tolerance ownership. General resource authoring/contracts remain platform-auditor scope.                                                                                                                                                                                                                                                                                                                                                   |
| Delivery, damage and conditions             | Complete reads of `js/games/gw2/platform/resolver/effect-delivery.ts`, `js/games/gw2/platform/resolver/event-handlers.ts`, `js/games/gw2/platform/resolver/event-phase.ts`, `js/games/gw2/platform/resolver/hit-resolution.ts`, `js/games/gw2/platform/resolver/weapon-strength-resolution.ts`, and `js/games/gw2/platform/resolver/condition-resolution.ts`; runtime state construction and critical proc use also traced. Queued versus immediate settlement, deferred preparation, cancellation/target/death gates, strike critical fact and rounding, condition application-duration snapshots versus impact-time damage queries, half-open expiry, shared owner pulses, buffered remainders, stale wake tokens, source/activation attribution and detached reporting. This is internal consistency review, not live-game coefficient validation. |
| Boons, modifiers and temporal queries       | Boon pool/replay/window code in `js/games/gw2/platform/combat/boons.ts` and all of `js/games/gw2/platform/combat-calculation/timeline-index.ts`; selected paths in `js/games/gw2/platform/combat-calculation/combat-query.ts` and modifier execution in `js/games/gw2/platform/combat/modifiers.ts`. Duration/intensity stacking, recipient separation, extension expiry, live versus history reads, same-time cache invalidation, acceptance versus impact sampling. Individual modifier declarations and all normalization branches were not exhaustively audited here.                                                                                                                                                                                                                                                                             |
| Facts and public results                    | `js/games/gw2/platform/combat/history/executed-facts.ts`, `js/games/gw2/platform/results/planning-state.ts`, `js/games/gw2/platform/results/project-runtime.ts`, `js/games/gw2/platform/results/combat-result.ts`, and `js/games/gw2/platform/results/resolved-events.ts`. Gameplay facts versus optional reports, detached planning snapshots, observation clipping, totals/attribution and score/detailed projection. No browser chart/rendering review claimed.                                                                                                                                                                                                                                                                                                                                                                                    |
| Effects and concrete authoring reachability | `js/games/gw2/platform/effects/materializer.ts` and `js/games/gw2/platform/effects/timing.ts`; selected numeric/timing validation and patch-edit fields. Native Thief Dodge/No Quarter and Guardian Firebrand page consumers, fractional wait normalization, normal duration editor, concurrency palette guard and log wait quantization were traced at the finding citations. Full native contract compiler, catalogs, patch UI and all profession implementations remain peer scope.                                                                                                                                                                                                                                                                                                                                                                |

## Methods and evidence

- Read the shared audit brief and relevant repository/platform contribution and ownership guidance. Consulted
  `README.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/MODULES.md`,
  `docs/architecture/PROGRAMMATIC-SIMULATION.md`, `js/games/gw2/platform/README.md`, `tests/README.md`, and
  `scripts/README.md`; read `docs/architecture/SIMULATION-EVENT-CLOCK.md`, `docs/architecture/SKILL-EVENT-ORDERING.md`,
  and `docs/architecture/SHARED-CONDITION-TICKS.md` for the event/condition contract. Current source, not stale
  two-stage README wording, establishes one runtime queue/clock.
- Read all kernel source and kernel tests, inventory imports with `rg`, then trace selected execution, resolver, history
  and output consumers. Consulted focused runtime, ordering, observation, condition, boon and randomness test sources as
  needed. Reviewed snippets against numbered baseline source.
- Reproduced native failures and synthetic extension-contract inconsistencies with the existing compiled modules; did
  not change tracked production code, tests or configuration, rebuild, or rerun the broad suite. Essential snippets are
  preserved below so ignored scratch files are not required evidence.
- Coordinator baseline `npm run check` passed, including 4,876 Node tests. Focused results and negative controls are
  recorded separately below. No external game-mechanic claim, benchmark snapshot, or timing-grid assumption is used to
  elevate a finding.

## Confirmed findings

### KERNEL-001 — Cost admission can accept an unfunded cast and abort a valid simulation

**Classification:** bug in a GW2 kernel consumer (not in the generic clock). **Severity:** medium. **Confidence:** high;
reproduced with a shipped native profession through the public entry point.

**Baseline locations:** `js/games/gw2/platform/execution/skill-cost.ts:21–39` (`skillCostAvailability`, particularly
line 31), `js/games/gw2/platform/profession-definition/profession.ts:438–455` (native availability composition),
`js/games/gw2/platform/simulation/runtime-resources.ts:229–235` (endurance spending), and
`js/games/gw2/platform/execution/cast-execution.ts:327–338` (completion reservation followed by cost payment). The
underlying timing tolerance is `js/kernel/core/clock.ts:10`.

**Expected:** a declared cost admitted by the shared availability gate can be paid; a still-unfunded command waits until
its controller's advertised readiness instant. **Observed:** availability treats a future readiness deadline up to 100
microseconds away as already ready. Spending compares the resource amount instead, so enough regeneration per second
turns that time allowance into a larger-than-allowed resource deficit and throws. This aborts the whole run after cast
admission has begun.

**Trigger/impact:** a command arrives just before an affordability boundary, possible through supported
fractional-millisecond rotation waits. This affects shared declared costs; the confirmed shipped case is ordinary Thief
Dodge with no traits or boons. It is not a claim that normal integer-millisecond presets currently fail.
`js/games/gw2/platform/execution/rotation.ts:116–123,183` accepts and preserves finite fractional `durationMs`. The
normal duration editor rounds to an integer (`js/ui/rotation/editing/duration-editor.ts:19–35`); log reconstruction
applies its `quantizeMs` policy before adding waits
(`js/games/gw2/integrations/logs/shared/rotation/timeline.ts:183–205`). The demonstrated reachability is the supported
public/canonical input boundary, not ordinary manual wait entry.

**Reproduction** (repository root, after the baseline build; run with `node --input-type=module`):

```js
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
simulateGw2({
  profession: thiefProfession,
  config: {
    specialization: 'Core',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    boons: {},
    selectedTraitIds: [],
    selectedSkillIds: [],
    target: { armor: 2597, conditions: {} },
    sigilSets: [{ names: [] }]
  },
  rotation: [
    { type: 'cast', skillId: -5 },
    { type: 'cast', skillId: -5 },
    { type: 'wait', durationMs: 8399.95 },
    { type: 'cast', skillId: -5 }
  ]
});
```

Actual result: `RangeError: Insufficient endurance.` The first two dodges occupy 0–0.8 and 0.8–1.6 seconds. The wait
ends at 9.999950 seconds; the third dodge requires 50 endurance and the controller reports readiness at 10 seconds.
Admission accepts because `10 <= 9.999950 + 0.0001`; the balance is approximately 49.99975, below spending's
`50 - 0.0001` threshold. Replacing the wait with **8399.8** milliseconds waits to 10 seconds and completes at 10.8;
**8400** milliseconds also succeeds. A separate continuous-energy fixture using the real shared gate reproduces the same
mismatch against `RESOURCE_TOLERANCE = 1e-9`.

**Smallest recommendation:** compare the controller's canonical readiness deadline with the current canonical time
without borrowing the clock EPSILON, leaving resource affordability tolerance in the resource owner. Preserve real
controller return semantics for already-affordable balances. Do not merely enlarge spending tolerance to mask an earlier
cast.

**Regression risk/validation:** readiness rounding and fractional regeneration need one consistent contract. Add the
native reproduction and controls just before, at, and after the deadline, plus a continuous declared-cost fixture.
Verify score/detailed parity and that no resource is spent before readiness. No production changes made by this audit.

**Related:** coordinated with platform auditor; no matching known issue established. The kernel constant is valid as a
documented tolerance; this finding concerns its use across time and resource units.

### KERNEL-003 — Explicit concurrency bypasses the ordinary cast lane

**Classification:** bug in GW2 execution admission. **Severity:** medium. **Confidence:** high; reproduced with the
native Firebrand runtime. This is a platform caller/lane defect, not heap ordering.

**Baseline locations:** `js/games/gw2/platform/execution/rotation-driver.ts:26–45` (only an explicit
`canCastConcurrently: false` is rejected), `js/games/gw2/platform/execution/rotation-cursor.ts:38–57` (`requestAt`
bypasses serial and blocking deadlines in the offset branch), and
`js/games/gw2/platform/execution/rotation.ts:79–85,126–133,185–191` (canonical command admission). Compare the intended
instant/independent eligibility in `js/games/gw2/app/rotation/palette/interactions.ts:232–240` and the ordinary
serial-lane contract in `docs/architecture/SIMULATION-EVENT-CLOCK.md`, section 4. The optional flag describes whether an
**instant** skill can overlap at `js/games/gw2/platform/skills/types.ts:68–69`.

**Expected:** an explicit offset must not authorize two ordinary positive-duration player casts to overlap. Unsupported
overlap should yield an invalid command/warning before any resource reservation, consistent with existing explicit-false
handling. **Observed:** ordinary skills whose optional concurrency flag is absent can overlap, because `requestAt`
directly uses the prior cast start plus offset. Distinct skill IDs also evade the same-skill in-flight readiness check.

**Trigger/impact:** programmatic or imported canonical rotation with `concurrentOffsetMs` on an ordinary noninstant
skill. The normal palette shift-add flow guards this correctly. At minimum, the backend accepts an impossible
simultaneous cast schedule; when costs are paid at commitment, both accepted casts can rely on the same remaining
resource and one later throws, aborting the run.

```js
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
simulateGw2({
  profession: guardianProfession,
  config: {
    specialization: 'Firebrand',
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Torch',
    initialTomePages: 1,
    boons: {},
    selectedTraitIds: [],
    selectedSkillIds: [],
    target: { armor: 2597, conditions: {} },
    sigilSets: [{ names: [] }]
  },
  rotation: [
    { type: 'cast', skillId: 44364 }, // Tome of Justice
    { type: 'cast', skillId: 40015 }, // Scorched Aftermath: 920 ms
    { type: 'cast', skillId: 40635, concurrentOffsetMs: 0 } // Igniting Burst: 480 ms
  ]
});
```

Actual result: `RangeError: Insufficient tomePages.` Both page skills start at zero with one available page; Igniting
Burst pays at 0.48 seconds and Scorched Aftermath attempts another payment at 0.92 seconds. Removing the offset produces
no warnings: Scorched Aftermath runs 0–0.92 seconds, and Igniting Burst waits for page recharge and runs 8–8.48 seconds.
Both skill records have `canCastConcurrently === undefined`; this is not an explicitly allowed ordinary overlap.

**Smallest recommendation:** centralize a cast-overlap eligibility predicate and enforce it after transformed skill
selection, before calling `requestAt`, matching the instant/independent rule used by authoring. Reject unsupported
commands explicitly instead of silently treating the offset as a different timing operation. Do not solve this solely by
increasing page balances or catching the later spending error.

**Regression risk/validation:** preserve independent companion commands, instant skills, and explicit
`canCastConcurrently: false`; account for runtime duration transforms where they legitimately make a skill instant. Add
a two-distinct-normal-skill scenario, the native page repro, and allowed instant/independent controls. Deferred-cost
reservation under otherwise legitimate overlap is a separate extension-contract question, not established as a shipped
defect here.

**Related:** KERNEL-001 has the same eventual insufficient-resource symptom but a distinct cause and fix. Coordinated
with platform auditor; no matching known issue established.

### KERNEL-004 — Boon replay reorders accepted history and can lose a valid extension

**Classification:** bug in a GW2 timeline consumer. **Severity:** low. **Confidence:** high for the demonstrated
inconsistency; native rotation reachability remains unproven.

**Baseline locations:** `js/games/gw2/platform/combat/boons.ts:418–441` (`timedBuffApplicationsAt`, especially the sort
at line 434), `js/games/gw2/platform/combat-calculation/timeline-index.ts:60–66,82–85,170–174` (resolved history
preserves actual order until extension/window replay bypasses it), and `js/kernel/events/queue.ts:47–54` (phase and
priority precede causal order).

**Expected:** replay of accepted, executed facts reconstructs the same state as live application, including timestamp
ties. **Observed:** replay sorts ties by causal order alone. A higher-priority buff can execute before a lower-priority
extension despite having a later causal order; replay reverses them, attempts to extend an empty pool, and reports the
boon expired.

**Reproduction** through the production runtime with the repository's event fixture:

```js
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
let owner;
const common = { at: 0, source: 'probe', sourceId: 'probe', actorType: 'player' };
resolveTestGw2Events({
  endTime: 1.5,
  events: [
    { ...common, type: 'buff', kind: 'might', duration: 1, stacks: 1, priority: -1, causalOrder: 2 },
    { ...common, type: 'boon_extension', kind: 'might', duration: 2, causalOrder: 1 }
  ],
  engineInitialize(runtime) {
    owner = runtime;
  }
});
console.log(owner.history.map((event) => event.type)); // ['buff', 'boon_extension']
console.log(buffApplicationStacks(owner.boons.get('might'), 'might', 1.5, 25)); // 1
console.log(owner.query.timeline.buffStacksAt('might', 1.5, 0, 25)); // 0
```

**Trigger/impact:** supported same-time packets with priority order different from causal order. The fixture authors
explicit ordering metadata; no ordinary native rotation reproducing this exact ordering was established. Live boon
queries with a runtime store remain correct in this reproduction. The faulty helper also feeds prepared Alacrity windows
and Vigor integration, so these consumers require protection, but a shipped recharge/endurance error is not claimed
here. See `js/games/gw2/platform/combat/boons.ts:273–303` and
`js/games/gw2/platform/combat/resources/endurance.ts:12–33`.

**Smallest recommendation:** distinguish executed-history replay from scheduled-input sorting and preserve recorded
execution order for the former. Propagate that distinction into prepared windows and extension queries. Merely deleting
all sorting would break supported unsorted scheduled inputs; rebuilding a partial comparator also risks missing private
phases and reaction transaction order.

**Regression risk/validation:** keep the existing unsorted scheduled-input/causal-order test at
`tests/games/gw2/platform/boon-extensions.test.js:100–116`. Add the priority inversion above, same-time causal
descendants, and received Alacrity/Vigor integration controls using resolved history. Test both intensity and duration
stacking. No production change made.

**Related:** KERNEL-005 omits a fact; this finding retains the fact but reorders it. They need separate fixes. No
matching known issue established.

### KERNEL-005 — Reaction-settled boon extensions are missing from executed facts

**Classification:** bug in GW2 effect delivery/history consistency. **Severity:** low. **Confidence:** high; reproduced
with native Thief No Quarter through the existing native runtime fixture.

**Baseline locations:** `js/games/gw2/platform/resolver/effect-delivery.ts:194–202` sends immediate extensions directly
to `handlers.dispatch`, bypassing the common history/public-event recording at
`js/games/gw2/platform/resolver/effect-delivery.ts:383–387`. The handler at
`js/games/gw2/platform/resolver/event-handlers.ts:93–96` updates the boon store and optional resolved report only. The
actual native emitter is `extendActiveFury` at `js/games/gw2/professions/thief/core/traits/critical-boons.ts:121–148`;
the all-output-mode executed-fact contract is `js/games/gw2/platform/combat/history/executed-facts.ts:3–34`.

**Expected:** an accepted boon extension is available to executed-fact readers and timeline replay whether it settles in
a reaction or from the queue. Reporting mode can omit report arrays, but should not change gameplay facts. **Observed:**
No Quarter extends live Fury and appears in `resolvedEvents`, but is absent from `runtime.history` and detailed
`events`. Timeline replay therefore sees the original expiry. Score mode has the same history omission.

```js
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
const resolvedAudience = {
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
};
const common = { source: 'probe', sourceId: 'probe', actorType: 'player', resolvedAudience };
const result = runThief(
  [{ type: 'wait', durationMs: 3000 }],
  { specialization: 'Core', selectedTraitIds: [THIEF_TRAIT_IDS.NO_QUARTER] },
  {
    initialize(runtime) {
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...common,
          type: 'buff',
          at: 0,
          kind: 'fury',
          duration: 2,
          stacks: 1
        }
      });
      runtime.effects.emit({
        kind: 'packet',
        event: {
          ...common,
          type: 'damage',
          at: 1,
          coefficient: 1,
          forceCrit: true,
          weaponStrength: 1000
        }
      });
    }
  }
);
const runtime = observedRuntime(result);
console.log(buffApplicationStacks(runtime.boons.get('fury'), 'fury', 3, 1)); // 1
console.log(runtime.query.timeline.buffStacksAt('fury', 3, 0, 1)); // 0
console.log(runtime.history.filter((event) => event.type === 'boon_extension').length); // 0
console.log(result.events.filter((event) => event.type === 'boon_extension').length); // 0
console.log(result.resolvedEvents.filter((event) => event.type === 'boon_extension').length); // 1
```

The fixture supplies a Fury grant and forced critical hit, then the real native trait emits the extension. It does not
replace that trait's handler or delivery services. Repeating with `{ output: 'score', initialize: ... }` preserves
live=1/timeline=0/history-extension-count=0; score intentionally has no public event arrays.

**Trigger/impact:** a reaction-settled extension, as used by No Quarter. Existing native tests at
`tests/games/gw2/platform/boon-extensions.test.js:277–296` verify the optional `resolvedEvents` path and miss
executed-fact parity. Live damage queries use the applied boon store
(`js/games/gw2/platform/combat-calculation/combat-query.ts:239–260`); no direct DPS discrepancy or incorrect effect
chart is established. The proven impact is incomplete public execution history and inconsistent history-based queries.

**Smallest recommendation:** pass immediate boon extensions through the same accepted-event recording path as immediate
buffs, without enqueueing them or applying them twice. Keep reaction settlement synchronous so later critical reactions
observe the extension immediately.

**Regression risk/validation:** check exactly one live application, one history fact, one detailed execution event, and
one optional resolved event; preserve parent/causal identity, score/detailed numerical parity, and No Quarter's same-hit
reaction order. Verify that general dispatch does not introduce inappropriate extra proc/combo reactions.

**Related:** KERNEL-004; coordinated with the platform auditor. No matching known issue established.

### KERNEL-002 — Bulk queue initialization bypasses the declared preparation hook

**Classification:** bug in a kernel extension contract. **Severity:** low. **Confidence:** high. **Reachability:** no
current GW2 production failure demonstrated; the production coordinator constructs an empty queue.

**Baseline locations:** `js/kernel/events/queue.ts:74–95` (`StableEventQueue` constructor; preparation comment at line
78 and initial entries at line 91), `:141–143` (`enqueue`), `js/games/gw2/platform/simulation/coordinator.ts:20–23`
(current empty-queue use).

**Expected:** a hook documented to prepare “every enqueued event before its ordering keys are captured” applies
consistently to initial events and later insertions. **Observed:** the constructor calls `entry` directly, while
`enqueue` invokes `prepare`. Initial packets therefore skip identity stamping/validation/transformation and can sort
differently from the same packets added incrementally.

```js
import { StableEventQueue } from '#kernel/events/queue.js';
const calls = [];
const queue = new StableEventQueue([{ at: 1, name: 'initial' }], {
  prepare(event) {
    calls.push(event.name);
    return { ...event, eventOrder: calls.length };
  }
});
queue.enqueue({ at: 1, name: 'incremental' });
console.log(calls); // ['incremental']
console.log(queue.dequeue().name, queue.dequeue().name); // incremental initial
```

**Trigger/impact:** any owner that combines a nonempty initial list with `prepare`; identity-dependent ordering reverses
initial-before-later expectations because only the later event receives finite causal metadata. A future second game or
bulk-loaded caller could accidentally bypass its preparation contract.

**Smallest recommendation:** run the same preparation operation before `entry` in construction while preserving O(n)
heapification. Avoid implementing construction via repeated enqueue if linear heap construction matters.

**Regression risk/validation:** preparation may be stateful or depend on initialized owner fields; document constructor
invocation timing and initialize queue-owned prerequisites before invoking it. Test one hook per initial/incremental
packet and equivalent ordering, including frozen inputs and thrown preparation. Existing production's empty construction
should be unchanged.

**Related:** existing queue tests compare bulk and incremental paths without `prepare`, so they miss this difference. No
matching known issue established.

### KERNEL-006 — Absolute observation tolerance differs between the primitive and live runtime

**Classification:** architectural inconsistency at the kernel/platform boundary. **Severity:** low. **Confidence:**
high.

**Baseline locations:** `js/kernel/execution/observation.ts:46–63` permits an absolute endpoint up to EPSILON before
rotation end and returns the later time. `js/games/gw2/platform/simulation/runtime.ts:208` installs the exact absolute
endpoint as an initial horizon; `js/games/gw2/platform/simulation/coordinator.ts:166–174` reaches it and rejects an
unfinished rotation before consulting the helper. `docs/architecture/SIMULATION-EVENT-CLOCK.md:185–194` documents the
helper's tolerant contract.

**Expected/observed:** the public runtime should follow the chosen observation contract. With a one-second wait and
absolute end 999.95 ms, the helper accepts and returns 1 second, while the runtime throws
`Absolute observation endTimeMs cannot precede rotation end.` The 50-microsecond difference is representable and below
EPSILON, not binary rounding noise.

```js
import { normalizeObservationPolicy, observationEndTime } from '#kernel/execution/observation.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
const observation = normalizeObservationPolicy({ kind: 'absolute', endTimeMs: 999.95 });
console.log(observationEndTime(observation, 1)); // 1
simulateGw2({
  profession: thiefProfession,
  config: {
    specialization: 'Core',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    boons: {},
    selectedTraitIds: [],
    selectedSkillIds: [],
    target: { armor: 2597, conditions: {} },
    sigilSets: [{ names: [] }]
  },
  rotation: [{ type: 'wait', durationMs: 1000 }],
  observationPolicy: observation
}); // RangeError
```

**Trigger/impact:** programmatic fractional endpoints in the narrow documented tolerance window. Ordinary
equal/end-later windows and long-tail behavior are not implicated. This finding does not select a game mechanic or
require tolerant execution.

**Smallest recommendation:** decide whether absolute horizons are strict canonical endpoints or allow EPSILON
adjustment, then align the helper, coordinator, and documentation. Strict rejection is the smaller implementation change
if maintainers choose to retire the documented allowance; honoring the allowance requires care not to execute arbitrary
extra combat past an intended horizon.

**Regression risk/validation:** test just before/equal/after rotation end, inside/outside EPSILON, with waits, cast
completion, and transition recovery. Existing runtime rejection tests cover materially short windows, not this narrow
disagreement (`tests/games/gw2/platform/runtime.test.js:396–414`).

**Related:** KERNEL-001 also concerns tolerance ownership, but its resource failure is independent. No matching known
issue established.

## Refactoring and bounded-work opportunities

### KERNEL-007 — Eager effect expansion is outside the execution safety budget

**Classification:** performance concern at an authoring/extension boundary, not a demonstrated ordinary-load performance
regression. **Severity:** low. **Confidence:** high for unbounded expansion; no latency, memory-limit, or browser-freeze
measurement is claimed.

**Baseline locations:** `js/kernel/execution/limits.ts:1–5` defines the 100,000-step limit;
`js/games/gw2/platform/simulation/coordinator.ts:126–183` counts outer iterations.
`js/games/gw2/platform/effects/validation.ts:96–140` requires finite numeric counts but does not bound their magnitude
or require safe integers. `js/games/gw2/platform/effects/materializer.ts:121–154` eagerly allocates all strike packets
before dispatch can consume an iteration; analogous repetition exists for other effect types. Supported patch authoring
exposes hits/applications/stacks at `js/games/gw2/integrations/patches/authoring/fields.ts:186–202` and applies numeric
edits at `js/games/gw2/integrations/patches/authoring/patches.ts:455–470`.

**Expected/observed:** a runaway-work budget should also bound the batch produced by one accepted effect, or explicitly
state that author-supplied counts are trusted and outside the budget. A valid finite authored hit count can allocate
more packets than the entire runtime's iteration limit before that limit is checked. Counts above the safe-integer range
are accepted as well; increment-by-one loops cease making progress at sufficiently large integers, even if memory
exhaustion would normally happen first.

```js
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
const [effect] = normalizeSkillEffects([{ type: 'strike', coefficient: 1, atMs: 0, hits: 100001 }], 'audit-count');
const packets = materializeSkillEffectApplications({
  skill: { id: 990111, name: 'Count probe' },
  effect,
  start: 0,
  fullEnd: 0,
  baseEvent: { source: 'probe', sourceId: 990111, actorType: 'player' }
});
console.log(packets.length); // 100001, allocated before any dequeue budget
```

`normalizeSkillEffects([{ type: 'strike', coefficient: 1, atMs: 0, hits: 1e20 }], 'audit-count')` also accepts. The
audit did **not** materialize that huge count. Ordinary shipped catalog counts were not shown to approach this
threshold. The demonstrated boundary is direct canonical effect authoring; patch fields provide an additional authoring
route, but no end-to-end browser patch-freeze experiment was run.

**Smallest recommendation:** reject unsafe/nonintegral repetition counts at the canonical authoring boundary and impose
a documented packet-expansion budget before allocating the array. If intentionally supporting larger batches, use
incremental expansion with budget accounting that cannot be bypassed by one handler. A similar budget should cover
per-stack condition expansion, but this report does not assign a measured complexity regression to it.

**Regression risk/validation:** coefficient splitting, intentional fractional legacy counts, and legitimate large
multi-target batches need explicit compatibility decisions. Verify the maximum accepted batch and first rejected batch
without allocating the rejected count, then ensure ordinary multi-hit coefficients and application attribution are
unchanged.

**Related:** no matching known issue established. This is separate from the correct same-time dequeue guard and should
not be “fixed” by only increasing that guard.

Two narrower cleanup opportunities follow from the review without additional defect claims:

- Document queue handle semantics: `enqueue` may return a canonical copy; callers should retain that result for identity
  cancellation. A probe using `at: 0.56 + 0.04` found cancellation of the original input ineffective, while cancellation
  of the returned handle passed. Current coordinator consumers retain the correct handle. `length` reports retained heap
  entries after discarding only canceled heads, while `pending()` excludes all canceled entries; a two-entry probe
  returned length 2/pending 1. No production misuse of `length` was found. Clarifying naming/contracts is preferable to
  changing cancellation behavior without a caller need.
- Keep game policy outside the kernel. The existing nine-module boundary is small and imports no GW2 modules. Extracting
  casts, conditions, or boon stacking into it solely to reduce platform file size would weaken that boundary. Share
  future profession behavior through the existing native contract and GW2 services first.

## Results, negative evidence, and limitations

The focused diagnostics were run with Node against the coordinator's prebuilt baseline modules, without source changes
or rebuilds:

| Diagnostic                                | Actual result                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Dodge cost boundary matrix         | 8399.8 and 8400 ms waits succeed at 10.8 s; 8399.9 and 8399.95 ms throw insufficient endurance; 8399.999 ms is tolerated by the resource comparison and starts slightly early                                                                                                                                                             |
| Continuous-resource shared-gate fixture   | 999.8 ms advances to 1 s; 999.9, 999.95, and 999.999 ms throw insufficient energy; 1000 ms succeeds                                                                                                                                                                                                                                       |
| Native Firebrand explicit overlap/control | Offset 0 throws insufficient tomePages; removing the offset schedules the second page skill at 8 s and succeeds                                                                                                                                                                                                                           |
| Queue preparation/canonical identity      | Constructor skips prepare; incremental insertion invokes it; returned canonical cancellation handle works                                                                                                                                                                                                                                 |
| Boon priority replay                      | Accepted history is buff then extension; live Might=1 and timeline Might=0 at 1.5 s                                                                                                                                                                                                                                                       |
| No Quarter native reaction fixture        | Live Fury=1, timeline Fury=0 at 3 s; no extension in executed facts, one in detailed resolved events; same gameplay discrepancy in score mode                                                                                                                                                                                             |
| Absolute observation comparison           | Primitive accepts 999.95 ms against 1 s; actual runtime rejects                                                                                                                                                                                                                                                                           |
| Eager materialization                     | 100001 packets allocated; 1e20 accepted by normalization only and deliberately not expanded                                                                                                                                                                                                                                               |
| Eight negative-control groups             | All passed: phase/priority/causal/stable order; returned-handle cancellation; shared command/event safety count; queued-key mutation rejection; finite canonical/half-open clock checks; independent RNG streams and no-draw probability endpoints; frozen tail policy; repeat-run and score/detailed parity for the native Dodge control |
| Canonical-clock idempotence sample        | 10,000 consecutive microseconds around each of nine anchors (1, 10, 1e6, 1e8, 1e9, 2e9, 4e9, 8e9, 9e9 seconds): no sampled `canonicalTime(canonicalTime(t))` disagreement; this is not exhaustive floating-point proof                                                                                                                    |

Commands were
`node .scratch/audit/kernel/{native-cost-probe,native-concurrent-probe,contract-probes,boon-order-probe,reaction-extension-probe,materialization-probe,negative-controls,clock-probe}.mjs`,
executed individually. Scratch diagnostics are not committed; the finding sections preserve their essential
reproductions. The public native variant of KERNEL-006 was additionally checked directly. The coordinator's broad
baseline passed before this work; its 4,876-test result is baseline evidence, not a second run by this reviewer.
Existing test sources were inspected to establish what the focused probes add.

The controls reduce specific concerns; they do not establish general correctness. Source inspection found fresh per-run
queue, histories, random streams, cooldown/resource stores and profession state, owner-generation cancellation, detached
scheduled payloads, private queue phase keys, and `finally` restoration of causal scopes. There is no promise to resume
a runtime after a handler exception; current invariant violations abort the run. Cooldown reset resets recharge state
rather than resetting the simulation clock or RNG. No leaked RNG state, global event counter, canceled-lifetime
resurrection, or ordinary score/detailed numerical divergence was reproduced in this review.

No engine latency benchmark or heap-retention profile was run. Heap insertion/removal is logarithmic; cancellation and
`pending()` scan retained entries; canceled non-head entries remain until popped; event/history indexes retain facts for
the run. These are observed implementation costs, not claims that typical rotations are slow. Performance work should
measure representative long rotations and cancellation-heavy companion workloads before adding identity indexes or
compaction policies.

One unpromoted contract question remains: `docs/architecture/SIMULATION-EVENT-CLOCK.md:168–170` promises upward rounding
of fractional retry deadlines, but `js/games/gw2/platform/execution/rotation-driver.ts:127–132` uses nearest canonical
rounding and rejects a positive 0.4-microsecond retry at time zero as “no future retry boundary.” A synthetic
availability fixture reproduces that warning. No supported native resource controller returning such an off-grid
deadline was established, so this is recorded as an extension/documentation question rather than another shipped
simulation defect.

Known-issue review was limited to the supplied 36 issue bodies and title/keyword checks against relevant terms; no
matching issue for these findings was established. Historical off-grid effect timing discussions are not treated as
evidence that every fractional packet should be rounded to 40 ms. This audit follows the current separation between
integer-microsecond queue ordering and game-specific action-tick rules.

The literal nine kernel modules were reviewed completely. Consumer coverage is selective and explicitly inventoried
above; the 222-file kernel-import inventory is not a claim that every importing file was read line by line. This report
does not independently validate all profession mechanics, all damage coefficients against live GW2, every modifier
declaration, equipment proc behavior, combo recipes, authoring/import UI, workers, storage, or browser rendering. Those
domains are covered by peer reports or remain outside this report. No external game facts were needed for the internal
inconsistencies reported here. Constant player Alacrity, effective Quickness-calibrated player casts, and full player
health are documented policies, not findings. Actual summon Alacrity is received-boon dependent; stale blanket
documentation was shared with the professions auditor rather than duplicated as a kernel defect.
