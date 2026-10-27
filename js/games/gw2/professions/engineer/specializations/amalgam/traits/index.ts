import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { requireBalanceNumber } from '#gw2/platform/effects/validation.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireSkillFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { activeAmalgamState } from '#gw2/professions/engineer/specializations/amalgam/mechanics/modifier-queries.js';
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
import type {
  EngineerModifierContext,
  EngineerResolverEvent,
  EngineerRuntime
} from '#gw2/professions/engineer/types.js';

/** Double Helix chooses the Evolved bonus without changing the shared pre-profession conversion pool. */
export function evolveAttributeFactor(context: EngineerModifierContext): number {
  if (hasTrait(context, TRAIT.DOUBLE_HELIX))
    return balanceNumberFromContext(context, TRAIT.DOUBLE_HELIX, 'coefficientMultiplier');

  const skill = requireSkillFromContext(context, ID.EVOLVE_BASE);
  return requireBalanceNumber(skill.attributeMultiplier, `${skill.name} attributeMultiplier`);
}

/** Restrict Symbiotic Synergy to player-owned Morph strikes. */
function morphStrike(context: EngineerModifierContext): boolean {
  return Boolean(
    isGw2PlayerModifierOwnedEvent(context.event) &&
    skillForEvent(context.profession?.catalog, context.event, context.skillId)?.categories?.includes('Morph')
  );
}

/** Owns Carbolic Composition tuning and its existing Morph/Evolve contribution. */
const carbolicComposition = defineTrait({
  name: 'Carbolic Composition',
  id: TRAIT.CARBOLIC_COMPOSITION,
  balance: {
    conditionDurationBonus: 0.33,
    effects: [{ name: CONDITION.POISONED, type: 'condition', condition: CONDITION.POISONED, stacks: 1, duration: 3 }]
  },
  attributes: ({ balanceContext }) => ({
    traitDurations: {
      'Poison Duration':
        100 * balanceNumberFromContext(balanceContext, TRAIT.CARBOLIC_COMPOSITION, 'conditionDurationBonus')
    }
  }),
  triggers: [
    onTriggerPoint(amalgamStruck, {
      when: (runtime, { cause }: AmalgamStrike) => isAmalgamSkillHit(runtime, cause),
      run: applyCarbolicPoison
    })
  ]
});

/** Owns Double Helix tuning and its existing Morph/Evolve contribution. */
const doubleHelix = defineTrait({
  name: 'Double Helix',
  id: TRAIT.DOUBLE_HELIX,
  // Trait-owned scaling keeps patch notes scoped to builds selecting the stronger Evolve bonus.
  balance: { coefficientMultiplier: 1.2 },
  hooks: {
    modifySkillId: (context, skillId) => resolveAmalgamSkillId(context.hasTrait(TRAIT.DOUBLE_HELIX), skillId)
  }
});

/** Owns Mercurial Tendencies tuning and its existing Morph/Evolve contribution. */
const mercurialTendencies = defineTrait({
  name: 'Mercurial Tendencies',
  id: TRAIT.MERCURIAL_TENDENCIES,
  balance: {
    internalCooldown: 0.24,
    rechargeReduction: 2.5
  },
  // Selected control admission owns recharge rewards; only actual reductions consume the interval.
  triggers: [{ on: 'control.resolved', run: reactToMercurialTendencies }]
});

/** Owns Hybrid Vigor tuning and its existing Morph/Evolve contribution. */
const hybridVigor = defineTrait({
  name: 'Hybrid Vigor',
  id: TRAIT.HYBRID_VIGOR,
  balance: { attributeBonus: 240 },
  attributes: traitAttributeEffects(TRAIT.HYBRID_VIGOR, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: 'none' }
  ])
});

/** Owns Willing Host tuning and its existing Morph/Evolve contribution. */
const willingHost = defineTrait({
  name: 'Willing Host',
  id: TRAIT.WILLING_HOST,
  balance: {
    damageIncrease: 0.05,
    conditionDamageIncrease: 0.05,
    duration: 10
  },
  modifierRules: [
    {
      id: 'engineer.willing-host',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      // Strike and condition balance remain independently editable.
      amount: (context, target) =>
        balanceNumberFromContext(
          context,
          TRAIT.WILLING_HOST,
          target === MODIFIER_TARGET.CONDITION_DAMAGE ? 'conditionDamageIncrease' : 'damageIncrease'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeAmalgamState(context, 'willingHostUntil')
    }
  ],
  triggers: [onTriggerPoint(amalgamMorphed, { run: extendWillingHost })]
});

/** Owns Symbiotic Synergy tuning and its existing Morph/Evolve contribution. */
const symbioticSynergy = defineTrait({
  name: 'Symbiotic Synergy',
  id: TRAIT.SYMBIOTIC_SYNERGY,
  // The trait balance owns tuning consumed by damage rules and presentation.
  balance: { damageIncrease: 0.33 },
  modifierRules: [
    {
      id: 'engineer.symbiotic-synergy',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.SYMBIOTIC_SYNERGY, 'damageIncrease'),
      when: (context) => morphStrike(context)
    }
  ],
  triggers: [onTriggerPoint(amalgamEvolved, { run: resetMorphRecharge })]
});

/** Owns Silver Lining tuning and its existing Morph/Evolve contribution. */
const silverLining = defineTrait({
  name: 'Silver Lining',
  id: TRAIT.SILVER_LINING,
  // Morph grants its protocol strain; Evolve then skips the strains it would otherwise grant.
  triggers: [
    onTriggerPoint(amalgamMorphed, {
      when: (_runtime, { morphKind }: AmalgamMorph) => Boolean(morphKind),
      run: grantMorphStrain
    })
  ]
});

/** Owns New Genes tuning and its existing Morph/Evolve contribution. */
const newGenes = defineTrait({
  name: 'New Genes',
  id: TRAIT.NEW_GENES,
  balance: {
    effects: [
      { name: boonKey(BOON.ALACRITY), type: 'boon', boon: BOON.ALACRITY, stacks: 1, duration: 5 },
      { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 4, duration: 12 },
      { name: 'cleanse', type: 'boon', boon: BOON.AEGIS, stacks: 1, duration: 4, metadata: { trigger: 'cleanse' } },
      {
        name: 'protect',
        type: 'boon',
        boon: BOON.PROTECTION,
        stacks: 1,
        duration: 4,
        metadata: { trigger: 'protect' }
      },
      { name: 'thorns', type: 'boon', boon: BOON.STABILITY, stacks: 2, duration: 4, metadata: { trigger: 'thorns' } },
      {
        name: 'demolish',
        type: 'boon',
        boon: BOON.SWIFTNESS,
        stacks: 1,
        duration: 6,
        metadata: { trigger: 'demolish' }
      },
      {
        name: 'obliterate',
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 5,
        duration: 12,
        metadata: { trigger: 'obliterate' }
      },
      { name: 'pierce', type: 'boon', boon: BOON.VIGOR, stacks: 1, duration: 4, metadata: { trigger: 'pierce' } },
      { name: 'shred', type: 'boon', boon: BOON.FURY, stacks: 1, duration: 6, metadata: { trigger: 'shred' } }
    ]
  },
  triggers: [onTriggerPoint(amalgamMorphed, { run: grantNewGenes })]
});

/** Owns Hardened Chrome tuning and its existing Morph/Evolve contribution. */
const hardenedChrome = defineTrait({
  name: 'Hardened Chrome',
  id: TRAIT.HARDENED_CHROME,
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
  state.willingHostUntil = Math.max(
    state.willingHostUntil,
    at + balanceNumberFromContext(context, TRAIT.WILLING_HOST, 'duration')
  );
}

/** Grants Hardened Chrome protection with the duration field of the transition that triggered it. */
function grantHardenedChrome(context: EngineerRuntime, durationField: 'minimumStacks' | 'maximumStacks'): void {
  const sourceSkill = context.helpers.skillsById.get(TRAIT.HARDENED_CHROME) || {
    id: TRAIT.HARDENED_CHROME,
    name: 'Hardened Chrome'
  };
  buildEngineerPackets(
    'buff',
    {
      at: context.time,
      source: 'engineer',
      sourceId: TRAIT.HARDENED_CHROME,
      actorType: ACTOR.PLAYER,
      skillName: 'Hardened Chrome',
      name: 'Hardened Chrome',
      kind: boonKey(BOON.PROTECTION),
      duration: balanceNumberFromContext(context, TRAIT.HARDENED_CHROME, durationField),
      stacks: 1
    },
    sourceSkill
  ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
}

/** Silver Lining applies the committed protocol's strain at Morph time. */
function grantMorphStrain(context: EngineerRuntime, { skill, at }: AmalgamMorph): void {
  applyAmalgamStrain(context, skill, at);
}

/** New Genes combines universal boons with one protocol-specific boon; each survives patches independently. */
function grantNewGenes(context: EngineerRuntime, { morphKind, at }: AmalgamMorph): void {
  for (const name of [boonKey(BOON.ALACRITY), boonKey(BOON.MIGHT), ...(morphKind ? [morphKind] : [])]) {
    const newGenesProfile = requireBalanceProfileFromContext(context, TRAIT.NEW_GENES);
    const boon = requireEffect(newGenesProfile, 'boon', name);

    if (!boon) continue;

    emitTraitProfile(context, TRAIT.NEW_GENES, TRAIT.NEW_GENES, undefined, {
      at,
      effect: { type: 'boon', name },
      attribution: {
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        source: 'engineer',
        actorType: ACTOR.PLAYER,
        skillName: 'New Genes',
        name: 'New Genes'
      },
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
  if (event.actorType === ACTOR.SUMMON) return false;

  // Rapacious Strain fires as an "effect" actor after player hits. Allow it
  // through so Carbolic Composition also procs on Rapacious damage.
  if (event.actorType === ACTOR.EFFECT) {
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
  const poison = requireEffect(carbolicCompositionProfile, 'condition', CONDITION.POISONED);

  if (poison) {
    emitTraitProfile(context, TRAIT.CARBOLIC_COMPOSITION, TRAIT.CARBOLIC_COMPOSITION, undefined, {
      at: event.at,
      effect: { type: 'condition', name: CONDITION.POISONED },
      settlement: 'reaction',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.CARBOLIC_COMPOSITION,
        actorType: ACTOR.EFFECT,
        skillId: undefined,
        activationId: undefined,
        skillName: 'Carbolic Composition',
        triggeredBy: event.skillName,
        offTarget: event.offTarget,

        ownerActorType: ACTOR.PLAYER
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
  if (event.actorType === ACTOR.SUMMON) return;

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
    attribution: { source: 'Trait', sourceId: TRAIT.MERCURIAL_TENDENCIES, actorType: ACTOR.EFFECT },
    announcement: {
      name: 'Mercurial Tendencies',
      at: at,
      cooldownReduction: reducedBy,
      type: 'trait',
      sourceSkill: event.skillName || event.name
    }
  });
}
