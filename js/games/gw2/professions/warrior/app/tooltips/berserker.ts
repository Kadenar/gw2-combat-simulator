import {
  fromProfile,
  modifierFact,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipAttributeConversion,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { BOON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import { resourceTooltip } from '#gw2/professions/warrior/app/tooltips/shared.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Describe berserker tooltips from the selected balance data. */
export const berserkerTooltips = {
  // Rage extensions are intrinsic to each selected skill rather than a shared category lookup.
  skillFacts: (balanceContext, entity) =>
    entity.durationExtension == null
      ? []
      : [
          skillFact(
            balanceContext,
            entity.id,
            'durationExtension',
            'Base extension while Berserk is active',
            tooltipSeconds
          )
        ],
  skills: {
    [ID.SUNDERING_LEAP]: resourceTooltip,
    [ID.GUN_FLAME]: resourceTooltip,
    [ID.SKULL_GRINDER]: resourceTooltip,
    [ID.ARC_DIVIDER]: resourceTooltip,
    [ID.SCORCHED_EARTH]: resourceTooltip,
    [ID.WILD_BLOW]: resourceTooltip,
    [ID.SHATTERING_BLOW]: resourceTooltip,
    [ID.OUTRAGE]: resourceTooltip,
    [ID.HEAD_BUTT]: resourceTooltip,
    [ID.FLAMING_FLURRY]: resourceTooltip,
    [ID.DECAPITATE]: resourceTooltip,
    [ID.RUPTURING_SMASH]: resourceTooltip,
    // Keep the primal-burst resource facts while exposing the skill's selected boonless-target multiplier.
    [ID.SLICING_MAELSTROM]: (context, entity) => {
      const tooltip = resourceTooltip(context, entity);
      return {
        ...tooltip,
        description: `${tooltip.description} Deal increased damage against the simulator's boonless target.`,
        facts: [
          ...tooltip.facts,
          modifierFact(
            context,
            'warrior.slicing-maelstrom-boonless',
            'factor',
            'Strike damage against a boonless target',
            tooltipFactorChange
          )
        ]
      };
    },
    [ID.RAMPART_SPLITTER]: resourceTooltip,
    [ID.WILD_THROW]: resourceTooltip,
    [ID.BERSERK]: skillTooltip(
      'Enter Berserk, reduce your adrenaline capacity, and unlock primal bursts. Rage skills and eligible traits can extend the active duration.',
      (balanceContext) => [
        ...simulationEffectFacts(
          requireSkillAction(requireSkill(balanceContext.catalog, ID.BERSERK), 'berserk').effects,
          'base duration before trait extensions'
        ).facts,
        profileFact(balanceContext, TRAIT.PRIMAL_RAGE, 'maximumStacks', 'Adrenaline capacity while Berserk')
      ]
    ),
    [ID.BLOOD_RECKONING]: skillTooltip(
      'Gain adrenaline and reset primal-burst recharges when the activation succeeds. Healing is outside combat simulation scope.'
    )
  },
  traits: {
    [TRAIT.PRIMAL_RAGE]: traitTooltip(
      'Unlock Berserk and primal bursts. Primal bursts replace ordinary bursts while Berserk is active.'
    ),
    [TRAIT.BURST_OF_AGGRESSION]: traitTooltip('Entering Berserk grants quickness and fury.'),
    [TRAIT.FATAL_FRENZY]: traitTooltip('Berserk grants power and condition damage.', [
      fromProfile(TRAIT.FATAL_FRENZY, 'attributeBonuses.power', 'Power during Berserk'),
      fromProfile(TRAIT.FATAL_FRENZY, 'attributeBonuses.conditionDamage', 'Condition damage during Berserk')
    ]),
    [TRAIT.SMASH_BRAWLER]: traitTooltip(
      'Gain critical-strike chance during Berserk. Completing primal bursts extends Berserk; Decapitate uses a shorter extension.',
      [
        ['criticalChance', 'Critical chance during Berserk', tooltipPercent],
        ['resourceGain', 'Primal-burst extension', tooltipSeconds],
        ['minimumStacks', 'Decapitate extension', tooltipSeconds]
      ]
    ),
    [TRAIT.LAST_BLAZE]: traitTooltip(
      'Completed Rage skills inflict burning. Rage skills other than Outrage additionally extend an active Berserk window.',
      [['durationExtension', 'Additional Berserk extension', tooltipSeconds]]
    ),
    [TRAIT.SAVAGE_INSTINCT]: outsideScopeTooltip,
    [TRAIT.BLOOD_REACTION]: traitTooltip(
      'Gain ferocity from precision and condition damage from power. The conversion is stronger during Berserk.',
      [
        ['attributeConversion', 'Base attribute gain', tooltipAttributeConversion],
        ['coefficientMultiplier', 'Attribute gain during Berserk', tooltipAttributeConversion]
      ]
    ),
    // Describe each Quickness variant from Heat the Soul's own selected effects.
    [TRAIT.HEAT_THE_SOUL]: (context) => ({
      description:
        'Completed primal bursts grant quickness, fury, and might to the party. Decapitate grants a shorter quickness duration.',
      facts: (tooltipProfile(context, TRAIT.HEAT_THE_SOUL).effects ?? []).flatMap(
        (effect) =>
          simulationEffectFacts(
            [effect],
            effect.name === 'Decapitate quickness'
              ? 'Decapitate'
              : effect.name === BOON.QUICKNESS
                ? 'other primal bursts'
                : ''
          ).facts
      )
    }),
    [TRAIT.DEAD_OR_ALIVE]: outsideScopeTooltip,
    [TRAIT.BLOODY_ROAR]: traitTooltip(
      'Deal increased strike damage during Berserk. Entering Berserk grants resistance.',
      [fromProfile(TRAIT.BLOODY_ROAR, 'damageMultiplier', 'Strike damage during Berserk', tooltipFactorChange)]
    ),
    [TRAIT.KING_OF_FIRES]: traitTooltip(
      'Burning lasts longer. Eligible critical hits grant a fire aura; completing a Berserker skill detonates an active aura to strike and burn the target.',
      [
        ['internalCooldown', 'Aura-grant cooldown', tooltipSeconds],
        ['durationMultiplier', 'Burning duration', tooltipPercent]
      ]
    ),
    [TRAIT.ETERNAL_CHAMPION]: outsideScopeTooltip
  }
} satisfies ProfessionTooltips<WarriorSkill>;
