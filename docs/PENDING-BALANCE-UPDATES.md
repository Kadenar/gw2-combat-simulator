# Pending balance updates

Status as of November 10, 2026, after the supplied Elementalist, Guardian, Necromancer, Ranger, Revenant, Thief,
Warrior, Engineer, and Mesmer final notes and the follow-up Firebrand values.

PvE changes only. PvP/WvW-only changes are excluded.

This tracks unresolved work and confirmations. Code remains the source of truth. All nine professions have received
final notes. The active balance preview is retired; unresolved mechanics remain listed below.

## Elementalist

Owner: [staff skills](../js/games/gw2/professions/elementalist/core/skills/weapons/staff.ts).

- [ ] **Fire Blast.** Replace and rename Flame Burst. Need the new strike coefficient, Burning stacks and duration, and
      cast/impact timing. Confirm which old effects survive. The catalog still contains Flame Burst and its old payload.
- [ ] **Lightning Surge.** Implement the ground-targeted initial bolt and delayed stronger strike. Need both
      coefficients, the repeat delay, and Blindness duration. The simulator still uses the old single strike.
- [ ] **Shock Wave.** Implement the ground-targeted impact and Daze. Need damage and control durations, plus
      confirmation of retained Bleeding and combo behavior. The simulator still uses the old projectile payload.
- [ ] **Eruption.** Add Cripple pulses before detonation. Need pulse interval, first pulse, number of applications, and
      Cripple duration. Current Cripple applies only at detonation.
- [ ] **Baseline attunement boons.** Add the new innate boon grant for each element and change Elemental Attunement to
      extend/share those grants. Need baseline boon identities, stacks, durations, and the trait's duration increase.
      The [Arcane trait implementation](../js/games/gw2/professions/elementalist/core/traits/arcane/index.ts) still owns
      the previous trait-only grants.

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

- [ ] **Apex Predator.** Renamed in the catalog and retired Oppressive Superiority bonuses removed. Need frenzy
      coefficients, hit count/timing, the stronger Beast-skill variant, and trigger limits before implementing its
      attacks. Soulbeast presets remain marked not up to date. See
      [Soulbeast traits](../js/games/gw2/professions/ranger/specializations/soulbeast/traits/index.ts).
- [ ] **Hunter's Tactics damage bug.** The refreshing 8-second critical-chance window is implemented. The damage
      multiplier remains neutral to match the supplied November 10 reports. Recheck after a game fix. See
      [Skirmishing traits](../js/games/gw2/professions/ranger/core/traits/skirmishing/index.ts).

- [ ] **Untamed benchmark rotations.** Original recorded rotations are preserved. The new pet cooldowns cause four
      unavailable-ambush warnings in power Hawk/Beastmastery Hammer-Sword/Axe and one in condition Quickness
      Axe/Dagger-Dagger/Torch. Updated benchmark recordings are needed; do not insert waits or otherwise rewrite these
      rotations to clear warnings. Both presets remain marked not up to date in the
      [Ranger manifest](../data/gw2/builds/ranger/manifest.json).

## Revenant

- [ ] **Frigid Blitz.** Need the new area-strike coefficient, Chilled and Torment payloads, and teleport/impact timing.
      The simulator retains the previous two-hit model. See
      [axe skills](../js/games/gw2/professions/revenant/core/skills/weapons/axe.ts).
- [ ] **Forced Engagement.** Taunt is removed. Need Cripple duration, tether duration and distance threshold, pull
      rules, and additional defiance damage. Existing strike and Slow remain until their retention is confirmed. See
      [Dwarf skills](../js/games/gw2/professions/revenant/core/skills/legends/dwarf.ts).
- [ ] **Balance in Discord.** Need endurance per trigger and confirmation of any combat restriction. The legend-swap
      trigger exists but grants zero until confirmed. Alliance Tactics is still absent.
- [ ] **Rise to the Occasion.** Need strike-damage percentage and stacking. The old Empire Divided Power and Leviathan
      Strength bonuses are removed. The new endurance-gated damage rule remains neutral until confirmed.
- [ ] **Friend of the Luxons.** Need damage bonus, duration, stacking/refresh rules after Luxon skills, plus
      Archemorus's Strike coefficient, cooldown, energy cost, cast/impact timing, and knockdown duration. Neither effect
      is implemented.
- [ ] **Heated Rivalry.** The two-skill PvE threshold is recorded. Faction counters, Alliance Tactics recharge, and the
      next opposite-faction skill's energy refund still need implementation with the missing Kurzick bar and Alliance
      Tactics. Confirm counter reset and refund consumption rules.
- [ ] **Friend of the Kurzicks.** Shield of Saint Viktor is absent. Need its cooldown, energy cost, cast time, barrier,
      and dome duration, plus the heal after Kurzick skills. Barrier, incoming projectiles, and healing are outside the
      combat model, but any resource and activation behavior still needs implementation.
- [ ] **New Vindicator identities.** Grandmasters use local IDs and the specialization icon until official IDs and icons
      are confirmed. See [trait IDs](../js/games/gw2/professions/revenant/data/ids.ts).
- [ ] **Vindicator presets.** Saved trait choices now use the live layout. Both presets remain marked not up to date
      while the new mechanics and tuning are incomplete. Recorded rotations are preserved. See
      [Revenant manifest](../data/gw2/builds/revenant/manifest.json).
- [ ] **Gladiator's Defense.** Need block duration, retaliation coefficient, successful-block bonus, Weakness duration,
      and Dwarf Aegis duration. The previous strike and boon model remains. Incoming attacks are outside scope, so the
      successful-block branch cannot be inferred from an ordinary simulation. See
      [Entity skills](../js/games/gw2/professions/revenant/specializations/conduit/skills/entity-skills.ts).
- [ ] **Other Revenant presets.** Presets whose recorded rotations use Frigid Blitz, Forced Engagement, or Gladiator's
      Defense remain marked not up to date until those reworks are complete. Their metrics reflect the disclosed
      incomplete model, not validated post-patch benchmarks.
- [ ] **Centaur empowerment coverage.** Tranquil consumption/replenishment and empowered Energy Expulsion Stability are
      implemented. Existing gaps remain for empowered Natural Harmony endurance and Protective Solace Protection.
      Release Potential: Monk's tablet/Tranquil interaction also needs implementation. See
      [Centaur skills](../js/games/gw2/professions/revenant/core/skills/legends/centaur.ts).

Missing Revenant values were not supplied in the follow-up. The old preview's assumed endurance and damage bonuses were
not promoted to live values. Vindicator mechanics are owned by
[live traits](../js/games/gw2/professions/revenant/specializations/vindicator/traits/index.ts).

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

## Mesmer

- [ ] **Inspiration support effects.** Focal Feedback and Sympathetic Visage use the new tiers. Enemy-boon transfer and
      allied cleansing are outside the current combat model. The existing Focus recharge reduction is retained; confirm
      whether the new Focal Feedback retains it.
- [ ] **Mesmer presets.** The current skill IDs resolve the previous equipment and mantra warnings. Preserved rotations
      now simulate without warnings, but affected presets still need post-patch loadout and rotation review. Their
      metrics describe the current model. See the [Mesmer manifest](../data/gw2/builds/mesmer/manifest.json) and
      [patch contracts](../tests/games/gw2/professions/mesmer/patch-contracts.test.js).

## Unresolved details outside the current combat model

These are coverage limits or missing reference values, not requests to add player-health or incoming-damage simulation.

Warrior's Destruction of the Empowered and Break Enchantments enemy-boon effects are outside scope because simulated
enemies have no boons. See [Discipline traits](../js/games/gw2/professions/warrior/core/traits/discipline/index.ts) and
[Spellbreaker skills](../js/games/gw2/professions/warrior/specializations/spellbreaker/skills/index.ts).

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
| Ranger, Light on your Feet    | Movement-speed amount and duration are unspecified and outside combat scope. The retired shortbow and evade combat bonuses have been removed.                                                      |
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
