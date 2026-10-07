# Kernel and execution-consumer audit

Status: initial investigation in progress; findings below are not yet frozen.

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3`.

## Scope and ownership

This review inventories all nine literal `js/kernel` modules and follows their GW2 execution consumers where primitive contracts meet simulation behavior. Casts, recharge, damage, effects, and profession lifetimes are platform/profession responsibilities, not literal kernel modules. Cross-scope findings are coordinated with the platform auditor. This is an exhaustive coverage objective, not a claim that reviewed code is bug-free.

| Kernel module | Review status |
| --- | --- |
| `core/clock.ts` | Read completely; consumer tracing in progress |
| `core/collections.ts` | Read completely; consumer tracing in progress |
| `core/dynamic-fields.ts` | Read completely; type-only declaration |
| `core/numeric.ts` | Read completely; consumer tracing in progress |
| `core/simulation-random.ts` | Read completely; consumer tracing in progress |
| `core/unvalidated.ts` | Read completely; type-only declaration |
| `events/queue.ts` | Read completely; focused contract diagnostics planned |
| `execution/limits.ts` | Read completely; consumer tracing in progress |
| `execution/observation.ts` | Read completely; focused boundary diagnostics planned |

## Methods and evidence

- Read audit brief, architecture and platform ownership documentation; event-clock and ordering documentation are being checked against actual call paths.
- Read each literal kernel module in full with baseline line numbers.
- Baseline `npm run check` was run by the coordinator and passed, including 4,876 Node tests. This reviewer does not repeat the broad baseline.
- Focused diagnostics use the existing compiled `dist` and live only under `.scratch/audit/kernel/`; reproduction snippets will be preserved in this report.

## Confirmed findings

### KERNEL-001 — Cost admission can accept an unfunded cast and abort a valid simulation

**Classification:** bug in a GW2 kernel consumer (not in the generic clock). **Severity:** medium. **Confidence:** high; reproduced with a shipped native profession through the public entry point.

**Baseline locations:** `js/games/gw2/platform/execution/skill-cost.ts:21–39` (`skillCostAvailability`, particularly line 31), `js/games/gw2/platform/profession-definition/profession.ts:438–455` (native availability composition), `js/games/gw2/platform/simulation/runtime-resources.ts:229–235` (endurance spending), and `js/games/gw2/platform/execution/cast-execution.ts:327–338` (completion reservation followed by cost payment). The underlying timing tolerance is `js/kernel/core/clock.ts:10`.

**Expected:** a declared cost admitted by the shared availability gate can be paid; a still-unfunded command waits until its controller's advertised readiness instant. **Observed:** availability treats a future readiness deadline up to 100 microseconds away as already ready. Spending compares the resource amount instead, so enough regeneration per second turns that time allowance into a larger-than-allowed resource deficit and throws. This aborts the whole run after cast admission has begun.

**Trigger/impact:** a command arrives just before an affordability boundary, possible through supported fractional-millisecond rotation waits. This affects shared declared costs; the confirmed shipped case is ordinary Thief Dodge with no traits or boons. It is not a claim that normal integer-millisecond presets currently fail. `execution/rotation.ts:116–123,183` accepts and preserves finite fractional `durationMs`. The normal duration editor rounds to an integer (`js/ui/rotation/editing/duration-editor.ts:19–35`); log reconstruction applies its `quantizeMs` policy before adding waits (`js/games/gw2/integrations/logs/shared/rotation/timeline.ts:183–205`). The demonstrated reachability is the supported public/canonical input boundary, not ordinary manual wait entry.

**Reproduction** (repository root, after the baseline build; run with `node --input-type=module`):

```js
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
simulateGw2({
  profession: thiefProfession,
  config: {
    specialization: 'Core', primaryWeapon: 'Dagger', secondaryWeapon: 'Dagger',
    boons: {}, selectedTraitIds: [], selectedSkillIds: [],
    target: { armor: 2597, conditions: {} }, sigilSets: [{ names: [] }]
  },
  rotation: [
    { type: 'cast', skillId: -5 }, { type: 'cast', skillId: -5 },
    { type: 'wait', durationMs: 8399.95 }, { type: 'cast', skillId: -5 }
  ]
});
```

Actual result: `RangeError: Insufficient endurance.` The first two dodges occupy 0–0.8 and 0.8–1.6 seconds. The wait ends at 9.999950 seconds; the third dodge requires 50 endurance and the controller reports readiness at 10 seconds. Admission accepts because `10 <= 9.999950 + 0.0001`; the balance is approximately 49.99975, below spending's `50 - 0.0001` threshold. Replacing the wait with **8399.8** milliseconds waits to 10 seconds and completes at 10.8; **8400** milliseconds also succeeds. A separate continuous-energy fixture using the real shared gate reproduces the same mismatch against `RESOURCE_TOLERANCE = 1e-9`.

**Smallest recommendation:** compare the controller's canonical readiness deadline with the current canonical time without borrowing the clock EPSILON, leaving resource affordability tolerance in the resource owner. Preserve real controller return semantics for already-affordable balances. Do not merely enlarge spending tolerance to mask an earlier cast.

**Regression risk/validation:** readiness rounding and fractional regeneration need one consistent contract. Add the native reproduction and controls just before, at, and after the deadline, plus a continuous declared-cost fixture. Verify score/detailed parity and that no resource is spent before readiness. No production changes made by this audit.

**Related:** coordinated with platform auditor; no matching known issue established. The kernel constant is valid as a documented tolerance; this finding concerns its use across time and resource units.

### KERNEL-003 — Explicit concurrency bypasses the ordinary cast lane

**Classification:** bug in GW2 execution admission. **Severity:** medium. **Confidence:** high; reproduced with the native Firebrand runtime. This is a platform caller/lane defect, not heap ordering.

**Baseline locations:** `js/games/gw2/platform/execution/rotation-driver.ts:26–45` (only an explicit `canCastConcurrently: false` is rejected), `js/games/gw2/platform/execution/rotation-cursor.ts:38–57` (`requestAt` bypasses serial and blocking deadlines in the offset branch), and `js/games/gw2/platform/execution/rotation.ts:79–85,126–133,185–191` (canonical command admission). Compare the intended instant/independent eligibility in `js/games/gw2/app/rotation/palette/interactions.ts:232–240` and the ordinary serial-lane contract in `docs/architecture/SIMULATION-EVENT-CLOCK.md`, section 4. The optional flag describes whether an **instant** skill can overlap at `js/games/gw2/platform/skills/types.ts:68–69`.

**Expected:** an explicit offset must not authorize two ordinary positive-duration player casts to overlap. Unsupported overlap should yield an invalid command/warning before any resource reservation, consistent with existing explicit-false handling. **Observed:** ordinary skills whose optional concurrency flag is absent can overlap, because `requestAt` directly uses the prior cast start plus offset. Distinct skill IDs also evade the same-skill in-flight readiness check.

**Trigger/impact:** programmatic or imported canonical rotation with `concurrentOffsetMs` on an ordinary noninstant skill. The normal palette shift-add flow guards this correctly. At minimum, the backend accepts an impossible simultaneous cast schedule; when costs are paid at commitment, both accepted casts can rely on the same remaining resource and one later throws, aborting the run.

```js
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
simulateGw2({
  profession: guardianProfession,
  config: {
    specialization: 'Firebrand', primaryWeapon: 'Axe', secondaryWeapon: 'Torch',
    initialTomePages: 1, boons: {}, selectedTraitIds: [], selectedSkillIds: [],
    target: { armor: 2597, conditions: {} }, sigilSets: [{ names: [] }]
  },
  rotation: [
    { type: 'cast', skillId: 44364 }, // Tome of Justice
    { type: 'cast', skillId: 40015 }, // Scorched Aftermath: 920 ms
    { type: 'cast', skillId: 40635, concurrentOffsetMs: 0 } // Igniting Burst: 480 ms
  ]
});
```

Actual result: `RangeError: Insufficient tomePages.` Both page skills start at zero with one available page; Igniting Burst pays at 0.48 seconds and Scorched Aftermath attempts another payment at 0.92 seconds. Removing the offset produces no warnings: Scorched Aftermath runs 0–0.92 seconds, and Igniting Burst waits for page recharge and runs 8–8.48 seconds. Both skill records have `canCastConcurrently === undefined`; this is not an explicitly allowed ordinary overlap.

**Smallest recommendation:** centralize a cast-overlap eligibility predicate and enforce it after transformed skill selection, before calling `requestAt`, matching the instant/independent rule used by authoring. Reject unsupported commands explicitly instead of silently treating the offset as a different timing operation. Do not solve this solely by increasing page balances or catching the later spending error.

**Regression risk/validation:** preserve independent companion commands, instant skills, and explicit `canCastConcurrently: false`; account for runtime duration transforms where they legitimately make a skill instant. Add a two-distinct-normal-skill scenario, the native page repro, and allowed instant/independent controls. Deferred-cost reservation under otherwise legitimate overlap is a separate extension-contract question, not established as a shipped defect here.

**Related:** KERNEL-001 has the same eventual insufficient-resource symptom but a distinct cause and fix. Coordinated with platform auditor; no matching known issue established.

### KERNEL-002 — Bulk queue initialization bypasses the declared preparation hook

**Classification:** bug in a kernel extension contract. **Severity:** low. **Confidence:** high. **Reachability:** no current GW2 production failure demonstrated; the production coordinator constructs an empty queue.

**Baseline locations:** `js/kernel/events/queue.ts:74–95` (`StableEventQueue` constructor; preparation comment at line 78 and initial entries at line 91), `:141–143` (`enqueue`), `js/games/gw2/platform/simulation/coordinator.ts:20–23` (current empty-queue use).

**Expected:** a hook documented to prepare “every enqueued event before its ordering keys are captured” applies consistently to initial events and later insertions. **Observed:** the constructor calls `entry` directly, while `enqueue` invokes `prepare`. Initial packets therefore skip identity stamping/validation/transformation and can sort differently from the same packets added incrementally.

```js
import { StableEventQueue } from '#kernel/events/queue.js';
const calls = [];
const queue = new StableEventQueue([{ at: 1, name: 'initial' }], {
  prepare(event) { calls.push(event.name); return { ...event, eventOrder: calls.length }; }
});
queue.enqueue({ at: 1, name: 'incremental' });
console.log(calls); // ['incremental']
console.log(queue.dequeue().name, queue.dequeue().name); // incremental initial
```

**Trigger/impact:** any owner that combines a nonempty initial list with `prepare`; identity-dependent ordering reverses initial-before-later expectations because only the later event receives finite causal metadata. A future second game or bulk-loaded caller could accidentally bypass its preparation contract.

**Smallest recommendation:** run the same preparation operation before `entry` in construction while preserving O(n) heapification. Avoid implementing construction via repeated enqueue if linear heap construction matters.

**Regression risk/validation:** preparation may be stateful or depend on initialized owner fields; document constructor invocation timing and initialize queue-owned prerequisites before invoking it. Test one hook per initial/incremental packet and equivalent ordering, including frozen inputs and thrown preparation. Existing production's empty construction should be unchanged.

**Related:** existing queue tests compare bulk and incremental paths without `prepare`, so they miss this difference. No matching known issue established.

## Refactoring opportunities

To be assessed separately from correctness defects.

## Open hypotheses and remaining coverage

Queue constructor preparation versus enqueue, canonicalized identity/cancellation, lazy cancellation retention, ordering-frontier failures, numeric coercion, observation limit conversion, and callers' ownership of shared mutable state are under investigation. These are hypotheses, not findings.
