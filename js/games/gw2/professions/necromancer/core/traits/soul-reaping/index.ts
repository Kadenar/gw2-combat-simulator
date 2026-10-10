import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
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
  necromancerStrikeLifeForce
} from '#gw2/professions/necromancer/core/mechanics/combat-boundaries.js';
import { shroudEntered, shroudExited, shroudInvoked } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerActiveShroud } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { necromancerPassivesStarting } from '#gw2/professions/necromancer/core/mechanics/passives.js';
import { dhuumfireProjection } from '#gw2/professions/necromancer/core/traits/soul-reaping/procs.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Owns Dhuumfire tuning and behavior at its existing execution boundaries. */
export const dhuumfire = defineTrait({
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== 'effect' && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyDhuumfire(runtime, input.event, input.dhuumfireDuration, input.shroudSkillOne)
    })
  ],
  id: TRAIT.DHUUMFIRE,
  name: 'Dhuumfire',
  balance: {
    effects: [
      {
        name: 'Burning',
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Unyielding Blast tuning and behavior at its existing execution boundaries. */
export const unyieldingBlast = defineTrait({
  triggers: [
    onTriggerPoint(necromancerStrike, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrike>) =>
        input.event.actorType !== 'effect' && Number(input.event.coefficient) > 0,
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrike>) =>
        applyUnyieldingBlast(runtime, input.event, input.firstHit, input.shroudSkillOne)
    })
  ],
  id: TRAIT.UNYIELDING_BLAST,
  name: 'Unyielding Blast',
  balance: {
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 10,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Vital Persistence tuning and behavior at its existing execution boundaries. */
export const vitalPersistence = defineTrait({
  id: TRAIT.VITAL_PERSISTENCE,
  name: 'Vital Persistence',
  balance: { attributeBonus: 180 },
  buildAttributes: traitAttributeEffects(TRAIT.VITAL_PERSISTENCE, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Sinister Shroud tuning and behavior at its existing execution boundaries. */
export const sinisterShroud = defineTrait({
  id: TRAIT.SINISTER_SHROUD,
  name: 'Sinister Shroud',
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
  id: TRAIT.DEATH_PERCEPTION,
  name: 'Death Perception',
  balance: {
    criticalDamage: 1.1,
    criticalChance: 0.15
  },
  modifierRules: [
    {
      order: -18,
      id: 'necromancer.death-perception-critical-chance',
      label: 'Death Perception',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEATH_PERCEPTION), 'criticalChance')
    },
    {
      order: 105,
      id: 'necromancer.death-perception-critical-hit-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEATH_PERCEPTION), 'criticalDamage'),
      when: (context) => Boolean(necromancerActiveShroud(context))
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext }) => ({
    traitCriticalChance:
      balanceProfileNumber(requireBalanceProfileFromContext(profileContext, TRAIT.DEATH_PERCEPTION), 'criticalChance') *
      100
  })
});

/** Owns Soul Barbs tuning and behavior at its existing execution boundaries. */
export const soulBarbs = defineTrait({
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
  ],
  id: TRAIT.SOUL_BARBS,
  name: 'Soul Barbs',
  balance: { duration: 15 },
  modifierRules: [
    {
      order: -17,
      id: 'necromancer.soul-barbs',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => buffActive(context, 'necromancer-soul-barbs')
    }
  ]
});

/** Owns Eternal Life tuning and behavior at its existing execution boundaries. */
export const eternalLife = defineTrait({
  triggers: [
    onTriggerPoint(necromancerPassivesStarting, { run: startEternalLife }),
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        enterEternalLife(runtime, input.cast)
    })
  ],
  lifetime: {
    backgroundTasks: ['necromancer.eternal-life'],
    tasks: { 'necromancer.eternal-life': renewEternalLife }
  },
  id: TRAIT.ETERNAL_LIFE,
  name: 'Eternal Life',
  balance: {
    lifeForceGain: 3,
    threshold: 0.66,
    pulseInterval: 1,
    effects: [
      { name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 3, packetLabel: 'on shroud entry' }
    ]
  }
});

/** Owns Fear of Death tuning and behavior at its existing execution boundaries. */
export const fearOfDeath = defineTrait({
  triggers: [
    onTriggerPoint(necromancerConditionApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyFearOfDeath(runtime, input.event)
    })
  ],
  id: TRAIT.FEAR_OF_DEATH,
  name: 'Fear of Death',
  balance: { lifeForceGain: 15, internalCooldown: 4 }
});

/** Owns Speed of Shadows tuning and behavior at its existing execution boundaries. */
export const speedOfShadows = defineTrait({
  triggers: [
    onTriggerPoint(shroudEntered, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof shroudEntered>) =>
        enterSpeedOfShadows(runtime, input.cast)
    })
  ],
  id: TRAIT.SPEED_OF_SHADOWS,
  name: 'Speed of Shadows',
  balance: {
    effects: [
      { name: 'swiftness', type: 'boon', boon: 'swiftness', stacks: 1, duration: 10, packetLabel: 'on shroud entry' }
    ]
  }
});

/** Owns Soul Marks tuning and behavior at its existing execution boundaries. */
export const soulMarks = defineTrait({
  id: TRAIT.SOUL_MARKS,
  name: 'Soul Marks',
  balance: { lifeForceGain: 3 },
  // Only the first accepted mark hit contributes to the combined life-force grant.
  triggers: [
    onTriggerPoint(necromancerStrikeLifeForce, {
      when: (_runtime: unknown, input: TriggerPointInput<typeof necromancerStrikeLifeForce>) =>
        Number(input.event.hitIndex ?? 1) === 1 && input.skill.categories?.includes('Mark') === true,
      run(runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerStrikeLifeForce>) {
        input.percent += balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, TRAIT.SOUL_MARKS),
          'lifeForceGain'
        );
      }
    })
  ]
});

/** Owns Soul Battery tuning and behavior at its existing execution boundaries. */
export const soulBattery = defineTrait({
  id: TRAIT.SOUL_BATTERY,
  name: 'Soul Battery',
  balance: { lifeForceCapacityMultiplier: 1.2 }
});

/** Owns Gluttony tuning and behavior at its existing execution boundaries. */
export const gluttony = defineTrait({
  id: TRAIT.GLUTTONY,
  name: 'Gluttony',
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
      actorType: 'player',
      kind: 'necromancer-soul-barbs',
      stacks: 1,
      duration: balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'duration')
    }
  });
}

/** Emits speed of shadows at the ordered post-entry boundary. */
function enterSpeedOfShadows(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitTraitProfile(runtime, TRAIT.SPEED_OF_SHADOWS, TRAIT.SPEED_OF_SHADOWS, undefined, {
    skillName: requireBalanceProfileFromContext(runtime, TRAIT.SPEED_OF_SHADOWS).name,
    activationId: cast.id,
    attribution: { triggeredBy: cast.skill.name },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({ ...event, ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget }) })
  });
}

/** Emits eternal life at the ordered post-entry boundary. */
function enterEternalLife(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  emitTraitProfile(runtime, TRAIT.ETERNAL_LIFE, TRAIT.ETERNAL_LIFE, undefined, {
    skillName: requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE).name,
    activationId: cast.id,
    attribution: { triggeredBy: cast.skill.name },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({ ...event, ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget }) })
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

  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
      context,
      TRAIT.DHUUMFIRE,
      TRAIT.DHUUMFIRE,
      undefined,
      {
        at: event.at,
        effect: { type: 'condition', name: 'Burning' },
        settlement: 'reaction',
        attribution: { skillName: 'Dhuumfire', triggeredBy: event.skillName, ownerActorType: 'player' },
        // Shroud skills may supply a duration variant; all remaining fields stay authored.
        transform: (packet) => ({ ...packet, name: 'Dhuumfire - ' + packet.condition, duration: effect.duration })
      }
    );
    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Dhuumfire', at: event.at, sourceSkill: event.skillName }
    });
  }
}

function applyUnyieldingBlast(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!firstHit || !shroudSkillOne) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.UNYIELDING_BLAST);
  const effect = requireEffect(profile, 'condition', 'Vulnerability');
  if (!effect) return;
  {
    /* Trait payloads and their timeline annotation share the same emission boundary. */ emitTraitProfile(
      context,
      TRAIT.UNYIELDING_BLAST,
      TRAIT.UNYIELDING_BLAST,
      undefined,
      {
        at: event.at,
        fullEnd: event.at,
        effect: { type: 'condition', name: 'Vulnerability' },
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.UNYIELDING_BLAST,
          actorType: 'effect',
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
}

/** Accepted non-summon fear grants life force under one cooldown; missed and travelling packets grant nothing. */
function applyFearOfDeath(runtime: NecromancerRuntime, event: NecromancerResolverEvent): void {
  if (
    event.condition !== 'Fear' ||
    event.actorType === 'summon' ||
    !runtime.procs.claim(TRAIT.FEAR_OF_DEATH, 'necromancer.core.fearOfDeath', runtime.time)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FEAR_OF_DEATH);
  grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
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
  if (interval > 0 && balanceProfileNumber(profile, 'lifeForceGain') !== 0)
    scheduleEternalLife(runtime, { interval, deadline: interval });
}

/** Retain accepted cadence and live selection/shroud checks even when new producers are omitted. */
function renewEternalLife(runtime: NecromancerRuntime, data: unknown): void {
  const pulse = data as { interval: number; deadline: number };
  scheduleEternalLife(runtime, { ...pulse, deadline: canonicalTime(pulse.deadline + pulse.interval) });
  if (hasTrait(runtime, TRAIT.ETERNAL_LIFE)) applyEternalLifePulse(runtime);
}

function scheduleEternalLife(runtime: NecromancerRuntime, pulse: { interval: number; deadline: number }): void {
  const at = gw2CooldownReadyAt(pulse.deadline);
  runtime.profession.core.passiveNextAt['eternal-life'] = at;
  runtime.schedule('necromancer.eternal-life', at, pulse, undefined, -10);
}
