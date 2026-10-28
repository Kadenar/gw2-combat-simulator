// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBoonStacks, buffActive, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { emitTraitProfile, invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { shroudEntered } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import {
  necromancerConditionApplied,
  necromancerStrike,
  necromancerStrikeLifeForce,
  necromancerStrikePreparing
} from '#gw2/professions/necromancer/core/mechanics/trigger-points.js';
import { emitShroudEntryTrait } from '#gw2/professions/necromancer/core/traits/shroud-entry.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime
} from '#gw2/professions/necromancer/types.js';

/** Owns Reaper's Might tuning and behavior at its existing execution boundaries. */
export const reapersMight = defineTrait({
  name: "Reaper's Might",
  id: TRAIT.REAPERS_MIGHT,
  balance: {
    effects: [
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 1,
        duration: 15,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== ACTOR.EFFECT && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyReapersMight(runtime, input.event, input.firstHit, input.shroudSkillOne)
    })
  ]
});

/** Owns Siphoned Power tuning and behavior at its existing execution boundaries. */
export const siphonedPower = defineTrait({
  name: 'Siphoned Power',
  id: TRAIT.SIPHONED_POWER,
  balance: {
    threshold: 0.5,
    cooldown: 1,
    effects: [
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 3,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== ACTOR.EFFECT && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applySiphonedPower(runtime, input.event)
    })
  ]
});

/** Owns Chill of Death tuning and behavior at its existing execution boundaries. */
export const chillOfDeath = defineTrait({
  name: 'Chill of Death',
  id: TRAIT.CHILL_OF_DEATH,
  balance: { threshold: 0.5 },
  triggers: [
    onTriggerPoint(necromancerStrikePreparing, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrikePreparing>) =>
        applyChillOfDeathCondition(runtime, input.event)
    }),
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== ACTOR.EFFECT && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyChillOfDeath(runtime, input.event)
    })
  ]
});

/** Owns Awaken the Pain tuning and behavior at its existing execution boundaries. */
export const awakenThePain = defineTrait({
  name: 'Awaken the Pain',
  id: TRAIT.AWAKEN_THE_PAIN,
  balance: {
    attributePerStack: 10,
    effects: [
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 5,
        duration: 5,
        packetLabel: 'on shroud entry'
      }
    ]
  },
  // The trait portion of Might follows the queried actor, with build assumptions before runtime exists.
  attributes(context) {
    const might =
      context.query?.mightStacksAt(context.time, context.runtime, context.event) ??
      activeBoonStacks(context, boonKey(BOON.MIGHT));
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: might * balanceNumberFromContext(context.balanceContext, TRAIT.AWAKEN_THE_PAIN, 'attributePerStack'),
          feedsConversions: 'none',
          enabled: true
        }
      ]
    };
  },
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        emitShroudEntryTrait(runtime, input.cast, TRAIT.AWAKEN_THE_PAIN)
    })
  ]
});

/** Owns Spiteful Fortitude tuning and behavior at its existing execution boundaries. */
export const spitefulFortitude = defineTrait({
  name: 'Spiteful Fortitude',
  id: TRAIT.SPITEFUL_FORTITUDE,
  balance: { threshold: 0.5, attributeConversion: 0.1, lifeForceGain: 1 },
  attributes: traitAttributeEffects(TRAIT.SPITEFUL_FORTITUDE, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Vitality',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'common'
    }
  ]),
  // The post-hit target threshold gates the reward independently of the passive vitality conversion.
  triggers: [
    onTriggerPoint(necromancerStrikeLifeForce, {
      run(runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrikeLifeForce>) {
        if (!runtime.combat.targetHealthBelow(balanceNumberFromContext(runtime, TRAIT.SPITEFUL_FORTITUDE, 'threshold')))
          return;

        input.percent += balanceNumberFromContext(runtime, TRAIT.SPITEFUL_FORTITUDE, 'lifeForceGain');
      }
    })
  ]
});

/** Owns Signets of Suffering tuning and behavior at its existing execution boundaries. */
export const signetsOfSuffering = defineTrait({
  name: 'Signets of Suffering',
  id: TRAIT.SIGNETS_OF_SUFFERING,
  balance: {
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 1413,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      order: 1,

      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Signet')),
      emit: TRAIT.SIGNETS_OF_SUFFERING,
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Signets of Suffering',
        name: 'Signets of Suffering',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Unequipped'
      })
    }
  ]
});

/** Owns Bitter Chill tuning and behavior at its existing execution boundaries. */
export const bitterChill = defineTrait({
  name: 'Bitter Chill',
  id: TRAIT.BITTER_CHILL,
  balance: {
    effects: [
      { name: CONDITION.VULNERABILITY, type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 3, duration: 8 }
    ]
  },
  triggers: [
    onTriggerPoint(necromancerConditionApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyBitterChill(runtime, input.event)
    })
  ]
});

/** Owns Malicious Swarm tuning and behavior at its existing execution boundaries. */
export const maliciousSwarm = defineTrait({
  name: 'Malicious Swarm',
  id: TRAIT.MALICIOUS_SWARM,
  triggers: [
    {
      order: 0,
      on: 'castCommit',
      invoke: ID.LESSER_SIGNET_OF_THE_LOCUST,
      cooldown: 'skill',
      when: (_runtime, cast) => cast.skill.type === 'Heal'
    }
  ]
});

/** Owns Spiteful Spirit tuning and behavior at its existing execution boundaries. */
export const spitefulSpirit = defineTrait({
  name: 'Spiteful Spirit',
  id: TRAIT.SPITEFUL_SPIRIT,
  balance: {
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        emitShroudEntryTrait(runtime, input.cast, TRAIT.SPITEFUL_SPIRIT)
    })
  ]
});

/** Owns Dread tuning and behavior at its existing execution boundaries. */
export const dread = defineTrait({
  name: 'Dread',
  id: TRAIT.DREAD,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: {
    duration: 3,
    damageIncrease: 0.2
  },
  modifierRules: [
    {
      order: -16,
      id: 'necromancer.dread',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.DREAD, 'damageIncrease'),
      when: (context) => buffActive(context, 'necromancer-dread')
    }
  ],
  triggers: [
    onTriggerPoint(necromancerConditionApplied, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        input.event.condition === CONDITION.FEAR,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyDreadWindow(runtime, input.event)
    })
  ]
});

/** Owns Spiteful Talisman tuning and behavior at its existing execution boundaries. */
export const spitefulTalisman = defineTrait({
  name: 'Spiteful Talisman',
  id: TRAIT.SPITEFUL_TALISMAN,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.05 },
  modifierRules: [
    {
      order: 106,
      id: 'necromancer.spiteful-talisman',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.SPITEFUL_TALISMAN, 'damageMultiplier')
    }
  ]
});

/** Owns Close to Death tuning and behavior at its existing execution boundaries. */
export const closeToDeath = defineTrait({
  name: 'Close to Death',
  id: TRAIT.CLOSE_TO_DEATH,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { threshold: 0.5, damageMultiplier: 1.2 },
  modifierRules: [
    {
      order: 107,
      id: 'necromancer.close-to-death',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.CLOSE_TO_DEATH, 'damageMultiplier'),
      when: (context) =>
        targetHealthBelow(context, balanceNumberFromContext(context, TRAIT.CLOSE_TO_DEATH, 'threshold'))
    }
  ]
});

function applyReapersMight(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!firstHit || !shroudSkillOne) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.REAPERS_MIGHT);
  const effect = requireEffect(profile, 'boon', boonKey(BOON.MIGHT));

  // The proc record reports only a delivered boon.
  if (!effect) return;

  emitTraitProfile(context, TRAIT.REAPERS_MIGHT, TRAIT.REAPERS_MIGHT, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'boon', name: boonKey(BOON.MIGHT) },
    durationContext: event,
    attribution: {
      skillName: "Reaper's Might",
      source: 'Trait',
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: ACTOR.EFFECT,
      triggeredBy: event.skillName,
      name: "Reaper's Might"
    }
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: "Reaper's Might", at: event.at, sourceSkill: event.skillName }
  });
}

function applySiphonedPower(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.SIPHONED_POWER);

  if (!context.combat.targetHealthBelow(balanceProfileNumber(profile, 'threshold'))) return;

  const effect = requireEffect(profile, 'boon', boonKey(BOON.MIGHT));

  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // might, so a removed boon leaves it ready.
  if (!effect || !context.procs.claimCooldown('siphonedPower', event.at, balanceProfileNumber(profile, 'cooldown')))
    return;

  emitTraitProfile(context, TRAIT.SIPHONED_POWER, TRAIT.SIPHONED_POWER, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'boon', name: boonKey(BOON.MIGHT) },
    durationContext: event,
    attribution: {
      skillName: 'Siphoned Power',
      source: 'Trait',
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: ACTOR.EFFECT,
      triggeredBy: event.skillName,
      name: 'Siphoned Power'
    }
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Siphoned Power', at: event.at, sourceSkill: event.skillName }
  });
}

function applyChillOfDeath(context: NecromancerRuntime, event: NecromancerResolverEvent): void {
  // Eligibility belongs to the trait; the selected skill owns recharge and independently removable components.
  if (!context.combat.targetHealthBelow(balanceNumberFromContext(context, TRAIT.CHILL_OF_DEATH, 'threshold'))) return;

  const skill = context.helpers.skillsById.get(ID.LESSER_SPINAL_SHIVERS)!;
  const strike = requireEffect(skill, 'strike', 'Lesser Spinal Shivers - No Boons');
  const chilled = requireEffect(skill, 'condition', CONDITION.CHILLED);

  if ((!strike && !chilled) || context.cooldownController.isOnCooldown(skill.id, context.time)) return;

  context.cooldownController.startRecharge(skill, context.time);

  if (strike)
    invokeTraitSkill(context, TRAIT.CHILL_OF_DEATH, skill.id, event, {
      effect: { type: 'strike', name: 'Lesser Spinal Shivers - No Boons' },
      announce: true,
      transform: (packet) => ({ ...packet, ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}) })
    });
  else if (chilled) queueChillOfDeathCondition(context, event);
}

function queueChillOfDeathCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Chill follows the accepted strike, or applies directly if the strike was removed by a patch.
  invokeTraitSkill(context, TRAIT.CHILL_OF_DEATH, ID.LESSER_SPINAL_SHIVERS, event, {
    effect: { type: 'condition', name: CONDITION.CHILLED }
  });
}

/** Queue Chill from the resolved trait strike so sibling strikes keep their pre-Chill state. */
function applyChillOfDeathCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType !== ACTOR.EFFECT || event.skillId !== ID.LESSER_SPINAL_SHIVERS) return;

  queueChillOfDeathCondition(context, event);
}

function applyBitterChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition !== CONDITION.CHILLED) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.BITTER_CHILL);
  const vulnerability = requireEffect(profile, 'condition', CONDITION.VULNERABILITY);

  if (!vulnerability) return;

  emitTraitProfile(context, TRAIT.BITTER_CHILL, TRAIT.BITTER_CHILL, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: CONDITION.VULNERABILITY },
    attribution: {
      name: 'Bitter Chill',
      skillName: 'Bitter Chill',
      source: 'Trait',
      sourceId: TRAIT.BITTER_CHILL,
      actorType: ACTOR.EFFECT,
      triggeredBy: event.skillName
    }
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Bitter Chill', at: event.at, sourceSkill: event.skillName }
  });
}

/** Fear refreshes the existing observation window; Dread's selected modifier decides whether it contributes. */
function applyDreadWindow(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition === CONDITION.FEAR) {
    context.effects.emit({
      kind: 'packet',
      cause: event,
      settlement: 'reaction',
      event: {
        type: 'buff',
        kind: 'necromancer-dread',
        at: event.at,
        duration: balanceNumberFromContext(context, TRAIT.DREAD, 'duration'),
        stacks: 1,
        source: 'Trait',
        sourceId: TRAIT.DREAD,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        name: 'Dread',
        skillName: 'Dread',
        audience: { recipients: RECIPIENT.SELF }
      }
    });
  }
}
