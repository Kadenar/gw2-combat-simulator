# Engineer, Revenant, and Thief Implementation Specification

Status: implementation handoff  
Audit date: 2026-07-28  
Required delivery order: Engineer, then Revenant, then Thief

## 1. Objective

Add complete, deterministic, single-target PvE simulation support for Engineer,
Revenant, and Thief. The implementations must follow the shared profession model
used by Guardian, Mesmer, and Necromancer.

Work must proceed in this order:

1. Complete the prerequisite shared refactors in section 4.
2. Implement and finish Engineer.
3. Implement and finish Revenant.
4. Implement and finish Thief.

Do not begin a later profession while an earlier profession has known catalog,
mechanic, trait, or test gaps.

This document is a specification only. It does not include the implementation.

Aquatic weapons and skills are categorically out of scope and do not belong in
this project. They require no implementation, mechanics audit, or test coverage.

## 2. Definition of complete

A profession is complete only when:

- All nine current specialization lines and all 108 current traits are present.
- Every terrestrial profession, weapon, slot, mechanic, transform, bundle, pet,
  summon, and elite-specialization skill relevant to the simulator is accounted
  for.
- Every damaging skill has verified PvE strike coefficients at packet level.
- Every skill applies its intended damaging and non-damaging conditions at the
  correct packet or completion time.
- Wiki cooldowns, ammo counts, recharge rules, resource costs, and durations are
  explicitly encoded in profession mechanics data.
- Weapon chains, flips, replacements, stealth attacks, dual skills, kits,
  transforms, legend bars, and other conditional bars are enforced by scheduler
  availability rules.
- Every trait has an explicit coverage classification and no trait remains
  unreviewed.
- All behavior that affects damage, conditions, resources, cooldowns, action
  availability, or tracked state has focused automated tests.
- The profession passes the shared profession conformance suite, unit tests,
  syntax checks, and browser smoke tests.
- Its build can be encoded, decoded, reloaded, and migrated without using display
  names as runtime identifiers.
- The implementation has no new profession-specific branches in shared platform
  or app code where an optional profession contract can express the behavior.

Literal simulation of every support effect is outside the current engine's
single-target damage scope. "All traits implemented" therefore means every trait
is reviewed and either:

- implemented for every effect observable by the current simulator, or
- explicitly classified as out of model with a reason and a coverage assertion.

Do not represent an out-of-model effect as fake zero damage or silently ignore it.
If literal ally healing, revival, barrier, incoming-hit reactions, or multi-target
support must be simulated, that is a separate engine expansion and must be scoped
before claiming those effects are complete.

## 3. Audit of the current repository

### 3.1 Current baseline

At audit time:

- Branch: `consolidate_v5`
- `npm test`: 482 tests passed.
- `npm run check`: passed when run outside the restricted process sandbox.
- Native shared-engine professions: Guardian, Mesmer, and Necromancer.
- Elementalist remains a legacy standalone implementation and is not the model
  for new work.

The existing shared architecture already provides:

- A profession definition/runtime contract.
- Stable numeric skill and trait IDs.
- Chronological scheduler and resolver state.
- Profession-owned mechanics and event handlers.
- Generic resource views and palette groups.
- A profession registry with lazy loading.
- Shared build encoding and migration support.
- A generic API snapshot generator.
- Registry-driven conformance tests.

Use Guardian and Necromancer as the primary examples for stable-ID mechanics.
Mesmer is useful for complex state and action replacement, but it still contains
substantial name-based dispatch and must not be copied into new professions.

### 3.2 Current catalog sizes

The runtime currently reports:

| Profession | Skills | Traits | Lines |
| --- | ---: | ---: | ---: |
| Mesmer | 141 | 108 | 9 |
| Guardian | 191 | 108 | 9 |
| Necromancer | 161 | 108 | 9 |

`docs/GUARDIAN.md` reports 190 skills and is stale by one. Correct that
documentation when the prerequisite documentation cleanup is performed.

`docs/NECROMANCER.md` refers to API coefficients even though generated API data is
not intended to be coefficient authority. Correct that wording. Coefficients must
come from current PvE wiki research and later EVTC validation where applicable.

### 3.3 Existing debt that does not block this work

Mesmer's remaining name-based mechanics should eventually be migrated to stable
IDs. That migration is documented in `docs/PROFESSION_EXPANSION_MIGRATION.md` and
should not block Engineer. New professions must use stable IDs from their first
commit.

Do not expand this project into a full Mesmer rewrite unless a new shared
contract cannot be introduced safely without it.

## 4. Required shared work

Each item must be implemented and tested before the first profession that depends
on it. Keep each refactor behavior-preserving for existing professions.

### Gate 0A: keep aquatic skills out of generated catalogs

The snapshot generator currently excludes `Trident` but not the GW2 API weapon
key `Speargun`.

Required change:

- Add `Speargun` to the default terrestrial weapon exclusions in
  `scripts/lib/gw2-profession-snapshot.mjs`.
- Apply the exclusion consistently in both skill filtering and skill association
  generation.
- Preserve land spear skills. Do not filter the `Spear` weapon key.
- Add fixture tests covering Trident, Speargun, and land Spear behavior.

### Gate 0B: profession-owned custom event presentation

`js/app/rotation-ui.js` currently recognizes Mesmer custom event types directly,
including phantasm and instrument events. Engineer kits and transforms, Revenant
legends and upkeep, and Thief steal/artifact/shroud state must not add more
profession branches there.

Add an optional profession UI contract such as:

```js
ui.eventLogRow(context, event)
```

Contract:

- Shared event types continue to render in shared UI code.
- A namespaced custom event is delegated to the active profession.
- The hook returns a normalized row descriptor or `null`.
- State-only events can deliberately return `null`.
- Unknown custom events are handled safely and are visible in development
  diagnostics.
- Custom event types remain namespaced: `engineer.*`, `revenant.*`, `thief.*`.

Migrate the existing Mesmer-specific custom-event rendering to this hook and add
regression tests before using it for a new profession.

### Gate 0C: trait coverage manifest and validator

The existing professions catalog all 108 traits, but catalog presence does not
prove behavioral coverage. Add a reusable coverage manifest and validator for new
professions.

Every trait entry must have:

```js
{
  traitId,
  status: "implemented" | "out-of-model",
  effects: ["short description of each reviewed effect"],
  tests: ["test name or stable test ID"],
  reason: null // required when status is out-of-model
}
```

Validation must fail when:

- A catalog trait has no coverage entry.
- A coverage entry references an unknown trait.
- An implemented trait has no behavioral test reference.
- An out-of-model trait has no concrete reason.
- A trait is classified only by its name without documenting each effect.

The manifest must support mixed traits. If one part affects damage and another
part heals allies, implement and test the damage part and mark the healing part
out of model in the same entry.

Do not force a risky backfill of all existing profession traits as part of Gate
0. Apply the validator to every new profession. Backfilling Guardian, Mesmer, and
Necromancer should be tracked separately unless a shared regression requires it.

### Gate 0D: timestamp-aware target condition queries

New traits frequently depend on whether the target currently has poison,
weakness, chill, cripple, immobilize, vulnerability, or another condition.
Profession code should not create separate booleans for each condition.

Expose shared, timestamp-aware queries equivalent to:

```js
query.targetConditionStacks(condition, atMs, runtime)
query.targetHasCondition(condition, atMs, runtime)
```

Requirements:

- Include permanent scenario conditions and runtime-applied condition state.
- Respect application, expiration, cleanse/removal if modeled, and same-time
  event ordering.
- Use the canonical condition vocabulary.
- Preserve vulnerability's damage modifier behavior.
- Test damaging and non-damaging conditions with overlapping durations.

Implement this before Engineer trait work.

### Gate 1: profession-owned slot loadout model

Required before Revenant.

The shared app assumes a conventional heal, three utilities, and elite selection.
Revenant selects two legends, and each legend supplies a fixed five-skill bar.
Do not emulate this with ten independently selected utility skills.

Add an optional profession-owned loadout view/model contract. The exact name is
not prescribed, but it must let a profession provide:

- Build selectors that replace the standard slot-skill selectors.
- The active fixed slot bar.
- Inactive alternate bars.
- Validation and normalization rules.
- Palette grouping and unavailable reasons.

The default implementation must preserve all current professions.

Revenant build data must store stable legend IDs and a starting legend, for
example:

```js
{
  selectedLegends: [legendIdA, legendIdB],
  startingLegend: legendIdA
}
```

### Gate 2: profession-owned weapon-set skill matching

Required before Thief.

The current weapon bar model treats slot 3 as belonging to a single hand.
Thief slot 3 depends on the exact main-hand/off-hand combination, including
no-offhand variants.

Add an optional adapter hook such as:

```js
weaponSkillMatchesSet(skill, [mainHand, offHand], context)
```

Requirements:

- The default reproduces current weapon matching.
- Thief mechanics data can declare exact hand requirements.
- Build previews, palette construction, and scheduler availability all use the
  same matcher.
- Tests cover every supported main-hand/off-hand combination and empty offhand.
- The hook does not contain a shared-code check for `profession === "Thief"`.

### Gate 3: profession-owned simulation assumptions

Required before Thief trait completion and useful for all later professions.

Some mechanics depend on target position, range, player health, a marked target,
or a deterministic choice that the current generic controls do not expose. Add
generic profession-owned assumption controls rather than hard-coding Thief fields
in the app.

At minimum support:

- Flanking and behind state.
- Target distance or a documented range band.
- Player health percentage.
- Target defiance state rather than an unconditional hidden value.
- Explicit deterministic choices for mechanics that can alter future actions.

Assumptions must be encoded in saved builds when they affect deterministic
results. Defaults must be documented in presets and test fixtures.

## 5. Common implementation rules

### 5.1 IDs and dispatch

- Use GW2 numeric IDs for skills, traits, specializations, legends, and pets when
  an API ID exists.
- Define stable internal IDs for mechanic actions omitted by the API.
- Never use a display name for runtime dispatch, replacement, or availability.
- Names may be used only for display, diagnostics, and legacy import.
- Same-name API records must be manually disambiguated and covered by fixtures.

### 5.2 Generated data versus mechanics data

Generated API metadata is authoritative for:

- Identity and display metadata.
- Specialization and trait membership.
- Weapon, slot, profession, chain, flip, and bundle associations where complete.
- Icons and descriptions.

Generated API metadata is not authoritative for simulation coefficients. It is
also incomplete for many kit, transform, pet, command, artifact, and bundle
skills.

Profession-owned mechanics data is authoritative for:

- Strike packets and coefficients.
- Condition applications and durations.
- Cooldowns, ammo, and recharge behavior.
- Initiative, energy, heat, upkeep, and other resource costs.
- Boons and buffs that affect results.
- Cast and aftercast timing.
- Replacement, flip, chain, and availability behavior.
- Actor ownership and summon behavior.

Add supplemental catalog files for API-omitted skills. A supplemental record must
follow the same validation and stable-ID rules as a generated record.

### 5.3 Per-skill mechanics record

Every implemented skill or mechanic action needs a research record containing:

- Stable ID and display name.
- Source URL, source revision date, and PvE mode.
- Profession/spec/legend/kit/weapon/slot classification.
- Required weapon set or state.
- Cooldown, ammo, recharge, and recharge anchor.
- Energy, initiative, endurance, heat, page, upkeep, or other costs.
- `castTimeMs` and a timing confidence value.
- Every strike packet as `{ atMs, coefficient, actorType }`.
- Every condition packet as `{ atMs, condition, stacks, durationMs }`.
- Control, blind, boons, buffs, and state changes at their intended time.
- Chain, flip, replacement, interrupt, and cancellation behavior.
- Handler ID only when declarative mechanics are insufficient.
- Stable test references.

Do not collapse a multihit skill into one coefficient. The total coefficient and
each packet coefficient must be independently testable.

Use the correct weapon strength source. Thief dual-wield attacks use the
main-hand weapon. Summon and effect packets must use their intended actor type so
sigils, traits, and relics do not trigger incorrectly.

### 5.4 Conditions

- Use canonical condition names already recognized by the engine.
- Apply conditions on the actual hit or completion packet documented by the
  source.
- Include non-damaging conditions when they affect traits, relics, availability,
  or later damage.
- Model vulnerability through the shared target-condition and damage-modifier
  systems.
- Test stack count, duration, packet timing, and expiration.
- A skill with no coefficient but a relevant condition is not a zero-damage
  strike; encode the condition effect directly.

### 5.5 Timing and recharge

Cooldowns must be taken from the current PvE wiki values and explicitly encoded.
Do not let a future API refresh silently change simulation cooldowns. Add a test
that mutating generated API recharge metadata does not change mechanics output.

For initial cast timing:

1. Use the current wiki activation time when it exists.
2. Use a documented deterministic estimate when it does not.
3. Mark each timing value as `wiki`, `estimated`, or `evtc`.
4. Replace estimates with EVTC-derived values after logs are supplied.

EVTC timing validation must be a data correction, not an opportunity to change
coefficients or unrelated mechanics in the same patch.

Continue using the shared timing model:

- `castTimeMs`
- optional `quicknessCastTimeMs`
- explicit packet anchors
- `rechargeAnchor`
- explicit lockouts

### 5.6 Random mechanics

Expected-value modeling is permitted only when randomness changes damage but
cannot change later action availability or state.

If a random outcome changes the next available action, resource state, skill bar,
or cooldown path, expose a deterministic sequence or explicit build/simulation
choice. This applies particularly to Antiquary artifacts and Double Edge
backfires. Tests must be reproducible without a global random-number generator.

### 5.7 Weaponmaster and expansion weapons

Support the current PvE weapon-access rules, including Weaponmaster Training,
Expanded Weapon Proficiency, and land spear. Elite specialization weapons must be
available to other specializations where the live game permits it, while
elite-specific profession mechanics and slot skills remain specialization-gated.

### 5.8 Custom events

- Namespace all profession events.
- Materialize state transitions chronologically.
- Never let resolver code observe future state.
- Define ordering for simultaneous resource gain, damage, condition, cooldown,
  and replacement events.
- State events that exist only for calculation may be hidden from the user event
  log through the profession UI hook.

## 6. Required profession module shape

Follow the current native profession layout. Exact file splitting may vary, but
responsibilities must remain separated:

```text
js/professions/<profession>/
  app/
    adapter.js
  core/
    calc-attributes.js
  data/
    <profession>-api-metadata.js
    supplemental-skills.js
    traits-data.js
  mechanics/
    autoattack-chains.js
    availability.js
    contract.js
    handler-mechanics.js
    skill-mechanics.js
    specific/
  resolver/
    event-handlers.js
  app-runtime.js
  attribute-rules.js
  build.js
  build-attributes.js
  catalog.js
  definition.js
  ids.js
  state.js
  ui.js
```

Also add:

- A profession HTML entry point.
- Registry entry and lazy loader.
- Theme/card styles using the existing design model.
- Profession documentation and mechanics source ledger.
- Focused profession tests.
- Shared conformance registration.
- At least one deterministic preset per major mechanic.

## 7. Engineer specification

Engineer must be fully complete before Revenant work starts.

### 7.1 Catalog

Implement these nine specialization lines:

- Explosives
- Firearms
- Inventions
- Alchemy
- Tools
- Scrapper
- Holosmith
- Mechanist
- Amalgam

Catalog and classify all 108 traits.

Terrestrial weapons:

- Rifle
- Pistol main hand and off hand
- Shield
- Hammer
- Sword
- Mace
- Short bow
- Spear

### 7.2 Core profession mechanics

Implement:

- No in-combat weapon swap.
- Heal, utility, and elite skill selection.
- Tool-belt skill derivation from the selected slot skills.
- F1 through F5 tool-belt layout where applicable.
- Independent cooldowns for a slot skill and its tool-belt skill.
- Tool-belt replacement rules from specializations and traits.
- Device, gadget, elixir, gyro, kit, signet, stance, turret, and other relevant
  skill types.
- Turrets and persistent effects as non-player actors.

The build may retain two weapon sets for shared build compatibility, but the
rotation must reject `Swap Weapons` during combat. The starting set is the active
set unless a mechanic explicitly changes only swap-trigger state.

### 7.3 Engineering kits

Implement all core kits and every kit-bar skill:

- Med Kit
- Bomb Kit
- Grenade Kit
- Elixir Gun
- Flamethrower
- Tool Kit
- Elite Mortar Kit

Required behavior:

- Equipping a kit replaces weapon slots 1 through 5.
- Stowing a kit restores the prior weapon bar.
- Equipping another kit directly changes to that kit.
- Kit skills retain their own cooldowns across equip and stow.
- Kit transitions trigger weapon-swap sigil effects under current live rules
  without changing the equipped weapon set.
- Kits inherit the appropriate equipped weapon attributes and sigils.
- Autoattack chain state is reset or preserved according to observed game rules
  and documented explicitly.
- Interrupt, cancellation, and kit-stow timing are deterministic.
- The palette displays only currently legal kit actions while preserving
  deliberate queueing rules already supported by the scheduler.

Recommended state:

```js
{
  activeKitId,
  previousWeaponBar,
  toolbeltSkillIds,
  availableFlips,
  kitTransitionReadyAt
}
```

Do not model kits as a conventional weapon swap.

### 7.4 Scrapper

Implement:

- Function Gyro and its F5 replacement behavior.
- Gyro/well actors and pulses.
- Superspeed and quickness effects where they influence tracked state.
- Barrier-dependent or incoming-hit traits only to the extent observable by the
  current model; classify the rest.
- Impact Savant's damage-linked behavior and current PvE conversion values.
- Hammer and all Scrapper slot skills.
- Every Scrapper trait and trait-modified skill behavior.

Gyro pulses must use correct actor ownership and packet timing. Function Gyro's
revival/finisher support can be classified out of model, but any strike,
condition, boon, cooldown, or trait interaction must still be implemented.

### 7.5 Holosmith

Implement:

- Photon Forge engage/disengage through F5.
- Forge weapon bar and all forge skills.
- Heat from 0 to 100 by default.
- Trait-modified maximum heat, including the 150-heat configuration.
- Passive heat gain/cooling with timestamp-accurate state advancement.
- Overheat, its lockout, self-effect classification, and trait interactions.
- The kit lockout after entering Photon Forge.
- Forge transitions as weapon-swap-sigil triggers without changing the equipped
  weapon set.
- Heat thresholds and scaling for sword, Exceed, forge, and trait effects.
- Holosmith weapon, utility, heal, and elite skills.
- Every Holosmith trait.

Heat must be computed continuously at action boundaries, not by mutating a final
state after scheduling.

Recommended state:

```js
{
  heat,
  maximumHeat,
  heatUpdatedAt,
  photonForgeActive,
  overheatUntil,
  kitLockoutUntil
}
```

Test exact boundary behavior at each relevant heat threshold.

### 7.6 Mechanist

Implement:

- Jade Mech summon, dismissal, crash-down, and recall state.
- Replacement of the normal tool belt with Mech Commands.
- Trait-selected F1, F2, and F3 command skills.
- F4 lifecycle action.
- Mech attributes and player-to-mech inheritance used by current PvE mechanics.
- Mech basic attacks, queued commands, cooldowns, conditions, and actor ownership.
- Signet passive/active behavior and mech interactions.
- Mace and all Mechanist slot skills.
- Every Mechanist trait.

The mech is a persistent summon actor. Its attacks must not trigger
player-only on-hit effects unless the game mechanic explicitly attributes them to
the player.

Recommended state:

```js
{
  mech: {
    active,
    summonedAt,
    commandSkillIds,
    commandQueue,
    inheritedAttributes
  }
}
```

### 7.7 Amalgam

Implement the current live Amalgam specialization:

- Short bow and all Amalgam slot skills.
- Selectable morph loadout and its profession-skill slot mapping.
- Evolve and all Evolve-state effects.
- Strain application, duration, stacking, and consumption/interaction rules.
- Stance skills and their tracked effects.
- Trait-selected morph or Evolve modifications.
- Every Amalgam trait.

The API contains locked/placeholder profession-skill records. Add stable
supplemental records for the live selectable morph skills and their variants.
Verify the exact F1-F5 mapping from the current wiki rather than inferring it from
placeholder API records.

Branch-changing morph choices must be saved in the build and validated against
the selected specialization.

Recommended state:

```js
{
  selectedMorphSkillIds,
  evolvedUntil,
  strains,
  activeStances
}
```

### 7.8 Engineer tests

At minimum test:

- Every weapon skill's packet coefficients and conditions.
- Every kit skill and kit transition.
- No-combat-weapon-swap enforcement.
- Tool-belt derivation and independent cooldowns.
- Swap sigil internal cooldown across kits and Photon Forge.
- Heat gain, cooling, thresholds, overheat, and kit lockout.
- Mech command selection, actor ownership, and inheritance.
- Morph selection, Evolve, and strains.
- Every trait coverage entry and every implemented trait effect.
- Quickness and Alacrity behavior on casts and cooldowns without incorrectly
  modifying heat or unrelated state.

## 8. Revenant specification

Start only after Engineer is complete and Gate 1 has passed.

### 8.1 Catalog

Implement these nine specialization lines:

- Devastation
- Corruption
- Retribution
- Salvation
- Invocation
- Herald
- Renegade
- Vindicator
- Conduit

Catalog and classify all 108 traits.

Terrestrial weapons:

- Sword main hand and off hand
- Axe off hand
- Mace main hand
- Staff
- Hammer
- Shield
- Short bow
- Greatsword
- Scepter
- Spear

### 8.2 Legend loadout and swapping

Implement:

- Selection of exactly two legal legends.
- A stable starting legend.
- Five fixed slot skills per legend.
- Legend-specific F2/F3 mechanics.
- Legend swap cooldown using the current PvE wiki value.
- Legend swap setting energy to the current live reset value.
- Legend swaps triggering weapon-swap sigil effects without changing weapon set.
- Skill-bar replacement, upkeep termination/persistence rules, and cooldown
  preservation on swap.
- Elite-specialization legend legality.

Build validation must reject duplicate or illegal legend combinations and a
starting legend not included in the selected pair.

### 8.3 Energy and upkeep

Implement:

- Base energy range and initial in-combat value.
- Passive energy regeneration.
- Explicit energy costs on every skill.
- Upkeep costs and net regeneration.
- Multiple simultaneous upkeep effects where live rules permit them.
- Automatic upkeep cancellation at insufficient energy.
- Skill cooldowns in addition to energy cost.
- Timestamp-accurate energy at action availability boundaries.
- Trait and specialization modifications to regeneration, cost, reset, and cap.

Recommended state:

```js
{
  energy,
  energyUpdatedAt,
  activeLegendId,
  selectedLegendIds,
  legendSwapReadyAt,
  activeUpkeeps: [{ skillId, upkeepCost }]
}
```

Alacrity affects applicable cooldowns. It must not accelerate passive energy
regeneration unless a live trait explicitly changes it.

### 8.4 Core Revenant

Implement:

- All core legend bars and their profession actions.
- Ancient Echo and its per-legend results.
- Invocation of legend-specific effects.
- Weapon skills, chains, conditions, blocks, evades, and movement-dependent
  damage that is representable in the deterministic model.
- Every core trait across the five core specialization lines.

Healing, ally movement, projectile destruction, and incoming-hit effects must be
classified honestly, while their damage/resource/cooldown components remain
implemented.

### 8.5 Herald

Implement:

- Facets as upkeep skills.
- Facet active/consume flips.
- Facet of Nature and True Nature variants by active legend.
- Upkeep, boon, cooldown, and trait interactions.
- Shield and all Herald slot skills.
- Every Herald trait.

Facet state and its active flip must remain correct across legend swaps,
deactivation, insufficient energy, and interruption.

### 8.6 Renegade

Implement:

- Kalla's legend bar.
- Citadel Orders.
- Warband summons and pulse/attack actors.
- Soulcleave's Summit upkeep and pulses.
- Short bow and all Renegade skills.
- Every Renegade trait.

Warband attacks must use summon actor types and preserve correct source
attribution for conditions and modifiers.

### 8.7 Vindicator

Implement:

- Alliance legend skill bar.
- Alliance Tactics and its current PvE recharge.
- Kurzick/Luxon skill-side switching and replacement rules.
- Energy Meld.
- Vindicator endurance changes.
- The selected Vindicator dodge variant and its damage/boon effects.
- Greatsword and all Vindicator slot skills.
- Every Vindicator trait.

The selected dodge behavior and alliance side must be explicit build/start state.
Incoming attacks and evade success cannot be assumed unless represented by a
documented scenario input.

### 8.8 Conduit

Implement the current live Conduit specialization:

- Spear and all Conduit slot skills.
- Release Potential variants by active legend.
- Affinity generation, spending, thresholds, and scaling.
- Cosmic Wisdom, duration, cooldown, and form transitions.
- Entity/Razah legend skills and any fixed or conditional bar replacements.
- Automatic form behavior on legend swap.
- Trait modifications to legend swap, affinity, forms, skills, and damage.
- Every Conduit trait.

The profession catalog must include supplemental records for API-omitted form or
replacement skills. Do not dispatch variants by their shared display names.

Recommended extended state:

```js
{
  affinity,
  cosmicWisdomUntil,
  conduitForm,
  allianceSide,
  activeLegendSummons
}
```

### 8.9 Revenant tests

At minimum test:

- Every weapon skill's packets, conditions, energy cost, and cooldown.
- Every legend bar and legal legend pair.
- Energy regeneration, upkeep, insufficient-energy cancellation, and boundary
  ordering.
- Legend swap cooldown, energy reset, bar swap, and swap-sigil interaction.
- Facet flips and legend-dependent True Nature.
- Renegade summon actor ownership.
- Alliance-side switching and dodge variants.
- Affinity, Release Potential, and Cosmic Wisdom state.
- Every trait coverage entry and every implemented trait effect.
- Alacrity modifying cooldowns but not energy regeneration.

## 9. Thief specification

Start only after Revenant is complete and Gates 2 and 3 have passed.

### 9.1 Catalog

Implement these nine specialization lines:

- Deadly Arts
- Critical Strikes
- Shadow Arts
- Acrobatics
- Trickery
- Daredevil
- Deadeye
- Specter
- Antiquary

Catalog and classify all 108 traits.

Terrestrial weapons:

- Dagger main hand and off hand
- Pistol main hand and off hand
- Sword main hand
- Short bow
- Staff
- Rifle
- Scepter main hand
- Axe main hand
- Spear

### 9.2 Initiative

Implement:

- Current base initiative and trait-modified maximum.
- Passive initiative regeneration.
- Explicit initiative costs for every weapon skill.
- Shared initiative across both weapon sets.
- Weapon skills without ordinary recharge unless the live skill explicitly has
  one.
- Initiative gain, refund, steal, and trait interactions.
- Timestamp-accurate availability at regeneration boundaries.

Recommended state:

```js
{
  initiative,
  maximumInitiative,
  initiativeUpdatedAt
}
```

Alacrity must not increase passive initiative regeneration.

### 9.3 Dual-wield and conditional weapon bars

Implement:

- Every slot-3 dual-wield skill for every legal main-hand/off-hand combination.
- The correct slot-3 skill for an empty off hand where one exists.
- Main-hand weapon strength for dual-wield damage.
- Weapon swap preserving shared initiative and each weapon chain's state under
  live rules.
- Exact palette and scheduler legality from the active weapon combination.

Create table-driven tests enumerating all supported combinations. A missing
combination must fail validation rather than fall back to a same-name skill.

### 9.4 Stealth, revealed, and stealth attacks

Implement:

- Stealth duration and stacking behavior relevant to the simulator.
- Revealed and its current PvE duration.
- Stealth loss from attacks and other relevant actions.
- Slot-1 replacement with the correct stealth attack for the active weapon.
- Stealth attack costs, conditions, malice interactions, and actor ownership.
- Trait effects on entering/leaving stealth and attacking from stealth.

State changes must occur at the correct cast, hit, or completion packet. A
stealth attack may not be scheduled if Revealed or another live restriction
prevents stealth.

### 9.5 Core Steal

Implement:

- Core Steal recharge from the current PvE wiki.
- Instant/concurrent activation and range restrictions.
- F1 Steal and F2 stolen-skill storage/use.
- Replacement of a previously stored stolen skill.
- Trait effects triggered by Steal, stolen skills, shadowsteps, and target state.
- A deterministic target/stolen-skill selection input.

Do not attempt to infer a full target database from enemy names. Provide stable
scenario choices, including a documented default for the standard raid-golem
test target.

### 9.6 Daredevil

Implement:

- Modified endurance capacity.
- All Daredevil dodge replacements.
- Damage, conditions, boons, and movement/landing packets from each dodge.
- Staff and all Daredevil slot skills.
- Physical skills and relevant chained/flip behavior.
- Every Daredevil trait.

Incoming-attack evade triggers require an explicit scenario event. Do not grant
them merely because an evade frame exists.

### 9.7 Deadeye

Implement:

- Deadeye's Mark and marked-target state.
- Stolen-skill behavior under Mark.
- Malice generation, caps, trait modifications, and consumption.
- Once-per-skill-use versus per-hit malice rules.
- Kneel/standing state and rifle bar replacement.
- Rifle, cantrips, and all Deadeye skills.
- Every Deadeye trait.

Malice must be tied to the marked target even in the current single-target model.
Tests must distinguish per-cast, per-hit, and critical-hit behavior.

Recommended state:

```js
{
  markedTargetId,
  malice,
  kneeling,
  storedStolenSkillId
}
```

### 9.8 Specter

Implement:

- Siphon and its profession-mechanic replacement behavior.
- Shadow Force generation from initiative spending and other live sources.
- Current Shadow Force capacity and degeneration.
- Shadow Shroud entry, exit, and skill bar.
- Shadow Shroud transitions as weapon-swap-sigil triggers where live rules apply.
- Scepter, wells, and all Specter skills.
- Every Specter trait.

Ally tethering, ally barrier, and ally healing may be classified out of model,
but their coupled resource, boon, damage, condition, and cooldown effects must
still be implemented.

Recommended state:

```js
{
  shadowForce,
  maximumShadowForce,
  shadowForceUpdatedAt,
  shadowShroudActive
}
```

### 9.9 Antiquary

Implement the current live Antiquary specialization:

- Skritt Swipe and its current PvE recharge.
- Offensive and Defensive Artifact slots.
- Trait-granted additional artifact capacity.
- Artifact acquisition, replacement, use counts, and skill variants.
- Reshuffle and its exact effect on artifact state.
- Double Edge skills, recast behavior, backfire chances, and penalty state.
- Trait behavior that changes or guarantees Double Edge outcomes.
- Axe and all Antiquary slot skills.
- Antiquary-specific Thieves Guild behavior.
- Every Antiquary trait.

Artifact identity and backfire outcomes can alter future available actions. Use an
explicit deterministic sequence or saved scenario choice, not expected-value
averaging or unseeded randomness.

Recommended state:

```js
{
  artifactSlots,
  artifactUsesRemaining,
  artifactOutcomeSequence,
  doubleEdgeOutcomeSequence,
  backfireState,
  activeAntiquarySummons
}
```

API omissions and same-name artifact variants require supplemental stable IDs and
manual alias fixtures.

### 9.10 Thief tests

At minimum test:

- Every weapon skill's packet coefficients, conditions, and initiative cost.
- Every dual-wield combination and stealth attack.
- Initiative regeneration, caps, spending, refunds, and shared-set behavior.
- Steal cooldown, stored skill replacement, and target selection.
- Stealth/Revealed ordering and stealth attack replacement.
- Dodge variants and explicit evade-event behavior.
- Mark, malice, Kneel, and per-use versus per-hit rules.
- Shadow Force, Shadow Shroud, and swap-sigil interaction.
- Artifact inventory, Reshuffle, Double Edge deterministic outcomes, and summons.
- Every trait coverage entry and every implemented trait effect.
- Alacrity affecting real cooldowns while leaving initiative regeneration alone.

## 10. Testing standard

### 10.1 Catalog and conformance

Extend the shared conformance suite so each new profession proves:

- Nine specialization lines and 108 unique traits.
- No duplicate stable IDs.
- Every terrestrial skill is implemented or explicitly excluded with a reason.
- Every mechanic handler ID resolves.
- Every custom event is namespaced.
- Every resource view and profession UI hook returns valid descriptors.
- Builds survive encode/decode and migration.
- Wrong-profession and future-version builds fail safely.
- Generated metadata refreshes do not overwrite mechanics authority.

### 10.2 Skill mechanics

For every damaging weapon or slot skill, assert:

- Total coefficient.
- Each packet coefficient and timestamp.
- Hit count.
- Condition stacks, duration, and application timestamp.
- Cooldown/ammo/recharge.
- Resource cost.
- Correct actor and weapon strength.
- Chain, flip, replacement, and availability behavior.

Use table-driven fixtures so an added catalog skill without a mechanics test
causes a failure.

### 10.3 Chronology

Add boundary tests for:

- Resource regeneration exactly at an action timestamp.
- Same-time damage, condition, resource, and cooldown events.
- Swaps during active upkeep, kit, transform, shroud, or stealth state.
- Interrupts and early cancellation.
- State expiration immediately before and at the boundary.
- No resolver access to future scheduled state.

### 10.4 Traits

For each implemented trait, test the smallest observable behavior and at least
one negative case. Include:

- Selected versus unselected.
- Correct specialization gating.
- Cooldown/internal-cooldown boundaries.
- Per-hit versus per-cast behavior.
- Player versus summon actor ownership.
- Target-condition and positioning requirements.
- Resource thresholds and exact boundary values.

### 10.5 Browser and UI

For each profession verify:

- Page load without console errors.
- Build controls and profession-specific loadouts.
- Weapon and conditional palette groups.
- Resource meters and starting-state controls.
- Unavailable action explanations.
- Event-log rendering of custom events.
- Save/load and share-code round trip.
- At least one representative rotation resolving to a stable summary.

## 11. Delivery sequence

Use small, reviewable changes and preserve a passing baseline between gates.

### Phase 0: shared prerequisites

1. Fix terrestrial snapshot filtering.
2. Add and migrate custom event presentation.
3. Add target-condition queries.
4. Add the trait coverage manifest validator.
5. Correct the two stale documentation statements found by the audit.
6. Run the full baseline suite.

### Phase 1: Engineer

1. Generate and pin API data.
2. Add supplemental IDs/catalog.
3. Add build/defaults/attributes.
4. Implement core state, actions, tool belt, and kits.
5. Implement all weapons and core slot skills.
6. Implement and test all core traits.
7. Implement Scrapper completely.
8. Implement Holosmith completely.
9. Implement Mechanist completely.
10. Implement Amalgam completely.
11. Add UI, registry, documentation, presets, and smoke tests.
12. Pass the full gate before starting Revenant.

### Phase 2: Revenant

1. Add the generic slot-loadout contract.
2. Generate and pin API data.
3. Add supplemental IDs/catalog.
4. Add build/defaults/attributes and legend validation.
5. Implement energy, upkeep, legend bars, and legend swap.
6. Implement all weapons, core skills, and core traits.
7. Implement Herald completely.
8. Implement Renegade completely.
9. Implement Vindicator completely.
10. Implement Conduit completely.
11. Add UI, registry, documentation, presets, and smoke tests.
12. Pass the full gate before starting Thief.

### Phase 3: Thief

1. Add generic weapon-set matching and assumption controls.
2. Generate and pin API data.
3. Add supplemental IDs/catalog.
4. Add build/defaults/attributes.
5. Implement initiative, dual wield, stealth, and Steal.
6. Implement all weapons, core skills, and core traits.
7. Implement Daredevil completely.
8. Implement Deadeye completely.
9. Implement Specter completely.
10. Implement Antiquary completely.
11. Add UI, registry, documentation, presets, and smoke tests.
12. Pass the complete repository gate.

## 12. Data refresh commands

After the destination profession directory exists:

```powershell
npm run update:profession-data -- --profession Engineer
npm run update:profession-data -- --profession Revenant
npm run update:profession-data -- --profession Thief
```

Pin the generated snapshot date in the profession's source ledger. Review every
diff after refresh; generated changes must not silently alter hand-authored
mechanics.

## 13. EVTC follow-up

When EVTC logs are supplied:

1. Record the game build, encounter/golem settings, build, equipment, boons, and
   latency assumptions.
2. Map casts and damage packets to stable skill IDs.
3. Compare activation, aftercast, projectile travel, pulse spacing, summon delay,
   transform/kit/legend transition, and resource timing.
4. Update timing-confidence records from `estimated` or `wiki` to `evtc`.
5. Add the log-derived timing case as a regression fixture or documented oracle.
6. Keep coefficient and condition changes separate unless the log independently
   proves those values wrong.

Useful first EVTC captures:

- Engineer: kit-to-kit, kit stow, Photon Forge, Overheat, mech commands, and
  Evolve transitions.
- Revenant: legend swap at multiple energy values, upkeep starvation, facet
  consume, Alliance Tactics, and Cosmic Wisdom.
- Thief: initiative regeneration boundaries, Steal/stolen skill, stealth attack,
  Kneel, Shadow Shroud, artifact replacement, and Double Edge recast.

## 14. Important callouts

- The current engine cannot truthfully simulate all ally-support and
  incoming-damage trait effects. The coverage manifest makes that limitation
  explicit; expanding those domains is separate scope.
- Wiki cooldowns and PvE splits change. Every mechanics fact needs a source date.
- Cast times are provisional until EVTC validation.
- API snapshots omit important mechanic bars and contain placeholders. Supplemental
  stable-ID catalogs are mandatory.
- Aquatic content is out of scope. The generator guard exists only to keep it out
  of profession catalogs.
- Mesmer's name-based mechanics are technical debt, not an implementation model.
- Shared UI currently contains Mesmer-specific event rendering; migrate it before
  adding new custom event types.
- Kit, Photon Forge, legend, and Shadow Shroud transitions can activate current
  weapon-swap effects without changing the actual weapon set. Test the shared
  on-swap internal cooldown across mixed transition types.
- Engineer cannot perform a normal in-combat weapon swap.
- Revenant's fixed legend bars require a real loadout contract.
- Thief's dual-wield slot 3 requires exact two-hand matching.
- Random outcomes that alter future actions must be explicit and deterministic.
- Do not call a profession complete based on catalog counts alone.

## 15. Primary sources

Use current PvE values and record the revision date for every researched page.

### API

- [Engineer API](https://api.guildwars2.com/v2/professions/Engineer?lang=en)
- [Revenant API](https://api.guildwars2.com/v2/professions/Revenant?lang=en)
- [Thief API](https://api.guildwars2.com/v2/professions/Thief?lang=en)

### Engineer

- [List of engineer skills](https://wiki.guildwars2.com/wiki/List_of_engineer_skills)
- [List of engineer traits](https://wiki.guildwars2.com/wiki/List_of_engineer_traits)
- [Engineer](https://wiki.guildwars2.com/wiki/Engineer)
- [Tool belt](https://wiki.guildwars2.com/wiki/Tool_belt)
- [Engineering Kit](https://wiki.guildwars2.com/wiki/Engineering_Kit)
- [Photon Forge](https://wiki.guildwars2.com/wiki/Photon_Forge)
- [Heat](https://wiki.guildwars2.com/wiki/Heat)
- [Scrapper](https://wiki.guildwars2.com/wiki/Scrapper)
- [Mechanist](https://wiki.guildwars2.com/wiki/Mechanist)
- [Amalgam](https://wiki.guildwars2.com/wiki/Amalgam)
- [Evolve](https://wiki.guildwars2.com/wiki/Evolve)
- [Strain](https://wiki.guildwars2.com/wiki/Strain)

### Revenant

- [List of revenant skills](https://wiki.guildwars2.com/wiki/List_of_revenant_skills)
- [List of revenant traits](https://wiki.guildwars2.com/wiki/List_of_revenant_traits)
- [Revenant](https://wiki.guildwars2.com/wiki/Revenant)
- [Energy](https://wiki.guildwars2.com/wiki/Energy)
- [Alliance Tactics](https://wiki.guildwars2.com/wiki/Alliance_Tactics)
- [Conduit](https://wiki.guildwars2.com/wiki/Conduit)
- [Cosmic Wisdom](https://wiki.guildwars2.com/wiki/Cosmic_Wisdom)
- [Release Potential](https://wiki.guildwars2.com/wiki/Release_Potential)

### Thief

- [List of thief skills](https://wiki.guildwars2.com/wiki/List_of_thief_skills)
- [List of thief traits](https://wiki.guildwars2.com/wiki/List_of_thief_traits)
- [Thief](https://wiki.guildwars2.com/wiki/Thief)
- [Initiative](https://wiki.guildwars2.com/wiki/Initiative)
- [Steal](https://wiki.guildwars2.com/wiki/Steal)
- [Stolen skill](https://wiki.guildwars2.com/wiki/Stolen_skill)
- [Dual Wield](https://wiki.guildwars2.com/wiki/Dual_Wield)
- [Stealth](https://wiki.guildwars2.com/wiki/Stealth)
- [Stealth Attack](https://wiki.guildwars2.com/wiki/Stealth_Attack)
- [Malice](https://wiki.guildwars2.com/wiki/Malice)
- [Shadow Shroud](https://wiki.guildwars2.com/wiki/Shadow_Shroud)
- [Antiquary](https://wiki.guildwars2.com/wiki/Antiquary)
- [Double Edge](https://wiki.guildwars2.com/wiki/Double_Edge)
- [Offensive Artifact](https://wiki.guildwars2.com/wiki/Offensive_Artifact)
- [Defensive Artifact](https://wiki.guildwars2.com/wiki/Defensive_Artifact)

### Shared combat rules

- [Weapon swap](https://wiki.guildwars2.com/wiki/Weapon_swap)
- [Sigil](https://wiki.guildwars2.com/wiki/Sigil)
- [Condition](https://wiki.guildwars2.com/wiki/Condition)
- [Damage](https://wiki.guildwars2.com/wiki/Damage)

## 16. Final acceptance checklist

- [ ] Gate 0 shared changes pass all existing tests.
- [ ] Engineer is complete and passes its gate.
- [ ] Gate 1 loadout contract passes existing and Revenant tests.
- [ ] Revenant is complete and passes its gate.
- [ ] Gates 2 and 3 pass existing and Thief tests.
- [ ] Thief is complete and passes its gate.
- [ ] All 27 specialization lines and 324 traits are cataloged.
- [ ] Every new trait has a coverage entry.
- [ ] Every new terrestrial skill is implemented or explicitly excluded.
- [ ] All weapon coefficients and condition packets have focused tests.
- [ ] Wiki cooldowns and resource costs are explicitly encoded.
- [ ] All custom actions use stable IDs and namespaced events.
- [ ] Build round trips and migration tests pass.
- [ ] Full test, syntax, conformance, and browser-smoke suites pass.
- [ ] Provisional timing values are documented for later EVTC correction.
