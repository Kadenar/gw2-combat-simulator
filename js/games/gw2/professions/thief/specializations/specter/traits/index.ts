import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { alliedBarrierGranted } from '#gw2/professions/thief/specializations/specter/skills/barrier.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';

import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import { ROT_WALLOW_VENOM_ICON } from '#gw2/professions/thief/specializations/specter/traits/behavior.js';

/** Owns Amplified Siphoning tuning and behavior at the existing execution boundaries. */
export const amplifiedSiphoning = defineTrait({
  id: TRAIT.AMPLIFIED_SIPHONING,
  name: 'Amplified Siphoning',
  balance: { resourceGain: 10 }
});

/** Owns Dark Sentry tuning and behavior at the existing execution boundaries. */
export const darkSentry = defineTrait({
  id: TRAIT.DARK_SENTRY,
  name: 'Dark Sentry',
  balance: {
    internalCooldown: 1,
    effects: [
      {
        type: 'buff',
        name: 'rot-wallow-venom',
        kind: 'rot-wallow-venom',
        stacks: 1,
        duration: 10
      },
      { type: 'condition', name: 'Torment', condition: 'Torment', stacks: 1, duration: 2 }
    ]
  },
  // Dark Sentry is an implicit minor; isolation suppresses admission while admitted ally venom still completes.
  triggers: [
    onTriggerPoint(alliedBarrierGranted, {
      requiresSelection: false,
      run(runtime, input: TriggerPointInput<typeof alliedBarrierGranted>) {
        runtime.schedule('thief.specter-dark-sentry', runtime.time, input);
      }
    })
  ],
  lifetime: { tasks: { 'thief.specter-dark-sentry': applyDarkSentry } }
});

/** Owns Larcenous Torment tuning and behavior at the existing execution boundaries. */
export const larcenousTorment = defineTrait({
  id: TRAIT.LARCENOUS_TORMENT,
  name: 'Larcenous Torment',
  balance: {
    resourceGain: 0.5,
    effects: [
      {
        type: 'strike',
        name: 'Larcenous Torment',
        flatStrikeBase: 99,
        flatStrikePowerCoeff: 0.005,
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [{ on: 'condition.applied', run: applyLarcenousTorment }]
});

/** Owns Second Opinion tuning and behavior at the existing execution boundaries. */
export const secondOpinion = defineTrait({
  id: TRAIT.SECOND_OPINION,
  name: 'Second Opinion',
  balance: {
    attributeBonus: 90,
    attributePerStack: 90,
    attributeConversion: 0.07
  },
  buildAttributes(_common, { build, weaponSet, balanceContext }) {
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const secondOpinionProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.SECOND_OPINION);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount:
            balanceProfileNumber(secondOpinionProfile, 'attributeBonus') +
            (weapons.includes('Scepter') ? balanceProfileNumber(secondOpinionProfile, 'attributePerStack') : 0),
          feedsConversions: true
        },
        {
          kind: 'conversion',
          from: 'Condition Damage',
          to: 'Healing Power',
          multiplier: balanceProfileNumber(secondOpinionProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** All three shroud rewards use compiled cast commitment, independently of intrinsic skill effects. */
export const shadestep = defineTrait({
  id: TRAIT.SHADESTEP,
  name: 'Shadestep',
  balance: {
    effects: [
      { type: 'boon', name: 'alacrity', boon: 'alacrity', stacks: 1, duration: 5 },
      { type: 'boon', name: 'protection', boon: 'protection', stacks: 1, duration: 5 },
      { type: 'boon', name: 'aegis', boon: 'aegis', stacks: 1, duration: 4 }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SHADESTEP,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.GRASPING_SHADOWS && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
      effects: (effect) => effect.type === 'boon' && effect.name === 'alacrity',
      attribution: { actorType: 'player', name: 'Shade Step - alacrity', audience: { recipients: 'party' } }
    },
    {
      emit: TRAIT.SHADESTEP,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.DAWNS_REPOSE && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
      effects: (effect) => effect.type === 'boon' && effect.name === 'protection',
      attribution: { actorType: 'player', name: 'Shade Step - protection', audience: { recipients: 'party' } }
    },
    {
      emit: TRAIT.SHADESTEP,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.MIND_SHOCK && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
      effects: (effect) => effect.type === 'boon' && effect.name === 'aegis',
      attribution: { actorType: 'player', name: 'Shade Step - aegis', audience: { recipients: 'party' } }
    }
  ]
});

/** Owns Strength of Shadows tuning and behavior at the existing execution boundaries. */
export const strengthOfShadows = defineTrait({
  id: TRAIT.STRENGTH_OF_SHADOWS,
  name: 'Strength of Shadows',
  modifierRules: [
    {
      order: 300,
      id: 'thief.strength-of-shadows',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.2,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.event?.condition === 'Torment'
    }
  ],
  balance: {
    attributeConversion: 0.13
  },
  buildAttributes(_common, { balanceContext }) {
    const strengthOfShadowsProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.STRENGTH_OF_SHADOWS);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Vitality',
          to: 'Expertise',
          multiplier: balanceProfileNumber(strengthOfShadowsProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** Native trait owners, in stable authoring order. */
export const specterTraits = Object.freeze([
  amplifiedSiphoning,
  shadestep,
  larcenousTorment,
  darkSentry,
  secondOpinion,
  strengthOfShadows
]);

/** Barrier on allies arms Dark Sentry's per-ally venom and its queued allied Torment. */
function applyDarkSentry(runtime: ThiefRuntime, data: unknown): void {
  const party = gw2AlliedPlayerAssumptions(runtime.config);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DARK_SENTRY);
  const venom = requireEffect(profile, 'buff', 'rot-wallow-venom');
  if (!venom) return;
  // Claim only validated, distinct allies after confirming that venom can be granted.
  const allies = [
    ...new Set(
      ((data as { allyIndices?: readonly number[] }).allyIndices ?? [])
        .map(Number)
        .filter((ally) => Number.isInteger(ally) && ally >= 1 && ally <= party.count)
    )
  ].filter((ally) => runtime.procs.claim(TRAIT.DARK_SENTRY, `thief.specter.darkSentry:${ally}`, runtime.time));
  if (!allies.length) return;
  const torment = requireEffect(profile, 'condition', 'Torment');
  const venomDuration = effectNumber(profile, venom, 'duration');
  emitTraitProfile(runtime, TRAIT.DARK_SENTRY, TRAIT.DARK_SENTRY, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'buff', name: 'rot-wallow-venom' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.DARK_SENTRY,
      skillId: TRAIT.DARK_SENTRY,
      skillName: 'Dark Sentry',
      name: 'Rot Wallow Venom',
      icon: ROT_WALLOW_VENOM_ICON,
      audience: { recipients: 'party', affectsSelf: false, maximumRecipients: allies.length },
      actorType: 'player'
    },
    transform: (packet) => ({ ...packet, duration: venomDuration, fixedDuration: true })
  });
  if (!torment) return;
  // Barrier grants stack per recipient; one shared strike consumes only one surviving batch.
  runtime.alliedStrikes.registerRecipients(
    (allyIndex) => ({
      id: `rot-wallow:${runtime.time}:${allyIndex}`,
      expiresAt: runtime.time + venomDuration,
      inclusiveExpiry: true,
      charges: effectNumber(profile, venom, 'stacks'),
      consumptionGroup: 'rot-wallow',
      trigger(proc) {
        emitTraitProfile(runtime, TRAIT.DARK_SENTRY, TRAIT.DARK_SENTRY, undefined, {
          at: proc.at,
          fullEnd: proc.at,
          effect: { type: 'condition', name: 'Torment' },
          attribution: {
            source: 'Trait',
            skillId: TRAIT.DARK_SENTRY,
            skillName: 'Rot Wallow Venom',
            name: `Rot Wallow Venom - Ally ${proc.allyIndex} Torment`,
            icon: ROT_WALLOW_VENOM_ICON,
            activationId: proc.activationId,
            metadata: { triggeredByAlly: proc.allyIndex },
            actorType: 'player',
            sourceId: TRAIT.DARK_SENTRY
          }
        });
      }
    }),
    { allyIndices: allies }
  );
}

/**
 * Each applied player Torment grants Shadow Force outside the shroud and one life siphon per stack, whether or not
 * the shroud is active.
 */
function applyLarcenousTorment(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  if (
    application.condition !== 'Torment' ||
    application.actorType !== 'player' ||
    !hasTrait(runtime, TRAIT.LARCENOUS_TORMENT)
  )
    return;
  const stacks = Math.max(0, Math.trunc(application.stacks || 0));
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.LARCENOUS_TORMENT);
  const strike = requireEffect(profile, 'strike', 'Larcenous Torment');
  if (strike)
    for (let stack = 1; stack <= stacks; stack += 1)
      emitTraitProfile(runtime, TRAIT.LARCENOUS_TORMENT, TRAIT.LARCENOUS_TORMENT, application, {
        at: runtime.time,
        fullEnd: runtime.time,
        effect: { type: 'strike', name: 'Larcenous Torment' },
        // Each consumed Torment stack produces an independent siphon, with the application retained as its cause.
        transform: ({ activationId: _activation, ...packet }) => packet,
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.LARCENOUS_TORMENT,
          actorType: 'effect',
          ownerActorType: 'player',
          skillId: TRAIT.LARCENOUS_TORMENT,
          skillName: 'Larcenous Torment',
          name: 'Larcenous Torment - Life Siphon',
          triggeredBy: application.skillName
        }
      });
  if (!specterState.from(runtime).shadowShroudActive && stacks > 0)
    runtime.resourceController.grant('shadowForce', stacks * balanceProfileNumber(profile, 'resourceGain'));
}
