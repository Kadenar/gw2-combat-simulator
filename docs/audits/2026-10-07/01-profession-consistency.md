# Profession consistency audit

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (2026-10-07). Documentation-only audit; source references remain pinned to this commit.

Status: investigation in progress. This initial report owns profession consistency across all nine professions, Core and all four implemented elites per profession. It does not claim that every authored coefficient or game mechanic has been independently verified.

## Scope and coverage inventory

Coverage will distinguish module/contract inspection, real execution traces, focused diagnostics, and remaining gaps.

| Profession | Modules covered | Organization and registration | Skills and traits | State, scheduling and platform integration | Tests and validation |
| --- | --- | --- | --- | --- | --- |
| Elementalist | Core, Tempest, Weaver, Catalyst, Evoker | Pending | Pending | Pending | Pending |
| Engineer | Core, Scrapper, Holosmith, Mechanist, Amalgam | Pending | Pending | Pending | Pending |
| Guardian | Core, Dragonhunter, Firebrand, Willbender, Luminary | Pending | Pending | Pending | Pending |
| Mesmer | Core, Chronomancer, Mirage, Virtuoso, Troubadour | Pending | Pending | Pending | Pending |
| Necromancer | Core, Reaper, Scourge, Harbinger, Ritualist | Pending | Pending | Pending | Pending |
| Ranger | Core, Druid, Soulbeast, Untamed, Galeshot | Pending | Pending | Pending | Pending |
| Revenant | Core, Herald, Renegade, Vindicator, Conduit | Pending | Pending | Pending | Pending |
| Thief | Core, Daredevil, Deadeye, Specter, Antiquary | Pending | Pending | Pending | Pending |
| Warrior | Core, Berserker, Spellbreaker, Bladesworn, Paragon | Pending | Pending | Pending | Pending |

## Methods, actual results, and limitations

- Read shared audit brief and profession/architecture documentation before forming findings.
- Coordinator reports baseline `npm run check` passed, including 4,876 Node tests and type/artifact checks. This auditor has not rerun the broad check.
- Existing issue bodies and recent issue/PR states are available in the audit scratch directory; findings will identify overlaps without treating closed reports as current defects.
- Source and generated baseline runtime inspection; focused reproducible probes only where they resolve concrete uncertainties. No source changes or Git mutations.

## Confirmed defects

See PROF-001 and PROF-003 below; further investigation is ongoing.

## Refactoring and contract recommendations

The native contract already exists in `platform/profession-definition/profession.ts`: all modules use `defineNativeModule`, families use `defineNativeProfession`, and active execution combines Core with one elite. Recommendations will refine this existing boundary, not replace it with another abstraction.

## Execution traces and preservation requirements

Pending.

## Open questions and remaining coverage gaps

Full numerical balance verification and external game-mechanics verification are outside this report's initial scope. Source inspection and focused traces are still being completed.

## Findings recorded during investigation

### PROF-001 — Natural Fortitude's runtime attribute callback is registered on the wrong elite

- **Classification:** bug (with architectural ownership inconsistency). **Severity:** low. **Confidence:** high for missing raw-config Vitality; no outgoing-DPS consequence established.
- **Baseline evidence:** `js/games/gw2/professions/ranger/specializations/druid/module.ts:10,21-22` imports and registers `modifyNaturalFortitudeAttributes`; `js/games/gw2/professions/ranger/specializations/untamed/module.ts:11-20` registers the owning traits but no corresponding modifier callback. `js/games/gw2/professions/ranger/specializations/untamed/traits/index.ts:24-34` declares trait 2286 with `attributeBonus: 240` and its build contribution. `js/games/gw2/professions/ranger/specializations/untamed/traits/behavior.ts:128-140` contains the live callback, selected-trait guard, and provenance guard.
- **Expected:** selected Untamed Natural Fortitude contributes the same 240 Vitality when the native attribute contract receives baseline stats as when the browser build calculator has already included static traits. Druid should not install an Untamed-only callback. The existing callback explicitly supports both provenance cases; this is an internal consistency expectation rather than an externally inferred game value.
- **Observed / trigger:** `rangerProfession.resolveProfession({specialization:'Untamed'}).modifyAttributes(...)`, with selected trait 2286, player ownership, baseline Vitality 1000 and no applied-static-rules provenance, returns 1000. The build calculator adds 240, and a browser-style input of 1240 with provenance true remains 1240. A Druid input incorrectly carrying trait 2286 instead enters the callback and throws because its selected catalog has no Untamed profile; this malformed cross-elite input is supporting ownership evidence, not the principal defect.
- **Reproduce** after the baseline module build:

```js
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
const rules = rangerProfession.resolveProfession({ specialization: 'Untamed' });
const context = {
  catalog: rules.catalog,
  config: { specialization: 'Untamed', selectedTraitIds: [2286] },
  event: { actorType: 'player' }
};
console.log(rules.modifyAttributes(context, {
  power: 1000, precision: 1000, ferocity: 0,
  conditionDamage: 0, expertise: 0, vitality: 1000
}).vitality); // baseline: 1000; trait profile declares +240
```

- **Smallest change:** move callback registration from Druid to Untamed (or attach it through the existing Untamed trait hook/modifier boundary if that contract supports the callback); retain its provenance checks. Do not add another build contribution.
- **Regression risk / validation:** compare baseline-stat and precomputed-stat player queries with trait selected/unselected, and a patched attribute bonus; preserve summon ownership semantics explicitly. Add a small cross-elite ownership assertion. Browser attribute calculation already works; no double-counting or current browser DPS error is claimed. `tests/games/gw2/professions/ranger/trait-definitions.test.js:14-27` asserts canonical ownership but does not check runtime attribute parity; the shared `native-build-attributes.test.js` parity test omits Ranger.
- **Related:** no matching issue in the supplied 36 known issue bodies. Open #70 concerns Untamed ambush availability, a different path. The Druid-only boundary is explicitly documented in `docs/professions/RANGER.md`; preserving an earlier boundary does not establish that the active elite owns the callback correctly.

### PROF-002 — Programmatic documentation calls a removed runtime method

- **Classification:** cleanup (broken public-interface documentation). **Severity:** low. **Confidence:** high.
- **Evidence / expected:** `docs/architecture/PROGRAMMATIC-SIMULATION.md:215` instructs callers to inspect `engineerProfession.resolveRuntime({ specialization: 'Core' }).catalog`; the native interface exposes `runtimeFor` in `js/games/gw2/platform/profession-definition/module-types.ts` and `profession.ts`, not `resolveRuntime`.
- **Observed / reproduction:** executing that exact expression against the compiled baseline throws `TypeError: engineerProfession.resolveRuntime is not a function`. The equivalent `engineerProfession.runtimeFor({specialization:'Core'}).catalog.skills.length` returns `133`.
- **Impact:** copied headless example fails before catalog inspection; simulation implementations and their current callers are unaffected.
- **Smallest change:** change the one documentation expression to `runtimeFor`; no compatibility alias is needed.
- **Risk / validation:** negligible runtime risk; execute the corrected snippet. Search found no production or test use of `resolveRuntime`.
- **Related:** no matching supplied known issue. Other stale README layout/scheduling wording is outside this finding.

### PROF-003 — Autonomous Ranger pet recharge snapshots Alacrity while commanded recharge integrates it

- **Classification:** bug / architectural inconsistency in recharge ownership. **Severity:** medium. **Confidence:** high for the divergent behavior; expected consistency is based on the repository's shared summon-recharge contract, not an independently measured game replay.
- **Evidence:** `js/games/gw2/professions/ranger/core/mechanics/pets.ts:248-253` reprojects commanded recharge from `petCommandRecharges` through `cooldownController.project`. The same file's `autonomousSkill` at `255-280` gates on an absolute `petAutoCooldowns` timestamp; autonomous activation at `430-446` samples Alacrity once and stores `time + cooldown / rate`. No later reader reprojects this autonomous timestamp. The shared contract in `js/games/gw2/platform/combat/recharge.ts:32-76` explicitly distinguishes permanent player recharge from summon recharge integrated over received boon grants/expiry. `js/games/gw2/professions/ranger/core/mechanics/pet-profiles.ts:364` gives Carrion Devourer Tail Lash a 20-second base recharge.
- **Expected:** subsequent Alacrity gain/expiry affects outstanding summon recharge work consistently for automatic and commanded skills; a fixed animation/recovery snapshot may remain intentional, but should not fix an entire recharge deadline.
- **Observed / impact:** a 45-second Carrion Devourer run activates Tail Lash at `3.12, 24.32` without Alacrity. Alacrity from 0–10 seconds yields `3.12, 20.56, 41.76`; from 0–30 yields `3.12, 20.56, 38`. Thus the short grant has the same first recharge as the long grant despite expiring mid-recharge. A grant beginning at 8 seconds yields `3.12, 24.32, 41.76`, leaving the first outstanding recharge identical to no boon. All four runs returned no warnings. Different subsequent autonomous action counts/timings change pet output; no DPS percentage is asserted.
- **Reproduction:** this uses the existing test fixture only to inject a timed boon; actual pet scheduling, boon audience resolution, and damage run through the native engine.

```js
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
for (const [at, duration] of [[0, 0], [0, 10], [0, 30], [8, 30]]) {
  const result = runRanger(
    [{ type: 'combat-start' }, { type: 'wait', durationMs: 45000 }],
    { selectedPet: 'Carrion Devourer', boons: {}, allies: { count: 0 },
      sharePlayerBoonsWithSummons: true },
    { initialize(runtime) {
      if (duration) runtime.effects.emit({ kind: 'packet', event: {
        type: 'buff', kind: 'alacrity', at, duration, stacks: 1,
        source: 'fixture', sourceId: 'fixture', actorType: 'player',
        audience: { recipients: 'party' }
      } });
    } }
  );
  console.log(at, duration, result.events.filter(event =>
    event.type === 'action' && event.skillId === ID.PET_TAIL_LASH
  ).map(event => event.at), result.warnings);
}
```

- **Smallest change:** store autonomous recharge as remaining-work records and project through the same cooldown policy as commands, retaining pet-specific Pack Alpha, explicit Alacrity immunity, and pet-incarnation audience. Consolidate the two recharge representations only after preserving independent pet-lane and activation behavior; do not move pet AI priorities into the platform.
- **Regression risk / validation:** validate a boon beginning and ending during recharge, immunity, pet swap/retirement, auto/manual use of the same commandable skill, wait partition invariance, and AI selection only at its next valid decision point. Preserve measured recovery delays and command preemption. `tests/games/gw2/professions/ranger/pets-and-specializations.test.js:958-997` checks whether a long initial grant is received; it does not cover grant/expiry during an automatic recharge.
- **Related documentation:** `docs/architecture/ARCHITECTURE.md`'s constant-recharge sentence for summons is stale relative to `combat/recharge.ts` and its tests. Correct it while clarifying the policy; it cannot justify ignoring received-boon changes only in this owner. No corresponding supplied issue; #70 is a separate Untamed ambush report.
