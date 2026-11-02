import {
  fromProfile,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipPercentValue,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import { percentagePoints } from '#gw2/professions/elementalist/app/tooltips/shared.js';
import { FLAME_EXPULSION_DELAY_SECONDS } from '#gw2/professions/elementalist/core/traits/fire/attunement-transition.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Describe fire tooltips from the selected balance data. */
export const elementalistFireTooltips = {
  [TRAIT.EMPOWERING_FLAME]: traitTooltip('Gain power while primarily attuned to Fire.', [
    ['attributeBonuses.power', 'Power in Fire']
  ]),
  [TRAIT.SUNSPOT]: traitTooltip(
    'Entering Fire in combat, or beginning a Fire overload, grants Fire Aura and triggers a strike that cannot critically strike.'
  ),
  [TRAIT.PYROMANCERS_TRAINING]: traitTooltip(
    'Fire-attuned skills recharge faster. Your strikes deal increased damage against burning targets.',
    [
      ['rechargeMultiplier', 'Fire skill recharge', tooltipFactorChange],
      fromProfile(
        TRAIT.PYROMANCERS_TRAINING,
        'damageMultiplier',
        'Strike damage against burning targets',
        tooltipFactorChange
      )
    ]
  ),
  [TRAIT.BURNING_PRECISION]: traitTooltip(
    'Eligible critical hits have a chance to burn the target. Burning lasts longer.',
    [
      ['procChance', 'Chance on critical hit', tooltipPercentValue],
      ['internalCooldown', 'Internal cooldown', tooltipSeconds],
      ['durationMultiplier', 'Burning duration', percentagePoints]
    ]
  ),
  [TRAIT.CONJURER]: traitTooltip('Equipping a conjured weapon grants Fire Aura.'),
  [TRAIT.BURNING_FIRE]: outsideScopeTooltip,
  [TRAIT.BURNING_RAGE]: traitTooltip('Gain condition damage. Sunspot also burns the target.', [
    ['attributeBonuses.conditionDamage', 'Condition damage']
  ]),
  [TRAIT.SMOTHERING_AURAS]: traitTooltip('Auras last longer.', [
    ['durationMultiplier', 'Aura duration', tooltipFactorChange]
  ]),
  [TRAIT.POWER_OVERWHELMING]: traitTooltip(
    'Gain power while you have enough might. Fire attunement uses the larger bonus instead.',
    [
      ['minimumStacks', 'Might stacks required'],
      ['attributeBonuses.power', 'Power outside Fire'],
      ['conditionalAttributeBonuses.power', 'Power in Fire']
    ]
  ),
  [TRAIT.PERSISTING_FLAMES]: traitTooltip(
    'Eligible fire-field hits grant temporary strike-damage stacks. Weapon fire fields last longer and keep pulsing their damage and conditions.',
    [
      fromProfile(TRAIT.PERSISTING_FLAMES, 'damageIncreasePerStack', 'Strike damage per stack', tooltipPercent),
      ['maximumStacks', 'Maximum stacks', tooltipDecimal],
      ['duration', 'Stack duration', tooltipSeconds],
      ['durationPerTier', 'Additional weapon field duration', tooltipSeconds]
    ]
  ),
  [TRAIT.PYROMANCERS_PUISSANCE]: (context, trait) => {
    const profile = tooltipProfile(context, trait.id);
    // Keep each reward's trigger distinct and combine base values with their selected Might scaling.
    const factsFor = (effects: NonNullable<typeof profile.effects>) =>
      effects.flatMap((effect) =>
        simulationEffectFacts([{ ...effect, name: undefined }]).facts.map((fact) => {
          if (effect.type === 'boon' && effect.name === 'Attunement Might')
            return { ...fact, name: 'Might on Fire skill' };

          if (effect.type === 'boon' && effect.name === 'Flame Expulsion Might')
            return {
              ...fact,
              name: 'Might to other allies',
              detail: `counted stacks · ${fact.detail}`,
              stacks: undefined
            };

          if (effect.name === 'Flame Expulsion' && effect.type === 'strike')
            return {
              ...fact,
              detail: `${fact.detail} + ${tooltipDecimal(tooltipNumber(profile, 'damageIncreasePerStack'))} per Might`
            };

          if (effect.name === 'Flame Expulsion' && effect.type === 'condition')
            return {
              ...fact,
              detail: `${fact.detail} + ${tooltipSeconds(tooltipNumber(profile, 'durationPerTier'))} per Might`
            };

          return fact;
        })
      );

    return {
      description:
        'Using skills in Fire grants Might. Leaving Fire or completing Overload Fire triggers Flame Expulsion, which counts your Might when triggered, scales its damage, and shares the counted stacks with other allies.',
      facts: [
        ...factsFor((profile.effects ?? []).filter((effect) => effect.name === 'Attunement Might')),
        { name: 'Flame Expulsion delay', detail: tooltipSeconds(FLAME_EXPULSION_DELAY_SECONDS) },
        profileFact(
          context,
          trait.id,
          'maximumStacks',
          'Might counted',
          (value) => `up to ${tooltipDecimal(value)} stacks`
        ),
        ...factsFor((profile.effects ?? []).filter((effect) => effect.name !== 'Attunement Might'))
      ]
    };
  },
  [TRAIT.INFERNO]: traitTooltip(
    'Burning scales with power instead of condition damage, retaining the shared burning base damage.',
    [
      // Display the Power conversion using combat's canonical Burning scaling.
      [
        'coefficientMultiplier',
        'Burning damage per second per power',
        (value) => tooltipDecimal(value * CONDITION_FORMULAS.Burning.scaling)
      ]
    ]
  )
} satisfies NonNullable<ProfessionTooltips['traits']>;
