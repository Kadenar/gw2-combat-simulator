import { emitShroudEntryTrait } from '#gw2/professions/necromancer/core/traits/shroud-entry.js';
import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  necromancerConditionApplied,
  necromancerStrike,
  necromancerStrikeLifeForce
} from '#gw2/professions/necromancer/core/mechanics/trigger-points.js';
import { shroudEntered, shroudExited, shroudInvoked } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerActiveShroud } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { necromancerPassivesStarting } from '#gw2/professions/necromancer/core/mechanics/passives.js';
import { dhuumfireProjection } from '#gw2/professions/necromancer/core/traits/soul-reaping/procs.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';

/** Owns Dhuumfire tuning and behavior at its existing execution boundaries. */
export const dhuumfire = defineTrait({
  name: 'Dhuumfire',
  id: TRAIT.DHUUMFIRE,
  balance: {
    effects: [
      {
        name: CONDITION.BURNING,
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== ACTOR.EFFECT && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyDhuumfire(runtime, input.event, input.dhuumfireDuration, input.shroudSkillOne)
    })
  ]
});

/** Owns Unyielding Blast tuning and behavior at its existing execution boundaries. */
export const unyieldingBlast = defineTrait({
  name: 'Unyielding Blast',
  id: TRAIT.UNYIELDING_BLAST,
  balance: {
    effects: [
      {
        name: CONDITION.VULNERABILITY,
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 10,
        actorType: ACTOR.EFFECT
      }
    ]
  },
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== ACTOR.EFFECT && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyUnyieldingBlast(runtime, input.event, input.firstHit, input.shroudSkillOne)
    })
  ]
});

/** Owns Vital Persistence tuning and behavior at its existing execution boundaries. */
export const vitalPersistence = defineTrait({
  name: 'Vital Persistence',
  id: TRAIT.VITAL_PERSISTENCE,
  balance: { attributeBonuses: { vitality: 180 } },
  attributes: traitAttributeEffects(TRAIT.VITAL_PERSISTENCE, [
    // Native Necromancer conversions include this bonus, but utility consumables exclude it.
    { kind: 'flat', to: 'Vitality', feedsConversions: 'profession-only' }
  ])
});

/** Owns Sinister Shroud tuning and behavior at its existing execution boundaries. */
export const sinisterShroud = defineTrait({
  name: 'Sinister Shroud',
  id: TRAIT.SINISTER_SHROUD,
  balance: { rechargeMultiplier: 0.85 },
  rechargeRules: [
    {
      order: 1,

      when: (_runtime, skill) => Boolean(skill.shroud),
      multiplier: { profile: TRAIT.SINISTER_SHROUD, field: 'rechargeMultiplier' }
    },
    {
      order: 0,

      when: (_runtime, skill) => SHADE_SKILLS.has(Number(skill.id)),
      multiplier: { profile: TRAIT.SINISTER_SHROUD, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Death Perception tuning and behavior at its existing execution boundaries. */
export const deathPerception = defineTrait({
  name: 'Death Perception',
  id: TRAIT.DEATH_PERCEPTION,
  balance: {
    criticalDamage: 1.1,
    criticalChance: 0.15
  },
  attributes: ({ balanceContext: profileContext }) => ({
    traitCriticalChance: balanceNumberFromContext(profileContext, TRAIT.DEATH_PERCEPTION, 'criticalChance') * 100
  }),
  modifierRules: [
    {
      order: 105,
      id: 'necromancer.death-perception-critical-hit-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.DEATH_PERCEPTION, 'criticalDamage'),
      when: (context) => Boolean(necromancerActiveShroud(context))
    }
  ]
});

/** Owns Soul Barbs tuning and behavior at its existing execution boundaries. */
export const soulBarbs = defineTrait({
  name: 'Soul Barbs',
  id: TRAIT.SOUL_BARBS,
  balance: {
    damageIncrease: 0.1,
    conditionDamageIncrease: 0.1,
    duration: 15
  },
  modifierRules: [
    {
      order: -17,
      id: 'necromancer.soul-barbs',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context, target) =>
        target === MODIFIER_TARGET.CONDITION_DAMAGE
          ? balanceNumberFromContext(context, TRAIT.SOUL_BARBS, 'conditionDamageIncrease')
          : balanceNumberFromContext(context, TRAIT.SOUL_BARBS, 'damageIncrease'),
      when: (context) => buffActive(context, 'necromancer-soul-barbs')
    }
  ],
  triggers: [
    onTriggerPoint(shroudInvoked, {
      run: (runtime: NecromancerRuntime, { cast }: TriggerPointInput<typeof shroudInvoked>) =>
        applySoulBarbs(runtime, {
          source: 'necromancer',
          sourceId: cast.skill.id,
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        })
    }),
    onTriggerPoint(shroudExited, { run: (runtime: NecromancerRuntime) => applySoulBarbs(runtime) }),
    onTriggerPoint(shroudEntered, { run: (runtime: NecromancerRuntime) => applySoulBarbs(runtime) })
  ]
});

/** Publish the next rounded opportunity before granting, without drifting the admitted cadence. */
export const eternalLifePassive = definePeriodicTask<NecromancerRuntime>({
  name: 'necromancer.eternal-life',
  background: true,
  priority: -10,
  state: (runtime) => runtime.profession.core.eternalLife,
  rearmBeforeRun: true,
  nextAt(runtime) {
    const state = runtime.profession.core.eternalLife;
    state.deadline = canonicalTime(state.deadline + state.interval);
    return gw2CooldownReadyAt(state.deadline);
  },
  run(runtime) {
    if (hasTrait(runtime, TRAIT.ETERNAL_LIFE)) applyEternalLifePulse(runtime);
  }
});

/** Owns Eternal Life tuning and behavior at its existing execution boundaries. */
export const eternalLife = defineTrait({
  name: 'Eternal Life',
  id: TRAIT.ETERNAL_LIFE,
  balance: {
    lifeForceGain: 3,
    threshold: 0.66,
    pulseInterval: 1,
    effects: [
      {
        name: boonKey(BOON.PROTECTION),
        type: 'boon',
        boon: BOON.PROTECTION,
        stacks: 1,
        duration: 3,
        packetLabel: 'on shroud entry'
      }
    ]
  },
  triggers: [
    onTriggerPoint(necromancerPassivesStarting, { run: startEternalLife }),
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        emitShroudEntryTrait(runtime, input.cast, TRAIT.ETERNAL_LIFE)
    })
  ],
  lifetime: eternalLifePassive.hooks
});

/** Owns Fear of Death tuning and behavior at its existing execution boundaries. */
export const fearOfDeath = defineTrait({
  name: 'Fear of Death',
  id: TRAIT.FEAR_OF_DEATH,
  balance: { lifeForceGain: 15, internalCooldown: 4 },
  triggers: [
    onTriggerPoint(necromancerConditionApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyFearOfDeath(runtime, input.event)
    })
  ]
});

/** Owns Speed of Shadows tuning and behavior at its existing execution boundaries. */
export const speedOfShadows = defineTrait({
  name: 'Speed of Shadows',
  id: TRAIT.SPEED_OF_SHADOWS,
  balance: {
    effects: [
      {
        name: boonKey(BOON.SWIFTNESS),
        type: 'boon',
        boon: BOON.SWIFTNESS,
        stacks: 1,
        duration: 10,
        packetLabel: 'on shroud entry'
      }
    ]
  },
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        emitShroudEntryTrait(runtime, input.cast, TRAIT.SPEED_OF_SHADOWS)
    })
  ]
});

/** Owns Soul Marks tuning and behavior at its existing execution boundaries. */
export const soulMarks = defineTrait({
  name: 'Soul Marks',
  id: TRAIT.SOUL_MARKS,
  balance: { lifeForceGain: 3 },
  // Only the first accepted mark hit contributes to the combined life-force grant.
  triggers: [
    onTriggerPoint(necromancerStrikeLifeForce, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrikeLifeForce>) =>
        Number(input.event.hitIndex ?? 1) === 1 && input.skill.categories?.includes('Mark') === true,
      run(runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrikeLifeForce>) {
        input.percent += balanceNumberFromContext(runtime, TRAIT.SOUL_MARKS, 'lifeForceGain');
      }
    })
  ]
});

/** Owns Soul Battery tuning and behavior at its existing execution boundaries. */
export const soulBattery = defineTrait({
  name: 'Soul Battery',
  id: TRAIT.SOUL_BATTERY,
  balance: { lifeForceCapacityMultiplier: 1.2 }
});

/** Owns Gluttony tuning and behavior at its existing execution boundaries. */
export const gluttony = defineTrait({
  name: 'Gluttony',
  id: TRAIT.GLUTTONY,
  balance: { lifeForceGainMultiplier: 1.1 }
});

const SHADE_SKILLS = new Set<number>([
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.MANIFEST_SAND_SHADE,
  ID.SANDSTORM_SHROUD
]);

/** Callers supply their trigger attribution; Core owns Soul Barbs selection and duration for every shroud variant. */
function applySoulBarbs(
  runtime: NecromancerRuntime,
  attribution: Pick<EffectEventBase, 'source' | 'sourceId' | 'skillId' | 'skillName' | 'activationId'> = {
    source: 'Trait',
    sourceId: TRAIT.SOUL_BARBS
  }
): void {
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      ...attribution,
      actorType: ACTOR.PLAYER,
      kind: 'necromancer-soul-barbs',
      stacks: 1,
      duration: balanceNumberFromContext(runtime, TRAIT.SOUL_BARBS, 'duration')
    }
  });
}

function applyDhuumfire(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  skillDuration: unknown,
  shroudSkillOne: boolean
): void {
  if (!shroudSkillOne) return;

  const { effect, interval } = dhuumfireProjection(context, event.metadata, skillDuration);

  // Zero or absent intervals bypass the claim so same-time applications remain unrestricted; the claim gates only
  // Burning, so a removed packet leaves it ready.
  if (!effect) return;

  if (interval > 0 && !context.procs.claimCooldown('dhuumfire', event.at, interval)) {
    return;
  }

  /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
    context,
    TRAIT.DHUUMFIRE,
    TRAIT.DHUUMFIRE,
    undefined,
    {
      at: event.at,
      effect: { type: 'condition', name: CONDITION.BURNING },
      settlement: 'reaction',
      attribution: { skillName: 'Dhuumfire', triggeredBy: event.skillName, ownerActorType: ACTOR.PLAYER },
      // Shroud skills may supply a duration variant; all remaining fields stay authored.
      transform: (packet) => ({ ...packet, name: 'Dhuumfire - ' + packet.condition, duration: effect.duration })
    }
  );
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Dhuumfire', at: event.at, sourceSkill: event.skillName }
  });
}

function applyUnyieldingBlast(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!firstHit || !shroudSkillOne) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.UNYIELDING_BLAST);
  const effect = requireEffect(profile, 'condition', CONDITION.VULNERABILITY);

  if (!effect) return;

  /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
    context,
    TRAIT.UNYIELDING_BLAST,
    TRAIT.UNYIELDING_BLAST,
    undefined,
    {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: CONDITION.VULNERABILITY },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.UNYIELDING_BLAST,
        actorType: ACTOR.EFFECT,
        skillName: 'Unyielding Blast',
        triggeredBy: event.skillName,
        name: 'Unyielding Blast'
      }
    }
  );
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: 'Unyielding Blast', at: event.at, sourceSkill: event.skillName }
  });
}

/** Accepted non-summon fear grants life force under one cooldown; missed and travelling packets grant nothing. */
function applyFearOfDeath(runtime: NecromancerRuntime, event: NecromancerResolverEvent): void {
  if (
    event.condition !== CONDITION.FEAR ||
    event.actorType === ACTOR.SUMMON ||
    !runtime.procs.claim(TRAIT.FEAR_OF_DEATH, 'necromancer.core.fearOfDeath', runtime.time)
  )
    return;

  grantNecromancerLifeForce(runtime, balanceNumberFromContext(runtime, TRAIT.FEAR_OF_DEATH, 'lifeForceGain'));
}

/** A granted Eternal Life pulse samples the live shroud and caps its gain at the trait threshold. */
function applyEternalLifePulse(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;

  if (state.activeShroud) return;

  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE);
  const missing = Math.max(
    0,
    state.lifeForce.maximum * balanceProfileNumber(profile, 'threshold') - state.lifeForce.value
  );
  runtime.resourceController.grant(
    'lifeForce',
    Math.min(missing, (state.lifeForce.maximum * balanceProfileNumber(profile, 'lifeForceGain')) / 100)
  );
}

/** Admission starts one authored cadence; removed resource gain cannot advertise endless readiness. */
function startEternalLife(runtime: NecromancerRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE);
  const interval = balanceProfileNumber(profile, 'pulseInterval');

  if (interval > 0 && balanceProfileNumber(profile, 'lifeForceGain') !== 0) {
    const state = runtime.profession.core.eternalLife;
    state.interval = interval;
    state.deadline = interval;
    eternalLifePassive.restart(runtime, gw2CooldownReadyAt(state.deadline));
  }
}
