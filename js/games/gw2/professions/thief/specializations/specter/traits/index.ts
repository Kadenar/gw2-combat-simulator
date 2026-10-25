import { WEAPON, ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { barrierRecipients } from '#gw2/platform/combat/barrier.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeChargeCount, consumeChargeBatch, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';

const ROT_WALLOW_VENOM_ICON = 'https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png';

/** Owns Amplified Siphoning tuning and behavior at the existing execution boundaries. */
const amplifiedSiphoning = defineTrait({
  id: TRAIT.AMPLIFIED_SIPHONING,
  name: 'Amplified Siphoning',
  balance: { resourceGain: 10 }
});

/** Owns Dark Sentry tuning and behavior at the existing execution boundaries. */
const darkSentry = defineTrait({
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
      { type: 'condition', name: CONDITION.TORMENT, condition: CONDITION.TORMENT, stacks: 1, duration: 2 }
    ]
  },
  // Dark Sentry is an implicit minor; isolation suppresses admission while admitted ally venom still completes.
  triggers: [
    {
      on: 'buff.applied',
      requiresSelection: false,
      run(runtime, event) {
        if (!isGw2PlayerModifierOwnedEvent(event)) return;

        // Only accepted allied-player recipients can arm venom; self and companions never occupy an ally slot.
        const allyIndices = barrierRecipients(event).flatMap((recipient) =>
          recipient.allyIndex == null ? [] : [recipient.allyIndex]
        );

        if (allyIndices.length)
          runtime.schedule('thief.specter-dark-sentry', runtime.time, { allyIndices, cause: event });
      }
    }
  ],
  lifetime: { tasks: { 'thief.specter-dark-sentry': applyDarkSentry } }
});

/** Owns Larcenous Torment tuning and behavior at the existing execution boundaries. */
const larcenousTorment = defineTrait({
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
const secondOpinion = defineTrait({
  id: TRAIT.SECOND_OPINION,
  name: 'Second Opinion',
  balance: {
    attributeBonus: 90,
    attributePerStack: 90,
    attributeConversion: 0.07
  },
  attributes({ loadout, weaponSet, balanceContext }) {
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    const secondOpinionProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.SECOND_OPINION);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount:
            balanceProfileNumber(secondOpinionProfile, 'attributeBonus') +
            (weapons.includes(WEAPON.SCEPTER) ? balanceProfileNumber(secondOpinionProfile, 'attributePerStack') : 0),
          feedsConversions: 'all'
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

/** Assume a tethered ally is present among nearby allies; share each committed shroud reward with the party. */
const shadestep = defineTrait({
  id: TRAIT.SHADESTEP,
  name: 'Shadestep',
  balance: {
    effects: [
      { type: 'boon', name: boonKey(BOON.ALACRITY), boon: BOON.ALACRITY, stacks: 1, duration: 5 },
      { type: 'boon', name: boonKey(BOON.PROTECTION), boon: BOON.PROTECTION, stacks: 1, duration: 5 },
      { type: 'boon', name: boonKey(BOON.AEGIS), boon: BOON.AEGIS, stacks: 1, duration: 4 }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SHADESTEP,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.GRASPING_SHADOWS && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.ALACRITY),
      attribution: {
        actorType: ACTOR.PLAYER,
        name: 'Shade Step - alacrity',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    },
    {
      emit: TRAIT.SHADESTEP,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.DAWNS_REPOSE && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.PROTECTION),
      attribution: {
        actorType: ACTOR.PLAYER,
        name: 'Shade Step - protection',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    },
    {
      emit: TRAIT.SHADESTEP,
      on: 'castCommit',
      when: (_runtime, cast) =>
        cast.skill.id === ID.MIND_SHOCK && Boolean(cast.skill.shadowShroudSkill) && !castWasInterrupted(cast),
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.AEGIS),
      attribution: {
        actorType: ACTOR.PLAYER,
        name: 'Shade Step - aegis',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    }
  ]
});

/** Owns Strength of Shadows tuning and behavior at the existing execution boundaries. */
const strengthOfShadows = defineTrait({
  id: TRAIT.STRENGTH_OF_SHADOWS,
  name: 'Strength of Shadows',
  modifierRules: [
    {
      order: 300,
      id: 'thief.strength-of-shadows',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      // The Torment-specific bonus multiplies the additive Lead Attacks and Distracting Throw pool.
      operation: 'multiply',
      factor: (context) => 1 + balanceNumberFromContext(context, TRAIT.STRENGTH_OF_SHADOWS, 'conditionDamageIncrease'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.event?.condition === CONDITION.TORMENT
    }
  ],
  balance: {
    conditionDamageIncrease: 0.2,
    attributeConversion: 0.13
  },
  attributes({ balanceContext }) {
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Vitality',
          to: 'Expertise',
          multiplier: balanceNumberFromContext(balanceContext, TRAIT.STRENGTH_OF_SHADOWS, 'attributeConversion'),
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
  const { allyIndices, cause } = data as { allyIndices: readonly number[]; cause: Gw2ResolverEvent };
  const party = gw2AlliedPlayerAssumptions(runtime.config);
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DARK_SENTRY);
  const venom = requireEffect(profile, 'buff', 'rot-wallow-venom');

  if (!venom) return;

  // Claim only validated, distinct allies after confirming that venom can be granted.
  const allies = [
    ...new Set(allyIndices.map(Number).filter((ally) => Number.isInteger(ally) && ally >= 1 && ally <= party.count))
  ].filter((ally) => runtime.procs.claim(TRAIT.DARK_SENTRY, `thief.specter.darkSentry:${ally}`, runtime.time));

  if (!allies.length) return;

  const torment = requireEffect(profile, 'condition', CONDITION.TORMENT);
  const venomDuration = effectNumber(profile, venom, 'duration');
  // Each admitted ally retains its identity in reporting as well as in the on-hit charge owner.
  for (const ally of allies)
    emitTraitProfile(runtime, TRAIT.DARK_SENTRY, TRAIT.DARK_SENTRY, cause, {
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
        audience: {
          recipients: RECIPIENT.PARTY,
          affectsSelf: false,
          alliedPlayerIndex: ally,
          maximumRecipients: 1,
          eligibleCompanionIds: []
        },
        actorType: ACTOR.PLAYER
      },
      transform: (packet) => ({ ...packet, duration: venomDuration, fixedDuration: true })
    });

  if (!torment) return;

  const stacks = effectNumber(profile, venom, 'stacks');
  // Barrier grants stack per ally as native batches with inclusive expiry; Rot Wallow Venom has no player counterpart.
  // One registration per ally offers each strike once, so a strike spends that ally's oldest surviving batch, under the
  // cause of the barrier that granted it.
  runtime.alliedStrikes.registerRecipients(
    (allyIndex, cause) => {
      const state = specterState.from(runtime);
      state.rotWallowVenom[allyIndex] = [
        ...(state.rotWallowVenom[allyIndex] ?? []).filter((grant) => activeChargeCount(grant, runtime.time, true) > 0),
        { ...grantCharges(stacks, runtime.time + venomDuration), cause }
      ];
      const batches = () => specterState.from(runtime).rotWallowVenom[allyIndex] ?? [];
      const next = (time: number) => batches().find((batch) => activeChargeCount(batch, time, true) > 0);
      return {
        id: `rot-wallow:${allyIndex}`,
        isActive: (time) => next(time) != null,
        causeAt: (time) => next(time)?.cause ?? null,
        trigger(proc) {
          if (!consumeChargeBatch(batches(), proc.at, undefined, true)) return false;

          emitTraitProfile(runtime, TRAIT.DARK_SENTRY, TRAIT.DARK_SENTRY, undefined, {
            at: proc.at,
            fullEnd: proc.at,
            effect: { type: 'condition', name: CONDITION.TORMENT },
            attribution: {
              source: 'Trait',
              skillId: TRAIT.DARK_SENTRY,
              skillName: 'Rot Wallow Venom',
              name: `Rot Wallow Venom - Ally ${proc.allyIndex} Torment`,
              icon: ROT_WALLOW_VENOM_ICON,
              activationId: proc.activationId,
              metadata: { triggeredByAlly: proc.allyIndex },
              actorType: ACTOR.PLAYER,
              sourceId: TRAIT.DARK_SENTRY
            }
          });
        }
      };
    },
    { allyIndices: allies }
  );
}

/**
 * Each applied player Torment grants Shadow Force outside the shroud and one life siphon per stack, whether or not
 * the shroud is active.
 */
function applyLarcenousTorment(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  if (
    application.condition !== CONDITION.TORMENT ||
    application.actorType !== ACTOR.PLAYER ||
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
          actorType: ACTOR.EFFECT,
          ownerActorType: ACTOR.PLAYER,
          skillId: TRAIT.LARCENOUS_TORMENT,
          skillName: 'Larcenous Torment',
          name: 'Larcenous Torment - Life Siphon',
          triggeredBy: application.skillName
        }
      });

  if (!specterState.from(runtime).shadowShroudActive && stacks > 0)
    runtime.resourceController.grant('shadowForce', stacks * balanceProfileNumber(profile, 'resourceGain'));
}
