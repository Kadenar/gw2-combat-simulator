import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/modifiers.js';

import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

export const mirageModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.nomads-endurance',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      strikeBonus: 0.1,
      conditionBonus: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, target, parameters) => {
      // Illusion strikes do not inherit personal strike bonuses, while their conditions remain owner-resolved.
      if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
      return target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikeBonus : parameters.conditionBonus;
    },
    when: (context) =>
      hasTrait(context, TRAIT.NOMADS_ENDURANCE) && Boolean(context.timeline?.vigorActiveAt(context.time))
  },
  {
    id: 'mesmer.phantom-pain',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: {
      duration: 10,
      maximumStacks: 4,
      strikePerStack: 0.0625,
      conditionPerStack: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, target, parameters) => {
      // Phantom Pain joins other additive outgoing-damage bonuses; phantasm
      // conditions use owner modifiers, but phantasm strikes use summon ownership.
      if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
      return (
        timedStacks(context, 'phantom-pain', parameters.duration, parameters.maximumStacks) *
        (target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionPerStack : parameters.strikePerStack)
      );
    }
  }
]);
