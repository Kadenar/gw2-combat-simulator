# Profession consistency audit

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (2026-10-07). Documentation-only audit; every source reference
names this baseline, even if the audit branch subsequently advances.

The native profession architecture is already substantially unified. All nine families and all 45 Core/elite
combinations registered, created state, and completed the sampled public simulations without warnings. The review found
two concrete runtime inconsistencies: autonomous Ranger pet recharge ignores Alacrity changes during recharge
(PROF-003), and Untamed's Natural Fortitude runtime attribute callback is attached to Druid (PROF-001). A copied
public-interface example fails (PROF-002). Static Thief Initiative costs are a bounded opportunity to reuse the existing
cost lifecycle (PROF-004), not an established gameplay error.

## Scope and coverage inventory

All nine family definitions and all 45 module shells were read. For each combination, inspection covered catalog/trait
ownership, state creation and optional projection, declared execution effects and costs, hooks/modifiers, and selected
public runtime assembly. The table names the mechanic paths reviewed in addition to those common checks. Leaf skills and
traits were sampled, not exhaustively verified. Test coverage means inspection of relevant tests plus the coordinator's
successful baseline run, not a new full-suite run by this auditor.

| Profession and implemented modules                             | Organization, registration, public interface                                      | Skills, traits, modifiers, buffs/conditions/damage                                                    | State, resources, cooldowns, scheduling and integration                                                         | Validation emphasis                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Elementalist — Core, Tempest, Weaver, Catalyst, Evoker         | Family assembly; selected catalogs; shared weapon metadata and specialized skills | Overload packets/lockout; dual skills; spheres; familiar charge/tier declarations; trait registration | Attunement transitions; Weaver dual state; Catalyst Energy; Evoker reservations/cancellation; commit-tail tasks | All five traces; deeper Overload Fire trace; execution declaration and architecture tests      |
| Engineer — Core, Scrapper, Holosmith, Mechanist, Amalgam       | Core kits versus elite forms; headless family and app adapter split               | Grenades, gyros, forge packets, mech commands and morph declarations; module trait/modifier ownership | Kit swaps; discrete heat wake tasks; mech independent lane/stats; Evolve charge/commit lifecycle                | All five traces; Corona Burst persists through forge exit; shared declaration tests            |
| Guardian — Core, Dragonhunter, Firebrand, Willbender, Luminary | Core virtues versus replacement mechanics; tome and forge catalog contributions   | Justice/tether; tome conditions/pages; Willbender hit tracking; Radiant Forge effects                 | Virtue cooldown/flip behavior; shared page resource policy/cost; forge state and delayed strikes                | All five traces; page spend and tome stow trace; module declaration tests                      |
| Mesmer — Core, Chronomancer, Mirage, Virtuoso, Troubadour      | Core shatter family; selected replacements; clone versus blade owners             | Shatter packets; continuum actions; mirror/ambush; bladesong; instrument declarations; traits         | Clone lifetime; explicit recharge checkpoint; blade spending/scheduled projectiles; performances                | All five traces; five-blade Harmony timing; architecture/declaration tests                     |
| Necromancer — Core, Reaper, Scourge, Harbinger, Ritualist      | Shared shroud storage; deliberately empty Reaper state; owned shade/spirit slices | Shroud chains; shade strike/Torment and barrier; Harbinger shroud; Ritualist spirits; traits          | Life-force policies; depletion; shade expiry generations; spirit packet attribution and boon recipients         | All five traces; Tainted Bolts multi-hit trace; declaration tests                              |
| Ranger — Core, Druid, Soulbeast, Untamed, Galeshot             | Core pet catalog/AI; elite state ownership; cross-elite callback import inspected | Pet attacks, Avatar, merged attack, ambush, bow packets; static/runtime trait provenance              | Companion lane; command/automatic recharge; Avatar drain; unleash windows; bow arrows/Wind Force                | All five traces; pet timing and four Alacrity scenarios; trait parity diagnostic; PROF-001/003 |
| Revenant — Core, Herald, Renegade, Vindicator, Conduit         | Legend-selected skills and elite additions; family energy policy                  | Impossible Odds hit reaction; facets, warband, landing, Entity skill declarations; traits             | Energy/upkeep reservation; swap; facet parent recharge; charges; airborne ownership; Conduit state              | All five traces; explicit valid legend config; no claim that open #66 is resolved              |
| Thief — Core, Daredevil, Deadeye, Specter, Antiquary           | Core Initiative/stealth/flip owner; selected elite hooks and trait ownership      | Stealth attacks; Palm Strike; malice snapshots; Shadow Force; artifact spend/refund; modifiers        | Initiative regeneration/custom cost; endurance; mark lifetime; shroud; artifact charge/window policies          | All five traces; Measured Shot → Endless Night; resource/cancel tests; PROF-004                |
| Warrior — Core, Berserker, Spellbreaker, Bladesworn, Paragon   | Core packet/burst owner; elite resource policy replacement                        | Burst tiers; primal bursts; accepted control/damage; Dragon Slash; chant/echo declarations            | Adrenaline; Berserk expiry; Flow conversion; charge/release; motivation and independent echo instances          | All five traces; two-charge Dragon Slash trace; architecture/declaration tests                 |

Registry discovery uses lazy imports in `js/games/gw2/profession-registry.ts`; each family's `profession.ts` exports a
native family, while its app adapter is a separate load path. The runtime probe called `loadProfession`, `runtimeFor`,
and `createState` for every combination. No browser globals were needed. Catalog skill counts in Core/elite order were:
Elementalist 213/220/264/220/226; Engineer 133/141/163/156/165; Guardian 86/94/120/99/110; Mesmer 79/90/97/90/93;
Necromancer 99/115/109/112/112; Ranger 207/216/271/226/222; Revenant 110/128/127/124/128; Thief 113/127/139/127/133;
Warrior 106/123/117/136/113. Counts establish assembled inventory, not correctness of every entry.

## Methods and actual results

- Read the shared brief, root/scripts/tests guidance, architecture/module/programmatic documentation, platform README,
  and all nine profession documents. Compared claims to current implementation rather than treating legacy documentation
  as authority.
- Read all family/module declarations and the native contract; followed selected skill declarations through side-effect
  dispatch, hooks, resource/recharge policy, queued effects, and resolved observations. Inspected relevant trait
  ownership and static-versus-runtime attributes. A cross-elite import scan identified Druid's Untamed callback, then
  direct execution established PROF-001.
- Coordinator reports `npm run check` passed all stages, including 4,876 Node tests and type/artifact checks. This
  auditor reused compiled baseline modules and did not run clean/build or the broad check concurrently. Focused Node
  probes produced 45 assembled runtimes, 45 warning-free short simulations, nine warning-free deeper family traces, the
  exact failed documentation call, and the focused attribute/recharge results below.
- Baseline tests inspected include `tests/games/gw2/professions/profession-architecture-baseline.test.js`,
  `tests/games/gw2/professions/execution-declarations.test.js`,
  `tests/games/gw2/professions/native-build-attributes.test.js`, Ranger pet/trait tests, and Thief resource/cancellation
  tests. Passing tests constrain the recommendations but do not cover the two reproduced inconsistencies.
- Compared the supplied 36 issue bodies and recent issue/PR states. Open #66 and #70 are acknowledged separately; closed
  historical reports were not promoted to current findings without reproduction. This is not a complete historical issue
  audit.
- Commands used existing compiled package aliases: `node <probe.mjs>` from the repository tree, plus `rg`/numbered
  source reads. Reproducible code is preserved below and in the appendix; temporary output is not required to reproduce
  a finding. No tracked production changes, added production tests, or Git mutations were made by this auditor.

## Confirmed defects and documentation correction

### PROF-003 — Autonomous Ranger pet recharge snapshots Alacrity while commanded recharge integrates it

- **Classification:** bug / architectural inconsistency in recharge ownership. **Severity:** medium. **Confidence:**
  high for the divergent behavior; expected consistency is based on the repository's shared summon-recharge contract,
  not an independently measured game replay.
- **Evidence:** `js/games/gw2/professions/ranger/core/mechanics/pets.ts:248-253` reprojects commanded recharge from
  `petCommandRecharges` through `cooldownController.project`. The same file's `autonomousSkill` at `255-280` gates on an
  absolute `petAutoCooldowns` timestamp; autonomous activation at `430-446` samples Alacrity once and stores
  `time + cooldown / rate`. No later reader reprojects this autonomous timestamp. The shared contract in
  `js/games/gw2/platform/combat/recharge.ts:32-76` explicitly distinguishes permanent player recharge from summon
  recharge integrated over received boon grants/expiry.
  `js/games/gw2/professions/ranger/core/mechanics/pet-profiles.ts:364` gives Carrion Devourer Tail Lash a 20-second base
  recharge.
- **Expected:** subsequent Alacrity gain/expiry affects outstanding summon recharge work consistently for automatic and
  commanded skills; a fixed animation/recovery snapshot may remain intentional, but should not fix an entire recharge
  deadline.
- **Observed / impact:** a 45-second Carrion Devourer run activates Tail Lash at `3.12, 24.32` without Alacrity.
  Alacrity from 0–10 seconds yields `3.12, 20.56, 41.76`; from 0–30 yields `3.12, 20.56, 38`. Thus the short grant has
  the same first recharge as the long grant despite expiring mid-recharge. A grant beginning at 8 seconds yields
  `3.12, 24.32, 41.76`, leaving the first outstanding recharge identical to no boon. All four runs returned no warnings.
  Different subsequent autonomous action counts/timings change pet output; no DPS percentage is asserted.
- **Reproduction:** this uses the existing test fixture only to inject a timed boon; actual pet scheduling, boon
  audience resolution, and damage run through the native engine.

```js
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
for (const [at, duration] of [
  [0, 0],
  [0, 10],
  [0, 30],
  [8, 30]
]) {
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
      }
    }
  );
  console.log(
    at,
    duration,
    result.events
      .filter((event) => event.type === 'action' && event.skillId === ID.PET_TAIL_LASH)
      .map((event) => event.at),
    result.warnings
  );
}
```

- **Smallest change:** store autonomous recharge as remaining-work records and project through the same cooldown policy
  as commands, retaining pet-specific Pack Alpha, explicit Alacrity immunity, and pet-incarnation audience. Consolidate
  the two recharge representations only after preserving independent pet-lane and activation behavior; do not move pet
  AI priorities into the platform.
- **Regression risk / validation:** validate a boon beginning and ending during recharge, immunity, pet swap/retirement,
  auto/manual use of the same commandable skill, wait partition invariance, and AI selection only at its next valid
  decision point. Preserve measured recovery delays and command preemption.
  `tests/games/gw2/professions/ranger/pets-and-specializations.test.js:958-997` checks whether a long initial grant is
  received; it does not cover grant/expiry during an automatic recharge.
- **Related documentation:** `docs/architecture/ARCHITECTURE.md:212-214`'s constant-recharge sentence for summons is
  stale relative to `js/games/gw2/platform/combat/recharge.ts` and its tests. Correct it while clarifying the policy; it
  cannot justify ignoring received-boon changes only in this owner. No corresponding supplied issue; #70 is a separate
  Untamed ambush report.

### PROF-001 — Natural Fortitude's runtime attribute callback is registered on the wrong elite

- **Classification:** bug (with architectural ownership inconsistency). **Severity:** low. **Confidence:** high for
  missing raw-config Vitality; no outgoing-DPS consequence established.
- **Baseline evidence:** `js/games/gw2/professions/ranger/specializations/druid/module.ts:10,21-22` imports and
  registers `modifyNaturalFortitudeAttributes`;
  `js/games/gw2/professions/ranger/specializations/untamed/module.ts:11-20` registers the owning traits but no
  corresponding modifier callback. `js/games/gw2/professions/ranger/specializations/untamed/traits/index.ts:24-34`
  declares trait 2286 with `attributeBonus: 240` and its build contribution.
  `js/games/gw2/professions/ranger/specializations/untamed/traits/behavior.ts:128-140` contains the live callback,
  selected-trait guard, and provenance guard.
- **Expected:** selected Untamed Natural Fortitude contributes the same 240 Vitality when the native attribute contract
  receives baseline stats as when the browser build calculator has already included static traits. Druid should not
  install an Untamed-only callback. The existing callback explicitly supports both provenance cases; this is an internal
  consistency expectation rather than an externally inferred game value.
- **Observed / trigger:** `rangerProfession.resolveProfession({specialization:'Untamed'}).modifyAttributes(...)`, with
  selected trait 2286, player ownership, baseline Vitality 1000 and no applied-static-rules provenance, returns 1000.
  The build calculator adds 240, and a browser-style input of 1240 with provenance true remains 1240. A Druid input
  incorrectly carrying trait 2286 instead enters the callback and throws because its selected catalog has no Untamed
  profile; this malformed cross-elite input is supporting ownership evidence, not the principal defect.
- **Reproduce** after the baseline module build:

```js
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
const rules = rangerProfession.resolveProfession({ specialization: 'Untamed' });
const context = {
  catalog: rules.catalog,
  config: { specialization: 'Untamed', selectedTraitIds: [2286] },
  event: { actorType: 'player' }
};
console.log(
  rules.modifyAttributes(context, {
    power: 1000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 0,
    expertise: 0,
    vitality: 1000
  }).vitality
); // baseline: 1000; trait profile declares +240
```

The separate build/provenance control was also executed (no UI/helper-derived defaults are assumed in the raw query):

```js
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { applyRangerBuildAttributeRules } from '#gw2/professions/ranger/build/attributes.js';
import { createRangerBuildDefaults } from '#gw2/professions/ranger/build/build.js';
const build = createRangerBuildDefaults();
build.specializations = [{ name: 'Untamed', traits: '1-1-1' }];
const calculate = createCalculateAttributes(applyRangerBuildAttributeRules, rangerProfession.traitBuildAttributes);
console.log(
  calculate(build, []).attributes.Vitality.final -
    calculate(build, [], 1, 'Natural Fortitude').attributes.Vitality.final
); // 240
console.log(
  rules.modifyAttributes(
    {
      ...context,
      config: {
        ...context.config,
        attributeProvenance: { professionStaticRulesApplied: true }
      }
    },
    { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0, vitality: 1240 }
  ).vitality
); // 1240
```

- **Smallest change:** move callback registration from Druid to Untamed (or attach it through the existing Untamed trait
  hook/modifier boundary if that contract supports the callback); retain its provenance checks. Do not add another build
  contribution.
- **Regression risk / validation:** compare baseline-stat and precomputed-stat player queries with trait
  selected/unselected, and a patched attribute bonus; preserve summon ownership semantics explicitly. Add a small
  cross-elite ownership assertion. Browser attribute calculation already works; no double-counting or current browser
  DPS error is claimed. `tests/games/gw2/professions/ranger/trait-definitions.test.js:14-27` asserts canonical ownership
  but does not check runtime attribute parity; the shared `tests/games/gw2/professions/native-build-attributes.test.js`
  parity test omits Ranger.
- **Related:** no matching issue in the supplied 36 known issue bodies. Open #70 concerns Untamed ambush availability, a
  different path. The Druid-only boundary is explicitly documented in `docs/professions/RANGER.md`; preserving an
  earlier boundary does not establish that the active elite owns the callback correctly.

### PROF-002 — Programmatic documentation calls a removed runtime method

- **Classification:** cleanup (broken public-interface documentation). **Severity:** low. **Confidence:** high.
- **Evidence / expected:** `docs/architecture/PROGRAMMATIC-SIMULATION.md:215` instructs callers to inspect
  `engineerProfession.resolveRuntime({ specialization: 'Core' }).catalog`; the native interface exposes `runtimeFor` in
  `js/games/gw2/platform/profession-definition/module-types.ts:180-183` and
  `js/games/gw2/platform/profession-definition/profession.ts:402-425,501`, not `resolveRuntime`.
- **Observed / reproduction:** executing that exact expression against the compiled baseline throws
  `TypeError: engineerProfession.resolveRuntime is not a function`. The equivalent
  `engineerProfession.runtimeFor({specialization:'Core'}).catalog.skills.length` returns `133`.
- **Impact:** copied headless example fails before catalog inspection; simulation implementations and their current
  callers are unaffected.
- **Smallest change:** change the one documentation expression to `runtimeFor`; no compatibility alias is needed.
- **Risk / validation:** negligible runtime risk; execute the corrected snippet. Search found no production or test use
  of `resolveRuntime`.
- **Related:** no matching supplied known issue. Other stale README layout/scheduling wording is outside this finding.

## Refactoring and contract ownership

### PROF-004 — Static Initiative costs duplicate an existing shared activation-cost lifecycle

- **Classification:** architectural inconsistency / refactor opportunity, **not a confirmed gameplay defect**.
  **Severity:** low. **Confidence:** high that the paths duplicate responsibility; medium that migration pays for itself
  before another cost-related change.
- **Evidence:** `js/games/gw2/professions/thief/core/hooks.ts:143-150` implements Initiative affordability and retry,
  while `js/games/gw2/professions/thief/core/mechanics/resources.ts:66-70` spends the same `initiativeCost` from
  `onCastStart` (`js/games/gw2/professions/thief/core/hooks.ts:228-235`). In contrast,
  `js/games/gw2/platform/execution/skill-cost.ts:12-43` owns the existing declared-cost calculation, retry, and spending
  for Firebrand pages and generic Dodge; `js/games/gw2/platform/execution/cast-execution.ts:130,338-340` owns its
  lifecycle phases. `js/games/gw2/platform/skills/types.ts:200-205` permits `resourceCost` or a profile-field amount but
  cannot directly refer to the existing `initiativeCost` field.
- **Expected / observed:** a fixed per-skill resource price should use the platform's established affordability/spend
  invariant, while the profession owns how much the skill costs and consequences of spending. Current Thief behavior
  works through its separate path, but numeric tolerance/readiness changes must be kept aligned manually. This is
  distinct from Revenant's legitimate dynamic Energy pricing and upkeep reservation
  (`js/games/gw2/professions/revenant/core/hooks.ts:138-158,243-253,275-279`) and Warrior/Mesmer all-stock transactions.
- **Concrete trace:** Measured Shot's declaration
  (`js/games/gw2/professions/thief/core/skills/weapons/scepter.ts:205-219`, ID 63267) provides an Initiative price;
  accepted casting reaches Core's custom spend, then Specter's `onCastStart` converts the same price to Shadow Force
  (`js/games/gw2/professions/thief/specializations/specter/hooks.ts:200-207`). The audit's Measured Shot → Endless Night
  public run completed without warnings, resolving one Measured Shot strike and seven Endless Night strikes. No current
  numerical mismatch is alleged.
- **Smallest recommended change:** when next touching activation-cost infrastructure, add a validated optional
  skill-field amount selector to the existing `SkillCost` contract, analogous to existing side-effect amount selectors,
  and migrate fixed Initiative costs to it. Keep `initiativeCost` as the authoritative authored/patchable value until a
  deliberate schema migration; do not copy it into a second mutable amount. Remove the old spend only once the shared
  declaration is installed. Keep Specter's reward in its own hook after payment. Antiquary also observes gross spending
  before Chak refunds and pilfer progress (`js/games/gw2/professions/thief/specializations/antiquary/hooks.ts:233-242`);
  retain that order and leave reward/refund policy with its owner.
- **Risk / validation:** affordability boundary behavior, warning code/reason and gate precedence, free skills,
  cancellation payment, fractional recovery, next-known-grant retry, live patch values, and spend-before-Shadow-Force
  reward order all need preservation decisions. The current shared cost gate executes before composed profession gates,
  whereas Thief checks state before its cost; characterize that difference instead of assuming an interchangeable
  one-line replacement. Existing `tests/games/gw2/professions/thief/resource-start-triggers.test.js` and
  `tests/games/gw2/professions/thief/interrupt-commit.test.js` are focused preservation anchors. This proposal is
  deliberately limited to static prices, not upkeep, all-resource shatters, or Dragon Trigger's repeated Flow
  conversion.
- **Related:** PROF-001 demonstrates why build/runtime parity matters but is a different defect. KERNEL-001 concerns a
  shared resource numeric-boundary failure; this refactor is not its fix. No matching supplied known issue.

### Existing native contract and bounded refinements

The common contract is present in `js/games/gw2/platform/profession-definition/module-types.ts:46-77,167-185`;
`defineNativeModule` in `js/games/gw2/platform/profession-definition/profession.ts:135-208` validates and assembles it.
`defineNativeProfession` at lines 291–325 checks ownership and references before selected runtime compilation. The
following is an ownership assessment, not a proposal for another framework.

| Responsibility               | Required versus optional                                                      | Definition/state/behavior owner                                                                                                                       | Refinement supported by this audit                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration and identity    | Module `id`, `data`, `state.create` required; Core first in family tuple      | Family exports modules; module owns authored metadata/profiles; platform selects Core plus one elite                                                  | Keep current interface; correct the documented method name under PROF-002                                                                                |
| Mutable combat state         | Fresh creator required; projection optional                                   | Core owns shared profession facts; selected elite owns its slice; platform owns clock/queue and generic controllers                                   | Preserve empty/omitted state projections where meaningful; fix the misplaced callback under PROF-001 rather than copying elite state into Core           |
| Authored skills and traits   | Contributions optional within catalog data; executable declarations validated | Modules own coefficients, identities, prices, trait definitions and selection-dependent policy; platform compiles declarations and dispatches effects | Keep trait ownership checks and build/runtime provenance together when correcting PROF-001                                                               |
| Hooks and modifiers          | Optional; Core then elite composition                                         | Module owns mechanic decisions; platform owns lifecycle phases, modifier application, event transport and resolver calculations                       | Move only repeated invariant behavior, such as fixed cost enforcement in PROF-004; keep rewards, conditions and stateful price decisions with profession |
| Resources/recharge/charges   | Optional declared policies/controllers according to mechanic                  | Profession owns capacity, recovery policy and applicability; shared controllers own arithmetic/projection                                             | Reuse received-boon recharge work for pet autos under PROF-003; consider skill-field amount selector under PROF-004                                      |
| Presentation and application | Optional presentation, build, matcher, family-hook extensions                 | App adapter handles browser integration; headless family supplies selected runtime/catalog and common build rules                                     | Preserve lazy headless loading and active-catalog boundaries; no browser-only abstraction is required                                                    |

Trait rules already receive selection guards during module construction
(`js/games/gw2/platform/profession-definition/profession.ts:152-175`); `requiresSelection: false` can represent an
already-earned effect whose lifetime survives a selection-dependent trigger. Such exceptions need mechanic-specific
evidence, not blanket removal. Full family metadata versus Core-plus-selected-elite execution also serves different
consumers intentionally. Weaponmaster-style shared weapons and specialization-only skill declarations should not be
normalized into identical directory placement.

Several implementation differences are justified. Thief Initiative has a fixed authored price; Revenant reserves upkeep
and computes Energy dynamically. Firebrand pages use the standard resource cost controller. Holosmith heat has discrete
wake events rather than continuous passive recovery. Mesmer shatters spend all available stock and schedule dependent
packets; Chronomancer's explicit recharge checkpoint is not a general planning-state rollback. Reaper reuses Core shroud
state instead of inventing an empty parallel mechanic. Mechanist and Ranger pets need autonomous lanes and companion
attribution. Elementalist's attunement/Weaver transitions differ from ordinary weapon swaps. Those are profession
extensions to keep, not evidence that every family needs the same hooks or state fields.

The incremental migration order is: correct PROF-001's registration and PROF-002's example first; characterize and fix
PROF-003's recharge integration next; take PROF-004 only with a cost-infrastructure change that justifies its scope.
Preservation gates are selected/unselected and raw/precomputed attribute parity; timed boon gain/expiry plus pet
incarnation and command preemption; then Thief affordability, cancellation, patchability, and ordered rewards/refunds.
Retain current catalogs, public exports, warning behavior, state projections and representative traces unless a finding
explicitly changes behavior. The platform audit independently owns query-state capability and commit-tail scheduling
proposals; this report does not duplicate them.

## Representative end-to-end traces

The common entry is `simulateGw2` in `js/games/gw2/platform/simulation/simulate.ts:15-23`, which obtains the selected
runtime and invokes the same chronological engine for all professions. Cast acceptance/commit use
`js/games/gw2/platform/execution/cast-execution.ts`; declared resource costs use
`js/games/gw2/platform/execution/skill-cost.ts`. The samples below followed the named profession owner into that shared
path and inspected final resolved events, rather than inferring behavior from filenames.

| Family sample and source owner                                                                                                                                                                                                        | Path traced and actual observation                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tempest Overload Fire — `js/games/gw2/professions/elementalist/specializations/tempest/skills/index.ts`, `js/games/gw2/professions/elementalist/specializations/tempest/hooks.ts:152-200`                                             | Selected Fire overload declaration emits its scheduled packets; commit installs lockout and completion work. Cast runs 0–3.32 s; with 4 s trailing wait, nine damage packets resolve, including the post-cast field.                                                                                                  |
| Holosmith Corona Burst — `js/games/gw2/professions/engineer/specializations/holosmith/skills/photon-forge-skills.ts`, `js/games/gw2/professions/engineer/specializations/holosmith/hooks.ts:19-41`                                    | Forge entry enables skill; start-side heat action and strike effects enter shared execution; exit changes form. Damage at 0.4 and 1.8 s both resolves, including the delayed second packet after exit.                                                                                                                |
| Firebrand Searing Spell — `js/games/gw2/professions/guardian/specializations/firebrand/skills/tome-skills.ts`, `js/games/gw2/professions/guardian/specializations/firebrand/hooks.ts:114-199`                                         | Tome entry changes bar; declared page cost reaches shared affordability/payment against the page policy; strike/condition effects use shared emission; stow exits. One page spent; strike at 0.32 s; cast ends 0.68 s.                                                                                                |
| Virtuoso Bladesong Harmony — `js/games/gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesongs.ts`, `js/games/gw2/professions/mesmer/specializations/virtuoso/hooks.ts:14-29`                                            | Availability checks stocked blades, bladesong logic captures/spends the stock and schedules packets. Five initial blades produce five player hits at 0.68/0.84/1/1.16/1.32 s after cast completion at 0.64 s.                                                                                                         |
| Harbinger Tainted Bolts — `js/games/gw2/professions/necromancer/specializations/harbinger/skills/shroud-skills.ts`, `js/games/gw2/professions/necromancer/specializations/harbinger/hooks.ts:157-225`                                 | Shared shroud entry and Life Force policy enable elite shroud skills; authored repeated effects emit two hits at 0.32/0.6 s while shroud drains.                                                                                                                                                                      |
| Ranger pet — `js/games/gw2/professions/ranger/core/mechanics/pets.ts:255-280,430-446`                                                                                                                                                 | Combat starts companion lane; AI picks profile, emits summon-attributed packets and records recharge; next wake advances selection. A 7 s wait resolves Twin Darts at 1.28/1.36, Tail Lash at 4.4, then Twin Darts at 6.36/6.44 s. PROF-003 probes the recharge branch further.                                       |
| Revenant Impossible Odds + Unrelenting Assault — `js/games/gw2/professions/revenant/core/hooks.ts:138-158,243-279`                                                                                                                    | Accepted upkeep reservation/activation changes Energy recovery; sword attack emits hits; accepted-hit reaction emits proc packets. Explicit Assassin/Demon configuration yields five Unrelenting Assault plus three Impossible Odds damage events. This validates plumbing only, not the correctness disputed in #66. |
| Specter Measured Shot + Endless Night — `js/games/gw2/professions/thief/core/skills/weapons/scepter.ts:205-219`, `js/games/gw2/professions/thief/specializations/specter/hooks.ts:200-207`                                            | Core accepts and spends Initiative; Specter grants Shadow Force; flip permits Endless Night; shared resolver receives one plus seven hits. PROF-004 describes the cost ownership and ordering.                                                                                                                        |
| Bladesworn Dragon Trigger + Dragon Slash—Force — `js/games/gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.ts`, `js/games/gw2/professions/warrior/specializations/bladesworn/mechanics/charge-release.ts` | Entry changes mode; queued charging converts Flow; explicit `releaseAtCharges: 2` gates slash; charge facts reach emitted strike. Slash starts 0.48 s, hits 1 s, and ends 1.52 s.                                                                                                                                     |

All nine deeper runs had no warnings. They used trait-free configurations to isolate intrinsic mechanic plumbing.
Selected trait logic was inspected through source/tests and the focused Natural Fortitude probe; these nine traces do
not validate every trait combination. Packet counts include only resolved damage events, not condition ticks, and are
not damage-balance benchmarks.

## All-module execution inventory

The appendix contains the complete fixture/configuration. Every row below returned no warnings; damage counts include
companion packets. Antiquary's selected actions acquire artifacts rather than directly deal damage, so its zero is
expected for this sample. Each run ends with a 3 s wait; some skills intentionally have later unresolved tails beyond
that observation window.

| Profession   | Module       | Sample rotation (after combat start)                           | Resolved damage packets |
| ------------ | ------------ | -------------------------------------------------------------- | ----------------------- |
| Elementalist | Core         | Dragon's Claw                                                  | 3                       |
| Elementalist | Tempest      | Overload Fire                                                  | 8                       |
| Elementalist | Weaver       | Water Attunement → Steam Surge                                 | 1                       |
| Elementalist | Catalyst     | Deploy Jade Sphere (Fire)                                      | 4                       |
| Elementalist | Evoker       | Ignite                                                         | 1                       |
| Engineer     | Core         | Grenade Kit → Grenade                                          | 3                       |
| Engineer     | Scrapper     | Shredder Gyro                                                  | 6                       |
| Engineer     | Holosmith    | Engage Photon Forge → Corona Burst → Deactivate Photon Forge   | 2                       |
| Engineer     | Mechanist    | Jade Mortar                                                    | 4                       |
| Engineer     | Amalgam      | Evolve (Base) → Liquid State                                   | 4                       |
| Guardian     | Core         | Virtue of Justice → Orb of Wrath                               | 1                       |
| Guardian     | Dragonhunter | Spear of Justice → wait 3 s → Hunter's Verdict                 | 1                       |
| Guardian     | Firebrand    | Tome of Justice → Chapter 1: Searing Spell → Stow Tome         | 1                       |
| Guardian     | Willbender   | Rushing Justice → Orb of Wrath                                 | 5                       |
| Guardian     | Luminary     | Enter Radiant Forge → Dazzling Hammer → Glaring Burst          | 2                       |
| Mesmer       | Core         | Mind Wrack                                                     | 4                       |
| Mesmer       | Chronomancer | Continuum Split → Split Second → Continuum Shift               | 2                       |
| Mesmer       | Mirage       | False Oasis → wait 3 s → Pick Up Mirage Mirror → Mirage Thrust | 20                      |
| Mesmer       | Virtuoso     | Bladesong Harmony                                              | 3                       |
| Mesmer       | Troubadour   | Lively Lute → Crescendo                                        | 4                       |
| Necromancer  | Core         | Death Shroud → Life Blast                                      | 1                       |
| Necromancer  | Reaper       | Reaper's Shroud → Life Rend → Life Slash → Life Reap           | 3                       |
| Necromancer  | Scourge      | Manifest Sand Shade → Desert Shroud                            | 6                       |
| Necromancer  | Harbinger    | Harbinger Shroud → Tainted Bolts                               | 2                       |
| Necromancer  | Ritualist    | Ritualist's Shroud → Anguish → Essence Blast                   | 11                      |
| Ranger       | Core         | Maul                                                           | 5                       |
| Ranger       | Druid        | Celestial Avatar → Lunar Impact → Release Celestial Avatar     | 4                       |
| Ranger       | Soulbeast    | Worldly Impact                                                 | 1                       |
| Ranger       | Untamed      | Unleash Ranger → Ravager's Abandon                             | 6                       |
| Ranger       | Galeshot     | Summon Cyclone Bow → Wind Shear → Dismiss Cyclone Bow          | 4                       |
| Thief        | Core         | Cloak and Dagger → Backstab                                    | 2                       |
| Thief        | Daredevil    | Fist Flurry → Palm Strike                                      | 8                       |
| Thief        | Deadeye      | Deadeye's Mark → Cloak and Dagger → Malicious Backstab         | 2                       |
| Thief        | Specter      | Siphon → Enter Shadow Shroud → Haunt Shot                      | 1                       |
| Thief        | Antiquary    | Skritt Scuffle → Skritt Swipe                                  | 0                       |
| Warrior      | Core         | Arcing Slice                                                   | 1                       |
| Warrior      | Berserker    | Berserk → Arc Divider                                          | 1                       |
| Warrior      | Spellbreaker | Full Counter → Arcing Slice                                    | 1                       |
| Warrior      | Bladesworn   | Dragon Trigger → skill 62797 (release at 2 charges)            | 1                       |
| Warrior      | Paragon      | Chant of Action → Arcing Slice                                 | 1                       |
| Revenant     | Core         | Impossible Odds → Unrelenting Assault                          | 8                       |
| Revenant     | Herald       | Swap Legends → Facet of Elements → Elemental Blast             | 3                       |
| Revenant     | Renegade     | Swap Legends → Icerazor's Ire                                  | 3                       |
| Revenant     | Vindicator   | Dodge                                                          | 1                       |
| Revenant     | Conduit      | Swap Legends → Twin Moon Sweep                                 | 2                       |

## Open questions and coverage limits

- No external game replay, balance patch comparison, exhaustive coefficient audit, or live wiki validation was
  performed. Expected behavior in the findings comes from internal contracts, authored profiles and equivalent paths.
  PROF-003 remains open to an explicit, documented intentional auto-recharge exception; none was found in inspected
  source/tests, and the current shared summon policy points the other way.
- All module registrations, selected state creators and a real execution path per module were checked; not every leaf
  skill, trait selection, elite/weapon pairing, interruption point, ammo boundary, transform/swap combination or long
  encounter was exercised. Short warning-free traces prove these paths execute, not complete profession correctness.
- Modifier/trait composition and standard condition/buff routing were inspected, but exhaustive numerical stacking
  order, duration rounding, simultaneous reaction order and every summon-stat inheritance case are outside this report.
  The kernel/platform audits own shared arithmetic and capability concerns.
- Browser automation and UI import/rotation behavior belong to other auditors. The build calculator/provenance
  comparison in PROF-001 is a direct programmatic invocation, not a browser test. No browser DPS regression is asserted
  for that finding.
- Open #70 covers more Untamed ambush availability than the valid Spear sample here; open #66 needs its own proc
  investigation. These samples do not close either issue. The supplied issue inventory may omit older or differently
  worded reports.

## Reproduction appendix: all 45 selected runtimes

Run this as an `.mjs` file inside the repository with the baseline's compiled modules available. It intentionally omits
selected slot restrictions and trait selections to isolate intrinsic skills; it is not a set of complete optimized
builds. Expected result: 45 JSON records, no `error`, and empty `warnings` arrays. The inventory above records actual
counts. For the nine deeper traces, use the same entry/configuration schema with the explicit resources, rotations and
trailing waits described in the trace table.

```js
import { loadProfession } from '#gw2/profession-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
const wait = { type: 'wait', durationMs: 3000 };
const cases = {
  elementalist: {
    config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Dagger', startAttunement: 'Fire' },
    Core: ["Dragon's Claw"],
    Tempest: ['Overload Fire'],
    Weaver: ['Water Attunement', 'Steam Surge'],
    Catalyst: ['Deploy Jade Sphere (Fire)'],
    Evoker: ['Ignite']
  },
  engineer: {
    config: { primaryWeapon: 'Rifle', selectedMorphSkillIds: [77103, 77203, 76954] },
    Core: ['Grenade Kit', 'Grenade'],
    Scrapper: ['Shredder Gyro'],
    Holosmith: ['Engage Photon Forge', 'Corona Burst', 'Deactivate Photon Forge'],
    Mechanist: ['Jade Mortar'],
    Amalgam: ['Evolve (Base)', 'Liquid State']
  },
  guardian: {
    config: { primaryWeapon: 'Scepter', initialTomePages: 5 },
    Core: ['Virtue of Justice', 'Orb of Wrath'],
    Dragonhunter: ['Spear of Justice', wait, "Hunter's Verdict"],
    Firebrand: ['Tome of Justice', 'Chapter 1: Searing Spell', 'Stow Tome'],
    Willbender: ['Rushing Justice', 'Orb of Wrath'],
    Luminary: ['Enter Radiant Forge', 'Dazzling Hammer', 'Glaring Burst']
  },
  mesmer: {
    config: { primaryWeapon: 'Sword', secondaryWeapon: 'Sword', initialResource: 3 },
    Core: ['Mind Wrack'],
    Chronomancer: ['Continuum Split', 'Split Second', 'Continuum Shift'],
    Mirage: ['False Oasis', wait, 'Pick Up Mirage Mirror', 'Mirage Thrust'],
    Virtuoso: ['Bladesong Harmony'],
    Troubadour: ['Lively Lute', 'Crescendo']
  },
  necromancer: {
    config: { primaryWeapon: 'Dagger', initialResource: 30 },
    Core: ['Death Shroud', 'Life Blast'],
    Reaper: ["Reaper's Shroud", 'Life Rend', 'Life Slash', 'Life Reap'],
    Scourge: ['Manifest Sand Shade', 'Desert Shroud'],
    Harbinger: ['Harbinger Shroud', 'Tainted Bolts'],
    Ritualist: ["Ritualist's Shroud", 'Anguish', 'Essence Blast']
  },
  ranger: {
    config: { primaryWeapon: 'Greatsword', selectedPet: 'Tiger', selectedPet2: 'Lynx' },
    Core: ['Maul'],
    Druid: ['Celestial Avatar', 'Lunar Impact', 'Release Celestial Avatar'],
    Soulbeast: ['Worldly Impact'],
    Untamed: ['Unleash Ranger', "Ravager's Abandon"],
    Galeshot: ['Summon Cyclone Bow', 'Wind Shear', 'Dismiss Cyclone Bow']
  },
  thief: {
    config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Dagger', initialInitiative: 12, initialShadowForce: 100 },
    Core: ['Cloak and Dagger', 'Backstab'],
    Daredevil: ['Fist Flurry', 'Palm Strike'],
    Deadeye: ["Deadeye's Mark", 'Cloak and Dagger', 'Malicious Backstab'],
    Specter: ['Siphon', 'Enter Shadow Shroud', 'Haunt Shot'],
    Antiquary: ['Skritt Scuffle', 'Skritt Swipe']
  },
  warrior: {
    config: { primaryWeapon: 'Greatsword', initialResource: 100 },
    Core: ['Arcing Slice'],
    Berserker: ['Berserk', 'Arc Divider'],
    Spellbreaker: ['Full Counter', 'Arcing Slice'],
    Bladesworn: ['Dragon Trigger', { type: 'cast', skillId: 62797, releaseAtCharges: 2 }],
    Paragon: ['Chant of Action', 'Arcing Slice']
  },
  revenant: {
    config: {
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      selectedLegends: ['LegendaryAssassin', 'LegendaryDemon'],
      startingLegend: 'LegendaryAssassin',
      initialEnergy: 50
    },
    Core: ['Impossible Odds', 'Unrelenting Assault'],
    Herald: ['Swap Legends', 'Facet of Elements', 'Elemental Blast'],
    Renegade: ['Swap Legends', "Icerazor's Ire"],
    Vindicator: ['Dodge'],
    Conduit: ['Swap Legends', 'Twin Moon Sweep']
  }
};
for (const [id, group] of Object.entries(cases)) {
  const profession = await loadProfession(id);
  for (const [specialization, rotation] of Object.entries(group)) {
    if (specialization === 'config') continue;
    let extra = { ...group.config };
    if (id === 'ranger' && specialization === 'Untamed') extra.primaryWeapon = 'Spear';
    if (id === 'necromancer' && specialization === 'Scourge') extra.initialResource = 100;
    if (id === 'revenant' && specialization !== 'Core') {
      const legend = {
        Herald: 'LegendaryDragon',
        Renegade: 'LegendaryRenegade',
        Vindicator: 'LegendaryAlliance',
        Conduit: 'LegendaryEntity'
      }[specialization];
      extra.selectedLegends = ['LegendaryAssassin', legend];
    }
    try {
      const config = {
        specialization,
        selectedTraitIds: [],
        stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 1000, expertise: 0, vitality: 1000 },
        boons: { quickness: true, alacrity: true },
        target: { armor: 2597, health: 10000000, conditions: {} },
        ...extra
      };
      const r = simulateGw2({ profession, rotation: [{ type: 'combat-start' }, ...rotation, wait], config });
      console.log(
        JSON.stringify({
          id,
          specialization,
          rotation,
          config,
          warnings: r.warnings,
          actions: r.steps.filter((s) => s.type === 'cast').length,
          hits: r.resolvedEvents.filter((e) => e.type === 'damage').length,
          state: r.planningState.profession
        })
      );
    } catch (e) {
      console.log(JSON.stringify({ id, specialization, error: e.message }));
    }
  }
}
```
