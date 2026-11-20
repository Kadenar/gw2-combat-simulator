import {
  modifierFact,
  simulationEffectFacts,
  skillFact,
  tooltipFactorChange,
  tooltipPercent,
  tooltipSeconds,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { skillActionEffects } from '#gw2/platform/effects/actions.js';
import type { TooltipFact } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

/** Malice changes individual packets; display their base values and name the affected packet explicitly. */
export const stealthAttack: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id) as ThiefSkill;
  let effects = (selected.effects || []).filter((effect) => effect.packetLabel !== 'malice');
  const facts: TooltipFact[] = [];
  let description = 'Requires stealth or an available stealth-attack charge. A charge is consumed at cast start.';
  description +=
    selected.id === ID.DEATHS_JUDGMENT || selected.id === ID.MALICIOUS_DEATHS_JUDGMENT
      ? ' Applies Revealed at cast start.'
      : ' The first landed strike ends stealth and applies Revealed.';

  if (selected.spearStealthAttack) description += ' Using a charge without stealth does not apply Revealed.';

  if (selected.id === ID.MALICIOUS_SHADOWSQUALL) {
    description +=
      ' Each poison application checks your current malice when it hits your mark. The channel spends malice when it ends or is interrupted after a marked hit.';
    facts.push(
      modifierFact(
        balanceContext,
        'thief.malicious-shadowsquall-poison',
        'durationPerMalice',
        'Bonus poison duration per malice',
        tooltipPercent
      )
    );
  } else if (selected.id === ID.MALICIOUS_BACKSTAB)
    description += ' Backstab reads and spends your malice when it hits your mark.';
  else if (selected.id === ID.MALICIOUS_DEATHS_JUDGMENT)
    description += ' The shot gains damage from your malice on impact. Hitting your mark spends it.';
  else if (selected.id === ID.MALICIOUS_TACTICAL_STRIKE)
    description += ' Hitting your mark spends your current malice and restores endurance for each stack spent.';
  else if (selected.id === ID.MALICIOUS_CUNNING_SALVO)
    description += ' Only the outgoing axe poisons your mark, for one second per malice spent on impact.';
  else if (selected.id === ID.MALICIOUS_SURPRISE_SHOT)
    description += ' The arrow spends malice when it hits your mark.';
  else if (selected.id === ID.MALICIOUS_SNEAK_ATTACK)
    description +=
      ' The first bullet applies torment based on your malice when it hits your mark. The channel spends malice when it ends after a marked hit.';
  else if (selected.id === ID.MALICIOUS_HOOK_STRIKE)
    description += ' Hitting your mark spends your current malice and grants quickness for each stack spent.';

  // Each Backstab owns an independent selected positional modifier.
  if (selected.id === ID.BACKSTAB)
    facts.push(
      modifierFact(
        balanceContext,
        'thief.backstab-defiant',
        'factor',
        'Strike damage against a defiant target',
        tooltipFactorChange
      )
    );

  if (selected.id === ID.MALICIOUS_BACKSTAB) {
    facts.push(
      modifierFact(
        balanceContext,
        'thief.malicious-backstab-position',
        'factor',
        'Strike damage against a defiant target',
        tooltipFactorChange
      )
    );
  }

  if (selected.id === ID.MALICIOUS_BACKSTAB || selected.id === ID.MALICIOUS_DEATHS_JUDGMENT) {
    facts.push(
      modifierFact(
        balanceContext,
        selected.id === ID.MALICIOUS_BACKSTAB
          ? 'thief.malicious-backstab-malice'
          : 'thief.malicious-deaths-judgment-malice',
        'damagePerMalice',
        'Strike damage per malice against your mark'
      )
    );
  }

  if (selected.id === ID.MALICIOUS_SNEAK_ATTACK) {
    effects = [...effects, ...skillActionEffects(selected)];
    facts.push(
      skillFact(
        balanceContext,
        ID.MALICIOUS_SNEAK_ATTACK,
        'durationPerMalice',
        'Additional torment duration per malice',
        tooltipSeconds
      )
    );
  }

  if (selected.id === ID.MALICIOUS_HOOK_STRIKE) {
    facts.push(
      ...simulationEffectFacts(
        skillActionEffects(selected).filter((effect) => effect.type === 'boon'),
        'duration per malice'
      ).facts
    );
  }

  if (selected.id === ID.CUNNING_SALVO || selected.id === ID.MALICIOUS_CUNNING_SALVO)
    description += ' Its landed axe enters the shared ground-axe pool.';

  if (selected.spearStealthAttack) {
    description += ' Restores initiative on completion and resets the spear chain to its lead attacks.';
    facts.push(skillFact(balanceContext, selected.id, 'initiativeRefund', 'Initiative restored'));

    if (selected.malicious) {
      description +=
        ' The final hit checks your current malice for bonus damage and torment against your mark. The channel spends malice when it ends after a marked hit.';
      facts.push(
        skillFact(
          balanceContext,
          ID.MALICIOUS_ASHEN_ASSAULT,
          'coefficientPerMalice',
          'Final strike damage increase per malice',
          tooltipPercent
        ),
        ...simulationEffectFacts(
          selected.effects?.filter((effect) => effect.packetLabel === 'malice'),
          'torment duration per malice on the final hit'
        ).facts
      );
    }
  }

  return { description, facts: [...simulationEffectFacts(effects).facts, ...facts] };
};
