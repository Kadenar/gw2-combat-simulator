import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import {
  necromancerConditionApplied,
  necromancerStrike,
  necromancerStrikePreparing,
  necromancerStrikeLifeForce
} from '#gw2/professions/necromancer/core/mechanics/combat-boundaries.js';
import { shroudEntered } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Owns Reaper's Might tuning and behavior at its existing execution boundaries. */
export const reapersMight = defineTrait({
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== 'effect' && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyReapersMight(runtime, input.event, input.firstHit, input.shroudSkillOne)
    })
  ],
  id: TRAIT.REAPERS_MIGHT,
  name: "Reaper's Might",
  balance: {
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 1,
        duration: 15,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Siphoned Power tuning and behavior at its existing execution boundaries. */
export const siphonedPower = defineTrait({
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== 'effect' && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applySiphonedPower(runtime, input.event)
    })
  ],
  id: TRAIT.SIPHONED_POWER,
  name: 'Siphoned Power',
  balance: {
    threshold: 0.5,
    cooldown: 1,
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 3,
        duration: 8,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Chill of Death tuning and behavior at its existing execution boundaries. */
export const chillOfDeath = defineTrait({
  triggers: [
    onTriggerPoint(necromancerStrikePreparing, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrikePreparing>) =>
        applyChillOfDeathCondition(runtime, input.event)
    }),
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== 'effect' && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyChillOfDeath(runtime, input.event)
    })
  ],
  id: TRAIT.CHILL_OF_DEATH,
  name: 'Chill of Death',
  balance: {
    threshold: 0.5,
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 16,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'Lesser Spinal Shivers - No Boons',
        canCrit: false,
        actorType: 'effect'
      },
      {
        name: 'Chilled',
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 5,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Awaken the Pain tuning and behavior at its existing execution boundaries. */
export const awakenThePain = defineTrait({
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        enterAwakenThePain(runtime, input.cast)
    })
  ],
  id: TRAIT.AWAKEN_THE_PAIN,
  name: 'Awaken the Pain',
  balance: {
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 5, duration: 5, packetLabel: 'on shroud entry' }],
    attributePerStack: 10
  }
});

/** Owns Spiteful Fortitude tuning and behavior at its existing execution boundaries. */
export const spitefulFortitude = defineTrait({
  // The post-hit target threshold gates the reward independently of the passive vitality conversion.
  triggers: [
    onTriggerPoint(necromancerStrikeLifeForce, {
      run(runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrikeLifeForce>) {
        if (
          !runtime.combat.targetHealthBelow(
            balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SPITEFUL_FORTITUDE), 'threshold')
          )
        )
          return;
        input.percent += balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, TRAIT.SPITEFUL_FORTITUDE),
          'lifeForceGain'
        );
      }
    })
  ],
  id: TRAIT.SPITEFUL_FORTITUDE,
  name: 'Spiteful Fortitude',
  balance: { threshold: 0.5, attributeConversion: 0.1, lifeForceGain: 1 },
  buildAttributes: traitAttributeEffects(TRAIT.SPITEFUL_FORTITUDE, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Vitality',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'common'
    }
  ])
});

/** Owns Signets of Suffering tuning and behavior at its existing execution boundaries. */
export const signetsOfSuffering = defineTrait({
  id: TRAIT.SIGNETS_OF_SUFFERING,
  name: 'Signets of Suffering',
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
  triggers: [
    onTriggerPoint(necromancerConditionApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyBitterChill(runtime, input.event)
    })
  ],
  id: TRAIT.BITTER_CHILL,
  name: 'Bitter Chill',
  balance: {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 3, duration: 8 }]
  }
});

/** Owns Malicious Swarm tuning and behavior at its existing execution boundaries. */
export const maliciousSwarm = defineTrait({
  id: TRAIT.MALICIOUS_SWARM,
  name: 'Malicious Swarm',
  balance: {
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 15,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1, hits: 1 }]
  },
  triggers: [
    {
      order: 0,

      on: 'castCommit',
      emit: TRAIT.MALICIOUS_SWARM,
      cooldown: 'profile',
      when: (runtime, cast) =>
        cast.skill.type === 'Heal' &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.MALICIOUS_SWARM), 'strike', 'Strike')),
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Lesser Signet of the Locust',
        name: 'Lesser Signet of the Locust',
        skillWeapon: 'Unequipped',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget
      })
    }
  ]
});

/** Owns Spiteful Spirit tuning and behavior at its existing execution boundaries. */
export const spitefulSpirit = defineTrait({
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        enterSpitefulSpirit(runtime, input.cast)
    })
  ],
  id: TRAIT.SPITEFUL_SPIRIT,
  name: 'Spiteful Spirit',
  balance: {
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Dread tuning and behavior at its existing execution boundaries. */
export const dread = defineTrait({
  triggers: [
    onTriggerPoint(necromancerConditionApplied, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        input.event.condition === 'Fear',
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyDreadWindow(runtime, input.event)
    })
  ],
  id: TRAIT.DREAD,
  name: 'Dread',
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
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DREAD), 'damageIncrease'),
      when: (context) => buffActive(context, 'necromancer-dread')
    }
  ]
});

/** Owns Spiteful Talisman tuning and behavior at its existing execution boundaries. */
export const spitefulTalisman = defineTrait({
  id: TRAIT.SPITEFUL_TALISMAN,
  name: 'Spiteful Talisman',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.05 },
  modifierRules: [
    {
      order: 106,
      id: 'necromancer.spiteful-talisman',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SPITEFUL_TALISMAN), 'damageMultiplier')
    }
  ]
});

/** Owns Close to Death tuning and behavior at its existing execution boundaries. */
export const closeToDeath = defineTrait({
  id: TRAIT.CLOSE_TO_DEATH,
  name: 'Close to Death',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { threshold: 0.5, damageMultiplier: 1.2 },
  modifierRules: [
    {
      order: 107,
      id: 'necromancer.close-to-death',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CLOSE_TO_DEATH), 'damageMultiplier'),
      when: (context) =>
        targetHealthBelow(
          context,
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CLOSE_TO_DEATH), 'threshold')
        )
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
  const effect = requireEffect(profile, 'boon', 'might');
  // The proc record reports only a delivered boon.
  if (!effect) return;
  emitTraitProfile(context, TRAIT.REAPERS_MIGHT, TRAIT.REAPERS_MIGHT, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'boon', name: 'might' },
    durationContext: event,
    attribution: {
      skillName: "Reaper's Might",
      source: 'Trait',
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: 'effect',
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
  const effect = requireEffect(profile, 'boon', 'might');
  // Claim only after local eligibility, before conditions, resources or queued strikes; the cooldown gates only
  // might, so a removed boon leaves it ready.
  if (!effect || !context.procs.claimCooldown('siphonedPower', event.at, balanceProfileNumber(profile, 'cooldown')))
    return;
  emitTraitProfile(context, TRAIT.SIPHONED_POWER, TRAIT.SIPHONED_POWER, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'boon', name: 'might' },
    durationContext: event,
    attribution: {
      skillName: 'Siphoned Power',
      source: 'Trait',
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: 'effect',
      triggeredBy: event.skillName,
      name: 'Siphoned Power'
    }
  });
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Siphoned Power', at: event.at, sourceSkill: event.skillName }
  });
}

function applyChillOfDeath(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILL_OF_DEATH);
  if (!context.combat.targetHealthBelow(balanceProfileNumber(profile, 'threshold'))) return;
  // No target boons can be removed, so use only the zero-boon strike profile.
  const strike = requireEffect(profile, 'strike', 'Lesser Spinal Shivers - No Boons');
  const chilled = requireEffect(profile, 'condition', 'Chilled');
  // Claim only after local eligibility, before conditions, resources or queued strikes; with both packets removed
  // there is no proc to gate.
  if ((!strike && !chilled) || !context.procs.claim(TRAIT.CHILL_OF_DEATH, 'chillOfDeath', event.at)) return;
  if (strike) {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
      context,
      TRAIT.CHILL_OF_DEATH,
      TRAIT.CHILL_OF_DEATH,
      undefined,
      {
        at: event.at,
        effect: { type: 'strike', name: 'Lesser Spinal Shivers - No Boons' },
        skillWeaponFallback: 'Unequipped',
        attribution: {
          skillName: 'Lesser Spinal Shivers',
          name: 'Lesser Spinal Shivers',
          triggeredBy: event.skillName
        },
        transform: (packet) => ({ ...packet, ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}) })
      }
    );
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Lesser Spinal Shivers', at: event.at, sourceSkill: event.skillName }
    });
  }
  // Without its strike, Chill has no resolved hit to follow and applies at the trigger instead.
  else if (chilled) queueChillOfDeathCondition(context, event);
}

function queueChillOfDeathCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // The accepted strike owns delivery order; the live named Chill owns its payload.
  emitTraitProfile(context, TRAIT.CHILL_OF_DEATH, TRAIT.CHILL_OF_DEATH, undefined, {
    at: event.at,
    effect: { type: 'condition', name: 'Chilled' },
    attribution: { skillName: 'Lesser Spinal Shivers', name: 'Lesser Spinal Shivers — Chilled' }
  });
}

/** Queue Chill from the resolved trait strike so sibling strikes keep their pre-Chill state. */
function applyChillOfDeathCondition(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType !== 'effect' || event.sourceId !== TRAIT.CHILL_OF_DEATH) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILL_OF_DEATH);
  const chilled = requireEffect(profile, 'condition', 'Chilled');
  if (chilled) queueChillOfDeathCondition(context, event);
}

/** Emits awaken the pain at the ordered post-entry boundary. */
function enterAwakenThePain(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitTraitProfile(runtime, TRAIT.AWAKEN_THE_PAIN, TRAIT.AWAKEN_THE_PAIN, undefined, {
    skillName: requireBalanceProfileFromContext(runtime, TRAIT.AWAKEN_THE_PAIN).name,
    activationId: cast.id,
    attribution: { triggeredBy: cast.skill.name },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({ ...event, ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget }) })
  });
}

/** Emits spiteful spirit at the ordered post-entry boundary. */
function enterSpitefulSpirit(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitTraitProfile(runtime, TRAIT.SPITEFUL_SPIRIT, TRAIT.SPITEFUL_SPIRIT, undefined, {
    skillName: requireBalanceProfileFromContext(runtime, TRAIT.SPITEFUL_SPIRIT).name,
    activationId: cast.id,
    attribution: { triggeredBy: cast.skill.name },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({ ...event, ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget }) })
  });
}

function applyBitterChill(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.condition !== 'Chilled') return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.BITTER_CHILL);
  const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
  if (!vulnerability) return;
  emitTraitProfile(context, TRAIT.BITTER_CHILL, TRAIT.BITTER_CHILL, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: 'Vulnerability' },
    attribution: {
      name: 'Bitter Chill',
      skillName: 'Bitter Chill',
      source: 'Trait',
      sourceId: TRAIT.BITTER_CHILL,
      actorType: 'effect',
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
  if (event.condition === 'Fear') {
    context.effects.emit({
      kind: 'packet',
      cause: event,
      settlement: 'reaction',
      event: {
        type: 'buff',
        kind: 'necromancer-dread',
        at: event.at,
        duration: balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DREAD), 'duration'),
        stacks: 1,
        source: 'Trait',
        sourceId: TRAIT.DREAD,
        actorType: 'effect',
        ownerActorType: 'player',
        name: 'Dread',
        skillName: 'Dread',
        audience: { recipients: 'self' }
      }
    });
  }
}
