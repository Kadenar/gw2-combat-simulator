import { buildMesmerConditions, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Accepted player or summon control grants Vulnerability before imperative control reactions. */
export const dazzling = defineTrait<MesmerSkill>({
  id: TRAIT.DAZZLING,
  name: 'Dazzling',
  balance: {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }]
  },
  triggers: [
    {
      on: 'control.resolved',
      emit: TRAIT.DAZZLING,
      when: (_runtime, event) => !missesTarget(event) && (event.actorType === 'player' || event.actorType === 'summon'),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Vulnerability',
      attribution: { source: 'Trait', sourceId: TRAIT.DAZZLING, actorType: 'effect', ownerActorType: 'player' }
    }
  ]
});

/** Vulnerability increases owner strikes; clone and phantasm strikes remain excluded. */
export const fragility = defineTrait<MesmerSkill>({
  id: TRAIT.FRAGILITY,
  name: 'Fragility',
  modifierRules: [
    {
      id: 'mesmer.fragility',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: Object.freeze({ baseFactor: 1, damagePerStack: 0.005 }),
      factor: (context, _target, parameters) =>
        parameters.baseFactor +
        (context.query?.vulnerabilityStacksAt(context.time, context.runtime) || 0) * parameters.damagePerStack,
      order: 95,
      when: (context) => !illusionSource(context)
    }
  ]
});

/** The simulated target has no boons, so selected Vicious Expression always grants its strike bonus. */
export const viciousExpression = defineTrait<MesmerSkill>({
  id: TRAIT.VICIOUS_EXPRESSION,
  name: 'Vicious Expression',
  modifierRules: [
    {
      id: 'mesmer.vicious-expression',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // The target never has boons, so the full bonus always applies.
      factor: 1.15,
      order: 96
    }
  ]
});

/** Only clone and phantasm strikes receive the selected illusion multiplier. */
export const empoweredIllusions = defineTrait<MesmerSkill>({
  id: TRAIT.EMPOWERED_ILLUSIONS,
  name: 'Empowered Illusions',
  modifierRules: [
    {
      id: 'mesmer.empowered-illusions',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      order: 97,
      when: (context) => illusionSource(context)
    }
  ]
});

/** The first eligible shatter strike uses the activating or idle target multiplier. */
export const mentalAnguish = defineTrait<MesmerSkill>({
  id: TRAIT.MENTAL_ANGUISH,
  name: 'Mental Anguish',
  modifierRules: [
    {
      id: 'mesmer.mental-anguish',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: Object.freeze({
        activatingFactor: 1.25,
        idleFactor: 1.5
      }),
      factor: (context, _target, parameters) =>
        context.config?.target?.activatingSkills ? parameters.activatingFactor : parameters.idleFactor,
      order: 99,
      // Repeat packets are still shatter damage, but the skill contract limits shatter traits to the first strike.
      when: (context) => Boolean(context.event?.metadata?.shatterTraitEligible)
    }
  ]
});

/** At fixed full player health, Egotism benefits owner strikes only after the target loses health. */
export const egotism = defineTrait<MesmerSkill>({
  id: TRAIT.EGOTISM,
  name: 'Egotism',
  modifierRules: [
    {
      id: 'mesmer.egotism',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      order: 100,
      when: (context) => !illusionSource(context) && remainingTargetHealthBelow(context.config, context.runtime, 1)
    }
  ]
});

/** Extra berserkers and committed Mirror Blade bounces share the same active balance profile. */
export const bountifulBlades = defineTrait<MesmerSkill>({
  id: TRAIT.BOUNTIFUL_BLADES,
  name: 'Bountiful Blades',
  balance: {
    // Extra berserker entities retain summon ownership and the preview's summon exclusion.
    damagePreviewAttribution: 'summon',
    summons: 2,
    damageMultiplier: 0.66,
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        ticks: [
          { atMs: 1240, coefficient: 0.0000064 },
          { atMs: 1400, coefficient: 0.000000256 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});

/** Shatters apply Vulnerability per source; instrument impacts use their own resolved hit packets. */
export const rendingShatter = defineTrait<MesmerSkill>({
  id: TRAIT.RENDING_SHATTER,
  name: 'Rending Shatter',
  balance: {
    effects: [{ type: 'condition', name: 'Vulnerability', condition: 'Vulnerability', stacks: 1, duration: 8 }]
  },
  triggers: [
    {
      on: 'damage.resolved',
      emit: TRAIT.RENDING_SHATTER,
      when: (runtime, event) => {
        const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
        return (
          !missesTarget(event) && event.sourceId === skill?.id && Boolean(skill.instrument || skill.crescendoProfileId)
        );
      }
    }
  ]
});

/** Preserve shatter impact timing while counting each clone or spent blade only once, including defensive shatters. */
export function triggerRendingShatter(context: MesmerRuntime, resolution: MesmerShatterResolution): void {
  if (!hasTrait(context, TRAIT.RENDING_SHATTER) || !resolution.traitHits.length) return;
  const effect = requireEffect(
    requireBalanceProfileFromContext(context, TRAIT.RENDING_SHATTER),
    'condition',
    'Vulnerability'
  );
  if (!effect) return;
  const mechanics = mesmerMechanicsFor(context);
  const kind = mechanics.shatters[resolution.skill.id]?.kind;
  const hits =
    kind === 'blade-control' || kind === 'blade-defense'
      ? [{ at: resolution.traitHits[0].at, count: resolution.spent }]
      : kind?.startsWith('blade-')
        ? resolution.traitHits.slice(0, resolution.spent)
        : resolution.traitHits;
  for (const hit of hits) {
    if (hit.count <= 0) continue;
    buildMesmerConditions(
      context,
      resolution.skill.name,
      hit.at,
      {
        name: 'Vulnerability',
        duration: effect.duration,
        stacks: Number(effect.stacks) * hit.count
      },
      'Player',
      `${resolution.skill.name} — Rending Shatter`,
      {
        source: 'Trait',
        sourceId: TRAIT.RENDING_SHATTER,
        skillId: resolution.skill.id,
        actorType: 'player'
      }
    ).forEach((packet) => {
      context.effects.emit({
        ...resolution.delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  }
}

export const mesmerDominationTraits = [
  rendingShatter,
  dazzling,
  fragility,
  viciousExpression,
  empoweredIllusions,
  mentalAnguish,
  egotism,
  bountifulBlades
];
