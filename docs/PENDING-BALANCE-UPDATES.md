# Pending balance updates

Status as of November 10, 2026, after the supplied Elementalist, Guardian, Necromancer, Ranger, Revenant, Thief,
Warrior, Engineer, and Mesmer final notes and the follow-up Firebrand values.

This tracks unresolved work and confirmations. Code remains the source of truth. All nine professions have received
final notes. The active balance preview is retired; unresolved mechanics remain listed below.

## Necromancer

Current limitations are recorded in the [Core tooltips](../js/games/gw2/professions/necromancer/app/tooltips/core.ts).

- [ ] **Signet of Vampirism.** Replace the old active siphon model with consumable self charges. The
      [live API](https://api.guildwars2.com/v2/skills/21762) and `20261110-160650.zevtc` establish the self-charge
      grant, lifetime, and consumption interval. Siphon Power scaling remains unverified; these logs contain no
      separately identified Signet damage. `20261110-165650.zevtc` adds three active golem casts with all charges
      consumed; target-health loss supports siphon damage despite the missing damage events. The earlier three weapon
      golem logs record only the passive. Healing remains outside combat simulation scope.
- [ ] **Anguish against disabled, non-defiant targets.** The capped bonus and defiant-target maximum are implemented for
      Anguish and its Summon Spirits attacks. Temporary target disability is not tracked by this implementation, so the
      separate disabled-target route to the maximum remains unsupported. See
      [Ritualist skills](../js/games/gw2/professions/necromancer/specializations/ritualist/skills/index.ts).
- [ ] **Anguish opening barrage validation.** The supplied power Ritualist log `20261110-102344.zevtc` records opening
      hits substantially above the current model, while commanded Anguish attacks are close. Isolate the opening
      coefficient and modifiers before replacing the patch-note value in
      [Ritualist skills](../js/games/gw2/professions/necromancer/specializations/ritualist/skills/index.ts). This golem
      log does not resolve the disabled, non-defiant target case above.

## Ranger

- [ ] **Hunter's Tactics damage bug.** The refreshing 8-second critical-chance window is implemented. The damage
      multiplier remains neutral to match the supplied November 10 reports. Recheck after a game fix. See
      [Skirmishing traits](../js/games/gw2/professions/ranger/core/traits/skirmishing/index.ts).

- [ ] **Untamed benchmark rotations.** Original recorded rotations are preserved. The new pet cooldowns cause four
      unavailable-ambush warnings in power Hawk/Beastmastery Hammer-Sword/Axe and one in condition Quickness
      Axe/Dagger-Dagger/Torch. Updated benchmark recordings are needed; do not insert waits or otherwise rewrite these
      rotations to clear warnings. Both presets remain marked not up to date in the
      [Ranger manifest](../data/gw2/builds/ranger/manifest.json).

## Revenant

- [ ] **Frigid Blitz.** Confirm the new strike coefficient; the previous final-strike coefficient remains. See
      [axe skills](../js/games/gw2/professions/revenant/core/skills/weapons/axe.ts).
- [ ] **Friend of the Luxons.** Confirm damage stacking and refresh behavior against combat logs. See
      [live traits](../js/games/gw2/professions/revenant/specializations/vindicator/traits/index.ts).
- [ ] **Heated Rivalry.** Faction counters, Alliance Tactics recharge, and the next opposite-faction skill's energy
      refund still need implementation. Confirm counter reset and refund consumption rules.
- [ ] **Shield of Saint Viktor integration.** Its light combo field and any interaction with Heated Rivalry remain
      unimplemented.
- [ ] **Vindicator trait identities.** Replace local grandmaster IDs and update moved trait IDs from the live API.
- [ ] **Centaur empowerment coverage.** Implement empowered Natural Harmony endurance, empowered Protective Solace
      Protection, and Release Potential: Monk's tablet/Tranquil interaction. See
      [Centaur skills](../js/games/gw2/professions/revenant/core/skills/legends/centaur.ts).

## Thief

The Acrobatics layout and Twin Fangs trigger now belong to live Core. Unknown bonuses use neutral values instead of the
old preview assumptions. See [Acrobatics traits](../js/games/gw2/professions/thief/core/traits/acrobatics/index.ts).

- [ ] **Deft Initiation.** Confirm refresh and consumption edge cases against combat logs.
- [ ] **Feline Grace.** Daredevil dodge variants need confirmation. Specter wells qualify as shadowsteps.
- [ ] **Opportune Opening.** Confirm damage stacking and condition-damage coverage.
- [ ] **Sharp Initiation.** Confirm weapon strength basis, critical-hit eligibility, damage ownership, and cooldown
      relationship with Deft Initiation against combat logs. Official trait ID and icon also need confirmation.
- [ ] **Axe flight calibration.** The known velocity increase scales the existing release-to-landing flight time.
      Confirm flight endpoints against a post-patch recording; outgoing melee impacts retain their action-tick timings.
      See [axe lifecycle](../js/games/gw2/professions/thief/core/mechanics/axes.ts).
- [ ] **Deadeye coverage.** Melee Mark pathing and simultaneous secondary targets are outside the positional and
      single-target model. Malicious Death's Judgment uses full captured-malice damage regardless of mark eligibility;
      the resource-spend path still requires a hit on the marked target.

## Unresolved details outside the current combat model

These are coverage limits or missing reference values, not requests to add player-health or incoming-damage simulation.

| Change                        | Remaining limitation                                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elementalist, Chain Lightning | Instant chaining between enemies is not represented by the current single-target payload.                                                                                                          |
| Elementalist, Signet of Water | The skill is absent from the Core catalog. Its healing, cleansing, revive removal, and outgoing-healing passive are outside the current combat model. The new passive percentage was not supplied. |
| Guardian, Orb of Wrath        | Increased projectile speed has no supplied value and is not represented by the current impact model.                                                                                               |
| Guardian, Chains of Light     | Striking four additional enemies is not represented by the current single-target payload.                                                                                                          |
| Guardian, Zealot's Resolution | Placing the symbol at the enemy instead of the player is not distinguished by the current positional model.                                                                                        |
| Firebrand, Bastion            | Increased Protection effectiveness has no supplied percentage. Incoming damage is not simulated.                                                                                                   |
| Firebrand, Imbued Haste       | The condition-damage bonus is implemented. Outgoing-healing and incoming-damage modifiers remain unspecified and unmodeled.                                                                        |
| Firebrand, Deliverance        | Resolve passive retention concerns healing. Eternal Oasis healing over time has no supplied amount, duration, or interval and is not simulated.                                                    |
| Necromancer, Locust Swarm     | Healing allies around the user is not simulated; its new healing tuning was not supplied.                                                                                                          |
| Ranger, Hidden Barbs          | Shortbow piercing additional enemies is outside the single-target model.                                                                                                                           |
| Ranger, Light on your Feet    | Movement speed is outside combat scope. The evade-triggered strike damage and condition duration bonuses remain; shortbow-specific bonuses have been removed.                                      |
| Reaper, Augury of Death       | Healing changes are outside scope. The amount of healing reduction for each additional target was not supplied.                                                                                    |

## Existing preset flags needing review

The [Elementalist manifest](../data/gw2/builds/elementalist/manifest.json) also retains these not-up-to-date flags.
Their specific blockers are not recorded in the manifest; the latest numerical updates did not establish that they were
resolved.

- [ ] Tempest, Power Alacrity Hammer, Fresh Air.
- [ ] Tempest, Condition Alacrity Scepter/Warhorn.
- [ ] Catalyst, Condition Quickness Pistol/Warhorn.
- [ ] Catalyst, Inferno Scepter/Dagger.
- [ ] Evoker, Power Quickness Hare Scepter/Dagger.
- [ ] Evoker, Inferno Fox Specialized Elements Scepter/Focus.

The struck-through Unholy Feast targeting change was withdrawn and is not pending. Cascading Corruption's withdrawn
strike-damage reduction is also not pending.
