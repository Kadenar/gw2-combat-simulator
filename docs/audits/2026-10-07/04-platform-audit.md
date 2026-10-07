# GW2 platform audit

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3`, reviewed 2026-10-07. This is a documentation-only audit of the
shared GW2 platform and its profession/kernel boundaries. No source, tests, configuration, or generated assets were
changed. Findings use baseline line numbers.

## Findings at a glance

| ID           | Classification              | Severity | Confidence | Finding                                                                                                                |
| ------------ | --------------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| PLATFORM-001 | Bug                         | Low      | High       | Damage occurrence enumeration drops selected traits represented by numeric strings, although simulation executes them. |
| PLATFORM-002 | Architectural inconsistency | Low      | High       | The specialization-state accessor restores mutation capabilities to explicitly read-only query contexts.               |
| PLATFORM-003 | Architectural inconsistency | Low      | High       | Multiple profession modules encode the engine's cast-completion tail ordering with a private numeric priority.         |

Only PLATFORM-001 is a demonstrated incorrect output. PLATFORM-002 demonstrates a type-level capability hole, without a
discovered production mutation through it. PLATFORM-003 recommends preserving and naming an existing, tested ordering
relationship; it does not allege that the present order is wrong.

## Scope and actual coverage

The platform contains **209 TypeScript files / 32,229 lines in 15 domains**. These are inventory counts, not fully
reviewed-line counts. “Deep” below means a representative path was followed through its callers and consumers; it does
not mean every file or mechanic in that domain was exhausted. Paths in the second column are relative to
`js/games/gw2/platform/`.

| Domain                    | Files / lines | Actual review and limits                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `builds`                  |    14 / 4,827 | Deep trait membership and selected-skill normalization; sampled canonical codec migration/validation, attribute derivation and assumption boundaries. Chat-code parsing and every migration variant were not exhaustively reviewed.                                                                |
| `combat`                  |    26 / 3,405 | Deep resource pools, charge/counter/stack primitives, resource policy, boons, modifier contracts; sampled target health/conditions, actor ownership, allied-player tracking and proc registries. No independent game-balance verification.                                                         |
| `combat-calculation`      |     2 / 1,091 | Traced combat-query use of traits/modifiers/live resources; read timeline indexing, incremental cache invalidation, audience/retirement handling and recharge integration. Full numerical combinatorics and every modifier combination were not reviewed.                                          |
| `combos`                  |     9 / 1,423 | Deep descriptor-to-runtime-field/finisher-to-outcome path, binding ownership and ambiguity behavior; sampled catalog normalization, permanent-field assumptions and validation. Not every field/finisher outcome checked.                                                                          |
| `effects`                 |    13 / 1,986 | Deep declared actions, side-effect dispatch, emission/materialization, type and audience contracts; sampled declaration validation. Packet-builder variants and all procedural producer metadata were not exhausted.                                                                               |
| `equipment`               |    53 / 4,871 | Representative relic lifecycle, query/runtime separation and Fireworks/Blightbringer/Fractal rules; sigil loadout and weapon matching/strength boundaries. Most individual relics, consumable values and gear tables were not manually validated.                                                  |
| `events`                  |       3 / 444 | Read actor and packet identity contracts and core event validation, including explicit actor attribution and extension validation. Custom profession event schemas remain owner-specific.                                                                                                          |
| `execution`               |    15 / 2,158 | Deep cast lifecycle, side-effect/commit order, shared flips and autoattack chains; sampled availability/timing/cost interfaces. Detailed cursor, cooldown and queue correctness belongs to the kernel audit.                                                                                       |
| `profession-definition`   |    17 / 2,860 | Deep native module/family composition, runtime selection, state fragments, hook composition, capability contexts, traits/triggers and compiler validation; sampled full/application versus active catalog assembly and profile authoring. This existing contract is the basis for recommendations. |
| `profession-presentation` |     5 / 1,231 | Read contract and composition rules: active Core/elite/family slices, list/scalar merge rules, duplicate identity rejection, resource capacity and preview preparation. Sampled attribute/damage preview types. Browser rendering is outside this report.                                          |
| `resolver`                |    15 / 2,727 | Sampled phase/handler/reaction registries and combat-service integration; traced effect materialization into resolver ownership and resolved facts into queries. Deeper delivery/condition ordering is covered by the kernel auditor, not claimed complete here.                                   |
| `results`                 |    11 / 1,541 | Deep planning projection, runtime projection and effect observation/policy merge; sampled combat-result construction. Full sampling/report aggregation and every result consumer not independently reviewed.                                                                                       |
| `simulation`              |    12 / 1,594 | Deep public entry/config, runtime construction, resource controller, mechanic/query binding and task scheduling; sampled work/coordinator contracts. Did not duplicate the kernel auditor's full coordinator trace.                                                                                |
| `skill-damage`            |       7 / 735 | Deep occurrence enumeration, isolated preview runtime, occurrence execution/measurement and query preview; compared actual Thief simulation against occurrence listing. Individual profession preview preparations are sampled.                                                                    |
| `skills`                  |     7 / 1,336 | Read catalog assembly and sampled shared actions, chains, balance profiles and skill validation, including declared side-effect ordering. Not all authored skill definitions or external-ID mappings validated.                                                                                    |

Documentation reviewed: `js/games/gw2/platform/README.md`; `docs/architecture/ARCHITECTURE.md`,
`docs/architecture/MODULES.md`, `docs/architecture/SKILL-EVENT-ORDERING.md`;
`docs/architecture/PROGRAMMATIC-SIMULATION.md`; `tests/README.md`; `scripts/README.md`; and all nine
`docs/professions/*.md` guides. Architecture/module inventories and long guides were sampled where unrelated to these
paths. Existing issue bodies and recent issue/PR titles/states were checked against candidates; this was not a complete
historical issue search.

Native profession consumers traced include Thief Mug and preparations; Engineer Amalgam commit work; Elementalist
Evoker, Tempest, Weaver and Rock Barrier; Guardian Dragonhunter flips and elite effect observers; Mesmer rifle expiry;
and several Warrior elite effect observers. This cross-section tests shared ownership against real requirements without
treating profession-specific mechanics as duplication merely because their file shapes differ.

## Methods and results

- Used `rg`, numbered source reads and caller/consumer tracing against the pinned baseline. Inventory counted TypeScript
  files and lines under the actual platform domains.
- The coordinator's baseline `npm run check` passed all stages, including **4,876 Node tests**. This auditor did not
  repeat the broad suite or rebuild shared `dist`.
- Ran a focused native Thief simulation and occurrence-list diagnostic against existing compiled package aliases: exit
  **0**, reproduced PLATFORM-001 with identical damage but different listing.
- Ran a focused TypeScript compilation extending `tsconfig.build.json`, with `noEmit: true`, for PLATFORM-002: exit
  **0**, no diagnostics. A direct write required `@ts-expect-error`; equivalent writes through the specialization
  accessor did not.
- Read existing ordering tests for PLATFORM-003, including Unravel, Evoker familiar reset/deferred grants and Amalgam
  Thorns. These already ran in the coordinator's passing baseline; no separate rerun was needed to establish the
  architectural duplication.
- Temporary scripts/logs were isolated under `.scratch/audit/platform/`. The reproductions needed for independent
  verification are included below; those scratch files are not part of the deliverable.

No benchmark or performance improvement is claimed. All findings rely on internal repository contracts; external game
mechanics were not used to manufacture correctness expectations.

## Confirmed correctness finding

### PLATFORM-001 — Numeric-string trait IDs disappear from damage occurrence listings

**Classification:** bug. **Severity:** low. **Confidence:** high.

**Expected behavior.** A configuration accepted by the simulation should enumerate its selected damage owners with the
same trait-ID semantics. `js/games/gw2/platform/simulation/config.ts:33` explicitly accepts
`readonly (string | number)[]`. `normalizeSelectedTraitIds` in `js/games/gw2/platform/builds/selected-traits.ts:12–16`
normalizes numeric strings, and `hasTrait` at lines 31–61 handles number/string identity consistently.

**Observed behavior and location.** `damageOccurrences` in
`js/games/gw2/platform/skill-damage/list-occurrences.ts:12–19` constructs an unnormalized `Set` and tests profile
ownership with strict `.has`. The separate declared-damage-effect gate at line 37 repeats that behavior. Numeric owner
`1276` therefore does not match selected trait string `"1276"`.

The actual native consumer is Mug, defined by `js/games/gw2/professions/thief/core/traits/deadly-arts.ts:135–141`. Both
forms of the selected trait execute Mug. Only the numeric form lists it as a damage occurrence. The application consumes
this function at `js/games/gw2/app/build/skill-damage/plan.ts:467`.

**Trigger and impact.** Programmatic or restored configurations containing numeric-string trait IDs can omit a selected
trait's damage-preview row while the same trait contributes damage in simulation. This reproduction does not establish
that ordinary canonical browser builds produce string IDs; those commonly use numbers. Simulation totals are unaffected
in this case, which limits severity.

**Reproduction.** Save the following as an `.mjs` file inside the repository and execute it with Node after the normal
build. The audit used the already-built baseline, without rebuilding:

```js
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { damageOccurrences } from '#gw2/platform/skill-damage/list-occurrences.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

for (const id of [1276, '1276']) {
  const config = {
    specialization: 'Core',
    selectedTraitIds: [id],
    selectedSkillIds: [],
    boons: {}
  };
  const result = simulateGw2({
    profession: thiefProfession,
    config,
    rotation: ['Steal', { type: 'wait', durationMs: 100 }]
  });
  console.log({
    traitId: id,
    mugListed: damageOccurrences(thiefProfession.runtimeFor(config), config).some(
      (entry) => entry.effect.kind === 'profile' && entry.effect.id === 1276
    ),
    mugExecuted: result.events.some((event) => event.type === 'damage' && event.sourceId === 1276),
    totalDamage: result.totalDamage,
    warnings: result.warnings
  });
}
```

Observed:

```text
traitId: 1276    mugListed: true   mugExecuted: true   totalDamage: 635   warnings: []
traitId: '1276'  mugListed: false  mugExecuted: true   totalDamage: 635   warnings: []
```

**Smallest recommendation and ownership.** Reuse the existing trait lookup contract for both occurrence gates. Normalize
selection once and use `hasTrait`, or otherwise share exactly its number/string semantics. This belongs to the platform
because selection identity is already shared by runtime, build and presentation consumers. No profession workaround or
new configuration format is needed.

**Compatibility, risk and validation.** Preserve nonnumeric string IDs, inactive/unselected-owner exclusion, duplicate
suppression and existing profile-versus-declared-effect ownership rules. Add a focused occurrence-list parity test for
numeric and numeric-string Mug selection, plus a declared `damageEffects` owner case exercising the second gate. Confirm
identical simulation totals and no additional unselected entries. Risk is low if this uses the existing helper rather
than introducing another normalization rule.

**Related findings/issues.** No matching issue was identified in the supplied issue snapshots. This is independent of
the runtime/resource findings in the kernel report.

## Architectural recommendations

### PLATFORM-002 — Specialization accessors erase read-only query capabilities

**Classification:** architectural inconsistency. **Severity:** low. **Confidence:** high.

**Expected behavior.** Query and observation consumers should inspect live state without acquiring mutation
capabilities. This is explicit in `MechanicQueryContext` at
`js/games/gw2/platform/profession-definition/mechanic-context.ts:22–24`, and implemented recursively by
`ReadonlyMechanicState` in `js/games/gw2/platform/profession-definition/runtime-context.ts:52–61`. It covers nested
objects and read-only maps/sets, not just an outer `readonly` property.

**Observed behavior and location.** `ProfessionSpecializationStateDefinition.from` in
`js/games/gw2/platform/profession-definition/state.ts:155–163` accepts `unknown` and returns mutable `TState`. Its
implementation at lines 181–184 calls `specializationStateForKind`, whose lines 141–152 validate the active discriminant
and return the original `active.state`. Consequently, passing a read-only query context grants writable access to its
live specialization state.

This is a real consumer path, not a proposed future extension: `availability` in
`js/games/gw2/professions/elementalist/specializations/evoker/mechanics/availability.ts:23–24` receives
`MechanicQueriesOf<ElementalistRuntime>` and immediately obtains state through `evokerState.from(context)`. It currently
reads the returned state. Elite effect observers likewise use the accessor, for example
`js/games/gw2/professions/guardian/specializations/firebrand/effect-state.ts:15` and
`js/games/gw2/professions/warrior/specializations/berserker/effect-state.ts:20`.

The query binding does not clone or freeze live gameplay state:
`js/games/gw2/platform/simulation/bind-mechanic-context.ts:69–70` exposes the same state under a read-only type. Thus
the accessor is a meaningful capability escape, not merely a mutable local copy.

**Trigger and impact.** An availability or effect-observation implementation using the normal specialization accessor
can accidentally mutate pools or pending-work collections without a compiler error. Query frequency would then become
behaviorally significant. No such production write or numerical corruption was found; the confirmed issue is the
inconsistency in an already-advertised type boundary.

**Focused type reproduction.** At `.scratch/audit/platform/readonly-state.ts`, the following compiles successfully:

```ts
import { evokerState } from '../../../js/games/gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntime } from '../../../js/games/gw2/professions/elementalist/types.js';
import type { MechanicQueriesOf } from '../../../js/games/gw2/platform/profession-definition/mechanic-context.js';

export function demonstrate(context: MechanicQueriesOf<ElementalistRuntime>) {
  if (context.profession.specialization.kind === 'Evoker') {
    // @ts-expect-error Direct mutation is correctly rejected.
    context.profession.specialization.state.familiarCharges.value = 99;
  }
  evokerState.from(context).familiarCharges.value = 99;
  evokerState.from(context).pendingWeaponCompletions.length = 0;
}
```

Compile it with a sibling `tsconfig-readonly.json`:

```json
{
  "extends": "../../../tsconfig.build.json",
  "compilerOptions": {
    "noEmit": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["./readonly-state.ts"]
}
```

Command: `node node_modules/typescript/bin/tsc --project .scratch/audit/platform/tsconfig-readonly.json`. Actual result:
exit 0, no diagnostics. The negative assertion establishes that direct access remains protected while accessor-based
writes are accepted.

**Smallest recommendation and platform ownership.** Preserve the distinction in the shared state accessor instead of
asking every profession to cast manually. For example, provide a read accessor returning `ReadonlyMechanicState<TState>`
and restrict the mutable accessor to the existing mutation-capable mechanic context; alternatively use a type-preserving
accessor with reliable capability discrimination. Merely adding a read method while leaving the unrestricted
`from(unknown)` escape in query code does not close this gap. Keep the active-kind check and the same live state
identity; deep-freezing gameplay state or cloning on each query is unnecessary.

**Consumers and compatibility.** Migrate Evoker availability and read-only elite observers to the read access path.
Mutation hooks must retain mutable access. The existing native family/compiler and owner-local state factories remain
intact; a new state framework is not warranted. Because TypeScript's structural assignability can undermine a naive
overload or parameter restriction, validate the proposed typing with negative compile cases rather than assuming a
narrower-looking signature is sufficient.

**Risk and validation.** This will intentionally expose query helpers that depend on mutable types, so migration can be
wider than a one-line signature edit. Compile-time checks should reject writes through direct and accessor paths,
including nested pools, arrays and map/set mutators, while accepting legitimate lifecycle mutations. Run existing
availability, observation and state-replacement tests to ensure access still follows the current specialization state
without changing gameplay. No runtime performance claim is made.

**Related findings/issues.** No matching issue identified. Distinct from the cached runtime/catalog mutability question
discussed under gaps: this finding has a concrete existing read-only contract and a successful compiler reproduction.

### PLATFORM-003 — Name the shared cast-commit tail relationship

**Classification:** architectural inconsistency. **Severity:** low. **Confidence:** high.

**Expected behavior.** Professions should own their mechanic-specific rewards and transformations, while the platform
owns how a request runs after the current completion's synchronous hooks and before a later completion at the same
timestamp. The existing native hooks, side-effect handlers and task registry already express most of this lifecycle;
only this repeated scheduling relationship is implicit.

**Observed shared boundary.** In `js/games/gw2/platform/execution/cast-execution.ts:130–157`, successful completion
applies declared commit side effects, calls `onCastCommit`, schedules authored tasks and publishes completion. Its
queued `runtime.complete` work has priority `-100` at lines 327–335. The general `scheduleForCast` API at
`js/games/gw2/platform/simulation/runtime.ts:291–310` exposes an arbitrary timestamp and priority, but has no named
operation for the completion tail.

Concrete consumers repeat the same private relationship:

| Consumer                         | Baseline source                                                                               | Actual requirement and workaround                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Amalgam Thorns and Morph rewards | `js/games/gw2/professions/engineer/specializations/amalgam/hooks.ts:32–49`                    | Queue at `runtime.time`, priority `-101`, to retain Core cast rewards → Thorns retaliation → Morph trait tail before the next completion. |
| Tempest etching credit           | `js/games/gw2/professions/elementalist/specializations/tempest/hooks.ts:214–227`              | Queue at current time, `-101`, so ordinary Core credit precedes the extra two credits, which settle before another cast.                  |
| Weaver Unravel                   | `js/games/gw2/professions/elementalist/specializations/weaver/hooks.ts:250–254`               | Queue at current time, `-101`; the source comment explicitly references the next priority `-100` completion.                              |
| Evoker intrinsic completion work | `js/games/gw2/professions/elementalist/specializations/evoker/mechanics/familiars.ts:174–188` | A local scheduling wrapper queues named cast work at current time and `-101`.                                                             |
| Evoker final completion rewards  | `js/games/gw2/professions/elementalist/specializations/evoker/hooks.ts:101–117`               | A second same-priority tail preserves intrinsic reset → deferred grants → final trait rewards.                                            |

**Execution trace and impact.** A completion callback enqueues its tail(s), then continues its own synchronous hooks and
publication. Once it returns, newly queued `-101` work precedes the next `-100` completion. Equal-priority tails retain
their scheduling order. This currently implements intentional mechanics correctly. The maintenance problem is that at
least two profession families and four elite modules must know an engine-owned priority and recreate its relationship to
completion ordering. Changing the engine's completion priority alone would silently invalidate those assumptions.

The requirement is corroborated by existing tests, not inferred from a magic number alone:
`tests/games/gw2/professions/elementalist/skill-definition-ownership.test.js:738–780` observes Unravel state from
same-time `-100` work; lines 831–883 observe familiar reset/deferred grants before same-time work;
`tests/games/gw2/professions/engineer/side-effect-migrations.test.js:101–132` checks Core/retaliation/Morph event order.
These were part of the passing baseline.

**Smallest recommendation and ownership.** Add a narrow named operation to the existing mechanic scheduling capability,
such as `scheduleCastCommitTail(name, cast, data?)`, that delegates to the existing task machinery while centrally
owning “current time, after this callback returns, before another completion.” Migrate the listed calls without changing
their task handlers or request order. Preserve cast reservation copying, catalog skill lookup, handler validation and
work ownership. This is a scheduling contract the platform already implements, so its numeric realization should live
beside the completion implementation.

Do not introduce a generalized phase framework, a second queue, or a global priority enum for every profession task. A
direct `afterCommit` callback invoked in the middle of the present completion callback would not automatically be
equivalent: current tails also follow the remaining completion work. The first change can simply name and centralize the
existing behavior; it need not eliminate all registered task wrappers.

**Compatibility and regression risk.** Keep ordinary `scheduleForCast` for delayed or differently ordered work. Adoption
is internal to the existing native capability and the identified consumers; configuration, skill identity, reports and
kernel API need not change. The main risk is moving work across completion publication, cancellation or equipment
observation boundaries while trying to simplify it.

**Validation.** Retain existing Unravel, familiar, etching and Thorns assertions. Add a focused shared contract case
with two same-time completions and two tails from the first, proving first-completion synchronous work → tails in
request order → second completion. Also cover cancelled versus committed interrupted casts, unchanged cast
identity/owner cancellation, and unchanged ordinary packet/equipment notification order. Compare native consumer traces
before and after migration rather than only testing that the helper passes `-101`.

**Related findings/issues.** No matching issue identified. This does not duplicate the kernel report's
resource-affordability or concurrent-offset correctness findings. The profession report's PROF-004 addresses another
existing lifecycle duplication—static Thief initiative costs—and remains its canonical owner.

## Boundaries that should be retained

The native profession/compiler/capability system already supplies module ownership, active Core-plus-elite composition,
declarative effects, ordered hooks, resource policy, task ownership and read-only queries. Registry conflicts are
checked rather than silently overwritten: for example, `composeRuntimeHooks` in
`js/games/gw2/platform/profession-definition/runtime-hooks.ts:54–60` rejects duplicate task/handler ownership, and
`js/games/gw2/platform/resolver/handler-registry.ts` rejects duplicate or missing event handlers. No replacement
profession framework is recommended.

Shared state primitives do not imply every lifetime belongs in the platform. Thief preparations, Elementalist Rock
Barrier and Mesmer Inspiring Imagery attach different payloads to flip expiry. In particular, Rock Barrier's expiry also
releases held recharge, and Inspiring Imagery has a natural-expiry boon effect. Replacing their local scheduling
wholesale with automatic flip deletion could remove the state before the owner performs its payload. The shared window
primitive plus explicit owner callbacks remains reasonable; these paths were not counted as defects or as justification
for a large generic lifetime framework.

The same restraint applies to resources: static costs can converge on shared policy, while Revenant upkeep and all-stock
spending have additional mechanic semantics. PROF-004 owns the bounded static Initiative proposal. Constant player
Alacrity recharge is documented policy; summons actually integrate received grants through
`js/games/gw2/platform/combat/recharge.ts`. The profession auditor owns the Ranger autonomous-pet discrepancy and stale
documentation correction. This audit does not classify unsupported incoming damage, secondary targets or other stated
model exclusions as bugs.

## Cross-report ownership, unresolved questions and remaining gaps

- The kernel audit is canonical for the reproduced resource-ready/spend tolerance mismatch (KERNEL-001), invalid
  ordinary cast concurrency through `concurrentOffsetMs` (KERNEL-003), boon replay reordering (KERNEL-004), and missing
  reaction-settled boon-extension observations (KERNEL-005). These are not counted again here. See
  [03-kernel-audit.md](03-kernel-audit.md).
- The profession audit is canonical for Ranger pet recharge behavior, the Alacrity documentation correction and static
  Initiative lifecycle consolidation (PROF-004). See [01-profession-consistency.md](01-profession-consistency.md).
- Cached runtime/catalog objects include mutable implementation surfaces despite frozen outer definitions. No production
  mutation contaminating another run was found, and some direct-runtime tests intentionally override policies. This
  remains a contract-hardening question, not a confirmed gameplay bug or a separate recommendation in this report.
- Shared flip and autoattack execution rely on conventional Core fields:
  `js/games/gw2/platform/simulation/runtime.ts:331–335` expects `availableFlips`, and
  `js/games/gw2/platform/execution/autoattack-chains.ts:10–13,57–61` reads `autoattackChains`. Native professions supply
  these fields. Whether a small explicit shared-state type would improve ownership is a follow-up question; no missing
  native field or actual failure was demonstrated, so it is not promoted to a finding.
- Per-domain limits above remain material: individual equipment rules, every profession's procedural packet producer,
  all build/import combinations, every modifier interaction, report sampling and full resolver ordering were not
  exhaustively audited by this agent. No broad absence-of-bugs claim follows from this review or the passing baseline.
