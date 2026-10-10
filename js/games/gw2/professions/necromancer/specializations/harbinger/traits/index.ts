import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerRuntimeSpecializationState } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { party } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/audiences.js';
import { harbingerCastEmissionPolicy } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/cast-emission-policy.js';
import {
  harbingerBlightConsumed,
  harbingerElixirLaunched,
  harbingerShroudEntered,
  harbingerStrike
} from '#gw2/professions/necromancer/specializations/harbinger/mechanics/combat-boundaries.js';
import { HARBINGER_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { harbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Owns Cascading Corruption tuning and behavior at its existing execution boundaries. */
export const cascadingCorruption = defineTrait({
  triggers: [
    onTriggerPoint(harbingerBlightConsumed, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerBlightConsumed>) =>
        applyCascadingCorruption(runtime, input.cast, input.consumed)
    })
  ],
  id: TRAIT.CASCADING_CORRUPTION,
  name: 'Cascading Corruption',
  balance: {
    minimumStacks: 20,
    effects: [
      {
        name: 'meltdown',
        type: 'buff',
        kind: 'meltdown',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 4.5,
        hits: 1,
        // The explosion lands 17 action ticks after Meltdown activates.
        atMs: 680,
        actorType: 'effect'
      },
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 6,
        duration: 6,
        atMs: 680,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      order: 3,
      id: 'necromancer.cascading-corruption',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: 0.1,
      // Read the emitted buff through the shared timeline, including explicitly supplied initial buffs.
      when: (context) => buffActive(context, 'meltdown')
    }
  ]
});

/** Owns Septic Corruption tuning and behavior at its existing execution boundaries. */
export const septicCorruption = defineTrait({
  triggers: [
    onTriggerPoint(harbingerStrike, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerStrike>) =>
        applySepticCorruptionStrike(runtime, input.event)
    })
  ],
  id: TRAIT.SEPTIC_CORRUPTION,
  name: 'Septic Corruption',
  balance: {
    effects: [
      {
        name: 'Poisoned',
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      order: 2,
      id: 'necromancer.septic-corruption-blight',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      parameters: { damagePerStack: 0.0025 },
      amount: (context, _target, parameters) => activeBlight(context) * parameters.damagePerStack
    }
  ]
});

/** Owns Doom Approaches tuning and behavior at its existing execution boundaries. */
export const doomApproaches = defineTrait({
  triggers: [
    onTriggerPoint(harbingerStrike, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerStrike>) =>
        applyDoomApproachesStrike(runtime, input.event)
    })
  ],
  id: TRAIT.DOOM_APPROACHES,
  name: 'Doom Approaches',
  balance: {
    blightGain: 4,
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6,
        actorType: 'effect'
      }
    ]
  },
  profiles: [
    variant(
      HARBINGER_BALANCE_PROFILE_IDS.darkBarrageDoomApproaches,
      ID.DARK_BARRAGE,
      'Dark Barrage — Doom Approaches',
      {
        pulseCount: 8,
        pulseInterval: 0.75 / 8,
        effects: [
          { name: 'Strike', type: 'strike', coefficient: 0.6 },
          { name: 'Torment', type: 'condition', condition: 'Torment', stacks: 1, duration: 3 }
        ]
      }
    )
  ]
});

/** Owns Deathly Haste tuning and behavior at its existing execution boundaries. */
export const deathlyHaste = defineTrait({
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
  ],
  id: TRAIT.DEATHLY_HASTE,
  name: 'Deathly Haste',
  balance: {
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Corrupted Talent tuning and behavior at its existing execution boundaries. */
export const corruptedTalent = defineTrait({
  triggers: [onTriggerPoint(harbingerShroudEntered, { run: grantCorruptedTalent })],
  id: TRAIT.CORRUPTED_TALENT,
  name: 'Corrupted Talent',
  balance: {
    lifeForceGain: 15
  }
});

/** Owns Implacable Foe tuning and behavior at its existing execution boundaries. */
export const implacableFoe = defineTrait({
  triggers: [
    onTriggerPoint(harbingerShroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerShroudEntered>) =>
        grantImplacableFoe(runtime, input.skill)
    })
  ],
  id: TRAIT.IMPLACABLE_FOE,
  name: 'Implacable Foe',
  balance: {
    attributeConversion: 0.13,
    effects: [
      {
        name: 'stability',
        type: 'boon',
        boon: 'stability',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        name: 'implacable-foe',
        type: 'buff',
        kind: 'implacable-foe',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  buildAttributes: traitAttributeEffects(TRAIT.IMPLACABLE_FOE, [
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Ferocity',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Bolstering Brew tuning and behavior at its existing execution boundaries. */
export const bolsteringBrew = defineTrait({
  triggers: [
    onTriggerPoint(harbingerElixirLaunched, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof harbingerElixirLaunched>) =>
        applyBolsteringBrew(runtime, input.cast)
    })
  ],
  id: TRAIT.BOLSTERING_BREW,
  name: 'Bolstering Brew',
  balance: {
    effects: [
      {
        name: 'protection',
        type: 'boon',
        boon: 'protection',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Alchemic Vigor tuning and behavior at its existing execution boundaries. */
export const alchemicVigor = defineTrait({
  id: TRAIT.ALCHEMIC_VIGOR,
  name: 'Alchemic Vigor',
  balance: {
    attributeBonus: 240
  },
  buildAttributes: traitAttributeEffects(TRAIT.ALCHEMIC_VIGOR, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Twisted Medicine tuning and behavior at its existing execution boundaries. */
export const twistedMedicine = defineTrait({
  id: TRAIT.TWISTED_MEDICINE,
  name: 'Twisted Medicine',
  balance: {
    attributeConversion: 0.13
  },
  buildAttributes: traitAttributeEffects(TRAIT.TWISTED_MEDICINE, [
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
export const wickedCorruption = defineTrait({
  id: TRAIT.WICKED_CORRUPTION,
  name: 'Wicked Corruption',
  balance: {
    criticalDamage: 1.1
  },
  modifierRules: [
    {
      order: 0,
      id: 'necromancer.wicked-corruption-blight',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: { damagePerStack: 0.01 },
      amount: (context, _target, parameters) => activeBlight(context) * parameters.damagePerStack
    },
    {
      order: 121,
      id: 'necromancer.wicked-corruption-critical-hit-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.WICKED_CORRUPTION), 'criticalDamage'),
      when: (context) => targetConditionActive(context, 'Torment')
    }
  ]
});

/** Owns Dark Gunslinger tuning and behavior at its existing execution boundaries. */
export const darkGunslinger = defineTrait({
  id: TRAIT.DARK_GUNSLINGER,
  name: 'Dark Gunslinger',
  balance: {
    attributeConversion: 0.1,
    rechargeMultiplier: 0.8
  },
  buildAttributes: traitAttributeEffects(TRAIT.DARK_GUNSLINGER, [
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

      when: (_runtime, skill) => skill.weapon === 'Pistol',
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
    event?.metadata?.necromancerBlight ?? necromancerRuntimeSpecializationState(context, 'Harbinger').blight ?? 0
  );
}

/** Registers each native trait owner once in its existing execution order. */
export const necromancerHarbingerTraits = [
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
  // Entry and finisher share profile expansion while preserving party ownership and the invoking skill.
  if (!hasTrait(runtime, TRAIT.DEATHLY_HASTE)) return;
  emitTraitProfile(runtime, TRAIT.DEATHLY_HASTE, TRAIT.DEATHLY_HASTE, undefined, {
    skillId: skill.id,
    skillName: skill.name,
    preserveName: true,
    skillWeaponFallback: 'Unequipped',
    attribution: (effect) => ({
      actorType: effect.actorType ?? (skill.type === 'Trait' ? 'effect' : 'player'),
      audience: party(runtime)
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
  if (
    consumed &&
    !runtime.combatStartPending &&
    !(runtime.combatStartTime != null && runtime.time < runtime.combatStartTime)
  ) {
    const corruption = requireBalanceProfileFromContext(runtime, TRAIT.CASCADING_CORRUPTION);
    const meltdown = requireEffect(corruption, 'buff', 'meltdown');
    const strike = requireEffect(corruption, 'strike', 'Strike');
    const torment = requireEffect(corruption, 'condition', 'Torment');
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
            actorType: 'effect',
            activationId: cast.id
          },
          announcement: {
            type: 'trait',
            at: runtime.time,
            name: 'Meltdown',
            icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png',
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
  {
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
        audience: hasTrait(runtime, TRAIT.TWISTED_MEDICINE) ? party(runtime) : undefined
      })),
      ...harbingerCastEmissionPolicy(cast, cast.skill)
    });
  }
}

/** Entry grants follow the new form state and precede the first Blight deadline. */
function grantImplacableFoe(runtime: NecromancerRuntime, skill: Skill): void {
  // The entry remains the causal skill while the trait profile supplies Stability's payload and label.
  emitTraitProfile(runtime, TRAIT.IMPLACABLE_FOE, TRAIT.IMPLACABLE_FOE, undefined, {
    skillId: skill.id,
    skillName: skill.name,
    preserveName: true,
    skillWeaponFallback: 'Unequipped',
    attribution: (effect) => ({ actorType: effect.actorType ?? (skill.type === 'Trait' ? 'effect' : 'player') })
  });
}

/** Applies Harbinger traits triggered by eligible resolved player or summon strikes. */
function applyDoomApproachesStrike(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  // Trait procs must not trigger from synthetic "effect" damage (e.g. Cascading Corruption Meltdown hits).
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  // Doom Approaches Vulnerability applies only on the first hit of Tainted Bolts, not each chain projectile.
  const firstHit = Number(event.hitIndex || 1) === 1;
  if (firstHit && skill?.id === ID.TAINTED_BOLTS) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.DOOM_APPROACHES);
    const vulnerability = requireEffect(profile, 'condition', 'Vulnerability');
    if (vulnerability) {
      /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
        context,
        TRAIT.DOOM_APPROACHES,
        TRAIT.DOOM_APPROACHES,
        undefined,
        {
          at: event.at,
          fullEnd: event.at,
          effect: { type: 'condition', name: 'Vulnerability' },
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.DOOM_APPROACHES,
            actorType: 'effect',
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
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  // Septic Corruption procs on shroud slot 2 specifically (the pistol #2 skill), not all pistol hits.
  if (skill?.shroudSlot === 2) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.SEPTIC_CORRUPTION);
    const condition = requireEffect(profile, 'condition', 'Poisoned');
    if (condition) {
      /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
        context,
        TRAIT.SEPTIC_CORRUPTION,
        TRAIT.SEPTIC_CORRUPTION,
        undefined,
        {
          at: event.at,
          fullEnd: event.at,
          effect: { type: 'condition', name: 'Poisoned' },
          settlement: 'reaction',
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.SEPTIC_CORRUPTION,
            actorType: 'effect',
            skillName: 'Septic Corruption',
            triggeredBy: event.skillName,
            ownerActorType: 'player',
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
  grantNecromancerLifeForce(
    runtime,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.CORRUPTED_TALENT), 'lifeForceGain')
  );
}
