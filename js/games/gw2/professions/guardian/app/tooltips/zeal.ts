import {
  attributeConversionFact,
  fromProfile,
  internalCooldownFact,
  maximumBonusFact,
  outsideScopeTooltip,
  simulationComboFacts,
  simulationEffectFacts,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipPercent,
  tooltipPercentValue,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips,
  type SimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { balanceNumber, requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Keep the trait's own effects separate and group symbol effects only when they share a pulse schedule. */
function symbolPulseFacts(symbol: Skill, trait: SimulationTooltip): SimulationTooltip {
  const effects = symbol.effects ?? [];
  const [first] = effects;
  const pulses = first?.applications ?? 1;
  const interval = first?.intervalMs ?? 0;
  const sharedPulses =
    pulses > 1 &&
    interval > 0 &&
    effects.every(
      (effect) =>
        effect.applications === pulses &&
        effect.intervalMs === interval &&
        (effect.atMs ?? 0) === (first?.atMs ?? 0) &&
        effect.timingAnchor === first?.timingAnchor &&
        effect.timingScale === first?.timingScale &&
        effect.intervalTimingScale === first?.intervalTimingScale
    );
  const payload = simulationEffectFacts(
    sharedPulses ? effects.map((effect) => ({ ...effect, applications: 1 })) : effects
  );
  return {
    ...trait,
    facts: [
      ...trait.facts,
      ...simulationComboFacts(symbol, payload),
      // Furious Focus displays its symbol's recharge in the trait heading.
      symbol.id === ID.LESSER_SYMBOL_OF_BLADES
        ? internalCooldownFact('Symbol recharge', symbol.cooldown ?? 0)
        : {
            name: 'Symbol recharge',
            detail:
              tooltipSeconds(symbol.cooldown ?? 0) + (symbol.rechargeIgnoresAlacrity ? ' (unaffected by alacrity)' : '')
          }
    ],
    factSections: payload.facts.length
      ? [
          {
            label: sharedPulses
              ? `Per pulse (${pulses} base pulses, ${tooltipSeconds(interval / 1000)} apart)`
              : 'Symbol effects',
            facts: payload.facts
          }
        ]
      : [],
    incomplete: trait.incomplete || payload.incomplete
  };
}

/** Describe zeal tooltips from the selected balance data. */
export const guardianZealTooltips = {
  [TRAIT.ZEALOTS_RESOLUTION]: (context, trait) => {
    const health = tooltipPercentValue(1 - balanceNumber(context.catalog, trait.id, 'threshold'));
    const symbol = requireSkill(context.catalog, ID.LESSER_SYMBOL_OF_RESOLUTION);
    const describe = traitTooltip(`When your strike hits a foe already below ${health} health, create ${symbol.name}.`);
    return symbolPulseFacts(symbol, describe(context, trait));
  },
  [TRAIT.SYMBOLIC_EXPOSURE]: traitTooltip(
    'Symbol hits inflict vulnerability. Deal increased strike damage to vulnerable targets.',
    [
      fromProfile(
        TRAIT.SYMBOLIC_EXPOSURE,
        'damageMultiplier',
        'Strike damage against vulnerable targets',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.SYMBOLIC_AVENGER]: traitTooltip(
    'Symbol hits grant stacking strike damage. New stacks replace the shortest remaining stack at the cap.',
    [
      fromProfile(TRAIT.SYMBOLIC_AVENGER, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
      maximumBonusFact('damageIncreasePerStack', 'maximumDamageStacks', 'Maximum strike damage bonus'),
      ['pulseInterval', 'Stack duration', tooltipSeconds]
    ]
  ),
  [TRAIT.WRATHFUL_SPIRIT]: outsideScopeTooltip,
  [TRAIT.FIERY_WRATH]: traitTooltip('Deal increased strike damage to burning targets.', [
    fromProfile(TRAIT.FIERY_WRATH, 'damageMultiplier', 'Strike damage against burning targets', tooltipFactorChange)
  ]),
  [TRAIT.ZEALOUS_SCEPTER]: outsideScopeTooltip,
  [TRAIT.RENEWING_SPLENDOR]: outsideScopeTooltip,
  [TRAIT.ZEALOUS_BLADE]: traitTooltip(
    'Gain power, with an additional bonus while wielding a greatsword. Greatsword skills recharge faster.',
    [
      ['attributeBonuses.power', 'Power', tooltipDecimal],
      ['conditionalAttributeBonuses.power', 'Power with a greatsword', tooltipDecimal],
      ['rechargeMultiplier', 'Greatsword recharge duration', tooltipFactorChange]
    ]
  ),
  // Show the selected patch's Power conversion as a Condition Damage fact.
  [TRAIT.KINDLED_ZEAL]: traitTooltip(
    'Gain bonus Condition Damage based on your Power. Power gained from other attribute conversions does not count.',
    [attributeConversionFact('Power', 'Condition Damage')]
  ),
  [TRAIT.ETERNAL_ARMORY]: traitTooltip('Spirit weapon skills gain additional ammunition.', [
    ['resourceGain', 'Additional ammunition']
  ]),
  [TRAIT.SHATTERED_AEGIS]: outsideScopeTooltip,
  [TRAIT.FURIOUS_FOCUS]: (context, trait) => {
    const symbol = requireSkill(context.catalog, ID.LESSER_SYMBOL_OF_BLADES);
    const describe = traitTooltip(
      `Activating Justice creates ${symbol.name}. While you have Fury, all your strikes deal more damage.`,
      [['damageIncrease', 'Strike damage with Fury', tooltipPercent]]
    );
    return symbolPulseFacts(symbol, describe(context, trait));
  }
} satisfies NonNullable<ProfessionTooltips['traits']>;
