# Elementalist Native Migration Audit

Audit date: 2026-08-12

## Scope and baseline

This audit compares behavior implemented by the standalone legacy Elementalist simulator with the native shared-engine implementation. It covers rotation legality, cooldowns, resources, skill state machines, trait effects, and damage-affecting assumptions. It does not treat defensive or allied-support effects that cannot affect the deterministic single-target model as migration requirements.

The legacy implementation is the parity baseline, not necessarily a statement that its Guild Wars 2 data is current. Any later game-balance audit should be separate from this migration audit.

Reviewed paths:

- Legacy scheduler, state, and mechanics under `js/professions/elementalist/legacy/sim/`
- Native core and specialization rules under `js/professions/elementalist/`
- Native generated skill data and trait coverage manifest
- Native/legacy parity and native mechanics tests

## Corrected during this audit

| ID      | Behavior                                                                                                                | Resolution                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| ELM-001 | Ride the Lightning halves its recharge when it hits. The simulator always assumes a hit.                                | Native recharge is halved before Alacrity. Added a regression test.                                     |
| ELM-002 | Elemental Enchantment reduces attunement recharge by 15%.                                                               | Applied to normal and Weaver attunement recharge.                                                       |
| ELM-003 | Elemental Enchantment reduces Overload and Jade Sphere recharge by 15%.                                                 | Applied through the native recharge hook.                                                               |
| ELM-004 | Flow State removes one second from Weaver attunement recharge outside Weave Self.                                       | Applied before Elemental Enchantment and Alacrity. Weave Self retains its fixed two-second base.        |
| ELM-005 | Element-specific weapon training only reduces single-element weapon skills; Flow State only reduces dual slot-3 skills. | Removed substring matching that incorrectly reduced Weaver dual attacks and added the slot requirement. |
| ELM-006 | Fresh Air's +250 Ferocity window begins when entering Air, not when a critical hit resets Air recharge.                 | Replaced the reset timestamp check with a five-second timed buff emitted on Air entry.                  |
| ELM-007 | Electric Discharge has double critical-hit damage.                                                                      | Added its critical-damage modifier.                                                                     |
| ELM-008 | Aeromancer's Training grants another 150 Ferocity while primarily attuned to Air.                                       | Added the dynamic bonus in addition to its static 150 Ferocity.                                         |
| ELM-009 | Enhanced Potency improves Fire familiar Might and Air familiar Fury.                                                    | Added +5 condition damage per Might for Fire and +15% critical chance while under Fury for Air.         |
| ELM-010 | Evoker weapon skills in slots 2-5 generate one charge, or two when matching the familiar element.                       | Added charge generation with the legacy conjure, transform, and Spear exclusions.                       |
| ELM-011 | Specialized Elements starts in the familiar attunement and prevents attunement swapping.                                | Native initial state and attunement availability now enforce both rules.                                |
| ELM-012 | Zap grants its five-second, 3% strike-damage effect.                                                                    | Added the timed buff and modifier.                                                                      |

## Open: rotation legality and cooldowns

These can change which rotations are accepted or when a skill can be cast, so they are the highest-priority remaining issues.

| ID      | Priority | Missing or divergent behavior                                                                                                                                                                          | Legacy source area                        |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| ELM-101 | Critical | Conjures have no native bundle state. Equipping, pickup windows, `__drop_bundle`, normal-weapon blocking, conjure-only skill access, and cooldown-key isolation are absent.                            | scheduler cast progression and step rules |
| ELM-102 | Critical | Conjured weapon stat snapshots are absent: Fiery Greatsword power/condition damage, Lightning Hammer precision/ferocity, and Frost Bow condition duration.                                             | resolver hit resolution                   |
| ELM-103 | High     | Rock Barrier incorrectly starts its cooldown immediately. Legacy starts the root cooldown when Hurl is used or when the 30-second transform window expires.                                            | `sim-cast-cooldowns.js`                   |
| ELM-104 | High     | Aura transmute skills do not require their matching active aura and do not consume it.                                                                                                                 | scheduler step rules and post-cast hooks  |
| ELM-105 | High     | Pistol cooldown effects are absent: Purblinding Plasma's consumed Air bullet, Dazing Discharge's five-second next-skill window, and their 33% reductions.                                              | pistol actions and cast cooldowns         |
| ELM-106 | High     | Ripple does not reduce the next non-autoattack Spear skill recharge by 33%.                                                                                                                            | cast follow-ups and cooldowns             |
| ELM-107 | High     | Specialized Elements does not reduce currently recharging weapon skills by 10% after a basic familiar or 33% after an empowered familiar, including ammo recharge.                                     | familiar special actions                  |
| ELM-108 | High     | Tempest overload dwell uses a fixed six seconds natively. Legacy applies Alacrity to the four- or six-second dwell requirement.                                                                        | attunement/overload availability          |
| ELM-109 | High     | Weaver dual-attunement Spear slot 3 does not reset the current primary attunement recharge.                                                                                                            | cast follow-ups                           |
| ELM-110 | High     | Hammer orb skills lack their 480 ms shared internal lockout.                                                                                                                                           | hammer mechanics                          |
| ELM-111 | High     | A Hammer orb skill can be reused while its same-element orb is active. Legacy rejects that cast until Grand Finale consumes the orb or it expires.                                                     | hammer mechanics and step rules           |
| ELM-112 | High     | Grand Finale's native availability check is unreachable behind generic weapon availability and does not enforce the legacy current-attunement/Weaver-compatible-orb requirement.                       | hammer mechanics and step rules           |
| ELM-113 | High     | Spear etchings have no native chain state: etching-to-lesser access, three-other-cast upgrade, Overload Fire/Air/Earth counting as three casts, and reset after lesser/full are absent.                | cast follow-ups and step rules            |
| ELM-114 | Medium   | Evoker's non-Specialized attunement rules diverge: leaving the familiar element should use the short off-attunement recharge, and already-short off-attunement cooldowns should be preserved on swaps. | `sim-attunement-actions.js`               |
| ELM-115 | Medium   | Attunement changes do not trigger shared on-swap sigils. Legacy calls the same swap proc path used for weapon swaps.                                                                                   | swap-shared helpers                       |

## Open: weapon and skill state machines

| ID      | Priority | Missing or divergent behavior                                                                                                                                                                                                                           |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ELM-201 | Critical | Pistol bullet consumption payloads are incomplete: Frostfire Flurry Fire aura/Water vulnerability, Purblinding Plasma Fire burning, Molten Meteor Earth bleeding, Flowing Finesse Water aura/Air superspeed, and Enervating Earth bleeding/Air control. |
| ELM-202 | High     | Raging Ricochet does not grant Might after consuming a Fire bullet.                                                                                                                                                                                     |
| ELM-203 | High     | Frigid Flurry does not turn its projectiles into 20% projectile finishers after consuming a Water bullet.                                                                                                                                               |
| ELM-204 | High     | Frozen Fusillade does not schedule its delayed 0.75-coefficient ice explosion with five Bleeding for eight seconds after consuming Water.                                                                                                               |
| ELM-205 | High     | Shattering Stone does not arm the next three direct hits within ten seconds to apply Bleeding.                                                                                                                                                          |
| ELM-206 | Medium   | Boulder Blast does not add the extra projectile finisher after consuming an Earth bullet.                                                                                                                                                               |
| ELM-207 | High     | Elemental Explosion does not consume all four bullets or grant the aura for the current attunement.                                                                                                                                                     |
| ELM-208 | High     | Grand Finale clears native orb state but does not cancel already-scheduled recurring orb damage.                                                                                                                                                        |
| ELM-209 | High     | Hammer orb damage buffs are incomplete: Fire's 5% strike/condition bonus is not reliably represented in resolver-time state, Air's 15% critical chance is absent, and the one-second post-Grand-Finale linger is absent.                                |
| ELM-210 | Medium   | Native Hammer state does not record which attunement granted an orb, which is needed for Weaver Grand Finale legality.                                                                                                                                  |
| ELM-211 | High     | Seethe does not grant +20% strike damage to the next non-autoattack Spear skill.                                                                                                                                                                        |
| ELM-212 | High     | Energize does not guarantee critical hits for the next non-autoattack Spear skill.                                                                                                                                                                      |
| ELM-213 | High     | Harden does not make the first hit of the next non-autoattack Spear skill a control hit.                                                                                                                                                                |
| ELM-214 | High     | Primordial Stance freezes one element when cast. Legacy determines both primary and secondary effects independently on every tick using the attunements active at that tick.                                                                            |
| ELM-215 | Medium   | Endurance gains declared by skills are absent from native data/progression, including Aquatic Stance and Hare's Agility.                                                                                                                                |

## Open: specialization and trait behavior

| ID      | Priority | Missing or divergent behavior                                                                                                                                                                                             |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ELM-301 | High     | Harmonious Conduit does not grant Swiftness for eight seconds and Stability for four seconds when an overload begins.                                                                                                     |
| ELM-302 | High     | Lucid Singularity does not grant one second of Alacrity on overload hits 1-4 and 4.5 seconds on hit 5.                                                                                                                    |
| ELM-303 | Medium   | Tempest overloads do not contribute three casts to active Spear etchings.                                                                                                                                                 |
| ELM-304 | High     | Elements of Rage is not refreshed on same-element Weaver transitions and each Unravel transition. Native only applies it when Unravel is activated.                                                                       |
| ELM-305 | Medium   | Elemental Attunement triggers on every Weaver transition. Legacy suppresses it when the target equals the old primary attunement.                                                                                         |
| ELM-306 | High     | Elemental Epitome grants a combo aura but does not grant Elemental Empowerment when any aura is gained.                                                                                                                   |
| ELM-307 | High     | Sphere Specialist doubles Spectacular Sphere's manually emitted boons but not the Jade Sphere's built-in boon pulses.                                                                                                     |
| ELM-308 | Medium   | Shattering Ice triggers from field ticks natively; legacy excludes field ticks.                                                                                                                                           |
| ELM-309 | Medium   | Catalyst's three base Elemental Empowerment stacks are assumed from time zero. Legacy begins them at explicit combat start.                                                                                               |
| ELM-310 | High     | Empowering Auras emits independent ten-second applications. Legacy refreshes all current stacks and caps the state at five, so native uptime diverges.                                                                    |
| ELM-311 | High     | Tempestuous Aria emits independent five-second applications. Legacy extends the existing effect by five seconds, capped at ten seconds from the current time.                                                             |
| ELM-312 | High     | Signet of Fire's passive 180 Precision remains active while the signet is recharging. It should be disabled after activation unless Written in Stone is selected.                                                         |
| ELM-313 | Medium   | Several attunement/aura trait procs can occur during setup because native rules lack the legacy explicit-combat-start guards. This includes Sunspot, Flame Expulsion, Pyromancer's Puissance, and aura empowerment paths. |
| ELM-314 | High     | Manually emitted native boons bypass the shared boon-duration scaling applied by legacy effect tracking. This affects multiple core, Tempest, Catalyst, and Evoker trait boons.                                           |

## Open: Evoker familiar details

| ID      | Priority | Missing or divergent behavior                                                                                                                                                              |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ELM-401 | High     | Familiar's Prowess should extend one duration-stacking effect by five seconds up to 15 seconds. Native emits independent five-second applications.                                         |
| ELM-402 | High     | Galvanic Enchantment should arm two Electric Enchantment stacks after every familiar; Lightning Blitz adds its normal one as well. Native only creates direct packets for Lightning Blitz. |
| ELM-403 | High     | Ignite should cycle Burning durations of 2, 0.5, 1, and 1.5 seconds on consecutive uses, resetting after 15 seconds. Native always uses the static first duration.                         |
| ELM-404 | High     | The Fire familiar passive should grant one Might for six seconds when Burning is applied, with a one-second internal cooldown.                                                             |
| ELM-405 | High     | Basic/empowered familiar flip delays and their mutual interruption/cancellation windows are absent.                                                                                        |
| ELM-406 | Medium   | Specialized Elements empowered familiars do not trigger the matching attunement-enter traits.                                                                                              |
| ELM-407 | Medium   | Fox's Fury's extra hit is emitted at cast completion instead of the legacy cast-start plus 560 ms scaled offset.                                                                           |

## Open: encounter assumptions and data

| ID      | Priority | Missing or divergent behavior                                                                                                                                                                                                                              |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ELM-501 | Medium   | Native builds dropped the legacy hitbox-size assumption. Small-hitbox caps are absent for Meteor Shower, Lightning Orb, Frost Storm, Invoke Lightning, Glyph of Storms Air/Water/Earth, and Fiery Whirl; Wildfire also lacks its large-hitbox extra ticks. |
| ELM-502 | Medium   | The legacy `glyphBoonedElementals` assumption and its 70% summon-damage multiplier are absent.                                                                                                                                                             |
| ELM-503 | Low      | The legacy Thorns boss-aura cadence assumption is absent from native configuration.                                                                                                                                                                        |

## Coverage and migration-control failures

| ID      | Priority | Finding                                                                                                                                                                                                                              |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ELM-601 | Critical | `ELEMENTALIST_SKILL_MECHANICS` is empty. Generated skills provide hit packets, but all non-tabular skill behavior depends on broad handwritten hooks, which is why weapon-specific state machines were easy to omit.                 |
| ELM-602 | High     | The trait coverage manifest labels broad sets of traits `implemented` and points them to one specialization smoke test even when individual effects are absent or partial. It is not currently reliable as a migration gate.         |
| ELM-603 | High     | Native/legacy parity has only five short happy-path fixtures—one per specialization—with a 5% aggregate-damage tolerance. It does not exercise cooldown loops, transformed skills, resource cycles, trait branches, or weapon state. |
| ELM-604 | High     | Existing native tests primarily prove that hooks execute, not that each documented effect has the correct trigger, timing, duration, stack behavior, or recharge interaction.                                                        |

## Recommended implementation order

1. Conjure bundle state, Spear etchings/follow-ups, Hammer orb legality/cancellation, and the remaining Pistol bullet state machine.
2. Specialized Elements weapon recharge and the remaining Evoker familiar state/timing rules.
3. Tempest overload timing/Alacrity, Catalyst aura/empowerment behavior, and Weaver dynamic effects.
4. Shared duration scaling, combat-start guards, signet passive state, swap sigils, hitbox assumptions, and endurance data.
5. Replace broad trait smoke-test claims with effect-specific tests and expand parity fixtures around every state machine above.

Each open item should get a focused native regression test and, where the legacy runner can express the scenario, an exact native/legacy parity fixture. Aggregate DPS tolerance should remain a final safety net, not the primary proof of mechanic parity.
