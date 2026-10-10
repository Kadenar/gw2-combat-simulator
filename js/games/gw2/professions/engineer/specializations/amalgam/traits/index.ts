import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { activeEngineerSpecializationState } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  amalgamStruck,
  type AmalgamStrike
} from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-effects.js';
import {
  amalgamEvolved,
  amalgamMorphed,
  type AmalgamMorph
} from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';
import { resolveAmalgamSkillId } from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { applyAmalgamStrain } from '#gw2/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { amalgamMaximumAmmo, morphStrike } from '#gw2/professions/engineer/specializations/amalgam/traits/behavior.js';
import type { EngineerResolverEvent, EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** Owns Carbolic Composition tuning and its existing Morph/Evolve contribution. */
export const carbolicComposition = defineTrait({
  id: TRAIT.CARBOLIC_COMPOSITION,
  name: 'Carbolic Composition',
  balance: {
    conditionDurationBonus: 0.33,
    effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', stacks: 1, duration: 3 }]
  },
  triggers: [
    onTriggerPoint(amalgamStruck, {
      when: (runtime, { cause }: AmalgamStrike) => isAmalgamSkillHit(runtime, cause),
      run: applyCarbolicPoison
    })
  ],
  attributes: ({ balanceContext }) => ({
    traitDurations: {
      'Poison Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.CARBOLIC_COMPOSITION),
          'conditionDurationBonus'
        )
    }
  })
});

/** Owns Double Helix tuning and its existing Morph/Evolve contribution. */
export const doubleHelix = defineTrait({
  id: TRAIT.DOUBLE_HELIX,
  name: 'Double Helix',
  hooks: {
    maximumAmmo: amalgamMaximumAmmo,
    modifySkillId: (context, skillId) => resolveAmalgamSkillId(context.hasTrait(TRAIT.DOUBLE_HELIX), skillId)
  }
});

/** Owns Mercurial Tendencies tuning and its existing Morph/Evolve contribution. */
export const mercurialTendencies = defineTrait({
  id: TRAIT.MERCURIAL_TENDENCIES,
  name: 'Mercurial Tendencies',
  balance: {
    internalCooldown: 0.24,
    rechargeReduction: 2.5
  },
  // Selected control admission owns recharge rewards; only actual reductions consume the interval.
  triggers: [{ on: 'control.resolved', run: reactToMercurialTendencies }]
});

/** Owns Hybrid Vigor tuning and its existing Morph/Evolve contribution. */
export const hybridVigor = defineTrait({
  id: TRAIT.HYBRID_VIGOR,
  name: 'Hybrid Vigor',
  balance: { attributeBonus: 240 },
  attributes: traitAttributeEffects(TRAIT.HYBRID_VIGOR, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Willing Host tuning and its existing Morph/Evolve contribution. */
export const willingHost = defineTrait({
  id: TRAIT.WILLING_HOST,
  name: 'Willing Host',
  balance: {
    damageIncrease: 0.05,
    conditionDamageIncrease: 0.05,
    durationMultiplier: 10
  },
  triggers: [onTriggerPoint(amalgamMorphed, { run: extendWillingHost })],
  modifierRules: [
    {
      id: 'engineer.willing-host',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      // Strike and condition balance remain independently editable.
      amount: (context, target) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.WILLING_HOST),
          target === MODIFIER_TARGET.CONDITION_DAMAGE ? 'conditionDamageIncrease' : 'damageIncrease'
        ),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        activeEngineerSpecializationState(context, 'Amalgam', 'willingHostUntil')
    }
  ]
});

/** Owns Symbiotic Synergy tuning and its existing Morph/Evolve contribution. */
export const symbioticSynergy = defineTrait({
  id: TRAIT.SYMBIOTIC_SYNERGY,
  name: 'Symbiotic Synergy',
  // The trait balance owns tuning consumed by damage rules and presentation.
  balance: { damageIncrease: 0.33 },
  triggers: [onTriggerPoint(amalgamEvolved, { run: resetMorphRecharge })],
  modifierRules: [
    {
      id: 'engineer.symbiotic-synergy',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SYMBIOTIC_SYNERGY), 'damageIncrease'),
      when: (context) => morphStrike(context)
    }
  ]
});

/** Owns Silver Lining tuning and its existing Morph/Evolve contribution. */
export const silverLining = defineTrait({
  id: TRAIT.SILVER_LINING,
  name: 'Silver Lining',
  // Morph grants its protocol strain; Evolve then skips the strains it would otherwise grant.
  triggers: [
    onTriggerPoint(amalgamMorphed, {
      when: (_runtime, { morphKind }: AmalgamMorph) => Boolean(morphKind),
      run: grantMorphStrain
    })
  ]
});

/** Owns New Genes tuning and its existing Morph/Evolve contribution. */
export const newGenes = defineTrait({
  id: TRAIT.NEW_GENES,
  name: 'New Genes',
  balance: {
    effects: [
      { name: 'alacrity', type: 'boon', boon: 'alacrity', stacks: 1, duration: 5 },
      { name: 'might', type: 'boon', boon: 'might', stacks: 4, duration: 12 },
      { name: 'cleanse', type: 'boon', boon: 'aegis', stacks: 1, duration: 4, metadata: { trigger: 'cleanse' } },
      { name: 'protect', type: 'boon', boon: 'protection', stacks: 1, duration: 4, metadata: { trigger: 'protect' } },
      { name: 'thorns', type: 'boon', boon: 'stability', stacks: 2, duration: 4, metadata: { trigger: 'thorns' } },
      { name: 'demolish', type: 'boon', boon: 'swiftness', stacks: 1, duration: 6, metadata: { trigger: 'demolish' } },
      { name: 'obliterate', type: 'boon', boon: 'might', stacks: 5, duration: 12, metadata: { trigger: 'obliterate' } },
      { name: 'pierce', type: 'boon', boon: 'vigor', stacks: 1, duration: 4, metadata: { trigger: 'pierce' } },
      { name: 'shred', type: 'boon', boon: 'fury', stacks: 1, duration: 6, metadata: { trigger: 'shred' } }
    ]
  },
  triggers: [onTriggerPoint(amalgamMorphed, { run: grantNewGenes })]
});

/** Owns Hardened Chrome tuning and its existing Morph/Evolve contribution. */
export const hardenedChrome = defineTrait({
  id: TRAIT.HARDENED_CHROME,
  name: 'Hardened Chrome',
  balance: {
    minimumStacks: 2.5,
    maximumStacks: 4
  },
  // Morph and Evolve share protection attribution while choosing their own duration field.
  triggers: [
    onTriggerPoint(amalgamMorphed, {
      run: (runtime: EngineerRuntime) => grantHardenedChrome(runtime, 'minimumStacks')
    }),
    onTriggerPoint(amalgamEvolved, { run: (runtime: EngineerRuntime) => grantHardenedChrome(runtime, 'maximumStacks') })
  ]
});

/** Registers amalgam traits in the established gameplay order. */
export const amalgamTraits = [
  willingHost,
  symbioticSynergy,
  carbolicComposition,
  newGenes,
  hardenedChrome,
  hybridVigor,
  mercurialTendencies,
  doubleHelix,
  silverLining
];

/** Willing Host's damage window extends from each committed Morph. */
function extendWillingHost(context: EngineerRuntime, { at }: AmalgamMorph): void {
  const state = amalgamState.from(context);
  const willingHostProfile = requireBalanceProfileFromContext(context, TRAIT.WILLING_HOST);
  state.willingHostUntil = Math.max(
    state.willingHostUntil,
    at + balanceProfileNumber(willingHostProfile, 'durationMultiplier')
  );
}

/** Grants Hardened Chrome protection with the duration field of the transition that triggered it. */
function grantHardenedChrome(context: EngineerRuntime, durationField: 'minimumStacks' | 'maximumStacks'): void {
  const sourceSkill = context.helpers.skillsById.get(TRAIT.HARDENED_CHROME) || {
    id: TRAIT.HARDENED_CHROME,
    name: 'Hardened Chrome'
  };
  const hardenedChromeProfile = requireBalanceProfileFromContext(context, TRAIT.HARDENED_CHROME);
  buildEngineerPackets(
    'buff',
    {
      at: context.time,
      source: 'engineer',
      sourceId: TRAIT.HARDENED_CHROME,
      actorType: 'player',
      skillName: 'Hardened Chrome',
      name: 'Hardened Chrome',
      kind: 'protection',
      duration: balanceProfileNumber(hardenedChromeProfile, durationField),
      stacks: 1
    },
    sourceSkill
  ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
}

/** Silver Lining applies the committed protocol's strain at Morph time. */
function grantMorphStrain(context: EngineerRuntime, { morphKind, at }: AmalgamMorph): void {
  applyAmalgamStrain(context, morphKind!, at);
}

/** New Genes combines universal boons with one protocol-specific boon; each survives patches independently. */
function grantNewGenes(context: EngineerRuntime, { morphKind, at }: AmalgamMorph): void {
  for (const name of ['alacrity', 'might', ...(morphKind ? [morphKind] : [])]) {
    const newGenesProfile = requireBalanceProfileFromContext(context, TRAIT.NEW_GENES);
    const boon = requireEffect(newGenesProfile, 'boon', name);
    if (!boon) continue;
    emitTraitProfile(context, TRAIT.NEW_GENES, TRAIT.NEW_GENES, undefined, {
      at,
      effect: { type: 'boon', name },
      attribution: { source: 'engineer', actorType: 'player', skillName: 'New Genes', name: 'New Genes' },
      transform: (event) => ({
        ...event,
        metadata: undefined,
        applicationIndex: undefined,
        totalApplications: undefined
      })
    });
  }
}

/**
 * Evolve recharges its morph skills as part of its traited kit. This is not a discrete trait proc, so the reset is
 * applied silently; reporting it misstated the summed remaining recharge as one Evolve cooldown reduction.
 */
function resetMorphRecharge(context: EngineerRuntime): void {
  for (const skillId of amalgamState.from(context).selectedMorphSkillIds) context.cooldownController.clear(skillId);
}

/** Carbolic accepts Amalgam skill hits and the Rapacious effect, while excluding summons. */
function isAmalgamSkillHit(context: Pick<MechanicQueryContext, 'helpers'>, event: EngineerResolverEvent): boolean {
  if (event.actorType === 'summon') return false;
  // Rapacious Strain fires as an "effect" actor after player hits. Allow it
  // through so Carbolic Composition also procs on Rapacious damage.
  if (event.actorType === 'effect') {
    return event.sourceId === 'engineer.rapacious-strain';
  }

  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  return Boolean(
    skill?.specialization === 'Amalgam' ||
    skill?.categories?.includes('Amalgam') ||
    skill?.categories?.includes('Morph')
  );
}

/** Eligible Amalgam and Rapacious hits apply trait-owned Poison before Rapacious checks its own proc. */
function applyCarbolicPoison(context: EngineerRuntime, { cause: event }: AmalgamStrike): void {
  const carbolicCompositionProfile = requireBalanceProfileFromContext(context, TRAIT.CARBOLIC_COMPOSITION);
  const poison = requireEffect(carbolicCompositionProfile, 'condition', 'Poisoned');
  if (poison) {
    emitTraitProfile(context, TRAIT.CARBOLIC_COMPOSITION, TRAIT.CARBOLIC_COMPOSITION, undefined, {
      at: event.at,
      effect: { type: 'condition', name: 'Poisoned' },
      settlement: 'reaction',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CARBOLIC_COMPOSITION,
        actorType: 'effect',
        skillId: undefined,
        activationId: undefined,
        skillName: 'Carbolic Composition',
        triggeredBy: event.skillName,
        offTarget: event.offTarget,
        metadata: {},
        ownerActorType: 'player'
      },
      transform: (packet) => ({
        ...packet,
        applicationIndex: undefined,
        totalApplications: undefined,
        name: 'Carbolic Composition' + ' \u2014 ' + packet.condition,
        stacks: Number(poison.stacks),
        duration: Number(poison.duration)
      })
    });
  }
}

/** Accepted non-summon control consumes its internal cooldown only when Evolve recharge actually decreases. */
function reactToMercurialTendencies(context: EngineerRuntime, event: EngineerResolverEvent): void {
  if (event.actorType === 'summon') return;
  const at = event.at;
  if (!isInternalCooldownReady(at, context.procs.deadline('mercurialTendencies') || 0)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.MERCURIAL_TENDENCIES);
  let reducedBy = 0;
  for (const id of [ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX]) {
    const skill = context.helpers.skillsById.get(id);
    if (skill)
      reducedBy += context.cooldownController.reduceSkillRecharge(
        skill,
        balanceProfileNumber(profile, 'rechargeReduction'),
        at
      );
  }

  if (!(reducedBy > 0)) return;
  context.procs.setDeadline('mercurialTendencies', at + balanceProfileNumber(profile, 'internalCooldown'));
  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.MERCURIAL_TENDENCIES, actorType: 'effect' },
    announcement: {
      name: 'Mercurial Tendencies',
      at: at,
      cooldownReduction: reducedBy,
      type: 'trait',
      sourceSkill: event.skillName || event.name
    }
  });
}
