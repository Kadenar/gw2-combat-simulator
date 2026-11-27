import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import {
  maximumBonusFact,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { BOON, RECIPIENT } from '#gw2/platform/constants.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Describe dueling tooltips from the selected balance data. */
export const mesmerDuelingTooltips = {
  [TRAIT.CRITICAL_INFUSION]: traitTooltip(
    'Your critical hits grant vigor. Critical hits from clones and phantasms do not trigger this trait.',
    [['internalCooldown', 'Internal cooldown', tooltipSeconds]]
  ),
  [TRAIT.SHARPER_IMAGES]: traitTooltip('Critical strikes from clones and phantasms inflict bleeding.'),
  // Label the two Fury grants by recipient so their internal effect names never repeat the audience.
  [TRAIT.MASTER_FENCER]: (context, { id }) => ({
    description: 'Your critical hits grant fury. Critical hits from illusions cannot trigger this trait.',
    facts: [
      profileFact(context, id, 'internalCooldown', 'Internal cooldown', tooltipSeconds),
      ...(tooltipProfile(context, id).effects ?? []).flatMap((effect) => {
        const audience = effect.audience;
        const limit = audience?.maximumRecipients;
        let recipient;

        if (audience?.recipients === RECIPIENT.SELF) recipient = 'you';

        if (audience?.recipients === RECIPIENT.PARTY && audience.affectsSelf === false && limit != null)
          recipient = `up to ${limit} nearby ${limit === 1 ? 'ally' : 'allies'}`;

        if (!recipient || effect.type !== 'boon' || effect.boon !== BOON.FURY)
          return simulationEffectFacts([effect]).facts;

        return [
          {
            name: `Fury on ${recipient}`,
            detail: tooltipSeconds(tooltipNumber(effect, 'duration')),
            icon: MODIFIER_EFFECT_ICONS[BOON.FURY]
          }
        ];
      })
    ]
  }),
  [TRAIT.PHANTASMAL_FURY]: traitTooltip('Your phantasms gain fury.', [
    ['criticalChance', 'Phantasm critical chance from fury', tooltipPercent]
  ]),
  [TRAIT.MENTAL_GYMNASTICS]: outsideScopeTooltip,
  [TRAIT.DUELISTS_DISCIPLINE]: outsideScopeTooltip,
  // Clone shatters blind once per source. Flute blinds once, and bladesongs have no blind trigger.
  [TRAIT.BLINDING_DISSIPATION]: (context, entity, specialization) => {
    if (specialization === 'Virtuoso')
      return { description: 'Bladesongs do not trigger Blinding Dissipation in the simulator.', facts: [] };

    const blind =
      specialization === 'Troubadour'
        ? 'Flustering Flute blinds your target.'
        : `${specialization === 'Chronomancer' ? 'Rewinder' : 'Cry of Frustration'} blinds your target once for you and once per clone you shatter.`;
    return traitTooltip(`${blind} If you have Ineptitude, each blind also inflicts confusion.`)(context, entity);
  },
  [TRAIT.WANDERING_MIND]: outsideScopeTooltip,
  [TRAIT.FENCERS_FINESSE]: traitTooltip('Sword hits grant stacking ferocity. Sword skills recharge faster.', [
    ['attributePerStack', 'Ferocity per stack'],
    maximumBonusFact('attributePerStack', 'maximumStacks', 'Maximum Ferocity bonus', tooltipDecimal),
    ['duration', 'Stack duration', tooltipSeconds],
    ['rechargeMultiplier', 'Sword recharge', tooltipFactorChange]
  ]),
  [TRAIT.SUPERIORITY_COMPLEX]: traitTooltip(
    'Your critical strikes deal increased damage. Use the larger bonus against low-health or targets affected by Fear or Taunt; defiance alone does not activate it.',
    [
      ['highHealthFactor', 'Base critical damage', tooltipFactorChange],
      ['lowHealthOrDisabledFactor', 'Enhanced critical damage', tooltipFactorChange],
      ['threshold', 'Target health threshold', (value) => `${tooltipDecimal(value * 100)}%`]
    ]
  ),
  [TRAIT.INEPTITUDE]: traitTooltip(
    'Blinding a foe always inflicts confusion. Hitting a foe with a control effect while it is activating a skill also inflicts confusion. Only interrupts against defiant foes have a cooldown.',
    [['internalCooldown', 'Defiant interrupt cooldown', tooltipSeconds]]
  ),
  [TRAIT.DECEPTIVE_EVASION]: traitTooltip('Dodging as Mirage creates a clone.')
} satisfies NonNullable<ProfessionTooltips['traits']>;
