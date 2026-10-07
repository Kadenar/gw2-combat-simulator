# Independent review of the kernel and execution-consumer audit

Status: complete. Source baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3`.

Reviewed original: [03-kernel-audit.md](03-kernel-audit.md), frozen at 2026-10-07 05:07:57 UTC; its SHA-256 remains
`44f50c48c27bc5e7e68b25ebe0854a8ac8d6afab00fbcdc7091271bbe9548d52`. This review changes no original report, source,
tests, configuration, dependencies, or Git state. The working branch contains documentation commits after the source
baseline; `git diff --name-only 061147ad40b62f032fb2f0da41f2dd4d9807eee3 -- js tests package.json` returned no changes.
All source line references below refer to that baseline.

All seven central observations reproduce. Two recommendations need material corrections: ordinary positive-duration
overlap is intentionally supported for Vindicator's **Dodge + Auto**, and effect normalization already rejects
fractional aggregate hit/application counts. Neither correction removes the demonstrated Firebrand crash or missing
expansion budget. No new reviewer-discovery finding is submitted.

## Dispositions

Classification, severity, and confidence are assessed separately. “High” confidence applies to the stated observation
and bounded reachability, not to untested gameplay impact.

| Original ID | Disposition                | Reviewed classification                            | Severity | Confidence | Scope of conclusion                                                                                                                         |
| ----------- | -------------------------- | -------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| KERNEL-001  | confirmed                  | Bug in GW2 cost admission                          | medium   | high       | Supported fractional public input can abort native Dodge execution in both output modes.                                                    |
| KERNEL-002  | confirmed                  | Kernel extension-contract bug                      | low      | high       | Constructor preparation differs from enqueue; the production coordinator's empty construction avoids it.                                    |
| KERNEL-003  | confirmed with corrections | GW2 overlap admission/resource-commit bug          | medium   | high       | Firebrand failure is real; a blanket instant/independent-only fix would break supported Vindicator authoring.                               |
| KERNEL-004  | confirmed                  | GW2 executed-history replay bug                    | low      | high       | Priority/causal inversion loses an extension in a supported packet fixture; native rotation impact remains unproven.                        |
| KERNEL-005  | confirmed                  | GW2 executed-fact recording bug                    | low      | high       | Native No Quarter extends the live pool but omits its executed fact; no direct DPS error established.                                       |
| KERNEL-006  | confirmed                  | Architectural/documentation contract inconsistency | low      | high       | Helper and runtime disagree in the documented tolerance window; this does not establish that runtime should extend its horizon.             |
| KERNEL-007  | confirmed with corrections | Performance/safety-budget concern                  | low      | high       | Safe-size reproduction proves eager expansion beyond the loop ceiling; integer validation already exists, safe-integer/batch bounds do not. |

## Scope and method

I read all nine literal kernel files (independently counted as 543 lines) and inspected the finding-bearing consumer
functions, their entry points, caller guards, and relevant test contracts. `rg -l '#kernel/' js | wc -l` independently
returned 222 importing source files; that is an inventory, not 222 complete reviews.

The consumer review concentrated on
`js/games/gw2/platform/execution/{skill-cost,rotation,rotation-driver,rotation-cursor,cast-execution}.ts`,
`js/games/gw2/platform/simulation/{simulate,runtime,coordinator,runtime-resources,internal-work}.ts`,
`js/games/gw2/platform/combat/{boons,recharge}.ts`, `js/games/gw2/platform/combat/resources/endurance.ts`,
`js/games/gw2/platform/combat-calculation/{timeline-index,combat-query}.ts`,
`js/games/gw2/platform/combat/query/effect-stacks.ts`, `js/games/gw2/platform/combat/history/executed-facts.ts`,
`js/games/gw2/platform/resolver/{effect-delivery,event-handlers}.ts`, and
`js/games/gw2/platform/effects/{validation,materializer,emission}.ts`. Selected cooldown/reset, projection, patch
authoring, wait editor, palette, log reconstruction, Thief trait, Guardian, and Vindicator paths supplied
counterexamples and reachability checks. This is narrower than independently repeating every complete consumer read
claimed by the original auditor.

Repository/platform READMEs, `tests/README.md`, `scripts/README.md`, and the architecture/module/event-clock documents
informed ownership and intended contracts. Source and actual callers take precedence when documentation is stale. No
external GW2 mechanic claim or browser reproduction was needed or performed.

Focused diagnostics used the existing baseline `dist` through package aliases. I did not rebuild, clean, or rerun
`npm run check`. The coordinator's 4,876-test passing baseline is inherited evidence, not my execution result.
Independent scratch probes reconstructed the supplied scenarios, added controls, and inspected source before execution.
The original report retains the essential executable reproductions; the changes and counterexamples needed to reproduce
this review are included below.

## Per-finding validation

### KERNEL-001 — Confirmed: affordability and spending use incompatible tolerances

**Classification:** bug. **Severity:** medium. **Confidence:** high.

`skillCostAvailability` in `js/games/gw2/platform/execution/skill-cost.ts:21–36` admits
`readyAt <= runtime.time + EPSILON`; the comparison is at **line 30**, not the original report's highlighted line 31.
Native availability composes this gate at `js/games/gw2/platform/profession-definition/profession.ts:438–455`.
`createRuntimeEndurance` predicts affordability at `js/games/gw2/platform/simulation/runtime-resources.ts:214–219` but
spending rejects a balance below `cost - EPSILON` at `:229–235`. The time tolerance and amount tolerance are not
interchangeable. Completion work is already reserved before acceptance-time payment at
`js/games/gw2/platform/execution/cast-execution.ts:327–338`; the exception terminates the run.

I reproduced the original native Thief input through `simulateGw2`: two `-5` Dodge casts, a fractional wait, then a
third Dodge, with Core, Dagger/Dagger, no selected traits/skills, and no boons. Results were identical with the real
`output: 'detailed'` and `output: 'score'` options:

| Wait durationMs | Result                                |
| --------------- | ------------------------------------- |
| 8399.8          | Success; rotation end 10.8 s.         |
| 8399.9          | `RangeError: Insufficient endurance.` |
| 8399.95         | `RangeError: Insufficient endurance.` |
| 8399.999        | Success; rotation end 10.799999 s.    |
| 8400            | Success; rotation end 10.8 s.         |

The last microsecond-early case is a useful limit: the resource owner itself tolerates the remaining tiny amount
deficit. It does not refute the larger unfunded admission at 9.99995 s. A second probe paired the real
`createRuntimeResources` continuous energy controller (initial 0, maximum 10, recovery 1/s, cost 1) with
`skillCostAvailability`. At 0.9998 s the gate returned retryAt 1; at 0.9999, 0.99995, and 0.999999 s the gate returned
null while `spend('energy', 1)` threw. At 1 s payment succeeded.

**Reachability and guards:** `js/games/gw2/platform/execution/rotation.ts:116–123,183` accepts/preserves the fractional
wait. The normal duration editor rounds to integer milliseconds (`js/ui/rotation/editing/duration-editor.ts:19–35`), and
log waits pass through `quantizeMs` (`js/games/gw2/integrations/logs/shared/rotation/timeline.ts:182–207`). The proven
native failure uses the supported programmatic/canonical boundary, not a demonstrated ordinary manual editor workflow.

**Recommendation and risk:** remove the cross-unit time allowance from admission, keeping amount tolerance under the
resource controller. Define how a genuinely future off-grid readiness time becomes a canonical retry; merely rounding it
to the current instant can expose the separate retry-contract question below. Preserve already-affordable controller
returns. Regression checks should include these native boundaries, a continuous pool, and both output modes. Enlarging
spend tolerance would permit unfunded execution and is not an adequate repair.

### KERNEL-002 — Confirmed: initial queue entries skip prepare

**Classification:** kernel extension-contract bug. **Severity:** low. **Confidence:** high.

`StableEventQueue` promises preparation before capturing ordering keys at `js/kernel/events/queue.ts:74–95`, but
construction calls `entry` directly at `:91`. Only `enqueue` calls `prepare` (`:141–143`). Independently using an
initial event named `initial` and later event named `later`, with a preparation hook that stamps sequential
`eventOrder`, yielded calls `['later']` and dequeue order `later, initial`. The later prepared event moves ahead of the
untagged initial event under the actual comparator (`:47–54`). This is not an unstable heap or canonical-time failure.

The sole production constructor found by `rg -n 'prepare:|new StableEventQueue' js tests/kernel` is
`js/games/gw2/platform/simulation/coordinator.ts:20–23`, and it starts empty. No current native simulation failure
follows from this case. Although a caller could pre-prepare input manually, neither the constructor type nor comment
declares initial input exempt from the hook.

**Recommendation and risk:** apply the hook once to each initial item before key capture and retain linear
heapification. Constructor callback timing needs an explicit contract: the production callback closes over
identity/queue state initialized later (`js/games/gw2/platform/simulation/coordinator.ts:20–30,61–70`), harmless today
because the list is empty. A future nonempty owner must initialize its dependencies before calling the constructor. Test
initial/incremental parity, frozen inputs, and thrown hooks; do not change ordinary empty construction or replace
heapification with repeated insertion without need.

### KERNEL-003 — Confirmed with corrections: unrestricted overlap causes the Firebrand failure, but some ordinary overlaps are intentional

**Classification:** GW2 overlap admission/resource-commit bug. **Severity:** medium. **Confidence:** high.

The reported Firebrand reproduction succeeds as evidence. `createRotationDriver` rejects an offset only for explicit
`canCastConcurrently === false` (`js/games/gw2/platform/execution/rotation-driver.ts:26–45`). The offset branch bypasses
the ordinary serial/blocking deadlines (`js/games/gw2/platform/execution/rotation-cursor.ts:38–57`). Readiness guards
equipment, chains, cooldowns, per-skill in-flight reservations, and lockout groups, but supplies no global ordinary-lane
replacement (`js/games/gw2/platform/execution/cast-execution.ts:379–416`). Two different tome skills therefore pass the
per-skill guard. Commit-time payment occurs at `:130`.

With Firebrand, one initial tome page, and casts `44364`, `40015`, then `40635` with `concurrentOffsetMs: 0`,
independent execution threw `RangeError: Insufficient tomePages.` Removing the offset yielded no warnings and steps
0–920 ms for Scorched Aftermath, then 8000–8480 ms for Igniting Burst. The duration and commit-cost distinction is
genuine; the offset path admitted resource-sharing overlap before either page was paid.

**Material counterexample to the proposed fix:** the original's instant/independent-only eligibility recommendation is
too narrow. The Vindicator frontend declares an intentional **Dodge + Auto** action:

- `js/games/gw2/professions/revenant/specializations/vindicator/presentation.ts:32–46,50–64,81–86` creates a palette
  action that emits Dodge Jump followed by the current autoattack with offset 0.
- `js/games/gw2/professions/revenant/data/vindicator-jump.ts:3–28` explicitly models an 800 ms jump, including
  overlapping autos.
- `js/games/gw2/integrations/logs/shared/rotation/professions/revenant/vindicator.ts:44–53` deliberately marks an
  airborne auto concurrent; the shared importer consumes this exception at
  `js/games/gw2/integrations/logs/shared/rotation/timeline.ts:266–281`.
- `tests/games/gw2/professions/revenant/renegade-and-vindicator.test.js:1514–1631` tests palette insertion and asserts
  simultaneous native simulation starts. I ran this exact test; it passed.

Direct catalog inspection returned Dodge Jump 800 ms, Preparation Thrust 360 ms, and Brutal Blade 560 ms. All three have
`independentCast` and `canCastConcurrently` undefined. Thus the absence of the concurrency flag is **not by itself proof
that every positive-duration overlap is unsupported**. Generic shift-add is guarded at
`js/games/gw2/app/rotation/palette/interactions.ts:232–243`, but that is not the entire authoring contract. The original
report missed this intentional synthetic palette path.

The helper-level palette test is not proof that the currently rendered macro is clickable: the bound handler exits for
`pal-context-disabled` at `js/games/gw2/app/rotation/palette/interactions.ts:69–74`, and absent planning availability is
denied at `js/games/gw2/app/rotation/palette/model.ts:321–337`. This review establishes the authored exception, native
execution, and importer support; it does not claim a successful normal rendered click. The coordinator is separately
reviewing that frontend reachability question.

**Corrected recommendation and regression risk:** make ordinary overlap permission explicit at the execution boundary,
including narrowly owned profession/pair exceptions such as Vindicator jump/auto, rather than copying only the generic
shift-add predicate. Build on existing native hooks/contracts; do not add a profession-name branch to the neutral
kernel. Review whether legal overlaps with deferred costs require reservation as a separate policy; do not infer that
question is solved by rejecting Firebrand. Preserve transformed instant skills, independent lanes, explicit-false
rejection, and Vindicator authored/import behavior. The original fix would have a demonstrated regression, so this is a
substantive correction, not merely extra coverage.

The exact additional validation command was:

```sh
node --test --test-name-pattern='Vindicator Dodge \+ Auto palette action uses the current chain step' tests/games/gw2/professions/revenant/renegade-and-vindicator.test.js
```

### KERNEL-004 — Confirmed: extension replay discards accepted priority ordering

**Classification:** GW2 timeline bug. **Severity:** low. **Confidence:** high for packet-level inconsistency; native
frequency/impact unestablished.

The neutral heap orders phase and priority before causal placement (`js/kernel/events/queue.ts:47–54`). Resolved
indexing explicitly preserves append order (`js/games/gw2/platform/combat-calculation/timeline-index.ts:60–66`), but
histories containing an extension use `timedBuffApplicationsAt` (`:170–174`). That helper sorts timestamp ties only by
causal order (`js/games/gw2/platform/combat/boons.ts:418–441`), losing accepted priority order.

I repeated the production-runtime event-fixture reproduction with a one-second Might grant at time 0, priority -1,
causalOrder 2, and a two-second extension at time 0, causalOrder 1. History was `[buff, boon_extension]`; at 1.5 s the
live pool returned 1 and timeline returned 0. Changing only the grant's priority to 0 produced `[boon_extension, buff]`
and both queries returned 0. That negative control demonstrates an ordering-dependent discrepancy rather than a generic
duration error or recipient mismatch.

**Counterexamples and reachability:** live damage reads use accepted applications when a runtime exists
(`js/games/gw2/platform/combat/query/effect-stacks.ts:19–35`), so a timeline disagreement alone is not a proven DPS
error. Prepared summon Alacrity windows call the same replay helper
(`js/games/gw2/platform/combat-calculation/timeline-index.ts:82–88`; `js/games/gw2/platform/combat/boons.ts:273–282`),
as does Vigor interval construction through boon intervals
(`js/games/gw2/platform/combat/resources/endurance.ts:12–33`). These justify regression coverage, not a claim that a
shipped rotation already has wrong recharge/endurance. Player recharge is constant and does not dynamically sample these
windows (`js/games/gw2/platform/combat/recharge.ts:28–63`).

**Recommendation and risk:** distinguish scheduled-input ordering from executed-history replay and preserve the latter's
settled order through extension/window helpers. The existing unsorted-input test at
`tests/games/gw2/platform/boon-extensions.test.js:100–116` passed independently and would constrain blindly removing
sorting. Do not reconstruct ordering from only public causal metadata. Check synchronous nested reaction recording as
well: `dispatchEvent` records after handlers (`js/games/gw2/platform/resolver/effect-delivery.ts:364–387`), so “append
order” must be verified against the intended application transaction, particularly when changing KERNEL-005. No
additional baseline failure is asserted from that recommendation risk.

### KERNEL-005 — Confirmed: reaction extensions bypass the fact writer

**Classification:** executed-fact recording bug. **Severity:** low. **Confidence:** high.

Reaction-settled conditions, buffs, and extensions have distinct dispatch paths at
`js/games/gw2/platform/resolver/effect-delivery.ts:194–202`. Extensions call `handlers.dispatch` directly, bypassing the
fact/public-event recording at `:383–387`. Their handler only updates the live boon pool and optional resolved report
(`js/games/gw2/platform/resolver/event-handlers.ts:93–96`). This violates the explicit gameplay-history responsibility
in `js/games/gw2/platform/combat/history/executed-facts.ts:3–27` and the runtime's history/query composition
(`js/games/gw2/platform/simulation/runtime.ts:133–143`).

The original fixture emits a two-second Fury grant at 0 and a forced critical player hit at 1, with native No Quarter
selected, then observes at 3. I reran it with both outputs:

| Output   | Live Fury | Timeline Fury | History extension count | Public events extension count | Resolved extension count |
| -------- | --------- | ------------- | ----------------------- | ----------------------------- | ------------------------ |
| detailed | 1         | 0             | 0                       | 0                             | 1                        |
| score    | 1         | 0             | 0                       | Array absent                  | Array absent             |

The native emitter is `extendActiveFury` at `js/games/gw2/professions/thief/core/traits/critical-boons.ts:124–145`; it
requires existing active Fury and deliberately settles the extension synchronously. This is real shipped trait logic
under synthetic deterministic triggering, not a synthetic replacement extension handler. Normal gameplay can call that
native reaction, but no browser end-to-end scenario or direct DPS difference was measured. Configured permanent Fury and
live applied-effect reads can mask historical incompleteness; they do not repair missing facts.

**Recommendation and risk:** route accepted reaction extensions through the fact-recording path without queueing, double
application, or changing same-hit visibility. Check one live application, one history fact, one detailed execution
event, and one optional resolved event, preserving cause/parent identities. Also test a synchronous extension caused by
a just-applied buff so nested recording order remains coherent. The original limitation concerning absent
DPS/effect-chart evidence is appropriate.

### KERNEL-006 — Confirmed as a contract inconsistency, not a mandated tolerant runtime

**Classification:** architectural/documentation inconsistency. **Severity:** low. **Confidence:** high.

`observationEndTime` permits a preceding absolute endpoint within EPSILON and returns the later endpoint
(`js/kernel/execution/observation.ts:46–63`). The documented public observation policy repeats this allowance
(`docs/architecture/SIMULATION-EVENT-CLOCK.md:183–195`). The runtime instead installs the exact canonical absolute
horizon immediately (`js/games/gw2/platform/simulation/runtime.ts:208`), and the coordinator rejects unfinished commands
at that horizon before applying the helper (`js/games/gw2/platform/simulation/coordinator.ts:149–174`).

Independent one-second native Thief waits produced:

| endTimeMs | Helper against rotation end 1 s | Public runtime                             |
| --------- | ------------------------------- | ------------------------------------------ |
| 999.8     | Rejects                         | Rejects                                    |
| 999.95    | Returns 1 s                     | Rejects with preceding-endpoint RangeError |
| 1000      | Returns 1 s                     | Succeeds at 1 s                            |
| 1000.05   | Returns approximately 1.00005 s | Succeeds at canonical 1.00005 s            |

The helper resolves a known completed timeline; the coordinator must enforce a horizon while completion is still
unknown. This difference in responsibility explains why simply calling the helper earlier is not a solution. The
runtime's strict stop has a defensible meaning, and the original finding appropriately leaves policy selection open. I
confirm the conflicting contracts, not that 50 microseconds of additional execution must be allowed.

**Recommendation and risk:** choose one documented absolute-horizon policy. Strict canonical rejection can be aligned by
tightening the helper/documentation; retaining tolerance requires bounded completion handling that does not admit
arbitrary work past the requested horizon. Test waits, completions, final input recovery, and events exactly at and
immediately beyond the chosen endpoint. Ordinary equal/later windows are supported controls, not affected cases.

### KERNEL-007 — Confirmed with corrections: expansion is unbudgeted, but positive-integer checks already exist

**Classification:** performance/safety-budget concern. **Severity:** low. **Confidence:** high for implementation
behavior, no measured latency/memory claim.

`DEFAULT_EXECUTION_ITERATION_LIMIT` is 100,000 (`js/kernel/execution/limits.ts:1–5`), counted by the coordinator only
between iterations (`js/games/gw2/platform/simulation/coordinator.ts:126–183`). `materializeSkillEffectApplications`
allocates all aggregate strike packets before returning (`js/games/gw2/platform/effects/materializer.ts:121–154`);
emission then iterates that returned array (`js/games/gw2/platform/effects/emission.ts:164–181`). One
normalization/materialization probe allocated exactly 100,001 packets before any runtime dequeue. The normalization-only
`hits: 1e20` probe was accepted. I did **not** materialize 1e20 or any similarly massive count.

**Correction to validation assessment/recommendation:** reading only the finite-number helper misses later guards.
`normalizeEffect` already requires positive integer non-tick `hits` at
`js/games/gw2/platform/effects/validation.ts:544–549`, and positive integer `applications` at `:425–435`, with explicit
intervals for repeated applications. Independent normalization rejected 0, -1, and 1.5 for both; it accepted 100001 and
1e20. `Number.isInteger(1e20)` is true, so these guards do not supply safe-integer or batch bounds. The report's
suggestion to introduce nonintegral rejection and its fractional-legacy-count concern should be narrowed: ordinary
aggregate hit/application normalization already rejects that input.

The extra guard probe is reproducible without allocating packets:

```js
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
for (const count of [0, -1, 1.5, 100001, 1e20]) {
  for (const effect of [
    { type: 'strike', coefficient: 1, atMs: 0, hits: count },
    { type: 'boon', boon: 'might', stacks: 1, duration: 1, atMs: 0, intervalMs: 1, applications: count }
  ]) {
    try {
      normalizeSkillEffects([effect], 'review');
      console.log(effect.type, count, 'accepted');
    } catch {
      console.log(effect.type, count, 'rejected');
    }
  }
}
```

**Reachability:** patch authoring exposes the repetition fields
(`js/games/gw2/integrations/patches/authoring/fields.ts:186–202`) and checks finite numeric edits
(`js/games/gw2/integrations/patches/authoring/patches.ts:267–296,455–470`), but no browser freeze was demonstrated.
There is no evidence ordinary shipped counts approach this ceiling. At immense integers increment-by-one cannot remain
progressive, but memory exhaustion would normally precede that point; the audit correctly does not claim to have
measured either failure.

**Corrected recommendation and risk:** retain existing positive-integer checks, add safe-integer/batch bounds before
allocation, and define how a batch spends the execution budget. Cover explicit tick arrays and per-stack condition
expansion when designing a comprehensive budget; merely strengthening aggregate numeric validation is not a total-work
bound. Validate accepted/rejected boundaries without allocating rejected work and preserve coefficient
splitting/attribution. Large legitimate authored batches require an explicit policy decision; this is hardening, not
evidence of a typical-load regression.

## Negative claims, unnumbered questions, and coverage gaps

The original report's scoped negative evidence is substantially supported, with these limits:

- **Kernel inventory and boundary:** all nine modules were independently read; imports remain game-neutral. Collections
  preserve equal-key insertion order; dynamic-fields/unvalidated are type-only. Numeric coercion and half-even rounding
  behavior are intentional contracts, not discoveries. I reran all 23 existing `tests/kernel/*.test.js` tests; all
  passed. This does not certify every caller or every possible numeric input.
- **Queue semantics:** independent controls verified phase/priority/causal/stable order, ordering-key mutation
  rejection, shared command/event same-time budget, canonical returned-handle cancellation, and retained non-head
  cancellation behavior. Canceling the pre-canonical input at `0.56 + 0.04` leaves the canonical copy pending; canceling
  the returned handle removes it. Canceling the second of two entries gives length 2/pending 1. Source at
  `js/kernel/events/queue.ts:23–27,98–113,173–182,220–222` supports the suggested documentation clarification. The
  coordinator retains the returned handle for its work map (`js/games/gw2/platform/simulation/coordinator.ts:88–93`). No
  production misuse of queue length was demonstrated.
- **Clock/randomness:** finite safe-microsecond rejection, canonical negative zero, half-open expiry, independent named
  streams, and no draws at probability endpoints passed independent controls. A 90,000-input sample of
  `canonicalTime(canonicalTime(t))` at the original nine anchors also passed. This is a sample, not a proof across all
  representable values. RNG state is per factory call (`js/kernel/core/simulation-random.ts:85–110`) and per runtime
  (`js/games/gw2/platform/resolver/runtime-state.ts:96`). No leaked RNG state was observed.
- **Lifecycle and reports:** source establishes per-run coordinator/history/controllers, `finally` restoration of causal
  context (`js/games/gw2/platform/simulation/coordinator.ts:18–32,73–85`), generation-aware owner cancellation
  (`js/games/gw2/platform/simulation/runtime.ts:313–320`), and cloned internal payloads
  (`js/games/gw2/platform/simulation/internal-work.ts:31–47`). Planning projections clone mutable public data
  (`js/games/gw2/platform/results/planning-state.ts:54–67`). Cooldown `resetAll` clears cooldown/progress/ammo stores,
  not clock/RNG (`js/games/gw2/platform/execution/cooldowns.ts:375–379`). These checks support the local architectural
  observations; I did not exhaustively prove cancellation correctness for every profession or all output equivalence.
- **Parity control:** repeated native Dodge controls were deeply equal, and score/detailed duration and damage agreed.
  KERNEL-001 throws in both modes; KERNEL-005 omits facts in both. This supports no mode-specific discrepancy in these
  scenarios, not general score/detailed parity.
- **Retry deadline question:** independently confirmed the unnumbered documentation inconsistency.
  `docs/architecture/SIMULATION-EVENT-CLOCK.md:168–170` promises upward rounding;
  `js/games/gw2/platform/execution/rotation-driver.ts:127–132` uses nearest `canonicalTime` and rejects a
  0.4-microsecond future retry. A native Thief fixture overriding only availability with
  `{ ready: false, retryAt: 0.0000004, reason: 'Review retry', code: 'review.retry' }` returned
  `Dodge: Review retry (no future retry boundary).` at rotation end 0. No native controller returning that particular
  deadline was established. Keep it an informational extension/documentation question; do not turn this fixture into a
  shipped-profession bug claim. Resolve upward versus nearest rounding deliberately, without hiding permanently
  nonadvancing callbacks.
- **Policy distinctions:** constant player Alacrity differs from received summon Alacrity
  (`js/games/gw2/platform/combat/recharge.ts:28–63`). Effective player Quickness and full player health are documented
  scope choices. There is no basis here to elevate them to defects. The architecture paragraph grouping summons with
  players is stale; the original report correctly recognizes that.
- **Performance/known issues:** heap operations and linear cancellation/pending scans follow the code, but no benchmark
  or retention profile was run. No new known-issue linkage was established by this review; the original's supplied-issue
  search remains its own bounded evidence, not proof of novelty. Historical or live-game correctness was not
  independently surveyed.

The main original coverage omission affecting recommendations is the supported Vindicator overlap contract. This review
also expands effect validation coverage enough to establish the later integer guards. Remaining gaps include actual
browser behavior, normal native priority-inversion rotations, direct numeric consequences of missing extension facts,
complete damage/condition/modifier mathematics, every profession/lifetime/resource controller, and full authoring/import
round trips. The original report's complete literal-kernel coverage is credible as a read inventory, but neither that
phrase nor passing controls proves bug absence.

## Executed commands and results

All commands ran from repository root against the unchanged source baseline and prebuilt modules. Scratch diagnostics
are ignored and not part of the deliverable.

| Command                                                          | Actual result                                                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node .scratch/audit/kernel-review/reproduce.mjs`                | Exit 0; independently reconstructed KERNEL-001–007 reproductions and controls described above. Actual output option was `output`, not `outputMode`. Huge-count case normalized only. |
| `node .scratch/audit/kernel-review/controls.mjs`                 | Exit 0; eight negative-control groups passed; fractional retry warning and continuous-resource mismatch reproduced.                                                                  |
| `node --test tests/kernel/*.test.js`                             | 23 tests passed, 0 failed.                                                                                                                                                           |
| Focused Vindicator command shown above                           | 1 selected test passed, 0 failed; native positive-duration overlap is intentionally asserted.                                                                                        |
| `node --input-type=module` with normalization-only snippet above | 0, -1, 1.5 rejected; 100001 and 1e20 accepted for both tested count fields.                                                                                                          |
| `node --input-type=module` idempotence sample                    | 90,000 samples passed at nine anchors from 1 to 9e9 seconds.                                                                                                                         |
| `sha256sum docs/audits/2026-10-07/03-kernel-audit.md`            | Matches frozen original hash stated above.                                                                                                                                           |
| Baseline-to-working-source diff named above                      | No source/test/package changes.                                                                                                                                                      |

Additional exact commands (kept outside the table to preserve shell pipe characters):

```sh
node --test --test-name-pattern='explicit overlaps|forbidden concurrent|prepared windows respect causal order' tests/games/gw2/platform/runtime.test.js tests/games/gw2/platform/boon-extensions.test.js
rg -l '#kernel/' js | wc -l
rg --files js/kernel | xargs wc -l
```

The selected test command passed 3 tests, 0 failed: allowed overlaps, explicit-false rejection, and unsorted scheduled
replay. The inventory commands returned 222 importing files and 9 modules totaling 543 lines.

No production fix or new test was written. Follow-up changes should use the existing native profession and GW2 service
contracts, preserve the identified counterexamples, and validate only the affected behavior before wider required gates.
