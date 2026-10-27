import { necromancerShroudDrain } from '#gw2/professions/necromancer/core/mechanics/shroud-tuning.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import {
  profileFact,
  skillTooltip,
  tooltipDecimal,
  tooltipNumber,
  tooltipSeconds,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

export const lifeForce = (value: number) => `${value}% life force`;

export const conditionTransferTooltip: DescribeSimulationTooltip = skillTooltip(
  "Transfer the oldest distinct self-condition types to your target, up to this skill's transfer limit. Transfer every stack of each selected type with its remaining duration.",
  (_context, skill) => [
    { name: 'Conditions Transferred', detail: tooltipDecimal(tooltipNumber(skill, 'conditionsTransferred')) }
  ]
);

export const flipTooltip: DescribeSimulationTooltip = skillTooltip(
  'Apply these effects and unlock the corresponding temporary follow-up. Using a follow-up consumes its availability.'
);

export const shroudTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected: NecromancerSkill | undefined = balanceContext.catalog.skillsById.get(entity.id);

  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);

  if (selected.shroudExit)
    return {
      description:
        'Leave shroud, restore your weapon skills, and begin the shroud-entry recharge. Triggers applicable shroud-exit traits.',
      facts: []
    };

  const owner = selected.shroudTuning!;
  return {
    description: `Enter shroud, replace your weapon skills, and trigger applicable shroud-entry traits. Life force drains while shroud is active.${selected.shroudEntry === 'harbinger' ? " Gain Blight on the shroud's recurring resource pulse." : ''}`,
    facts: [
      {
        name: 'Minimum life force to enter',
        detail: lifeForce(tooltipNumber(selected, 'minimumShroudLifeForcePercent'))
      },
      { name: 'Life force drained per second', detail: lifeForce(necromancerShroudDrain(balanceContext, selected)) },
      ...(selected.shroudEntry === 'harbinger'
        ? [
            profileFact(balanceContext, owner.id, 'blightGain', 'Blight per pulse'),
            profileFact(balanceContext, owner.id, 'pulseInterval', 'Blight pulse interval', tooltipSeconds)
          ]
        : [])
    ]
  };
};
