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

## Guardian

- [ ] **Fervid Conviction confirmation.** The supplied two Ashes charges for self, one per ally, and 10-second lifetime
      are implemented. The self/ally split still needs independent confirmation. See
      [Firebrand traits](../js/games/gw2/professions/guardian/specializations/firebrand/traits/index.ts).
- [ ] **Condition Firebrand preset.** Its [manifest entry](../data/gw2/builds/guardian/manifest.json) remains marked not
      up to date while the Fervid split is provisional. Reassess that flag and its generated results after confirmation
      or correction.
- [ ] **Smite Condition.** The skill is absent from the
      [Core slot-skill catalog](../js/games/gw2/professions/guardian/core/skills/slot-skills.ts). Its new cast time is
      unspecified. The supplied conditional damage coefficient is known, but the skill and its condition-removal trigger
      still need implementation if supported.

The six supplied Firebrand follow-up values are implemented. Their numerical implementation is no longer pending;
Fervid's confirmation remains open.

## Necromancer

Current limitations are recorded in the [Core tooltips](../js/games/gw2/professions/necromancer/app/tooltips/core.ts).

- [ ] **Rending Claws.** Add recharge reduction for other axe skills against low-health enemies. Need reduction amount
      and the new trigger's health threshold and application rules. The obsolete extra Vulnerability is already removed.
- [ ] **Ghastly Claws.** Add low-health bonus damage. Need the bonus amount and qualifying health threshold. Current
      damage has no new execution bonus.
- [ ] **Locust Swarm.** Replace the old life-siphon model with attached swarms dealing periodic strike damage. Need
      strike coefficients, swarm lifetime, pulse timing, and repeat-hit/attachment rules. Confirm retained Swiftness
      behavior. The simulator currently retains the earlier siphon and party Swiftness model.
- [ ] **Soul Grasp.** Implement the bouncing projectile and life force on return. Need damage, bounce count and
      repeat-target rules, return timing, and life force per enemy struck. The simulator currently retains its previous
      Vulnerability and life-force model.
- [ ] **Signet of Vampirism.** Replace the old active siphon model with consumable self charges. Need charge count,
      lifetime, consumption interval/rules, and siphon damage tuning. Healing remains outside combat simulation scope.
- [ ] **Anguish against disabled, non-defiant targets.** The capped bonus and defiant-target maximum are implemented for
      Anguish and its Summon Spirits attacks. Temporary target disability is not tracked by this implementation, so the
      separate disabled-target route to the maximum remains unsupported. See
      [Ritualist skills](../js/games/gw2/professions/necromancer/specializations/ritualist/skills/index.ts).

## Ranger

- [ ] **Apex Predator.** Renamed in the catalog and retired Oppressive Superiority bonuses removed. Need frenzy
      coefficients, hit count/timing, the stronger Beast-skill variant, and trigger limits before implementing its
      attacks. Soulbeast presets remain marked not up to date. See
      [Soulbeast traits](../js/games/gw2/professions/ranger/specializations/soulbeast/traits/index.ts).
- [ ] **Hunter's Tactics.** Need the duration and refresh rules for the new bonus after a flanking hit. The simulator
      retains the previous continuous flanking check, using defiance as its proxy. See
      [Skirmishing traits](../js/games/gw2/professions/ranger/core/traits/skirmishing/index.ts).
- [ ] **Strength of the Pack.** Player strikes now grant Might to both player and active pet. Need the pet damage bonus
      and confirmation of how it transfers in Beastmode. The damage bonus is not yet applied. See
      [Core slot skills](../js/games/gw2/professions/ranger/core/skills/slot-skills.ts).
- [ ] **Disabled targets.** Poison Volley's impairment/defiance extension and Unleashed Savage Shock Wave's capped
      defiance bonus are implemented. Temporary generic disabled-target windows remain unsupported.

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

- [ ] **Deft Initiation.** Need Might/Vulnerability stacks and durations, cooldown, and confirmation of refresh and
      consumption rules. Combat entry and movement arm one direct-strike reward, but its payload remains inactive.
- [ ] **Feline Grace.** Need Swiftness duration, cooldown, and qualifying movement skills. Specter well classification
      and Daredevil dodge variants need confirmation. Improved movement-speed tuning is also unspecified and outside
      combat scope. No Swiftness is granted until duration is confirmed.
- [ ] **Opportune Opening.** Need damage percentage, stacking, condition-damage coverage, and Cripple duration. The
      movement-impairment predicate is implemented, but damage and Cripple remain inactive.
- [ ] **Don't Stop.** Need endurance per actual Swiftness application and cooldown. Resource handling exists, but its
      grant remains zero. Player condition removal is outside scope.
- [ ] **Twin Fangs.** Need critical-chance window duration and confirmation of refresh rules. The trigger uses defiance
      as the existing flanking proxy. No critical-chance window is granted until duration is confirmed. The unchanged
      critical-damage bonus still applies. See
      [Critical Strikes](../js/games/gw2/professions/thief/core/traits/critical-strikes/index.ts).
- [ ] **Hard to Catch.** Need Resistance duration on Steal and replacements. The old movement-endurance reward is
      removed. No Resistance is granted until duration is confirmed.
- [ ] **Sharp Initiation.** Need coefficient, weapon-strength basis, critical-hit eligibility, damage ownership, and
      cooldown relationship with Deft Initiation. The extra strike remains neutral. Official trait ID and icon also need
      confirmation.
- [ ] **Endurance Training and Assassin's Reward.** Need Vigor duration and evade-trigger rules, plus healing tuning.
      Successful incoming evades and healing remain outside combat scope.
- [ ] **Axe flight calibration.** The known velocity increase scales the existing release-to-landing flight time.
      Confirm flight endpoints against a post-patch recording; outgoing melee impacts retain their action-tick timings.
      See [axe lifecycle](../js/games/gw2/professions/thief/core/mechanics/axes.ts).
- [ ] **Deadeye coverage.** Melee Mark pathing and simultaneous secondary targets are outside the positional and
      single-target model. Malicious Death's Judgment uses full captured-malice damage regardless of mark eligibility;
      the resource-spend path still requires a hit on the marked target.
- [ ] **Thief presets.** Builds using Twin Fangs or other unresolved new traits cannot be treated as validated final
      benchmarks. Antiquary's existing artifact/rotation review remains open. Recorded rotations are preserved. See
      [Thief manifest](../data/gw2/builds/thief/manifest.json).
- [ ] **Antiquary rotation warnings.** Four preserved presets emit 12 warnings after the update. Power Sword/Pistol
      attempts three Tactical Strikes without stealth; Condition Dagger/Dagger attempts one Backstab without stealth.
      Condition Scepter/Dagger has one unavailable artifact and three broken-chain actions. Condition Alacrity
      Scepter/Dagger has three unavailable artifacts and one broken-chain action. These presets remain not up to date;
      their warnings are not suppressed.

## Warrior

- [ ] **Fan of Fire.** Need first-hit and repeat-hit coefficients and Burning payloads. The previous three-arrow model
      remains until exact values are supplied. See
      [longbow skills](../js/games/gw2/professions/warrior/core/skills/weapons/longbow.ts).
- [ ] **Smoldering Arrow.** Need new Burning stacks and duration. Burning is not yet added.
- [ ] **Imminent Threat.** The skill is absent. Need adrenaline and barrier for the first and subsequent foes, plus
      offensive-boon removal count and selection rules. Barrier and multi-enemy scaling are outside current combat
      scope; the single-target adrenaline grant still needs implementation.
- [ ] **Featherfoot Grace.** The skill is absent. Need added Resolution duration before supporting its boon grant.
- [ ] **Sight Beyond Sight.** The skill is absent. Defensive-boon removal and player cleansing are outside current
      scope. No old guaranteed-critical-hit bonus is implemented to remove.
- [ ] **Enemy boons.** Destruction of the Empowered's published scaling and cap are recorded. Break Enchantments uses
      its updated base strike and charges. Their enemy-boon branches remain inactive because targets have no simulated
      boons. See [Discipline traits](../js/games/gw2/professions/warrior/core/traits/discipline/index.ts) and
      [Spellbreaker skills](../js/games/gw2/professions/warrior/specializations/spellbreaker/skills/index.ts).
- [ ] **Call of Valor.** Party/squad prioritization is not distinguished by the current allied-recipient model.
- [ ] **Longbow Berserker and Paragon presets.** Remain not up to date until Fan of Fire and Smoldering Arrow are
      complete. Recorded rotations are unchanged. See [Warrior manifest](../data/gw2/builds/warrior/manifest.json).

## Engineer

- [ ] **Rocket Burst.** Need its official skill ID, coefficient, rocket count, cast time, and the duration and
      consumption rules for the Rifle Burst flip granted by Net Shot and Overcharged Shot. The rifle still uses its
      previous attacks; the new flip and volley are not implemented. See
      [rifle skills](../js/games/gw2/professions/engineer/core/skills/weapons/rifle.ts).
- [ ] **Grenadier.** Need the explosion-damage percentage and confirmation of damage-type coverage. The existing
      explosion modifier remains neutral; the preview's assumed 5% was not promoted. The healing-triggered barrage
      remains. See [Explosives traits](../js/games/gw2/professions/engineer/core/traits/explosives/index.ts).
- [ ] **Grenade radius.** The baseline increase to 180 is known. The single-target model does not represent explosion
      radii or additional targets, so it has no simulated effect.
- [ ] **Rocket Kick.** The skill is absent. Its confirmed PvE cooldown is 20 seconds. Need the remaining skill data and
      evade duration before adding it; backward movement, incoming attacks, and stun breaks are outside current scope.
- [ ] **Toss Elixir S, Elixir X, and Hard Light Arena.** These skills are absent. Their confirmed cooldowns are 30, 60,
      and 30 seconds, respectively. Supporting their full behavior remains pending. Elixir X's final cooldown is 60,
      replacing the struck-through 75-second preview value.
- [ ] **Engineer presets.** Builds selecting Grenadier or using rifle remain not up to date while these reworks are
      incomplete. Recorded rotations are unchanged. See [Engineer manifest](../data/gw2/builds/engineer/manifest.json).

## Mesmer

- [ ] **Illusionary Leap.** Need the clone attack's Immobilized duration. Its previous initial strike still has no
      control payload, so the new Immobilized application remains unimplemented. See
      [sword skills](../js/games/gw2/professions/mesmer/core/skills/weapons/sword.ts).
- [ ] **Disenchant.** Need the official ID, cast time, strike coefficient, boonless-target bonus, boon-removal count,
      and flip duration/consumption rules. Swap's retired Immobilized application is removed; its Disenchant follow-up
      is not yet implemented. Enemy boon removal is outside the current model.
- [ ] **Phantasmal Disenchanter.** Focus placement is live. Need the new initial player projectile's damage and impact
      timing; it is not yet added. Enemy boon removal and Focal Feedback's boon transfer are outside the target model.
      See [focus skills](../js/games/gw2/professions/mesmer/core/skills/weapons/focus.ts).
- [ ] **Phantasmal Warden.** Utility placement and eight attacks are live. Confirm its new attack cadence and clone
      conversion timing, including Chronophantasma repeats. The eight retained attacks use the old cadence, and old
      conversion clocks remain. Spawning at the player is not distinguished by the positional model. See
      [utility skills](../js/games/gw2/professions/mesmer/core/skills/slot-skills.ts).
- [ ] **Chronophantasma.** Need the resummoned phantasm condition-duration reduction and whether it covers triggered
      conditions as well as native payloads. The strike multiplier is updated; condition durations remain unchanged. See
      [Chronomancer traits](../js/games/gw2/professions/mesmer/specializations/chronomancer/traits/index.ts).
- [ ] **Inspiration support effects.** Focal Feedback and Sympathetic Visage use the new tiers. Enemy-boon transfer and
      allied cleansing are outside the current combat model. The existing Focus recharge reduction is retained; confirm
      whether the new Focal Feedback retains it.
- [ ] **Mesmer presets.** Builds affected by unresolved sword, Focus, Warden, or Chronophantasma mechanics remain not up
      to date. Three preserved power rotations emit 56 warnings after the placement swap. Disenchanter requires Focus;
      skipped casts also leave later Power Spike uses without an active Mantra of Pain. These warnings are retained, and
      the results are not validated final benchmarks. Loadout and rotation review remains pending. See
      [Mesmer manifest](../data/gw2/builds/mesmer/manifest.json).

- Chronomancer, Power (Greatsword-Dagger/Sword): 21 warnings.
- Chronomancer, Power (Spear-Dagger/Sword): 19 warnings.
- Virtuoso, Power (Spear / Greatsword): 16 warnings.

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
