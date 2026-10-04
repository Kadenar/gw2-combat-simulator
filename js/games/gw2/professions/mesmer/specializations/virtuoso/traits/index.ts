import { createMesmerResources, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-mechanics.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { illusionSource, timedActive } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { mesmerTraitDamageProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';

/** Deadly Blades shares patched tuning with its existing packet and resource boundaries. */
export const deadlyBlades = defineTrait<MesmerSkill>({
  id: TRAIT.DEADLY_BLADES,
  name: 'Deadly Blades',
  balance: {
    durationMultiplier: 7,
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', duration: 5, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'mesmer.deadly-blades',
      requiresSelection: false,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: { strikeBonus: 0.05, conditionBonus: 0.1 },
      amount: (_context, target, parameters) =>
        target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionBonus : parameters.strikeBonus,
      when: (context) => !illusionSource(context) && timedActive(context, 'deadly-blades')
    }
  ]
});

/** Jagged Mind shares patched tuning with its existing packet and resource boundaries. */
export const jaggedMind = defineTrait<MesmerSkill>({
  id: TRAIT.JAGGED_MIND,
  name: 'Jagged Mind',
  balance: {
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 4, stacks: 1 }]
  }
});

/** Bloodsong shares patched tuning with its existing packet and resource boundaries. */
export const bloodsong = defineTrait<MesmerSkill>({
  id: TRAIT.BLOODSONG,
  name: 'Bloodsong',
  balance: {
    threshold: 5,
    resourceGain: 1
  },
  modifierRules: [
    {
      id: 'mesmer.bloodsong',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      order: 100,
      when: (context) => context.condition === 'Bleeding'
    }
  ],
  hooks: {
    reactions: {
      'condition.applied'(runtime, event) {
        if (event.condition !== 'Bleeding' || !hasTrait(runtime, TRAIT.BLOODSONG)) return;
        const state = virtuosoState.from(runtime);
        state.bloodsongProgress += event.stacks ?? 0;
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODSONG);
        const threshold = balanceProfileNumber(profile, 'threshold');
        while (threshold > 0 && state.bloodsongProgress >= threshold - 1e-9) {
          state.bloodsongProgress -= threshold;
          createMesmerResources(runtime).queueResources(
            runtime.time,
            balanceProfileNumber(profile, 'resourceGain'),
            mesmerActivePrimaryWeapon(runtime),
            'Bloodsong',
            { traitId: TRAIT.BLOODSONG, traitName: 'Bloodsong' }
          );
        }
      }
    }
  }
});

/** The proc owns its baseline attack; the shared phantasm lifecycle supplies the conversion boundary. */
const phantasmalBlade: MesmerTraitDamage = {
  coefficient: 0.7,
  hits: 1
};

export const phantasmalBlades = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_BLADES,
  name: 'Phantasmal Blades',
  profiles: [mesmerTraitDamageProfile(TRAIT.PHANTASMAL_BLADES, 'Phantasmal Blades', phantasmalBlade)]
});

/** Keep the rounded build conversion separate from live Fury and direct-simulation attribute adjustments. */
export const quietIntensity = defineTrait<MesmerSkill>({
  id: TRAIT.QUIET_INTENSITY,
  name: 'Quiet Intensity',
  balance: { phantasmCriticalChance: 0.15, criticalChance: 0.15, vitalityConversion: 0.1 },
  modifierRules: [
    {
      id: 'mesmer.quiet-intensity-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.QUIET_INTENSITY), 'criticalChance'),
      when: (context) =>
        !illusionSource(context) && Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
    }
  ],
  buildAttributes: (_common, { balanceContext, build }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.QUIET_INTENSITY);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Vitality',
          to: 'Ferocity',
          multiplier: balanceProfileNumber(profile, 'vitalityConversion'),
          rounding: 'round',
          input: 'common'
        }
      ],
      traitCriticalChance: build.assumptions?.fury !== false ? 100 * balanceProfileNumber(profile, 'criticalChance') : 0
    };
  }
});

/** Targets are always nearby in this simulation; only player strikes receive this multiplier. */
export const mentalFocus = defineTrait<MesmerSkill>({
  id: TRAIT.MENTAL_FOCUS,
  name: 'Mental Focus',
  modifierRules: [
    {
      id: 'mesmer.mental-focus',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05,
      // Apply after the blade-specific multiplier, as in the original collector.
      order: 101,
      when: (context) => isGw2PlayerActorEvent(context.event)
    }
  ]
});

/** Sharpening Sorrow shares patched tuning with its existing packet and resource boundaries. */
export const sharpeningSorrow = defineTrait<MesmerSkill>({
  id: TRAIT.SHARPENING_SORROW,
  name: 'Sharpening Sorrow',
  balance: {
    expertiseBonus: 150
  },
  buildAttributes: (_common, { balanceContext, build }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        to: 'Expertise',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.SHARPENING_SORROW),
          'expertiseBonus'
        ),
        feedsConversions: false,
        enabled: build.assumptions?.fury !== false
      }
    ]
  })
});

/** Infinite Forge shares patched tuning with its existing packet and resource boundaries. */
export const infiniteForge = defineTrait<MesmerSkill>({
  id: TRAIT.INFINITE_FORGE,
  name: 'Infinite Forge',
  balance: {
    pulseInterval: 3,
    threshold: 5,
    playerStacks: 1,
    resourceGain: 2
  },
  modifierRules: [
    {
      id: 'mesmer.infinite-forge',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      order: 100,
      when: (context) => Boolean(context.event?.metadata?.blade)
    }
  ],
  hooks: {
    tasks: {
      'mesmer.infinite-forge'(runtime) {
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.INFINITE_FORGE);
        createMesmerResources(runtime).gainResources(
          runtime.time,
          balanceProfileNumber(profile, 'playerStacks'),
          mesmerActivePrimaryWeapon(runtime),
          'Infinite Forge',
          { traitId: TRAIT.INFINITE_FORGE, traitName: 'Infinite Forge' }
        );
        const interval = balanceProfileNumber(profile, 'pulseInterval');
        if (interval > 0) runtime.schedule('mesmer.infinite-forge', runtime.time + interval, undefined, undefined, -20);
      }
    }
  }
});

/** Collect the eight implemented Virtuoso trait owners. */
export const virtuosoTraits = [
  quietIntensity,
  mentalFocus,
  sharpeningSorrow,
  deadlyBlades,
  jaggedMind,
  bloodsong,
  phantasmalBlades,
  infiniteForge
];
