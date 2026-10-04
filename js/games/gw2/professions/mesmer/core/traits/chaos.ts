import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { timedActive } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { mesmerTraitDamageProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Own Chaotic Persistence tuning alongside its runtime behavior. */
export const chaoticPersistence = defineTrait<MesmerSkill>({
  id: TRAIT.CHAOTIC_PERSISTENCE,
  name: 'Chaotic Persistence',
  balance: {
    expertiseBonus: 100,
    concentrationBonus: 250
  },
  buildAttributes: (_common, { balanceContext, build }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.CHAOTIC_PERSISTENCE);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(profile, 'expertiseBonus'),
          feedsConversions: false,
          enabled: build.assumptions?.regeneration !== false
        },
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(profile, 'concentrationBonus'),
          feedsConversions: false,
          enabled: build.assumptions?.regeneration !== false
        }
      ]
    };
  }
});

/** Own Illusionary Membrane tuning alongside its runtime behavior. */
export const illusionaryMembrane = defineTrait<MesmerSkill>({
  id: TRAIT.ILLUSIONARY_MEMBRANE,
  name: 'Illusionary Membrane',
  balance: {
    effects: [{ name: 'illusionary-membrane', type: 'buff', kind: 'illusionary-membrane', duration: 15, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'mesmer.illusionary-membrane',
      requiresSelection: false,
      order: -1,
      conditionSampleInvariant: true,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.07,
      when: (context) => timedActive(context, 'illusionary-membrane')
    }
  ]
});

/** Own Chaotic Interruption tuning alongside its runtime behavior. */
export const chaoticInterruption = defineTrait<MesmerSkill>({
  id: TRAIT.CHAOTIC_INTERRUPTION,
  name: 'Chaotic Interruption',
  balance: {
    recharge: 5,
    internalCooldown: 1
  }
});

/** Keep Method of Madness's authored attack and cooldown with its definition. */
const lesserChaosStorm: MesmerTraitDamage = {
  // Each storm pulse is a distinct strike packet, not an aggregate hit count.
  ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: index * 1000, coefficient: 1.98 / 6 })),
  cooldown: 28
};

export const methodOfMadness = defineTrait<MesmerSkill>({
  id: TRAIT.METHOD_OF_MADNESS,
  name: 'Method of Madness',
  profiles: [mesmerTraitDamageProfile(TRAIT.METHOD_OF_MADNESS, 'Method of Madness', lesserChaosStorm)]
});

export const mesmerChaosTraits = [chaoticPersistence, illusionaryMembrane, chaoticInterruption, methodOfMadness];
