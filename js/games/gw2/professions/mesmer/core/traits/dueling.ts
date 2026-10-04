import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

function superiorityComplexTargetControlled(context: Gw2ModifierContext): boolean {
  return ['Fear', 'Taunt'].some((condition) => targetConditionActive(context, condition));
}

function superiorityComplexFactor(context: Gw2ModifierContext): number {
  const superiorityComplexProfile = requireBalanceProfileFromContext(context, TRAIT.SUPERIORITY_COMPLEX);
  // Only supported control conditions and target health qualify; generic disable state is not simulated.
  return superiorityComplexTargetControlled(context) ||
    targetHealthBelow(context, balanceProfileNumber(superiorityComplexProfile, 'threshold'))
    ? balanceProfileNumber(superiorityComplexProfile, 'lowHealthOrDisabledFactor')
    : balanceProfileNumber(superiorityComplexProfile, 'highHealthFactor');
}

/** Fencer's Finesse shares active tuning with its ordered imperative reactions. */
export const fencersFinesse = defineTrait<MesmerSkill>({
  id: TRAIT.FENCERS_FINESSE,
  name: "Fencer's Finesse",
  balance: {
    attributePerStack: 15,
    maximumStacks: 10,
    durationMultiplier: 6,
    rechargeMultiplier: 0.8
  }
});

/** Ineptitude shares active tuning with its ordered imperative reactions. */
export const ineptitude = defineTrait<MesmerSkill>({
  id: TRAIT.INEPTITUDE,
  name: 'Ineptitude',
  balance: {
    internalCooldown: 3,
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 5, stacks: 2 }]
  }
});

/** Master Fencer shares active tuning with its ordered imperative reactions. */
export const masterFencer = defineTrait<MesmerSkill>({
  id: TRAIT.MASTER_FENCER,
  name: 'Master Fencer',
  balance: {
    internalCooldown: 8,
    effects: [
      {
        type: 'boon',
        name: 'Self Fury',
        audience: { recipients: 'self' },
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Allied Fury',
        boon: 'fury',
        duration: 4,
        stacks: 1,
        // Personal Fury is separate, leaving all four recipient slots for allies.
        audience: { recipients: 'party', maximumRecipients: 4, affectsSelf: false }
      }
    ]
  }
});

/** Sharper Images shares active tuning with its ordered imperative reactions. */
export const sharperImages = defineTrait<MesmerSkill>({
  id: TRAIT.SHARPER_IMAGES,
  name: 'Sharper Images',
  balance: {
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 5, stacks: 1 }]
  }
});

/** Phantasmal Fury shares active tuning with its ordered imperative reactions. */
export const phantasmalFury = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_FURY,
  name: 'Phantasmal Fury',
  balance: {
    criticalChance: 0.25
  },
  modifierRules: [
    {
      id: 'mesmer.phantasmal-fury-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      order: -1,
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PHANTASMAL_FURY), 'criticalChance'),
      when: (context) => context.event?.summonKind === 'phantasm'
    }
  ]
});

/** Superiority Complex shares active tuning with its ordered imperative reactions. */
export const superiorityComplex = defineTrait<MesmerSkill>({
  id: TRAIT.SUPERIORITY_COMPLEX,
  name: 'Superiority Complex',
  balance: {
    highHealthFactor: 1.15,
    lowHealthOrDisabledFactor: 1.25,
    threshold: 0.5
  },
  modifierRules: [
    {
      id: 'mesmer.superiority-complex',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',

      factor: superiorityComplexFactor,
      when: (context) => !illusionSource(context)
    }
  ]
});

/** Blindness follows the native confusion shatter packets at their existing emission boundary. */
export const blindingDissipation = defineTrait<MesmerSkill>({
  id: TRAIT.BLINDING_DISSIPATION,
  name: 'Blinding Dissipation'
});

/** Mirage invokes this reward only after its dodge has granted cloak. */
export const deceptiveEvasion = defineTrait<MesmerSkill>({ id: TRAIT.DECEPTIVE_EVASION, name: 'Deceptive Evasion' });

/** Only the player's resolved critical hits grant Vigor; illusion critical hits never claim the cooldown. */
export const criticalInfusion = defineTrait<MesmerSkill>({
  id: TRAIT.CRITICAL_INFUSION,
  name: 'Critical Infusion',
  balance: {
    internalCooldown: 10,
    effects: [{ type: 'boon', name: 'vigor', boon: 'vigor', duration: 5, stacks: 1 }]
  },
  triggers: [
    {
      on: 'damage.resolved',
      emit: TRAIT.CRITICAL_INFUSION,
      icd: 'profile',
      when: (_runtime, event, details) =>
        event.actorType === 'player' &&
        (details.hitContext?.damage ?? 0) > 0 &&
        Boolean(details.hitContext?.critEligible && details.hitContext.critical.didCrit)
    }
  ]
});

export const mesmerDuelingTraits = [
  criticalInfusion,
  fencersFinesse,
  ineptitude,
  masterFencer,
  sharperImages,
  phantasmalFury,
  superiorityComplex,
  blindingDissipation,
  deceptiveEvasion
];

/** Only Virtuoso registers this extra Phantasmal Fury contribution; Quiet Intensity supplies its active tuning. */
export const virtuosoPhantasmalFuryRule: Gw2ModifierRule = {
  id: 'mesmer.virtuoso.phantasmal-fury-critical-chance',
  target: MODIFIER_TARGET.CRITICAL_CHANCE,
  operation: 'add',
  amount: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.QUIET_INTENSITY), 'phantasmCriticalChance'),
  when: (context) => context.event?.summonKind === 'phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FURY)
};
