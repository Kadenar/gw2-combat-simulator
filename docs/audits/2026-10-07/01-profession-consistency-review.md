# Independent review: profession consistency

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (2026-10-07). Reviewed the frozen
[profession consistency audit](01-profession-consistency.md), without changing that report or production source. All
source paths and line references below refer to this baseline.

The two original runtime defects reproduce. The broken documentation expression also reproduces. The Initiative finding
remains a bounded refactoring opportunity, with no demonstrated gameplay defect. The pet-recharge recommendation needs a
material correction: the current shared summon projector loses companion identity, so copying it directly would import
another bug. A separate incoming-pet recharge failure was reproduced during this review and independently validated by
the coordinator as PROF-R001.

## Disposition register

| Original ID | Disposition                | Reassessed classification                                                                                                       | Severity | Confidence                                                                                 |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| PROF-003    | confirmed with corrections | Bug / architectural inconsistency; recommendation must preserve companion identity and lifetime                                 | medium   | High for internal-contract divergence and reproduced timing; no external game-timing claim |
| PROF-001    | confirmed                  | Bug / misplaced modifier ownership, limited to baseline-stat runtime queries in demonstrated valid inputs                       | low      | High                                                                                       |
| PROF-002    | confirmed                  | Cleanup: broken public-interface documentation                                                                                  | low      | High                                                                                       |
| PROF-004    | confirmed with corrections | Architectural inconsistency / optional refactor, not an established gameplay bug; refine gate precedence and validation anchors | low      | High for duplicate responsibility; medium for migration benefit                            |

## Scope and methods

I independently read the nine family definitions, the registry's separate family/app loading paths, the native authoring
and selected-runtime composition contracts, and the cited Ranger/Thief mechanic paths. Detailed validation covered
Natural Fortitude's trait definition, imperative callback, selected catalog and modifier composition, build calculation
and browser provenance; Ranger pet autonomous selection, command queuing, recovery, Alacrity reception, recharge
projection, swap retirement and incarnation identity; and Thief cost admission, payment, regeneration, Specter rewards
and Antiquary refunds. Firebrand's declared page costs, Revenant's dynamic Energy/upkeep path, Reaper's empty
specialization state and Chronomancer's explicit checkpoint provide counterexamples to indiscriminate standardization.

Read guidance includes `README.md`, `scripts/README.md`, `tests/README.md`, `docs/architecture/ARCHITECTURE.md`,
`docs/architecture/MODULES.md`, `docs/architecture/PROGRAMMATIC-SIMULATION.md`, `js/games/gw2/platform/README.md`,
`docs/professions/RANGER.md` and `docs/professions/THIEF.md`. I inspected supplied issue bodies and recent states,
particularly open #66/#70, closed #92/#94 and the Untamed build submissions. Their existence is not evidence that any
original finding is current; the source and executions below provide that evidence.

Focused commands ran from the repository root against its existing compiled package aliases:

| Command / method                                                               | Actual result                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node .scratch/audit/prof-review/probes.mjs`                                   | Four Untamed selected/provenance controls, build delta, broken/corrected documentation calls, four pet-Alacrity scenarios and earned-work comparisons; results below                                          |
| `node .scratch/audit/prof-review/move-callback.mjs`                            | In-memory module re-registration only: selected raw Untamed Vitality changes from 1000 to 1240; selected precomputed stays 1240; unselected stays 1000                                                        |
| `node .scratch/audit/prof-review/inventory.mjs`                                | All nine families / 45 selected runtimes load; each creates distinct root, Core and elite state objects; all states structured-clone; counts match the original report; `window` and `document` are undefined |
| `node .scratch/audit/prof-review/replayed-appendix.mjs`                        | Re-executed the original report's appendix fixture: 45 records, zero errors, zero nonempty warning arrays, all 45 reported damage-packet counts match                                                         |
| `node .scratch/audit/prof-review/swap-recharge.mjs`                            | Separate incoming-pet Alacrity leakage reproduced; exact standalone code and output below                                                                                                                     |
| Focused `node --test --test-name-pattern=...` command under PROF-004           | Seven selected tests passed, zero failed                                                                                                                                                                      |
| `rg -n 'resolveRuntime' js tests docs/architecture/PROGRAMMATIC-SIMULATION.md` | Only the documentation expression at line 215; no source/test caller                                                                                                                                          |
| Numbered source reads and targeted `rg` searches                               | Located callers, guards, alternative implementations, policies and tests; searches alone were not treated as proof of behavior                                                                                |

All four JavaScript blocks preserved below were extracted and executed again after writing the review; their outputs
match the tables. Source citation paths and upper line bounds were checked, the frozen original report hash still
matches, and the review passes its explicit Prettier check.

The scratch commands identify actual executions; the important new reproductions are retained in this report rather than
depending on uncommitted scratch files. The initial attribute-query attempt omitted its required cooldown readiness
provider and threw `Cooldown queries require a readiness provider.` That harness error was corrected by explicitly
supplying `skillOnCooldown: () => false`; it is not a product finding. No broad baseline rerun, rebuild, browser
installation, browser execution or production edit was performed. The coordinator's existing `npm run check` result,
including 4,876 passing Node tests, is reused as baseline evidence rather than represented as my own execution.

## Original finding assessments

### PROF-003 — Autonomous recharge snapshots Alacrity

**Disposition: confirmed with corrections. Classification: bug / architectural inconsistency. Severity: medium.
Confidence: high for the internal inconsistency.**

Independent source trace:

- `js/games/gw2/professions/ranger/core/mechanics/pets.ts:137-144` (`petBoonActive`) queries received boons for the
  current `rangerPetCompanionId`; that ID contains slot and generation at lines 56–59. Player permanent-Alacrity
  assumptions alone cannot activate this branch.
- `js/games/gw2/professions/ranger/core/mechanics/pets.ts:255-278` (`autonomousSkill`) compares the stored autonomous
  absolute deadline with commanded recharge. Lines 430–440 sample Alacrity once and assign `time + cooldown / rate`.
  Nothing subsequently updates that autonomous deadline for grant or expiry.
- `js/games/gw2/professions/ranger/core/mechanics/pets.ts:248-252` (`petCommandRechargeReadyAt`) instead projects
  `{ startedAt, work }`; command work is installed at lines 377–380 and re-anchored to actual execution at line 524.
  `js/games/gw2/platform/execution/cooldowns.ts:62-70` projects work through recharge intervals.
- `js/games/gw2/platform/combat/recharge.ts:28-63` explicitly makes player recharge constant while integrating received
  summon Alacrity; `projectRecharge` at lines 66–76 preserves earned work.
  `js/games/gw2/professions/ranger/data/module-data.ts:59-75` marks pet skills' recharge audience as summon.
- The 20-second Tail Lash input is independently present in
  `js/games/gw2/professions/ranger/core/mechanics/pet-profiles.ts:360-365`. No external skill value is required to
  establish this inconsistency.

I reproduced all four action sequences in the original report. A probe at 10 seconds additionally projects the same 20
units of work from the first Tail Lash start, 3.12 seconds:

| Received Alacrity | Stored autonomous deadline at t=10 | Shared earned-work projection at t=10 | Actual Tail Lash starts in 45 seconds |
| ----------------- | ---------------------------------- | ------------------------------------- | ------------------------------------- |
| None              | 23.12                              | 23.12                                 | 3.12, 24.32                           |
| 0–10 seconds      | 19.12                              | 21.4                                  | 3.12, 20.56, 41.76                    |
| 0–30 seconds      | 19.12                              | 19.12                                 | 3.12, 20.56, 38                       |
| 8–38 seconds      | 23.12                              | 20.096                                | 3.12, 24.32, 41.76                    |

All warnings were empty. The short initial grant therefore permits an automatic activation at 20.56 seconds before its
21.4-second earned-work deadline. A later grant does not accelerate the first autonomous deadline. Action starts can be
later than a recharge deadline because the pet only decides at its next available AI/recovery boundary; the table does
not conflate these quantities.

A reproduction retaining the additional projection evidence:

```js
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
for (const [at, duration] of [
  [0, 0],
  [0, 10],
  [0, 30],
  [8, 30]
]) {
  const samples = [];
  const result = runRanger(
    [{ type: 'combat-start' }, { type: 'wait', durationMs: 45000 }],
    { selectedPet: 'Carrion Devourer', boons: {}, allies: { count: 0 }, sharePlayerBoonsWithSummons: true },
    {
      initialize(runtime) {
        if (duration)
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              kind: 'alacrity',
              at,
              duration,
              stacks: 1,
              source: 'fixture',
              sourceId: 'fixture',
              actorType: 'player',
              audience: { recipients: 'party' }
            }
          });
      },
      probes: [
        [
          10,
          (runtime) =>
            samples.push({
              stored: runtime.profession.core.petAutoCooldowns[ID.PET_TAIL_LASH],
              projected: runtime.cooldownController.project(runtime.helpers.skillsById.get(ID.PET_TAIL_LASH), {
                startedAt: 3.12,
                work: 20
              })
            })
        ]
      ]
    }
  );
  console.log({
    at,
    duration,
    samples,
    warnings: result.warnings,
    starts: result.events.filter((e) => e.type === 'action' && e.skillId === ID.PET_TAIL_LASH).map((e) => e.at)
  });
}
```

**Guards and intentional exceptions.** Untamed's command-only natural pet skills bypass special AI selection in
`js/games/gw2/professions/ranger/data/pet-commands.ts:3-13` and
`js/games/gw2/professions/ranger/core/mechanics/pets.ts:257-260`. Tiger's autonomous profile explicitly ignores Alacrity
at `js/games/gw2/professions/ranger/core/mechanics/pet-profiles.ts:377-385`; this does not imply all of Tiger's
commanded skills are immune. The command test at
`tests/games/gw2/professions/ranger/pets-and-specializations.test.js:669-695` deliberately accelerates Tiger's Furious
Pounce after a received grant. Pack Alpha and the quickness-specific Crippling Anguish price are separate base-work
policies at `js/games/gw2/professions/ranger/core/mechanics/pets.ts:433-439` and must survive. Animation speed remains
sampled per activation at lines 490–491; that policy does not establish a whole-recharge snapshot exception.

**Corrected recommendation.** First provide identity/lifetime-safe summon recharge projection, or a pet-local adapter
using the shared arithmetic over correctly filtered boon windows. The existing `cooldownController.project` path is not
sufficient by itself: `js/games/gw2/platform/combat-calculation/timeline-index.ts:80-88` builds one aggregate summon
window stream. PROF-R001 below demonstrates the resulting current-code error. Then store autonomous base work and its
owning companion and consult the projection at AI decisions; preserve trait modifiers, autonomous-only immunity and
recovery cadence. The original report correctly requests incarnation preservation, but understates that the proposed
shared path already fails it.

Do not merely call `setReadyAt`: `js/games/gw2/platform/execution/cooldowns.ts:73-75` explicitly deletes recharge
progress. Automatic commandable activations currently publish such a deadline at
`js/games/gw2/professions/ranger/core/mechanics/pets.ts:441-443`. Any consolidation must cover that publication as well
as the AI map.

Validation should include timed gain/expiry, swap and swap-back, grant to another companion only, player-only grants,
immunity, Pack Alpha, command preemption, auto/manual sharing and partitioned waits. The original long-initial-grant
test at `tests/games/gw2/professions/ranger/pets-and-specializations.test.js:958-997` does not cover changing rates
during an automatic recharge. `docs/architecture/ARCHITECTURE.md:212-215` is demonstrably stale about summons; repair
that sentence without changing the intentional permanent-player policy. No supplied issue directly matches; #70 is a
different path.

### PROF-001 — Natural Fortitude's callback belongs to Untamed

**Disposition: confirmed. Classification: bug / ownership inconsistency. Severity: low. Confidence: high.**

`js/games/gw2/professions/ranger/specializations/druid/module.ts:10,21-22` imports and registers
`modifyNaturalFortitudeAttributes`. `js/games/gw2/professions/ranger/specializations/untamed/module.ts:11-20` registers
Untamed traits but no such modifier. The trait owns `attributeBonus: 240` and a static Vitality contribution in
`js/games/gw2/professions/ranger/specializations/untamed/traits/index.ts:24-34`; its existing callback reads that
profile only when selected and avoids adding already-applied static rules in
`js/games/gw2/professions/ranger/specializations/untamed/traits/behavior.ts:128-140`.

This is not an import-only inference. `composeModuleModifiers` collects only selected modules' callbacks in
`js/games/gw2/platform/profession-definition/profession.ts:223-258`; `selectionFor` selects Core plus the requested
elite at lines 359–388. `runtimeFor` installs that modifier at line 426. The actual combat attribute query calls it in
`js/games/gw2/platform/combat-calculation/combat-query.ts:365-376`. Thus Untamed's valid raw selected-trait input never
reaches its callback.

I independently ran the combat-query entry, not just the original direct callback expression:

```js
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
for (const selected of [false, true])
  for (const precomputed of [false, true]) {
    const config = {
      specialization: 'Untamed',
      selectedTraitIds: selected ? [2286] : [],
      stats: { vitality: precomputed && selected ? 1240 : 1000 },
      attributeProvenance: { professionStaticRulesApplied: precomputed }
    };
    const query = createGw2CombatQuery({
      profession: rangerProfession.runtimeFor(config),
      config,
      skillOnCooldown: () => false
    });
    console.log({
      selected,
      precomputed,
      vitality: query.statsAt(0, { type: 'damage', at: 0, actorType: 'player' }).vitality
    });
  }
```

| Selected | Static rules already included | Observed Vitality | Expected under the existing callback contract |
| -------- | ----------------------------- | ----------------- | --------------------------------------------- |
| No       | No                            | 1000              | 1000                                          |
| No       | Yes                           | 1000              | 1000                                          |
| Yes      | No                            | 1000              | 1240                                          |
| Yes      | Yes                           | 1240              | 1240                                          |

The build-calculator comparison independently returned a 240-point selected-trait delta. The provenance default is false
in `js/games/gw2/platform/builds/attribute-provenance.ts:8-28`; application config explicitly carries calculated
Vitality and provenance true in `js/games/gw2/app/simulation/build-config.ts:81-95,140-144`. These guards constrain
impact: no ordinary browser-panel failure or outgoing-DPS change was established. The malformed Druid-plus-Untamed-trait
throw is unnecessary to prove the valid-input defect and should not increase severity.

**Smallest useful change and risk.** Move the existing modifier registration from Druid to Untamed and retain its
selection/provenance checks. An in-memory reconstruction of the family with exactly that registration move corrected
selected raw Vitality to 1240 and preserved all three other controls above. No source was edited. Do not add another
build contribution. The suggested alternative trait-hook placement is unnecessary:
`js/games/gw2/platform/profession-definition/traits.ts:16-64` does not expose an imperative `modifyAttributes` hook;
module modifiers already do in `js/games/gw2/platform/profession-definition/module-types.ts:71-75`.

Add direct raw/precomputed parity, unselected, patched-profile and player/independent-summon cases. The callback's
special summon guard means actor scope deserves explicit preservation rather than assuming a registration move proves
every inheritance case. Correct the preservation-only comment and `docs/professions/RANGER.md:50-54`, which accurately
describe the existing Druid boundary but provide no gameplay reason for it. The original assessment that the shared
provenance test omits Ranger is correct for `tests/games/gw2/professions/native-build-attributes.test.js:153-283`. No
corresponding supplied issue was identified.

### PROF-002 — The documented runtime accessor does not exist

**Disposition: confirmed. Classification: cleanup / broken interface documentation. Severity: low. Confidence: high.**

The exact expression at `docs/architecture/PROGRAMMATIC-SIMULATION.md:215` throws:

```text
TypeError: engineerProfession.resolveRuntime is not a function
```

The native contract declares `runtimeFor` in `js/games/gw2/platform/profession-definition/module-types.ts:180-183`;
implementation and export are `js/games/gw2/platform/profession-definition/profession.ts:402-471,501`. Independently
executing the corrected expression returns a Core skill count of 133:

```js
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
console.log(engineerProfession.runtimeFor({ specialization: 'Core' }).catalog.skills.length);
```

The source/test search returns no other `resolveRuntime` use. This confirms the baseline documentation failure, not the
historical claim of when the method was removed. Change the one documentation expression; no compatibility alias or
production API change is justified. The complete application catalog remains intentionally distinct from the selected
runtime catalog. Runtime regression risk is negligible; execute the corrected snippet when editing the documentation. No
supplied issue directly matches.

### PROF-004 — Initiative duplicates a shared cost lifecycle

**Disposition: confirmed with corrections. Classification: architectural inconsistency / refactoring opportunity, not a
demonstrated gameplay bug. Severity: low. Confidence: high for the duplicate responsibility; medium for net migration
benefit.**

Independent source tracing confirms that Initiative uses the same resource controller but a separate
affordability/payment path. `js/games/gw2/professions/thief/core/hooks.ts:143-150` checks `initiativeCost`, current
value and `readyAt`; lines 228–231 call `spendThiefCoreResources`, which spends in
`js/games/gw2/professions/thief/core/mechanics/resources.ts:66-70`. The shared equivalents are `skillCostAvailability`
and `spendSkillCost` in `js/games/gw2/platform/execution/skill-cost.ts:12-43`.
`js/games/gw2/platform/execution/cast-execution.ts:337-340` pays a declared start cost before profession start hooks,
while line 130 pays a commit cost before completion hooks.

`js/games/gw2/platform/skills/types.ts:201-205` supports only `resourceCost` or `profileAmount`, not an arbitrary
authored skill-field selector. `js/games/gw2/platform/skills/validation.ts:377-385` also rejects unknown cost keys.
`js/games/gw2/professions/thief/core/skills/weapons/scepter.ts:205-215` owns Measured Shot's price of four Initiative.
`js/games/gw2/integrations/patches/authoring/fields.ts:21` exposes `initiativeCost` to patch authoring, so duplicating
the number into `resourceCost` would create avoidable drift.

The original comparison is appropriately bounded: Firebrand Searing Spell declares commit payment at
`js/games/gw2/professions/guardian/specializations/firebrand/skills/tome-skills.ts:123-129`; Initiative pays on
acceptance, including cancelled attempts. Revenant computes live Energy cost and reserves upkeep separately in
`js/games/gw2/professions/revenant/core/hooks.ts:138-158,243-253,275-279`. No evidence justifies replacing those
semantics with identical declarations.

**Corrections to the migration description.** The generic cost gate is evaluated first, but only a non-retryable cost
rejection immediately bypasses profession gates. `js/games/gw2/platform/profession-definition/profession.ts:446-455`
still runs composed availability for retryable cost failure, lets a non-retryable profession failure win, and combines
retry times with `Math.max`. The migration must preserve warning priority and codes as well as successful-cast timing.
Current custom rejection is `thief.initiative`; the generic path produces `gw2.insufficient-initiative`. Both paths call
`readyAt`, but only Thief additionally checks current value with `EPSILON`; removing that check is a behavioral
decision, not demonstrated equivalence.

Payment/reward ordering matters beyond the numeric debit.
`js/games/gw2/platform/profession-definition/runtime-hooks.ts:148-150` preserves hook order; Core then elite composition
occurs in `js/games/gw2/platform/profession-definition/profession.ts:415-419`. Specter grants force from gross authored
cost in `js/games/gw2/professions/thief/specializations/specter/hooks.ts:200-207`; Antiquary records gross spend,
refunds Chak and then checks pilfer at `js/games/gw2/professions/thief/specializations/antiquary/hooks.ts:233-242`.
Moving start payment to the shared phase can preserve these rewards, but the old Core spend must be removed atomically
to avoid double payment.

**Corrected validation anchors.** The original `resource-start-triggers.test.js` covers interrupted trait rewards, and
`tests/games/gw2/professions/thief/interrupt-commit.test.js:16-61` covers Preparation flips/recharge; neither directly
establishes Initiative-cost preservation. More direct existing anchors are:

- `tests/games/gw2/professions/thief/core-and-deadeye.test.js:662-755,1830-1862`: regeneration, paid-but-cancelled
  Unload, committed refund, fractional readiness across waits, and next-known-grant retries with zero regeneration.
- `tests/games/gw2/professions/thief/specter-and-antiquary.test.js:135-171`: Siphon, Initiative spending and Shadow
  Force.
- `tests/games/gw2/professions/thief/counter-contracts.test.js:17-58`: gross progress before Chak refund and pilfer
  handling.

I ran the following command: **seven tests passed; zero failed**.

```sh
node --test --test-name-pattern='initiative regenerates|Unload refunds|initiative-funded|initiative availability|Prodigious Pincher retains|Specter Siphon' tests/games/gw2/professions/thief/core-and-deadeye.test.js tests/games/gw2/professions/thief/counter-contracts.test.js tests/games/gw2/professions/thief/specter-and-antiquary.test.js
```

**Smallest useful change and risk.** Retain the report's defer-until-needed priority. If a cost-infrastructure change
justifies migration, add a validated single-source skill-field selector, retain `initiativeCost` as the authoritative
patchable field, and migrate admission/payment together. Explicitly decide warning compatibility and gate priority
first. Preserve zero/free costs, cancellation payment, fractional recovery, scheduled grants and ordered elite rewards.
Characterization of these boundaries is smaller and safer than undertaking a new generic framework now. No measured
performance benefit or current damage mismatch is claimed. This is not a fix for KERNEL-001. No supplied issue directly
matches.

## Native contract, coverage and migration blueprint

The report correctly recognizes that a common profession contract already exists. It should remain the extension point:

| Assessment                                                                      | Independent evidence and consequence                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required identity/data/state, optional modifiers/hooks/projection/presentation  | `js/games/gw2/platform/profession-definition/module-types.ts:46-77`; runtime validation in `js/games/gw2/platform/profession-definition/profession.ts:72-123`. Optional hooks are legal even though the current trait expansion can produce a hook table.                                                               |
| Core plus selected elite, separate full family catalog                          | `js/games/gw2/platform/profession-definition/profession.ts:359-388,420-435,479`; do not normalize both catalogs into one execution inventory.                                                                                                                                                                           |
| Trait declarations and explicit callbacks have different eligibility boundaries | Modifier rules gain a selection wrapper in `js/games/gw2/platform/profession-definition/profession.ts:155-162`; trait callbacks are composed at lines 164–177 and still need their own eligibility checks. The original report's statement should be read as applying to rules, not automatic gating of every callback. |
| State is per run; projection is not rollback                                    | Fresh fragment composition in `js/games/gw2/platform/profession-definition/profession.ts:261-287`; all 45 independent state checks passed. Chronomancer explicitly uses checkpoint/restore operations in `js/games/gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split.ts:21-27,48-66,87-95`. |
| Empty elite state can be intentional                                            | `js/games/gw2/professions/necromancer/specializations/reaper/state.ts:3-10` returns a fresh empty object, installed without projection in `js/games/gw2/professions/necromancer/specializations/reaper/module.ts:22-26`. No forced parallel state is warranted.                                                         |
| Headless execution and lazy presentation remain separate                        | `js/games/gw2/platform/profession-definition/profession.ts:212-219,502-515` defers UI factories; all families loaded and all selected runtimes were created with no browser globals. This is not a browser integration test.                                                                                            |

The independently replayed 45-case appendix and inventory support the report's registration/short-path claims. All skill
counts and resolved damage counts match. They do not establish correctness of every module's leaves, every selected
trait or every specialization/weapon pair. I did not independently repeat the nine additional deeper traces, every
claimed original source read, or every module shell; those remain original-author coverage claims, not new review
evidence. The original report clearly labels the traces as intrinsic plumbing and its leaf coverage as sampled, which is
appropriate.

The migration order is reasonable with one added dependency:

1. Correct PROF-001's registration and PROF-002's documentation expression locally.
2. Make summon recharge respect companion identity/lifetime (PROF-R001), then migrate autonomous work accounting for
   PROF-003 while retaining policy exceptions. These can share a focused change if the acceptance criteria remain
   distinct.
3. Defer PROF-004 until its cost-infrastructure benefit justifies the warning/order compatibility work.

Do not preserve defective pet timing as a golden trace. Preserve only unaffected cadence, commands, immunity and
attribution while explicitly updating expectations for corrected recharge. Keep numerical changes limited to
demonstrated defects. No cross-profession state framework, uniform directory layout or relocation of pet AI into the
platform follows from these findings.

## Reviewer discovery

### PROF-R001 — An outgoing pet's Alacrity accelerates the replacement pet's commanded recharge

**Status: reviewer discovery, independently reproduced and confirmed by the coordinator after notification.
Classification: bug. Severity: medium. Confidence: high for the internal recipient/lifetime violation; no externally
measured game timing is asserted.**

**Expected.** A grant addressed only to the old pet must not accelerate recharge started by its replacement. This
follows from explicit incarnation-based boon queries and retirement behavior, not an inferred wiki rule.

**Source and runtime path.** `js/games/gw2/professions/ranger/core/skills/actions.ts:40-67` emits retirement, changes
active pet and increments the generation via reset.
`js/games/gw2/professions/ranger/core/mechanics/event-handlers.ts:7-17` retires the outgoing companion;
`js/games/gw2/professions/ranger/core/mechanics/pets.ts:56-59,137-144` queries boons for the new identity. However,
commanded recharge uses `cooldownController.project` at
`js/games/gw2/professions/ranger/core/mechanics/pets.ts:248-252,524`. The controller gets its intervals from
`js/games/gw2/platform/simulation/runtime.ts:223-232`, through
`js/games/gw2/platform/combat-calculation/timeline-index.ts:80-88`. That path caches aggregate summon windows with no
companion identity. `buffMatchesAudience` accepts any summon recipient when the ID argument is omitted in
`js/games/gw2/platform/combat/boons.ts:237-255`; `prepareBoonWindows` omits it at lines 273–303 and does not clip for
companion retirement. The rate therefore comes from another incarnation's boon even though the incoming pet's own
active-boon query correctly returns zero.

**Reproduction.** Save this inside the repository as an `.mjs` file and execute with Node against compiled baseline
modules:

```js
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
for (const grant of [false, true]) {
  const samples = [];
  const result = runRanger(
    [
      { type: 'combat-start' },
      { type: 'wait', durationMs: 2000 },
      'Swap Pets',
      { type: 'wait', durationMs: 1000 },
      'Poisonous Cloud',
      'Poisonous Cloud',
      { type: 'wait', durationMs: 40000 }
    ],
    {
      selectedPet: 'Tiger',
      selectedPet2: 'Carrion Devourer',
      boons: {},
      allies: { count: 0 },
      sharePlayerBoonsWithSummons: true
    },
    {
      initialize(runtime) {
        if (grant)
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              kind: 'alacrity',
              at: 0,
              duration: 30,
              stacks: 1,
              source: 'fixture',
              sourceId: 'fixture',
              actorType: 'player',
              audience: { recipients: 'party' }
            }
          });
      },
      probes: [
        [
          5,
          (runtime) => {
            const companionId = rangerPetCompanionId(runtime);
            const skill = runtime.helpers.skillsById.get(ID.POISONOUS_CLOUD);
            samples.push({
              companionId,
              activeAlacrity: runtime.mechanics.combat.activeBoonStacks('alacrity', runtime.time, 1, {
                actor: 'companion',
                companionId
              }),
              readyAt: runtime.cooldownController.project(
                skill,
                runtime.profession.core.petCommandRecharges[ID.POISONOUS_CLOUD]
              )
            });
          }
        ]
      ]
    }
  );
  console.log({
    grant,
    samples,
    commandStarts: result.events
      .filter((e) => e.type === 'action' && e.skillId === ID.POISONOUS_CLOUD)
      .map((e) => e.at),
    alacrityRecipients: result.events
      .filter((e) => e.type === 'buff' && e.kind === 'alacrity')
      .map((e) => e.resolvedAudience.companionIds),
    warnings: result.warnings
  });
}
```

**Actual observations:**

| Case                        | Incoming identity | Incoming Alacrity at t=5 | First commanded recharge projection | Poisonous Cloud starts | Alacrity companion recipients |
| --------------------------- | ----------------- | ------------------------ | ----------------------------------- | ---------------------- | ----------------------------- |
| No grant                    | `ranger-pet:2:1`  | 0                        | 34.32                               | 4.32, 34.4             | None                          |
| 30-second grant before swap | `ranger-pet:2:1`  | 0                        | 28.32                               | 4.32, 30.64            | Only `ranger-pet:1:0`         |

Both runs have empty warnings. AI recovery accounts for the second command starting later than its projected ready time;
the projection and action differences both originate from a grant the new pet never received. This changes command
timing and can change output; no DPS percentage is claimed.

The coordinator independently inspected the implicated source, reran this probe and ran additional controls: player-only
grant with sharing disabled and an old-pet one-second grant expiring before swap both match the no-grant result
(`34.32`, starts `4.32,34.4`). Only the long old-pet grant produces the accelerated result. Those controls confirm this
is recipient/lifetime leakage, not permanent player Alacrity or ordinary pet-lane variability.

**Smallest useful change.** Carry the recharge owner's companion identity into the relevant projection and derive its
intervals from grants addressed to that identity, clipping/removing its active boon pool on retirement according to the
existing lifetime contract. Keep generic remaining-work arithmetic shared. A pet-local scoped interval adapter is a
bounded alternative if changing all shared recharge consumers at once is too broad. Do not simply clear every recharge
on swap: that changes skill cooldown persistence and erases legitimately earned work. Keep the public player
permanent-rate path unchanged.

**Regression risk / validation.** Preserve earned work before retirement, independently address multiple companions,
avoid applying replacement grants retroactively to an old owner's recharge, and characterize swap-back plus same-skill
identities across pets. Test old-only, new-only, player-only, short expired and post-swap grants; compare autonomous and
commanded cases without erasing Tiger's explicit auto policy. The demonstrated bug is Ranger commanded recharge; the
aggregate infrastructure warrants an inventory of other summon consumers, but this review does not claim they all fail.
No supplied issue directly matched. Related original finding: PROF-003; the new finding is a prerequisite correction to
its reuse recommendation, not a duplicate snapshot-rate defect.

## Remaining gaps and limitations

- External game logs, patch-by-patch coefficient correctness, live wiki values and complete profession balance were not
  verified. Findings use repository contracts and independently executed controls.
- No real browser test ran. The environment's unavailable Chrome/Chromium path was not retried, and headless loading is
  not evidence of browser layout, loading, persistence or UI correctness.
- The 45 smoke runs deliberately lack selected traits and many loadout restrictions, and use short observation windows.
  They cannot resolve open #66 (Impossible Odds / Sigil of Air) or #70 (Untamed palette ambush availability). The closed
  Measured Shot issues are not reopened by the Initiative refactor assessment.
- I did not exhaust all trait combinations, transformed bars, cancellation instants, ammo boundaries, patch overlays,
  multiple-summon interactions, encounter durations or independent-summon inheritance. PROF-001's in-memory move
  validates the supplied player parity matrix, not every possible attribute consumer.
- No implementation was made, so proposed fixes have not passed a production regression suite. PROF-004's payoff remains
  an engineering judgment; no performance measurement supports prioritizing it.
- Supplied issue snapshots are incomplete historical coverage. No claim of exhaustive bug absence is made.
