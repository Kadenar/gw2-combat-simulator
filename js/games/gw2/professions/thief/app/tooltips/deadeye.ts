import { MODIFIER_EFFECT_ICONS, tooltipFactIcon } from '#gw2/app/shared/icons.js';
import {
  fromModifier,
  fromProfile,
  fromSkill,
  maximumBonusFact,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipFactorChange,
  tooltipHasTrait,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { stealthAttack } from '#gw2/professions/thief/app/tooltips/shared.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { STOLEN_SKILL_STEALTH_MALICE } from '#gw2/professions/thief/data/stolen-skills.js';

// Maleficent Seven replaces the base cap. Both builds gain malice once per initiative skill.
const deadeyesMarkTooltip: DescribeSimulationTooltip = skillTooltip(
  'Mark your target. Initiative skills gain malice once per use when they hit your mark, with extra malice on a critical hit. Shadowstep to the target with a main-hand dagger, sword, spear, or staff. Lose your malice when the mark expires or you mark a different target.',
  (context, skill, build) => [
    profileFact(
      context,
      tooltipHasTrait(context, build, TRAIT.MALEFICENT_SEVEN) ? TRAIT.MALEFICENT_SEVEN : TRAIT.DEADEYES_GAZE,
      'maximumStacks',
      'Maximum malice'
    ),
    profileFact(context, TRAIT.DEADEYES_GAZE, 'resourceGain', 'Malice gained on hit'),
    profileFact(context, TRAIT.DEADEYES_GAZE, 'playerStacks', 'Malice gained on critical hit'),
    { ...skillFact(context, skill.id, 'duration', 'Duration', tooltipSeconds), icon: MODIFIER_EFFECT_ICONS.Lifetime }
  ]
);

const deadeyeMercyTooltip: DescribeSimulationTooltip = skillTooltip(
  "Consume current malice, restore initiative, and recharge Deadeye's Mark. Clears the Maleficent Seven cycle so it can trigger again.",
  [
    fromSkill(ID.MERCY, 'initiativeRefund', 'Base initiative restored'),
    fromSkill(ID.MERCY, 'initiativePerMalice', 'Additional initiative per malice')
  ]
);

const deadeyeShadowFlareTooltip: DescribeSimulationTooltip = skillTooltip(
  'Create a damaging field and temporarily unlock Shadow Swap. Its strikes deal increased damage against your active mark.',
  [
    fromSkill(ID.SHADOW_FLARE, 'flipDuration', 'Shadow Swap window', tooltipSeconds),
    fromModifier('thief.shadow-flare-marked', 'factor', 'Strike damage against your mark', tooltipFactorChange)
  ]
);

const deadeyeShadowSwapTooltip: DescribeSimulationTooltip = skillTooltip(
  'Consume the Shadow Flare follow-up and shadowstep to the field. Its strike deals increased damage against your active mark.',
  [fromModifier('thief.shadow-swap-marked', 'factor', 'Strike damage against your mark', tooltipFactorChange)]
);

const deadeyeShadowMeldTooltip: DescribeSimulationTooltip = skillTooltip(
  'Remove Revealed when activation begins, then grant stealth. Cantrip-use traits apply.'
);

const deadeyeStolenSkillTooltip: DescribeSimulationTooltip = (balanceContext, entity) => ({
  description:
    'Consume the held Deadeye stolen skill. Its boons affect the party. Having enough malice also grants stealth; this does not consume malice. Stolen-skill traits apply.',
  facts: [
    { name: 'Malice required for stealth', detail: String(STOLEN_SKILL_STEALTH_MALICE) },
    ...simulationEffectFacts(
      balanceContext.catalog.skillsById
        .get(entity.id)!
        .effects?.map((effect): SkillEffect =>
          effect.type === 'boon' ? { ...effect, audience: { recipients: RECIPIENT.PARTY } } : effect
        )
    ).facts
  ]
});

/** Describe deadeye tooltips from the selected balance data. */
export const deadeyeTooltips = {
  skills: {
    [ID.MALICIOUS_RESTORATION]: skillTooltip(
      'Heal yourself and transfer conditions to your marked target. This cast has no simulated condition transfer.'
    ),
    ...Object.fromEntries(
      [
        ID.MALICIOUS_DEATHS_JUDGMENT,
        ID.MALICIOUS_SURPRISE_SHOT,
        ID.MALICIOUS_SNEAK_ATTACK,
        ID.MALICIOUS_BACKSTAB,
        ID.MALICIOUS_TACTICAL_STRIKE,
        ID.MALICIOUS_SHADOWSQUALL,
        ID.MALICIOUS_HOOK_STRIKE,
        ID.MALICIOUS_CUNNING_SALVO
      ].map((id) => [id, stealthAttack])
    ),
    [ID.MALICIOUS_ASHEN_ASSAULT]: stealthAttack,
    [ID.DEADEYES_MARK]: deadeyesMarkTooltip,
    [ID.MERCY]: deadeyeMercyTooltip,
    [ID.SHADOW_FLARE]: deadeyeShadowFlareTooltip,
    [ID.SHADOW_SWAP]: deadeyeShadowSwapTooltip,
    [ID.SHADOW_MELD]: deadeyeShadowMeldTooltip,
    ...Object.fromEntries(
      [
        ID.STEAL_WARMTH,
        ID.STEAL_RESISTANCE,
        ID.STEAL_PRECISION,
        ID.STEAL_HEALTH,
        ID.STEAL_STRENGTH,
        ID.STEAL_TIME,
        ID.STEAL_DURABILITY,
        ID.STEAL_DEFENSES,
        ID.STEAL_MOBILITY
      ].map((id) => [id, deadeyeStolenSkillTooltip])
    )
  },
  traits: {
    [TRAIT.DEADEYES_GAZE]: traitTooltip(
      "Unlock Deadeye, rifle, cantrips, and Deadeye's Mark. Initiative attacks build malice against the marked target. Malicious attacks consume it.",
      [
        ['resourceGain', 'Malice gained on hit'],
        ['playerStacks', 'Malice gained on critical hit']
      ]
    ),
    [TRAIT.RENEWING_GAZE]: outsideScopeTooltip,
    [TRAIT.IRON_SIGHT]: traitTooltip('Deal increased strike damage to the marked target.', [
      fromProfile(TRAIT.IRON_SIGHT, 'damageMultiplier', 'Strike damage', tooltipFactorChange)
    ]),
    [TRAIT.MALICIOUS_INTENT]: traitTooltip(
      'Gain malice when marking a target and after a malicious attack spends malice.',
      [['resourceGain', 'Malice gained']]
    ),
    [TRAIT.COLLATERAL_DAMAGE]: outsideScopeTooltip,
    [TRAIT.ONE_IN_THE_CHAMBER]: traitTooltip(
      'Cantrips grant a new stolen skill choice, replacing the stored choice. Stolen skills deal increased strike damage.',
      [fromProfile(TRAIT.ONE_IN_THE_CHAMBER, 'damageMultiplier', 'Stolen skill strike damage', tooltipFactorChange)]
    ),
    [TRAIT.SILENT_SCOPE]: traitTooltip(
      'Gain precision. Dodging above the malice threshold grants one temporary stealth-attack use without entering stealth.',
      [
        ['attributeBonuses.precision', 'Precision'],
        ['threshold', 'Malice must exceed'],
        (context, id) => ({
          ...profileFact(context, id, 'duration', 'Attack availability', tooltipSeconds),
          icon: tooltipFactIcon('Duration')
        })
      ]
    ),
    [TRAIT.PAYBACK]: outsideScopeTooltip,
    [TRAIT.PREMEDITATION]: traitTooltip(
      'Gain concentration and increased strike damage for each different boon on you.',
      [
        ['attributeBonuses.concentration', 'Concentration'],
        fromProfile(TRAIT.PREMEDITATION, 'damagePerBoon', 'Strike damage per boon', tooltipPercent),
        maximumBonusFact('damagePerBoon', 'maximumBoons', 'Maximum strike damage bonus')
      ]
    ),
    // The higher cap is passive. Only filling the malice pool grants initiative and boons.
    [TRAIT.MALEFICENT_SEVEN]: (context, trait) => {
      const rewards = simulationEffectFacts(tooltipProfile(context, trait.id).effects);
      return {
        incomplete: rewards.incomplete,
        description:
          'Increase your malice cap. After you spend or lose your malice, you can fill it again to earn the rewards.',
        facts: [profileFact(context, trait.id, 'maximumStacks', 'Maximum malice')],
        factSections: [
          {
            label: 'On reaching maximum malice',
            facts: [profileFact(context, trait.id, 'resourceGain', 'Initiative restored'), ...rewards.facts]
          }
        ]
      };
    },
    [TRAIT.BE_QUICK_OR_BE_KILLED]: traitTooltip(
      'Marking a target grants quickness. Gain power and precision while quickness is active.',
      [
        ['attributeBonuses.power', 'Power with quickness'],
        ['attributeBonuses.precision', 'Precision with quickness']
      ]
    ),
    [TRAIT.FIRE_FOR_EFFECT]: traitTooltip(
      'Replace stolen skill choices with Steal Time. Using a stolen skill grants might and fury to the party.',
      () => [],
      RECIPIENT.PARTY
    )
  }
} satisfies ProfessionTooltips;
