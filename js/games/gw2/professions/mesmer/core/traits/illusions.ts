import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { TraitDefinition } from '#gw2/platform/profession-definition/traits.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Own Compounding Power tuning alongside its runtime behavior. */
export const compoundingPower = defineTrait<MesmerSkill>({
  id: TRAIT.COMPOUNDING_POWER,
  name: 'Compounding Power',
  balance: {
    maximumStacks: 5,
    durationMultiplier: 8
  },
  modifierRules: [
    {
      id: 'mesmer.compounding-power',
      requiresSelection: false,
      order: -2,
      conditionSampleInvariant: true,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: Object.freeze({
        duration: 8,
        maximumStacks: 5,
        // Match the supplied PvE logs' embedded buff formulas: 1% outgoing strike damage per active stack.
        strikePerStack: 0.01,
        conditionPerStack: 0.01
      }),
      amount: (context, target, parameters) => {
        // Illusion strikes use summon ownership, while their applied conditions inherit the Mesmer's outgoing modifiers.
        if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
        return (
          timedStacks(context, 'compounding', parameters.duration, parameters.maximumStacks) *
          (target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikePerStack : parameters.conditionPerStack)
        );
      }
    }
  ]
});

/** Own Cry of Pain tuning alongside its runtime behavior. */
export const cryOfPain = defineTrait<MesmerSkill>({
  id: TRAIT.CRY_OF_PAIN,
  name: 'Cry of Pain',
  balance: {
    // This replaces the shatter's confusion package rather than emitting an independently owned proc.
    damagePreviewAttribution: 'skill',
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 4, stacks: 2 }]
  }
});

/** Own Maim the Disillusioned tuning alongside its runtime behavior. */
export const maimTheDisillusioned = defineTrait<MesmerSkill>({
  id: TRAIT.MAIM_THE_DISILLUSIONED,
  name: 'Maim the Disillusioned',
  balance: {
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 6, stacks: 1 }]
  }
});

/** Own Malicious Sorcery tuning alongside its runtime behavior. */
export const maliciousSorcery = defineTrait<MesmerSkill>({
  id: TRAIT.MALICIOUS_SORCERY,
  name: 'Malicious Sorcery',
  balance: { durationMultiplier: 0.25 },
  modifierRules: [
    {
      id: 'mesmer.malicious-sorcery',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.MALICIOUS_SORCERY), 'durationMultiplier'),
      // Panel-derived simulation stats already contain this static bonus; provenance keeps direct simulations compatible.
      when: (context) => context.condition === 'Confusion' && !professionStaticRulesApplied(context.config)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Confusion Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.MALICIOUS_SORCERY),
          'durationMultiplier'
        )
    }
  })
});

/** Own Master of Misdirection tuning alongside its runtime behavior. */
export const masterOfMisdirection = defineTrait<MesmerSkill>({
  id: TRAIT.MASTER_OF_MISDIRECTION,
  name: 'Master of Misdirection',
  balance: { rechargeMultiplier: 0.85 }
});

/** Own Master of Fragmentation tuning alongside its runtime behavior. */
export const masterOfFragmentation = defineTrait<MesmerSkill>({
  id: TRAIT.MASTER_OF_FRAGMENTATION,
  name: 'Master of Fragmentation',
  balance: {
    criticalChance: 0.25,
    durationMultiplier: 1,
    damageIncreasePerStack: 0.3,
    effects: [
      { name: 'Crippled', type: 'condition', condition: 'Crippled', duration: 3, stacks: 1 },
      // provisional 3s Weakness; replace when Deafening Drum's trait duration is confirmed.
      { name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 3, stacks: 1 }
    ]
  },
  modifierRules: [
    {
      id: 'mesmer.master-of-fragmentation-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      order: -2,
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.MASTER_OF_FRAGMENTATION),
          'criticalChance'
        ),
      // Improve every native F1 strike, including repeats, without affecting trait procs or afterimages.
      when: (context) =>
        isGw2PlayerActorEvent(context.event) &&
        context.event?.sourceId === context.event?.skillId &&
        [ID.MIND_WRACK, ID.SPLIT_SECOND, ID.BLADESONG_HARMONY, ID.LIVELY_LUTE, ID.LIVELY_LUTE_ALTERNATE].some(
          (id) => id === context.event?.skillId
        )
    }
  ],
  triggers: [
    // Native shatter impacts inherit their triggering skill while selecting only the matching condition.
    ...(['Weakness', 'Crippled'] as const).map<
      Extract<NonNullable<TraitDefinition['triggers']>[number], { on: 'damage.resolved' }>
    >((condition) => ({
      on: 'damage.resolved' as const,
      when: (_runtime, event) =>
        event.type === 'damage' &&
        isGw2PlayerActorEvent(event) &&
        event.sourceId === event.skillId &&
        !missesTarget(event) &&
        (condition === 'Weakness'
          ? event.skillId === ID.DEAFENING_DRUM
          : [ID.CRY_OF_FRUSTRATION, ID.REWINDER, ID.BLADESONG_SORROW, ID.FLUSTERING_FLUTE].some(
              (id) => id === event.skillId
            )),
      emit: TRAIT.MASTER_OF_FRAGMENTATION,
      effects: (effect) => effect.type === 'condition' && effect.name === condition,
      attribution: (_runtime, event) => ({
        actorType: 'player',
        name: `${event.skillName || TRAIT.MASTER_OF_FRAGMENTATION} — ${condition}`
      })
    }))
  ]
});

/** Own Phantasmal Haste tuning alongside its runtime behavior. */
export const phantasmalHaste = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_HASTE,
  name: 'Phantasmal Haste',
  balance: {
    quicknessCastMultiplier: 1.5
  }
});

/** Own Shatter Storm tuning alongside its runtime behavior. */
export const shatterStorm = defineTrait<MesmerSkill>({
  id: TRAIT.SHATTER_STORM,
  name: 'Shatter Storm',
  balance: {
    maximumStacks: 2
  }
});

/** Own The Pledge tuning alongside its runtime behavior. */
export const thePledge = defineTrait<MesmerSkill>({
  id: TRAIT.THE_PLEDGE,
  name: 'The Pledge',
  balance: {
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', duration: 3, stacks: 2 }]
  }
});

/** Own Phantasmal Force tuning alongside its runtime behavior. */
export const phantasmalForce = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTASMAL_FORCE,
  name: 'Phantasmal Force',
  modifierRules: [
    {
      id: 'mesmer.phantasmal-force',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: Object.freeze({ baseFactor: 1, damagePerMight: 0.01 }),
      factor: (context, _target, parameters) =>
        parameters.baseFactor +
        context.query!.mightStacksAt(context.time, context.runtime, context.event) * parameters.damagePerMight,
      order: 98,
      when: (context) => context.event?.summonKind === 'phantasm'
    }
  ]
});

export const mesmerIllusionsTraits = [
  compoundingPower,
  cryOfPain,
  maimTheDisillusioned,
  maliciousSorcery,
  masterOfMisdirection,
  masterOfFragmentation,
  phantasmalHaste,
  shatterStorm,
  thePledge,
  phantasmalForce
];
