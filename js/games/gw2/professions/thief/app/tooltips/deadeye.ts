import { RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import {
  fromProfile,
  fromModifier,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  tooltipPercent,
  simulationEffectFacts,
  type ProfessionTooltips,
  type DescribeSimulationTooltip,
  fromSkill
} from '#gw2/app/shared/simulation-tooltip.js';

import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { stealthAttack } from '#gw2/professions/thief/app/tooltips/shared.js';

const deadeyesMarkTooltip: DescribeSimulationTooltip = skillTooltip(
  'Mark the target, trigger stealing traits, and grant the configured Deadeye stolen skill. Marked initiative attacks build malice on their first hit, with additional gain from critical hits. Remarking preserves existing malice; Malicious Intent adds its grant.',
  [
    fromSkill(ID.DEADEYES_MARK, 'duration', 'Mark duration', tooltipSeconds),
    fromProfile(TRAIT.DEADEYES_GAZE, 'maximumStacks', 'Maximum malice'),
    fromProfile(TRAIT.MALEFICENT_SEVEN, 'maximumStacks', 'Maximum malice with Maleficent Seven'),
    fromProfile(TRAIT.DEADEYES_GAZE, 'resourceGain', 'Malice per initiative attack'),
    fromProfile(TRAIT.DEADEYES_GAZE, 'playerStacks', 'Additional malice from a critical hit')
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
  [fromModifier('thief.shadow-flare-marked', 'factor', 'Strike damage against your mark', tooltipFactorChange)]
);

const deadeyeShadowMeldTooltip: DescribeSimulationTooltip = skillTooltip(
  'Remove Revealed when activation begins, then grant stealth. Cantrip-use traits apply.'
);

const deadeyeStolenSkillTooltip: DescribeSimulationTooltip = (balanceContext, entity) => ({
  description:
    'Consume the held Deadeye stolen skill. Its boons affect the party. Having enough malice also grants stealth; this does not consume malice. Stolen-skill traits apply.',
  facts: simulationEffectFacts(
    balanceContext.catalog.skillsById
      .get(entity.id)!
      .effects?.map((effect): SkillEffect =>
        effect.type === 'boon' ? { ...effect, audience: { recipients: RECIPIENT.PARTY } } : effect
      )
      .filter((effect) => !(effect.type === 'buff' && effect.kind === STATUS.STEALTH))
  ).facts
});

/** Describe deadeye tooltips from the selected balance data. */
export const deadeyeTooltips = {
  skills: {
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
      "Unlock Deadeye, rifle, cantrips, and Deadeye's Mark. Initiative attacks build malice against the marked target; malicious attacks consume it."
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
        ['attributeBonus', 'Precision'],
        ['threshold', 'Malice must exceed'],
        ['duration', 'Attack availability', tooltipSeconds]
      ]
    ),
    [TRAIT.PAYBACK]: outsideScopeTooltip,
    [TRAIT.PREMEDITATION]: traitTooltip(
      'Gain concentration and increased strike damage for each different boon on you.',
      [
        ['attributeBonus', 'Concentration'],
        fromProfile(TRAIT.PREMEDITATION, 'damagePerBoon', 'Strike damage per boon', tooltipPercent)
      ]
    ),
    [TRAIT.MALEFICENT_SEVEN]: traitTooltip(
      'Increase maximum malice. Reaching maximum malice grants initiative and boons once until a malicious attack spends malice.',
      [
        ['maximumStacks', 'Maximum malice'],
        ['resourceGain', 'Initiative restored']
      ]
    ),
    [TRAIT.BE_QUICK_OR_BE_KILLED]: traitTooltip(
      'Marking a target grants quickness. Gain power and precision while quickness is active.',
      [['attributeBonus', 'Power and precision with quickness']]
    ),
    [TRAIT.FIRE_FOR_EFFECT]: traitTooltip(
      'Replace stolen skill choices with Steal Time. Using a stolen skill grants might and fury to the party.',
      () => [],
      RECIPIENT.PARTY
    )
  }
} satisfies ProfessionTooltips;
