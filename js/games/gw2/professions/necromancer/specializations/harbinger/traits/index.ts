import { ACTOR, RECIPIENT, WEAPON, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerRuntimeSpecializationState } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerPartyAudience } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { harbingerCastEmissionPolicy } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/cast-emission-policy.js';
import {
  harbingerBlightConsumed,
  harbingerElixirLaunched,
  harbingerShroudEntered,
  harbingerStrike
} from '#gw2/professions/necromancer/specializations/harbinger/mechanics/trigger-points.js';
import { harbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Dark Disciple owns intrinsic Blight growth, capacity, and shroud life-force drain. */
const darkDisciple = defineTrait({
  name: 'Dark Disciple',
  id: TRAIT.DARK_DISCIPLE,
  balance: { maximumStacks: 25, lifeForceDrain: 5, blightGain: 2, pulseInterval: 1, effects: [] }
});

/** Owns Cascading Corruption tuning and behavior at its existing execution boundaries. */
const cascadingCorruption = defineTrait({
  name: 'Cascading Corruption',
  id: TRAIT.CASCADING_CORRUPTION,
  balance: {
    damageIncrease: 0.1,
    conditionDamageIncrease: 0.1,
    minimumStacks: 20,
    effects: [
      {
        name: 'meltdown',
        type: 'buff',
        kind: 'meltdown',
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      },
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 4.5,
        hits: 1,
        // The explosion lands 17 action ticks after Meltdown activates.
        atMs: 680,
        actorType: ACTOR.EFFECT
      },
      {
        name: CONDITION.TORMENT,
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 6,
        duration: 6,
        atMs: 680,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  modifierRules: [
    {
      order: 3,
      id: 'necromancer.cascading-corruption',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context, target) =>
        target === MODIFIER_TARGET.CONDITION_DAMAGE
          ? balanceNumberFromContext(context, TRAIT.CASCADING_CORRUPTION, 'conditionDamageIncrease')
          : balanceNumberFromContext(context, TRAIT.CASCADING_CORRUPTION, 'damageIncrease'),
      // Read the emitted buff through the shared timeline, including explicitly supplied initial buffs.
      when: (context) => buffActive(context, 'meltdown')
    }
  ],
  triggers: [
    onTriggerPoint(harbingerBlightConsumed, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerBlightConsumed>) =>
        applyCascadingCorruption(runtime, input.cast, input.consumed)
    })
  ]
});

/** Owns Septic Corruption tuning and behavior at its existing execution boundaries. */
const septicCorruption = defineTrait({
  name: 'Septic Corruption',
  id: TRAIT.SEPTIC_CORRUPTION,
  balance: {
    conditionDamageIncreasePerStack: 0.0025,
    effects: [
      {
        name: CONDITION.POISONED,
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  modifierRules: [
    {
      order: 2,
      id: 'necromancer.septic-corruption-blight',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',

      amount: (context) =>
        activeBlight(context) *
        balanceNumberFromContext(context, TRAIT.SEPTIC_CORRUPTION, 'conditionDamageIncreasePerStack')
    }
  ],
  triggers: [
    onTriggerPoint(harbingerStrike, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerStrike>) =>
        applySepticCorruptionStrike(runtime, input.event)
    })
  ]
});

/** Owns Doom Approaches tuning and behavior at its existing execution boundaries. */
const doomApproaches = defineTrait({
  name: 'Doom Approaches',
  id: TRAIT.DOOM_APPROACHES,
  balance: {
    blightGain: 4,
    effects: [
      {
        name: CONDITION.VULNERABILITY,
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 6,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  triggers: [
    onTriggerPoint(harbingerStrike, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerStrike>) =>
        applyDoomApproachesStrike(runtime, input.event)
    })
  ]
});

/** Owns Deathly Haste tuning and behavior at its existing execution boundaries. */
const deathlyHaste = defineTrait({
  name: 'Deathly Haste',
  id: TRAIT.DEATHLY_HASTE,
  balance: {
    effects: [
      {
        name: boonKey(BOON.QUICKNESS),
        type: 'boon',
        boon: BOON.QUICKNESS,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      },
      {
        name: boonKey(BOON.FURY),
        type: 'boon',
        boon: BOON.FURY,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ]
  },
  triggers: [
    // Only compiled cast admission may start the shroud finisher's party reward.
    {
      on: 'castCommit',
      run(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>) {
        if (cast.skill.id === ID.DARK_BARRAGE) applyDeathlyHaste(runtime, cast.skill);
      }
    },
    onTriggerPoint(harbingerShroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerShroudEntered>) =>
        applyDeathlyHaste(runtime, input.skill)
    })
  ]
});

/** Owns Corrupted Talent tuning and behavior at its existing execution boundaries. */
const corruptedTalent = defineTrait({
  name: 'Corrupted Talent',
  id: TRAIT.CORRUPTED_TALENT,
  balance: {
    lifeForceGain: 15
  },
  triggers: [onTriggerPoint(harbingerShroudEntered, { run: grantCorruptedTalent })]
});

/** Owns Implacable Foe tuning and behavior at its existing execution boundaries. */
const implacableFoe = defineTrait({
  name: 'Implacable Foe',
  id: TRAIT.IMPLACABLE_FOE,
  balance: {
    attributeConversion: 0.13,
    effects: [
      {
        name: boonKey(BOON.STABILITY),
        type: 'boon',
        boon: BOON.STABILITY,
        stacks: 3,
        duration: 5,
        actorType: ACTOR.PLAYER
      },
      {
        name: 'implacable-foe',
        type: 'buff',
        kind: 'implacable-foe',
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  attributes: traitAttributeEffects(TRAIT.IMPLACABLE_FOE, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Ferocity',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ]),
  triggers: [
    onTriggerPoint(harbingerShroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerShroudEntered>) =>
        grantImplacableFoe(runtime, input.skill)
    })
  ]
});

/** Owns Bolstering Brew tuning and behavior at its existing execution boundaries. */
const bolsteringBrew = defineTrait({
  name: 'Bolstering Brew',
  id: TRAIT.BOLSTERING_BREW,
  balance: {
    effects: [
      {
        name: boonKey(BOON.PROTECTION),
        type: 'boon',
        boon: BOON.PROTECTION,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  triggers: [
    onTriggerPoint(harbingerElixirLaunched, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerElixirLaunched>) =>
        applyBolsteringBrew(runtime, input.cast)
    })
  ]
});

/** Owns Alchemic Vigor tuning and behavior at its existing execution boundaries. */
const alchemicVigor = defineTrait({
  name: 'Alchemic Vigor',
  id: TRAIT.ALCHEMIC_VIGOR,
  balance: {
    attributeBonuses: { vitality: 240 }
  },
  attributes: traitAttributeEffects(TRAIT.ALCHEMIC_VIGOR, [{ kind: 'flat', to: 'Vitality', feedsConversions: 'all' }])
});

/** Owns Twisted Medicine tuning and behavior at its existing execution boundaries. */
const twistedMedicine = defineTrait({
  name: 'Twisted Medicine',
  id: TRAIT.TWISTED_MEDICINE,
  balance: {
    attributeConversion: 0.13
  },
  attributes: traitAttributeEffects(TRAIT.TWISTED_MEDICINE, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Concentration',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Wicked Corruption tuning and behavior at its existing execution boundaries. */
const wickedCorruption = defineTrait({
  name: 'Wicked Corruption',
  id: TRAIT.WICKED_CORRUPTION,
  balance: {
    damageIncreasePerStack: 0.01,
    criticalDamage: 1.1
  },
  modifierRules: [
    {
      order: 0,
      id: 'necromancer.wicked-corruption-blight',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',

      amount: (context) =>
        activeBlight(context) * balanceNumberFromContext(context, TRAIT.WICKED_CORRUPTION, 'damageIncreasePerStack')
    },
    {
      order: 121,
      id: 'necromancer.wicked-corruption-critical-hit-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.WICKED_CORRUPTION, 'criticalDamage'),
      when: (context) => targetConditionActive(context, CONDITION.TORMENT)
    }
  ]
});

/** Owns Dark Gunslinger tuning and behavior at its existing execution boundaries. */
const darkGunslinger = defineTrait({
  name: 'Dark Gunslinger',
  id: TRAIT.DARK_GUNSLINGER,
  balance: {
    attributeConversion: 0.1,
    rechargeMultiplier: 0.8
  },
  attributes: traitAttributeEffects(TRAIT.DARK_GUNSLINGER, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Expertise',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'eligible'
    }
  ]),
  rechargeRules: [
    {
      order: 0,

      when: (_runtime, skill) => skill.weapon === WEAPON.PISTOL,
      multiplier: { profile: TRAIT.DARK_GUNSLINGER, field: 'rechargeMultiplier' }
    }
  ]
});

function activeBlight(context: Gw2ModifierContext): number {
  const event = context.event;
  // Prefer the snapshotted blight from the event so that modifier rules see the value at the moment of impact,
  // not the current (post-impact) blight count which may already be lower due to subsequent consumption.
  return Math.max(
    0,
    event?.metadata?.necromancerBlight ??
      necromancerRuntimeSpecializationState(context, 'Harbinger').blightExpiries?.length ??
      0
  );
}

/** Registers each native trait owner once in its existing execution order. */
export const necromancerHarbingerTraits = [
  darkDisciple,
  cascadingCorruption,
  septicCorruption,
  doomApproaches,
  deathlyHaste,
  corruptedTalent,
  implacableFoe,
  bolsteringBrew,
  alchemicVigor,
  twistedMedicine,
  wickedCorruption,
  darkGunslinger
];

/** Entry and completed Dark Barrage independently deliver the surviving trait boons. */
function applyDeathlyHaste(runtime: NecromancerRuntime, skill: Skill): void {
  // Selection-gated entry and finisher listeners share party rewards attributed to the invoking skill.
  emitTraitProfile(runtime, TRAIT.DEATHLY_HASTE, TRAIT.DEATHLY_HASTE, undefined, {
    skillId: skill.id,
    skillName: skill.name,
    preserveName: true,
    skillWeaponFallback: 'Unequipped',
    attribution: (effect) => ({
      actorType: effect.actorType ?? (skill.type === 'Trait' ? ACTOR.EFFECT : ACTOR.PLAYER),
      audience: necromancerPartyAudience(runtime)
    })
  });
}

/** Consumed stacks claim one Meltdown threshold before the mechanic publishes the remaining Blight. */
function applyCascadingCorruption(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  consumed: number
): void {
  const state = harbingerState.from(runtime);

  if (consumed && runtime.engagement.hostileEffectsAllowed(runtime.time)) {
    const corruption = requireBalanceProfileFromContext(runtime, TRAIT.CASCADING_CORRUPTION);
    const meltdown = requireEffect(corruption, 'buff', 'meltdown');
    const strike = requireEffect(corruption, 'strike', 'Strike');
    const torment = requireEffect(corruption, 'condition', CONDITION.TORMENT);

    if (meltdown || strike || torment) {
      const threshold = balanceProfileNumber(corruption, 'minimumStacks');
      // Reaching the stack cap grants one Meltdown and resets buildup before any reward reacts.
      const progress = advanceCounter(state.cascadingCorruptionStacks, consumed, threshold, 'reset');
      state.cascadingCorruptionStacks = progress.value;

      if (progress.reached) {
        if (meltdown)
          state.meltdownUntil = canonicalTime(runtime.time + effectNumber(corruption, meltdown, 'duration'));

        const proc = runtime.effects.emit({
          receipt: true,
          kind: 'announcement',
          log: true,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.CASCADING_CORRUPTION,
            actorType: ACTOR.EFFECT,
            activationId: cast.id
          },
          announcement: {
            type: 'trait',
            at: runtime.time,
            name: 'Meltdown',
            icon: new URL('@images/wiki/meltdown.png', import.meta.url).href,
            sourceSkill: cast.skill.name
          }
        });
        const skill: Skill = { id: ID.CASCADING_CORRUPTION, name: 'Cascading Corruption', type: 'Trait' };
        runtime.effects.emit({
          kind: 'profile',
          cause: proc,
          profile: skill,
          effects: [meltdown, strike, torment]
            .filter((effect) => effect != null)
            .map((effect) => ({
              ...effect,
              sourceId: TRAIT.CASCADING_CORRUPTION,
              atMs: quantizeGw2ActionTimingMs(effect.atMs ?? 0)
            })),
          ...harbingerCastEmissionPolicy(cast, skill)
        });
      }
    }
  }
}

/** Elixir boons are chosen at launch, after the shared Blight transaction. */
function applyBolsteringBrew(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.BOLSTERING_BREW);
  runtime.effects.emit({
    kind: 'profile',
    profile: cast.skill,
    effects: (profile.effects ?? []).map((effect) => ({
      ...effect,
      atMs: 0,
      // Elixir casting owns the timing; Bolstering Brew owns these additional grants.
      source: 'Trait',
      sourceId: TRAIT.BOLSTERING_BREW,
      audience: hasTrait(runtime, TRAIT.TWISTED_MEDICINE) ? necromancerPartyAudience(runtime) : undefined
    })),
    ...harbingerCastEmissionPolicy(cast, cast.skill)
  });
}

/** Entry grants follow the new form state and precede the first Blight deadline. */
function grantImplacableFoe(runtime: NecromancerRuntime, skill: Skill): void {
  // The entry remains the causal skill while the trait profile supplies Stability's payload and label.
  emitTraitProfile(runtime, TRAIT.IMPLACABLE_FOE, TRAIT.IMPLACABLE_FOE, undefined, {
    skillId: skill.id,
    skillName: skill.name,
    preserveName: true,
    skillWeaponFallback: 'Unequipped',
    attribution: (effect) => ({ actorType: effect.actorType ?? (skill.type === 'Trait' ? ACTOR.EFFECT : ACTOR.PLAYER) })
  });
}

/** Applies Harbinger traits triggered by eligible resolved player or summon strikes. */
function applyDoomApproachesStrike(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Trait procs must not trigger from synthetic "effect" damage (e.g. Cascading Corruption Meltdown hits).
  if (event.actorType === ACTOR.EFFECT || !(Number(event.coefficient) > 0)) return;

  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  // Doom Approaches Vulnerability applies only on the first hit of Tainted Bolts, not each chain projectile.
  const firstHit = Number(event.hitIndex || 1) === 1;

  if (firstHit && skill?.id === ID.TAINTED_BOLTS) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.DOOM_APPROACHES);
    const vulnerability = requireEffect(profile, 'condition', CONDITION.VULNERABILITY);

    if (vulnerability) {
      /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
        context,
        TRAIT.DOOM_APPROACHES,
        TRAIT.DOOM_APPROACHES,
        undefined,
        {
          at: event.at,
          fullEnd: event.at,
          effect: { type: 'condition', name: CONDITION.VULNERABILITY },
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.DOOM_APPROACHES,
            actorType: ACTOR.EFFECT,
            skillName: 'Doom Approaches',
            triggeredBy: event.skillName,
            name: 'Doom Approaches'
          }
        }
      );
      context.effects.emit({
        kind: 'announcement',
        announcement: { type: 'trait', name: 'Doom Approaches', at: event.at, sourceSkill: event.skillName }
      });
    }
  }
}

/** Septic Corruption observes its shroud-slot packet after Doom Approaches. */
function applySepticCorruptionStrike(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType === ACTOR.EFFECT || !(Number(event.coefficient) > 0)) return;

  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);

  // Septic Corruption procs on shroud slot 2 specifically (the pistol #2 skill), not all pistol hits.
  if (skill?.shroudSlot === 2) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.SEPTIC_CORRUPTION);
    const condition = requireEffect(profile, 'condition', CONDITION.POISONED);

    if (condition) {
      /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
        context,
        TRAIT.SEPTIC_CORRUPTION,
        TRAIT.SEPTIC_CORRUPTION,
        undefined,
        {
          at: event.at,
          fullEnd: event.at,
          effect: { type: 'condition', name: CONDITION.POISONED },
          settlement: 'reaction',
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.SEPTIC_CORRUPTION,
            actorType: ACTOR.EFFECT,
            skillName: 'Septic Corruption',
            triggeredBy: event.skillName,
            ownerActorType: ACTOR.PLAYER,
            name: 'Septic Corruption' + ' - ' + String(condition.condition)
          }
        }
      );
      context.effects.emit({
        kind: 'announcement',
        announcement: { type: 'trait', name: 'Septic Corruption', at: event.at, sourceSkill: event.skillName }
      });
    }
  }
}

/** The accepted shroud entry grants its life force before the entry boons. */
function grantCorruptedTalent(runtime: NecromancerRuntime): void {
  grantNecromancerLifeForce(runtime, balanceNumberFromContext(runtime, TRAIT.CORRUPTED_TALENT, 'lifeForceGain'));
}
