import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  tooltipPercent,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as SOULBEAST } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';

/** Compose soulbeast descriptions using the selected catalog's balance data. */
export const soulbeastTooltips = {
  skills: {
    [ID.BEASTMODE]: skillTooltip(
      'Merge with your active pet, replace its commands with Beastmode skills, and gain its archetype attributes. The pet stops acting independently while merged. Trigger applicable Beastmode traits.'
    ),
    [ID.LEAVE_BEASTMODE]: skillTooltip(
      "Leave Beastmode, restore your pet's independent actions and command skills, and remove the merged archetype attributes. Trigger applicable Beastmode traits."
    ),
    [ID.ONE_WOLF_PACK]: skillTooltip(
      'Qualifying player strikes trigger a delayed additional strike during the stance. The echo cannot trigger itself. Leader of the Pack extends the stance and shares it with configured allies for 50% of your duration.',
      (balanceContext) => [
        profileFact(balanceContext, SOULBEAST.oneWolfPack, 'duration', 'Base stance duration', tooltipSeconds),
        profileFact(balanceContext, SOULBEAST.oneWolfPack, 'internalCooldown', 'Minimum echo interval', tooltipSeconds),
        ...simulationEffectFacts(tooltipProfile(balanceContext, SOULBEAST.oneWolfPack).effects, 'per echo').facts
      ]
    ),
    [ID.VULTURE_STANCE]: skillTooltip(
      'Qualifying player strikes inflict poison and grant might during the stance, subject to its trigger interval. Leader of the Pack extends the stance and shares it with configured allies for 50% of your duration.',
      (balanceContext) => [
        profileFact(balanceContext, SOULBEAST.vultureStance, 'duration', 'Base stance duration', tooltipSeconds),
        profileFact(balanceContext, SOULBEAST.vultureStance, 'internalCooldown', 'Trigger interval', tooltipSeconds),
        ...simulationEffectFacts(tooltipProfile(balanceContext, SOULBEAST.vultureStance).effects, 'per trigger').facts
      ]
    )
  },
  traits: {
    [TRAIT.ELEVATED_BOND]: traitTooltip(
      'Unlock Soulbeast, dagger, stances, and Beastmode. Merging replaces the pet with beast skills and grants attributes from its archetype.'
    ),
    [TRAIT.FURIOUS_STRENGTH]: traitTooltip('Deal increased strike damage while fury is active.', [
      fromProfile(TRAIT.FURIOUS_STRENGTH, 'damageIncrease', 'Strike damage with fury', tooltipPercent)
    ]),
    [TRAIT.TWICE_AS_VICIOUS]: traitTooltip('Control effects temporarily increase strike and condition damage.', [
      fromProfile(TRAIT.TWICE_AS_VICIOUS, 'damageIncrease', 'Strike damage', tooltipPercent),
      fromProfile(TRAIT.TWICE_AS_VICIOUS, 'conditionDamageIncrease', 'Condition damage', tooltipPercent)
    ]),
    [TRAIT.FRESH_REINFORCEMENT]: outsideScopeTooltip,
    [TRAIT.LIVE_FAST]: traitTooltip('The first hit of your merged Beast Ability grants fury and quickness.'),
    [TRAIT.UNSTOPPABLE_UNION]: traitTooltip('Entering or leaving Beastmode grants protection.'),
    [TRAIT.SECOND_SKIN]: outsideScopeTooltip,
    [TRAIT.ESSENCE_OF_SPEED]: traitTooltip('Receiving quickness extends your other active boons.', [
      ['duration', 'Boon extension', tooltipSeconds],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds]
    ]),
    [TRAIT.PREDATORS_CUNNING]: traitTooltip(
      'Poison applications trigger an additional strike that cannot critically strike.'
    ),
    [TRAIT.ETERNAL_BOND]: outsideScopeTooltip,
    // Explain how the shared stance benefits allies as well as showing its reduced duration.
    [TRAIT.LEADER_OF_THE_PACK]: traitTooltip(
      'Stances last longer and share a fraction of their extended duration with nearby allies. Allied hits trigger One Wolf Pack follow-up strikes and Vulture Stance effects, with a separate trigger cooldown for each ally.',
      (balanceContext, id) => [
        profileFact(balanceContext, id, 'durationMultiplier', 'Stance duration', tooltipFactorChange),
        profileFact(
          balanceContext,
          id,
          'sharedDurationMultiplier',
          'Allied stance duration',
          (value) => `${tooltipPercent(value)} of your extended duration`
        )
      ]
    ),
    [TRAIT.OPPRESSIVE_SUPERIORITY]: traitTooltip(
      'Gain strike damage and condition duration when the target has a lower health percentage than you. Player health remains full in combat.',
      [
        fromProfile(TRAIT.OPPRESSIVE_SUPERIORITY, 'damageMultiplier', 'Strike damage', tooltipFactorChange),
        ['conditionDurationBonus', 'Condition duration', tooltipPercent]
      ]
    )
  }
} satisfies ProfessionTooltips;
