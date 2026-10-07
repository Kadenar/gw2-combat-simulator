# Independent review of the GW2 platform audit

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3`, reviewed 2026-10-07. This is an independent source and
focused-execution review of frozen [04-platform-audit.md](04-platform-audit.md). The original report, implementation,
tests, configuration, and Git state were not modified by this reviewer. All source citations refer to the baseline.

## Complete disposition table

| Original ID  | Disposition                | Final classification        | Severity      | Confidence | Assessment                                                                                                                                                                                                                                                                               |
| ------------ | -------------------------- | --------------------------- | ------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLATFORM-001 | confirmed with corrections | Bug                         | Low           | High       | Both enumeration gates mishandle numeric-string IDs. Scope the demonstrated impact to direct/custom configuration consumers; ordinary canonical build restoration does not preserve raw selected-trait IDs. Normalize before lookup to match simulation semantics fully.                 |
| PLATFORM-002 | confirmed                  | Architectural inconsistency | Low           | High       | The specialization accessor restores mutable live state to a query context. Actual query consumers exist; no production write or gameplay corruption was demonstrated.                                                                                                                   |
| PLATFORM-003 | confirmed with corrections | Cleanup                     | Informational | High       | Six calls repeat a real ordering relationship across four elites. Existing scheduling already provides the required behavior and follows documented policy. A narrow shared convenience is optional; this is not a missing lifecycle capability or demonstrated architectural violation. |

Confidence concerns the evidence and bounded disposition, not the existence of unobserved user impact. No finding
warrants a severity increase. No additional reviewer discovery is promoted or awaiting coordinator validation.

## Methods, results, and review coverage

I read the shared brief before source inspection; reviewed the platform ownership README, relevant architecture/module
and ordering sections, root scope policies, and test/script conventions; traced each finding through its implementation,
concrete consumers, guards, and counterexamples. I did not use the original report's conclusions as proof.

The coordinator's baseline `npm run check` passed all stages and 4,876 tests. That broad result is inherited evidence,
not a check rerun by this reviewer. Compiled `dist` was reused without rebuilding or cleaning. Independent focused
results:

| Command or method                                                                             | Actual result                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node .scratch/audit/platform-review/occurrences.mjs`                                         | Exit 0. Mug executed for `1276`, `'1276'`, and `'01276'`, with 635 damage and no warnings; only `1276` was enumerated. Unselected ID `999999` neither executed nor listed Mug. Real Elementalist Electric Discharge declaration listed for `222`, but not `'222'` or empty selection. |
| `node node_modules/typescript/bin/tsc --project .scratch/audit/platform-review/tsconfig.json` | Exit 0, no diagnostics. Expected compiler errors verified direct nested/array mutation, Core-accessor mutation, and query scheduling rejection. Specialization-accessor mutations and legitimate command-context mutation compiled.                                                   |
| Focused Node ordering command shown below                                                     | Exit 0: four matching tests passed, zero failures.                                                                                                                                                                                                                                    |
| Numbered source reads and `rg` caller/priority searches                                       | Six `-101` scheduling calls found and individually inspected; no existing named completion-tail helper found. Canonical build restoration and actual query-service binding traced.                                                                                                    |

Focused ordering command, executed without rebuilding:

```sh
node --test --test-name-pattern='Unravel settles|familiar declarations reset|overload declarations preserve|grouped Thorns variants' tests/games/gw2/professions/elementalist/skill-definition-ownership.test.js tests/games/gw2/professions/engineer/side-effect-migrations.test.js
```

Scratch scripts are disposable and not deliverables; the material diagnostic code is preserved below. Browser execution
was unavailable in the shared environment and was not retried. No browser regression, numerical performance gain, or
external game-mechanic claim is inferred.

| Domain/boundary                                 | Independently reviewed                                                                                                                              | Limits                                                                                                                                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builds, application configuration, skill-damage | Trait membership, canonical specialization choices, active trait resolution, simulation configuration, occurrence profile and declared-effect gates | No complete import/migration matrix or browser rendering execution                                                                                                                     |
| Profession-definition, simulation capabilities  | State accessor types and implementation, query service binding, Core accessor counterexample, Evoker availability, Firebrand/Berserker observers    | No exhaustive search proving every query callback is pure; cached catalogs/configuration and all returned query-service values were not audited for immutability                       |
| Execution, scheduling, kernel boundary          | Completion sequence, six native tail callers, detached work, handler rehydration, causal/insertion order, four existing contract tests              | No implementation of a proposed helper, full cancellation matrix, or full kernel audit                                                                                                 |
| Retained profession/platform boundaries         | Hook/handler ownership, Rock Barrier, Inspiring Imagery, Thief preparations, player/summon recharge distinction                                     | No new resource-policy consolidation or independent validation of findings owned by other reports                                                                                      |
| Remaining platform domains                      | Context only                                                                                                                                        | Equipment catalog, numerical modifier combinations, combos, event schemas, result sampling, full presentation contracts, and all 15 platform domains were not independently re-audited |

The original report labels its inventory as an inventory rather than fully reviewed coverage. That restraint is
appropriate. This review does not inherit its domain-depth claims or establish exhaustive bug absence.

## PLATFORM-001 — Numeric-string trait occurrence omission

**Disposition:** confirmed with corrections. **Final classification:** bug. **Severity:** low. **Confidence:** high.

### Independently established behavior

`Gw2Config.selectedTraitIds` accepts string and number IDs in `js/games/gw2/platform/simulation/config.ts:33`. Runtime
construction normalizes the selection in `js/games/gw2/platform/simulation/runtime.ts:201–204`, using
`normalizeSelectedTraitIds` in `js/games/gw2/platform/builds/selected-traits.ts:12–16`. In contrast, `damageOccurrences`
creates a raw `Set` and checks it with strict identity at
`js/games/gw2/platform/skill-damage/list-occurrences.ts:12–22,36–37`. There is no normalization guard inside that entry
point.

The concrete Mug declaration is `js/games/gw2/professions/thief/core/traits/deadly-arts.ts:135–141`, with numeric
identity in `js/games/gw2/professions/thief/data/ids.ts:221`. The application consumes enumeration at
`js/games/gw2/app/build/skill-damage/plan.ts:467`. The second gate is independently reachable through the native
Electric Discharge declaration at `js/games/gw2/professions/elementalist/core/hooks.ts:80–91`; this is not merely a
synthetic hypothetical declaration.

Reproduce from a repository-local `.mjs` file after the normal build:

```js
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

for (const id of [1276, '1276', '01276', 999999]) {
  const config = { specialization: 'Core', selectedTraitIds: [id], selectedSkillIds: [], boons: {} };
  const result = simulateGw2({
    profession: thiefProfession,
    config,
    rotation: ['Steal', { type: 'wait', durationMs: 100 }]
  });
  console.log({
    id,
    listed: damageOccurrences(thiefProfession.runtimeFor(config), config).some(
      (entry) => entry.effect.kind === 'profile' && entry.effect.id === 1276
    ),
    executed: result.events.some((event) => event.type === 'damage' && event.sourceId === 1276),
    total: result.totalDamage,
    warnings: result.warnings
  });
}
const runtime = elementalistProfession.runtimeFor({ specialization: 'Core' });
const declared = runtime.damageEffects.find((entry) => entry.ownerId != null);
for (const selectedTraitIds of [[declared.ownerId], [String(declared.ownerId)], []]) {
  console.log({
    declaredId: declared.id,
    ownerId: declared.ownerId,
    selectedTraitIds,
    listed: damageOccurrences(runtime, { specialization: 'Core', selectedTraitIds }).some(
      (entry) => entry.id === `profession:${declared.id}`
    )
  });
}
```

Observed listing/execution/total tuples were `(true, true, 635)`, `(false, true, 635)`, `(false, true, 635)`, and
`(false, false, 0)` respectively; all warnings arrays were empty. The declaration was `elementalist.ElectricDischarge`,
owner `222`, and its three listing results were `true`, `false`, `false`.

### Reachability and recommendation corrections

“Restored configurations” must not imply an ordinary saved-build regression. Canonical build normalization preserves
specialization names and tier-choice strings, not the supplied runtime `selectedTraitIds` array
(`js/games/gw2/platform/builds/codec.ts:433–462`). `getActiveTraits` resolves catalog trait objects from those choices
(`js/games/gw2/professions/shared/trait-data.ts:49–73`); `createBuildAttributeContext` uses that resolver
(`js/games/gw2/professions/shared/build-attributes.ts:41–48`); application `simulationConfig` reconstructs IDs from the
active objects (`js/games/gw2/app/create-runtime.ts:172–190`). The demonstrated exposure is direct use of the declared
configuration API, custom adapters, or callers restoring raw runtime configurations. No ordinary browser restore path
carrying these strings was demonstrated. Totals remain correct in the reproduction.

The smallest fix is still local reuse of existing lookup semantics for both gates. Prefer
`normalizeSelectedTraitIds(config.selectedTraitIds)` followed by `hasTrait(selected, ownerId)`. Merely calling
`hasTrait(config, ownerId)` is insufficient for full runtime parity: its raw-array branch compares
`String(value) === String(traitId)` at `js/games/gw2/platform/builds/selected-traits.ts:55–61`, whereas runtime
normalization also accepts `'01276'`. The original's normalization-first option is sound; its broader “share exactly”
wording should identify which semantics are required.

Preserve nonnumeric owner IDs, unselected-owner exclusion, current profile/declaration precedence, and deduplication.
The minimal regression set is numeric/string/leading-zero parity at both gates plus an unselected control; do not
introduce profession-specific patches or normalize saved-build schema unnecessarily. Impact and regression risk are low.
This is the same original finding, not a new reviewer ID.

## PLATFORM-002 — Read-only specialization access

**Disposition:** confirmed. **Final classification:** architectural inconsistency. **Severity:** low. **Confidence:**
high.

The contract is explicit: `MechanicQueryContext` exposes recursively read-only profession state and selected service
methods in `js/games/gw2/platform/profession-definition/mechanic-context.ts:22–61`. `ReadonlyMechanicState` removes
nested writes, collection mutators, and stateful functions in
`js/games/gw2/platform/profession-definition/runtime-context.ts:52–61`. The binding exposes the same live object at
`js/games/gw2/platform/simulation/bind-mechanic-context.ts:69–70`, while constructing selected service surfaces at lines
17–66 and freezing the query wrapper at lines 102–107. This is a compile-time capability boundary, not a runtime
deep-freeze guarantee.

`ProfessionSpecializationStateDefinition.from` accepts `unknown` and returns `TState` at
`js/games/gw2/platform/profession-definition/state.ts:155–163`; its implementation returns the original active slice at
lines 135–152,181–184. The discriminant guard rejects the wrong active elite but does not preserve readonly capability.
The Core counterpart is a useful counterexample: `professionCoreState` derives its return type from the supplied context
at lines 91–128 and retains readonly state in the focused probe.

Real consumers are `availability` at
`js/games/gw2/professions/elementalist/specializations/evoker/mechanics/availability.ts:23–84`, `firebrandEffectStates`
at `js/games/gw2/professions/guardian/specializations/firebrand/effect-state.ts:12–16`, and `berserkerEffectStates` at
`js/games/gw2/professions/warrior/specializations/berserker/effect-state.ts:17–24`. These inspected consumers only read.
In particular, Evoker's `.sort()` follows `.filter()` at lines 52–54, so it sorts a fresh array and is not evidence of a
live-state mutation.

The independent compiler probe, saved as `.scratch/audit/platform-review/capabilities.ts`, was:

```ts
import { evokerState } from '../../../js/games/gw2/professions/elementalist/specializations/evoker/state.js';
import { professionCoreState } from '../../../js/games/gw2/platform/profession-definition/state.js';
import type { ElementalistRuntime } from '../../../js/games/gw2/professions/elementalist/types.js';
import type { MechanicQueriesOf } from '../../../js/games/gw2/platform/profession-definition/mechanic-context.js';

export function probe(query: MechanicQueriesOf<ElementalistRuntime>, commands: ElementalistRuntime) {
  if (query.profession.specialization.kind === 'Evoker') {
    // @ts-expect-error direct scalar mutation must be rejected
    query.profession.specialization.state.familiarCharges.value = 99;
    // @ts-expect-error direct array mutation must be rejected
    query.profession.specialization.state.pendingWeaponCompletions.push({ activationId: 'probe', at: 0, gain: 1 });
  }
  // @ts-expect-error Core generic accessor correctly retains readonly state
  professionCoreState(query).primaryAttunement = 'Water';
  // @ts-expect-error query cannot schedule work
  query.schedule('probe', 0);
  evokerState.from(query).familiarCharges.value = 99;
  evokerState.from(query).pendingWeaponCompletions.push({ activationId: 'probe', at: 0, gain: 1 });
  evokerState.from(commands).familiarCharges.value = 99;
}
```

Sibling `tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.build.json",
  "compilerOptions": { "noEmit": true, "noUnusedLocals": false, "noUnusedParameters": false },
  "include": ["./capabilities.ts"]
}
```

Compilation exited 0 without diagnostics. `@ts-expect-error` proves the direct/Core/query-service protections are
active; equivalent specialization writes require no suppression. The probe is a type test, not evidence that shipped
callbacks perform those mutations.

The original recommendation is appropriately bounded: preserve readonly input capability or offer separate read/mutation
access with the mutation route genuinely unavailable to query contexts. Keep active-kind checks, live identity, state
replacement, and legitimate mutation hooks. A naive structural overload or an additional read method beside unrestricted
`from(unknown)` would leave the escape intact. Validate negative compile cases for nested arrays/maps/sets and positive
lifecycle cases before migration. Do not freeze or clone gameplay state, broaden this into a security claim, or promise
that fixing this accessor makes every query service globally pure. No functional failure was found in the inspected
consumers; low severity remains appropriate.

## PLATFORM-003 — Repeated completion-tail ordering

**Disposition:** confirmed with corrections. **Final classification:** cleanup. **Severity:** informational.
**Confidence:** high.

The repetition and requirement are real. `complete` applies commit side effects, invokes composed commit hooks,
schedules skill tasks, publishes completion, applies self-stun bookkeeping, and removes the reservation at
`js/games/gw2/platform/execution/cast-execution.ts:130–165`. Its queued completion uses `-100` at lines 327–335. The six
current-time `-101` calls are:

| Owner                 | Exact baseline call sites                                                                     | Required relation                                            |
| --------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Amalgam               | `js/games/gw2/professions/engineer/specializations/amalgam/hooks.ts:32–49`                    | Core traits, retaliation, then Morph rewards                 |
| Tempest               | `js/games/gw2/professions/elementalist/specializations/tempest/hooks.ts:214–227`              | Core etching credit before extra credits                     |
| Weaver                | `js/games/gw2/professions/elementalist/specializations/weaver/hooks.ts:250–254`               | This cast's traits before Unravel, before another completion |
| Evoker intrinsic work | `js/games/gw2/professions/elementalist/specializations/evoker/mechanics/familiars.ts:174–181` | Shared completion bookkeeping before intrinsic tasks         |
| Evoker final rewards  | `js/games/gw2/professions/elementalist/specializations/evoker/hooks.ts:101–117`               | Intrinsic reset, deferred grants, final rewards              |

The distinction is optional centralization versus missing behavior. `scheduleForCast` already provides scheduling, task
validation, cast-data detachment, and catalog rehydration
(`js/games/gw2/platform/simulation/runtime.ts:291–310,338–350`;
`js/games/gw2/platform/simulation/internal-work.ts:9–47`). The author capability exposes it at
`js/games/gw2/platform/profession-definition/mechanic-context.ts:99–107`.
`docs/architecture/SKILL-EVENT-ORDERING.md:149–157` explicitly documents completion priority `-100` and
profession-selected priorities for local dependencies. Thus the numeric relationship is not an undocumented private
engine detail, and these callers use the intended primitive consistently. No present ordering failure or
architecture-rule breach was reproduced.

A convenience that centralizes “now and immediately ahead of the next ordinary completion” is reasonable given six
concrete calls across two profession families. However, a new method on every mechanic context is not proven necessary.
The smallest change could be a thin shared helper over the existing capability and one centrally owned completion/tail
priority relationship; keeping the current API with focused contract coverage is also defensible. Do not create a second
queue, generalized phase framework, global priority enum, or migrate unrelated delayed tasks. Reclassify the
recommendation as informational cleanup rather than low-severity architectural inconsistency.

### Ordering qualifications and regression risk

The original statement that equal-priority tails retain request order needs its causal qualifier. Queue order is
timestamp, phase, priority, causal order, then insertion (`js/kernel/events/queue.ts:47–54`); new work inherits current
causality at lines 129–136. Tails scheduled synchronously by the same completion share that causal placement, so request
order holds for these consumers. Equal priority alone does not guarantee global FIFO between unrelated causes. The
helper contract must preserve that placement rather than assign new roots or override phase.

A direct callback appended inside `onCastCommit` would move these operations ahead of `scheduleSkillTasks`, completion
publication, self-stun bookkeeping, and reservation deletion. Even a callback at the very end of `complete` changes the
queue boundary and possible interleaving with other work. The existing queued semantics should be retained if any
cleanup proceeds. Preserve detached reservation data, registered handler lookup, skill identity, cause attribution, and
optional owner-generation behavior; do not add cancellation semantics simply because work is cast-associated.

Four existing targeted tests passed independently.
`tests/games/gw2/professions/elementalist/skill-definition-ownership.test.js:697–780,831–883` verifies etching order,
Unravel hands, and familiar reset/deferred grants;
`tests/games/gw2/professions/engineer/side-effect-migrations.test.js:101–132` verifies Core/retaliation/Morph output
order. The Unravel and familiar tests observe a scheduled `-100` task, not a second actual `runtime.complete`
reservation. They support the intended relation but do not replace the proposed shared two-real-completions case.

If implemented, retain those native assertions and add the bounded two-completion/two-tail contract with causal
metadata. Validate committed interruptions versus cancellation, ordinary packet/equipment publication, and owner
cancellation only where the helper changes those paths. Do not expand testing into a new framework or claim baseline
coverage proves a future implementation preserves all ordering. The maintenance benefit is avoiding independently edited
priority literals; there is no measured runtime or performance benefit.

## Retained boundaries and remaining questions

The original recommendation to retain the native profession/compiler system is supported. `composeRuntimeHooks` rejects
duplicate task/handler/side-effect ownership at `js/games/gw2/platform/profession-definition/runtime-hooks.ts:50–60`;
the event registry rejects duplicates and missing handlers at
`js/games/gw2/platform/resolver/handler-registry.ts:23–34,58–64`. Existing extension points already host all inspected
mechanics. Nothing reviewed justifies a replacement profession framework.

Retain owner-specific lifetime consequences. Rock Barrier consumes its live flip before starting held recharge and
resetting chains (`js/games/gw2/professions/elementalist/core/mechanics/rock-barrier.ts:9–37`). Inspiring Imagery checks
matching natural expiry before emitting boons (`js/games/gw2/professions/mesmer/core/mechanics/rifle.ts:40–63`). Generic
deletion ahead of either owner would suppress its payload. One wording correction: the inspected Thief preparations are
not finite-expiry payloads. They arm an infinite flip, wait through the arming delay, and are consumed on activation
(`js/games/gw2/professions/thief/core/mechanics/preparations.ts:30–66`). This strengthens the case against forcing all
three into one generic expiry lifecycle.

The player/summon Alacrity distinction is source-supported: `gw2RechargeRate` and `gw2RechargeIntervals` use a constant
player rate but integrate received summon windows at `js/games/gw2/platform/combat/recharge.ts:28–63`. This review does
not validate the separate Ranger finding or static Initiative consolidation; their owning reports remain canonical.
Unsupported incoming damage and fixed player-health policy are not reclassified as defects.

Open questions remain bounded: a future accessor design needs proof against TypeScript structural assignability; a
future tail helper needs a precise current-completion/causal contract; neither is implemented or fully specified here.
Cached catalog mutability and conventional Core-field assumptions remain original follow-up questions without newly
demonstrated failures. The review found no basis to broaden them into additional confirmed findings.
