import {
  tooltipFactorChange,
  tooltipSeconds,
  profileFact,
  modifierFact,
  tooltipPercent,
  tooltipProfile,
  simulationEffectFacts,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/thief/core/profiles.js';
import { BACKSTAB_DEFIANT_MULTIPLIER } from '#gw2/professions/thief/core/skills/weapons/dagger.js';
import { DEADEYE_BALANCE_PROFILE_IDS as DE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import type { TooltipFact } from '#gw2/platform/skills/types.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

/** Malice changes individual packets; display their base values and name the affected packet explicitly. */
export const stealthAttack: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id) as ThiefSkill;
  let effects = selected.effects || [];
  const facts: TooltipFact[] = [];
  let description =
    'Requires stealth or an available stealth-attack charge. Beginning the attack consumes that access.';
  description += selected.preservesStealth
    ? ' Leaving stealth with this attack does not apply Revealed.'
    : ' Leaving stealth applies Revealed.';

  if (selected.malicious)
    description +=
      ' Snapshots malice when the cast starts. The first hit against your active mark consumes malice; Malicious Intent can then seed the next cycle.';

  // Core Backstab owns a packet transform; Malicious Backstab still owns a balance modifier.
  if (selected.id === ID.BACKSTAB)
    facts.push({
      name: 'Strike damage against a defiant target',
      detail: tooltipFactorChange(BACKSTAB_DEFIANT_MULTIPLIER)
    });

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
        'thief.malicious-stealth-attack',
        'damagePerMalice',
        'Strike damage per malice against your mark'
      )
    );
  }

  if (selected.id === ID.MALICIOUS_SNEAK_ATTACK) {
    const profile = tooltipProfile(balanceContext, DE.maliciousSneakAttack);
    // The selected scaling profile owns the independent Torment packet.
    effects = [...effects, ...(profile.effects || [])];
    facts.push(
      profileFact(
        balanceContext,
        DE.maliciousSneakAttack,
        'durationMultiplier',
        'Additional torment duration per malice',
        tooltipSeconds
      )
    );
  }

  if (selected.id === ID.MALICIOUS_HOOK_STRIKE) {
    description += ' Quickness duration scales with snapshotted malice; no malice grants no quickness.';
    effects = effects.filter((effect) => effect.type !== 'boon');
    facts.push(
      ...simulationEffectFacts(
        selected.effects?.filter((effect) => effect.type === 'boon'),
        'duration per malice'
      ).facts
    );
  }

  if (selected.id === ID.MALICIOUS_TACTICAL_STRIKE)
    description += ' Its first marked hit also restores endurance in proportion to consumed malice.';

  if (selected.id === ID.MALICIOUS_CUNNING_SALVO)
    description +=
      ' Outgoing poison lasts one second per consumed malice; recalled poison uses the base duration without consuming malice.';

  if (selected.id === ID.MALICIOUS_SHADOWSQUALL)
    description += " Malice extends this attack's poison duration; the values below are before malice scaling.";

  if (selected.id === ID.CUNNING_SALVO || selected.id === ID.MALICIOUS_CUNNING_SALVO)
    description += ' Its landed axe enters the shared ground-axe pool.';

  if (selected.spearStealthAttack) {
    description += ' Restores initiative on completion and resets the spear chain to its lead attacks.';
    facts.push(
      profileFact(
        balanceContext,
        selected.malicious ? DE.maliciousAshenAssault : CORE.ashenAssaultRefund,
        'resourceGain',
        'Initiative restored'
      )
    );

    if (selected.malicious) {
      description +=
        ' Malice increases only the final strike coefficient. Positive malice also adds torment on completion.';
      facts.push(
        profileFact(
          balanceContext,
          DE.maliciousAshenAssault,
          'coefficientMultiplier',
          'Final strike coefficient increase per malice',
          tooltipPercent
        ),
        profileFact(
          balanceContext,
          DE.maliciousAshenAssault,
          'durationMultiplier',
          'Additional torment duration per malice',
          tooltipSeconds
        ),
        ...simulationEffectFacts(
          tooltipProfile(balanceContext, DE.maliciousAshenAssault).effects,
          'requires positive malice; base duration before malice'
        ).facts
      );
    }
  }

  return { description, facts: [...simulationEffectFacts(effects).facts, ...facts] };
};
