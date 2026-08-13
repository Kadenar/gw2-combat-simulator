# Elementalist Native Migration Audit

Audit date: 2026-08-13

## Scope and baseline

This audit compares the standalone legacy Elementalist simulator with the native shared-engine implementation. It covers rotation legality, cooldowns, resources, skill state machines, trait effects, and damage-affecting assumptions. Defensive or allied-support effects that cannot affect the deterministic single-target model are excluded.

The legacy implementation is the migration parity baseline, not necessarily a statement that its Guild Wars 2 balance data is current.

Reviewed paths:

- Legacy scheduler, state, and mechanics under `js/professions/elementalist/legacy/sim/`
- Native core and specialization rules under `js/professions/elementalist/`
- Native generated skill data and trait coverage manifest
- Native/legacy parity and native mechanics tests

## Corrected

| IDs         | Behavior area                   | Resolution                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ELM-001-005 | Recharge rules                  | Corrected Ride the Lightning, Elemental Enchantment, Flow State, and element-specific training recharge calculations.                                                                                                                                                                                                                                                            |
| ELM-006-009 | Resolver modifiers              | Corrected Fresh Air timing, Electric Discharge critical damage, Aeromancer's Training, and Enhanced Potency.                                                                                                                                                                                                                                                                     |
| ELM-010-012 | Evoker fundamentals             | Added weapon-skill charge generation, Specialized Elements start/swap behavior, and Zap's timed strike modifier.                                                                                                                                                                                                                                                                 |
| ELM-101-102 | Conjured weapons                | Added bundle equip/drop/pickup state, access gating, swap procs, pickup expiry, isolated skill cooldowns, and resolver-time Frost Bow, Lightning Hammer, and Fiery Greatsword stat adjustments.                                                                                                                                                                                  |
| ELM-103-115 | Rotation legality and cooldowns | Added delayed Rock Barrier recharge, aura consumption, Pistol/Spear/familiar recharge effects, Alacrity-adjusted overload dwell, Hammer legality, Spear etchings, Evoker swap rules, and sigils.                                                                                                                                                                                 |
| ELM-201-215 | Weapon state machines           | Completed Pistol payloads, Hammer cancellation/buffs/provenance, Spear follow-ups, dynamic Primordial Stance ticks, and declared endurance gains.                                                                                                                                                                                                                                |
| ELM-301-314 | Specialization and traits       | Added missing Tempest, Weaver, Catalyst, and shared trait behavior, including duration stacking/scaling, combat-start guards, sphere pulses, and Signet of Fire passive suppression.                                                                                                                                                                                             |
| ELM-401-407 | Evoker familiars                | Added Familiar's Prowess extension, Galvanic stacks, Ignite cycling/passive, flip timing/cancellation, Specialized Elements entry effects, and Fox's Fury timing.                                                                                                                                                                                                                |
| ELM-501     | Elementalist hitbox assumptions | Added an Elementalist-only large/small hitbox control, legacy small-hitbox caps for all eight affected multi-hit skill families, and Wildfire's two large-hitbox-only packets. No other profession receives the control or packet filter.                                                                                                                                        |
| ELM-502     | Fire Elemental AI               | Replaced the legacy fixed hit list and `glyphBoonedElementals` multiplier with an EVTC-derived Fire Elemental actor: `Glyph of Elementals` always summons Fire regardless of attunement, autonomous Fireball/Flame Burst selection, interruptible Flame Barrage commands, independent summon attributes/boons, player-owned Burning, summon lifetime, and recharge after expiry. |
| ELM-505     | Elemental command flip          | Added Flame Barrage as an explicit rotation action that replaces Glyph of Elementals while the Fire Elemental is alive. Command timing is rotation-owned and interrupts the current autonomous action.                                                                                                                                                                           |
| ELM-601     | Skill mechanics ownership       | Added explicit native skill-mechanics entries for the Rock Barrier, transmute, Pistol, Hammer, Spear, and familiar state-machine families.                                                                                                                                                                                                                                       |
| ELM-602     | Trait coverage gate             | Replaced generic specialization-hook claims with catalog effect descriptions and named behavior evidence for core modifiers, attunement/aura procs, critical/control procs, and every elite specialization. Added a regression that rejects broad hook-only evidence.                                                                                                            |
| ELM-604     | Focused native coverage         | Added mechanic-specific regressions for bundles, Rock Barrier, Pistol, Hammer, Spear etchings, Tempest hit timing, familiar cancellation, Fox's Fury timing, and Fire Elemental AI/ownership.                                                                                                                                                                                    |

## Fire Elemental evidence

The supplied `power tempest dd.zevtc` log was parsed directly. It was recorded with ArcDPS build 20260715 and identifies Fire Elemental NPC 6524 as a summon of the Elementalist. Over roughly 90 seconds it contains seven Flame Barrages, five Flame Burst casts, and 18 Fireball starts.

The native profile is based on the observed event stream rather than the legacy aggregate timeline:

- Fireball and Flame Burst are autonomous actions with their own cast, impact, recovery, cooldown, and interruption state.
- Flame Barrage is a higher-priority player command. Its three projectiles land 0.20 seconds apart, its explosion coincides with the third projectile, and it can interrupt the current autonomous action.
- Flame Burst applies three stacks of Might and one stack of Burning. Flame Barrage applies three separate Burning stacks. The log attributes those conditions and boons to the player while direct strikes remain sourced from the elemental.
- Fireball and Flame Burst use the elemental's dynamic Might/Fury and target Vulnerability. Flame Barrage direct damage ignores Might and player profession modifiers, matching its documented behavior and observed damage packets.
- The summon lasts 120 seconds. Glyph recharge begins when the summon expires.

The trace is one stationary golem sample. Timings use measured central values and need additional logs to characterize movement, range, target switching, and natural timing variance.

## Open: encounter assumptions and data

| ID      | Priority | Finding                                                                                                                                                                                                                                    |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ELM-503 | Low      | The legacy Thorns boss-aura cadence assumption is not represented in native configuration.                                                                                                                                                 |
| ELM-504 | Medium   | Air, Ice, and Earth Elemental AI remain unmodeled. The native simulator follows the reference simulator by always using the EVTC-derived Fire Elemental profile, regardless of the player's attunement when `Glyph of Elementals` is cast. |

ELM-503 is an encounter-model migration rather than a native Elementalist combat-state blocker. ELM-504 requires additional combat evidence before distinct attunement-based summons can be modeled.

## Open: migration controls

| ID      | Priority | Finding                                                                                                                                                                                                      |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ELM-603 | High     | Native/legacy parity still has five short aggregate fixtures. It needs exact fixtures for transformed skills, cooldown loops, resource cycles, trait branches, and the newly migrated weapon state machines. |

## Verification

- 67 focused Elementalist mechanics, build migration, registration, and native/legacy parity tests
- Shared scheduler temporal and catalog-ownership suites
- Prettier and scoped `git diff --check`

The full repository build is currently blocked by unrelated in-progress Guardian changes: Firebrand references a missing `guardian.mantra` handler and imports a missing `castFirebrandMantra` export.

## Remaining implementation order

1. Capture representative Air, Ice, and Earth Elemental logs and implement their distinct AI/skills (ELM-504).
2. Add exact native fixtures for transformed skills, cooldown loops, resources, trait branches, and all implemented Elemental variants (ELM-603).
3. Add the low-priority Thorns cadence configuration if encounter parity still requires it (ELM-503).

Aggregate DPS tolerance remains a final safety net rather than primary proof of mechanic parity.
