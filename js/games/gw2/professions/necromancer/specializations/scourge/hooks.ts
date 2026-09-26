import { canonicalTime, isInternalCooldownReady, isTimeInWindow } from '#kernel/core/clock.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import { assertSimulationEvent } from '#gw2/platform/engine/events/events.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { removeNecromancerSelfCondition } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import { scourgeState, purgeScourgeTimedState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { scourgeResolverEventReactions } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shade-effects.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { NecromancerRuntime, NecromancerRuntimeState } from '#gw2/professions/necromancer/types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';

const EXPIRE = 'scourge.shade-expiry';
const MANIFEST = 'scourge.manifest-impact';
const BARRIER = 'scourge.barrier-pulse';

/** Shade replacements cancel the old expiry wake; only the next surviving shade deadline remains queued. */
function refreshShadeExpiry(runtime: NecromancerRuntime): void {
  const state = scourgeState.from(runtime);
  runtime.cancelOwner({ id: EXPIRE, generation: state.shadeGeneration });
  state.shadeGeneration++;
  if (state.shades.length)
    runtime.schedule(EXPIRE, Math.min(...state.shades), null, { id: EXPIRE, generation: state.shadeGeneration }, -20);
}

/** Hostile travel changes packet arrival, while the cast's local resource and barrier work retains its own clock. */
function emitPacket(runtime: NecromancerRuntime, cast: RuntimeCast, event: SimulationEventBase): void {
  runtime.emit({
    ...event,
    activationId: cast.id,
    offTarget: cast.command.offTarget,
    at: canonicalTime(event.at + (isHostileTargetEvent(event) ? Number(cast.command.impactDelayMs ?? 0) / 1000 : 0))
  });
}

function party(runtime: NecromancerRuntime) {
  return {
    recipients: 'party' as const,
    maximumRecipients: 5,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
  };
}

/** Each actual barrier pulse selects current duration attributes and companion recipients once. */
function barrierTraits(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  for (const [trait, kind] of [
    [TRAIT.ABRASIVE_GRIT, 'might'],
    [TRAIT.DESERT_EMPOWERMENT, 'alacrity']
  ] as const) {
    if (!hasTrait(runtime, trait)) continue;
    const profile = requireBalanceProfileFromContext(runtime, trait);
    const effect = requireEffect(profile, 'boon', kind);
    if (!effect) continue;
    const event = {
      type: 'buff' as const,
      at: runtime.time,
      source: 'necromancer',
      sourceId: cast.skill.id,
      actorType: 'player' as const,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      kind,
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      audience: party(runtime)
    };
    queueResolverBoon(runtime, event, event);
  }
}

/** Finite area pulses survive their creating cast; barrier boons wait to sample the state at their own application. */
function emitShroudEffects(runtime: NecromancerRuntime, cast: RuntimeCast, effects: readonly SkillEffect[]): void {
  for (const effect of effects) {
    for (const { event } of materializeSkillEffectApplications({
      skill: cast.skill,
      effect,
      start: runtime.time,
      fullEnd: runtime.time,
      baseEvent: {
        source: 'necromancer',
        sourceId: cast.skill.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        actorType: 'player',
        activationId: cast.id
      },
      skillWeaponFallback: 'Unequipped'
    })) {
      if (event.type === 'buff') runtime.schedule(BARRIER, event.at, { cast, event });
      // Keep authored profile-slot labels out of the public strike name.
      else emitPacket(runtime, cast, event.type === 'damage' ? { ...event, name: cast.skill.name } : event);
    }
  }
}

/** Every shade command owns one common strike and Torment application, independent of the number of active shades. */
function shadeStrike(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.shade);
  const attribution = {
    at: runtime.time,
    source: 'necromancer',
    sourceId: ID.MANIFEST_SAND_SHADE,
    actorType: 'player' as const,
    skillId: cast.skill.id,
    skillName: cast.skill.id === ID.NEFARIOUS_FAVOR ? 'Manifest Sand Shade' : 'Manifest Sand Shade (F1/F5)',
    parentSkillName: cast.skill.name
  };
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (strike)
    emitPacket(
      runtime,
      cast,
      buildResolverStrike({
        ...attribution,
        name: 'Sand Shade - Strike',
        skillWeapon: 'Unequipped',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        metadata: {
          necromancerShroudSkillOne: true,
          dhuumfireDuration: balanceProfileNumber(profile, 'dhuumfireDuration'),
          dhuumfireInterval: balanceProfileNumber(profile, 'dhuumfireInterval')
        }
      })
    );
  const torment = requireEffect(profile, 'condition', 'Torment');
  if (torment)
    emitPacket(
      runtime,
      cast,
      buildResolverCondition({
        ...attribution,
        condition: String(torment.condition),
        stacks: effectNumber(profile, torment, 'stacks'),
        duration: effectNumber(profile, torment, 'duration')
      })
    );
}

/** Completed shade commands mutate local state before their queued strikes, trait reactions, and later commands. */
function completeShade(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  if (!castCompleted(cast)) return;
  const skill = cast.skill;
  if ([ID.SERPENT_SIPHON, ID.SAND_FLARE].some((id) => id === Number(skill.id))) {
    barrierTraits(runtime, cast);
    return;
  }

  if (!SHADE_SKILLS.has(Number(skill.id))) return;
  if (skill.id === ID.MANIFEST_SAND_SHADE) {
    const profile = requireBalanceProfileFromContext(
      runtime,
      hasTrait(runtime, TRAIT.SAND_SAVANT) ? PROFILE.sandSavant : PROFILE.shade
    );
    const lifetime = requireEffect(profile, 'buff', 'active-shade');
    if (lifetime) {
      const state = scourgeState.from(runtime);
      state.shades = grantTimedStacks(state.shades, {
        at: runtime.time,
        expiresAt: canonicalTime(runtime.time + effectNumber(profile, lifetime, 'duration')),
        count: 1,
        maximumStacks: balanceProfileNumber(profile, 'maximumStacks'),
        retain: 'latest-expiry'
      }).reverse();
      refreshShadeExpiry(runtime);
    }

    if (hasTrait(runtime, TRAIT.DESERT_EMPOWERMENT)) barrierTraits(runtime, cast);
    return;
  }

  const core = runtime.profession.core;
  if (skill.id === ID.DESERT_SHROUD || skill.id === ID.SANDSTORM_SHROUD) {
    if (hasTrait(runtime, TRAIT.PLAGUE_SENDING)) {
      core.plagueSendingArmed = true;
      core.plagueSendingEntrySkillId = core.selfConditions.some((application) =>
        isTimeInWindow(runtime.time, application.appliedAt, application.expiresAt)
      )
        ? null
        : skill.id;
    }

    if (hasTrait(runtime, TRAIT.SOUL_BARBS))
      runtime.emit({
        type: 'buff',
        at: runtime.time,
        source: 'necromancer',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        activationId: cast.id,
        kind: 'necromancer-soul-barbs',
        stacks: 1,
        duration: balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_BARBS), 'duration')
      });
  }

  if (skill.id === ID.NEFARIOUS_FAVOR) removeNecromancerSelfCondition(core, runtime.time, 1);
  shadeStrike(runtime, cast);
  if (skill.id === ID.NEFARIOUS_FAVOR && hasTrait(runtime, TRAIT.SADISTIC_SEARING)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.sadisticSearing);
    const condition = requireEffect(profile, 'condition', 'Burning');
    if (condition)
      emitPacket(
        runtime,
        cast,
        buildResolverCondition({
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.SADISTIC_SEARING,
          actorType: 'effect',
          ownerActorType: 'player',
          skillId: skill.id,
          skillName: skill.name,
          condition: String(condition.condition),
          stacks: effectNumber(profile, condition, 'stacks'),
          duration: effectNumber(profile, condition, 'duration')
        })
      );
  } else if (skill.id === ID.SAND_CASCADE) barrierTraits(runtime, cast);
  else if (skill.id === ID.GARISH_PILLAR) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.garishPillar);
    if (requireEffect(profile, 'control', 'Control'))
      emitPacket(runtime, cast, {
        type: 'control',
        at: runtime.time,
        source: 'necromancer',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        controlKind: 'fear'
      });
  } else if (skill.id === ID.DESERT_SHROUD) {
    barrierTraits(runtime, cast);
    emitShroudEffects(runtime, cast, requireBalanceProfileFromContext(runtime, PROFILE.desertShroud).effects ?? []);
  } else if (skill.id === ID.SANDSTORM_SHROUD)
    emitShroudEffects(runtime, cast, requireBalanceProfileFromContext(runtime, PROFILE.sandstormShroud).effects ?? []);
}

// These profession skills share shade ownership and Sinister Shroud recharge.
const SHADE_SKILLS = new Set<number>([
  ID.NEFARIOUS_FAVOR,
  ID.SAND_CASCADE,
  ID.GARISH_PILLAR,
  ID.DESERT_SHROUD,
  ID.MANIFEST_SAND_SHADE,
  ID.SANDSTORM_SHROUD
]);

/** Scourge consumes Core life force once at acceptance; its specialization owns shades, barrier pulses, and trait claims. */
export const scourgeHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  availability(runtime, skill) {
    const herald = hasTrait(runtime, TRAIT.HERALD_OF_SORROW);
    if (skill.id === ID.SANDSTORM_SHROUD && !herald)
      return denySkillCast(skill, 'necromancer.trait-replacement', 'requires Herald of Sorrow.');
    if (skill.id === ID.DESERT_SHROUD && herald)
      return denySkillCast(
        skill,
        'necromancer.trait-replacement',
        'replaced by Sandstorm Shroud while Herald of Sorrow is selected.'
      );
    return { ready: true };
  },
  // Shade traits compose multiplicatively against the same live catalog.
  rechargeRules: [
    {
      trait: TRAIT.SINISTER_SHROUD,
      when: (_runtime, skill) => SHADE_SKILLS.has(Number(skill.id)),
      multiplier: { profile: CORE_PROFILE.sinisterShroud, field: 'rechargeMultiplier' }
    },
    {
      trait: TRAIT.SAND_SAVANT,
      when: (_runtime, skill) => skill.id === ID.MANIFEST_SAND_SHADE,
      multiplier: { profile: PROFILE.sandSavant, field: 'rechargePenalty' }
    }
  ],
  maximumAmmo(runtime, skill, maximum) {
    return skill.id === ID.MANIFEST_SAND_SHADE && hasTrait(runtime, TRAIT.SAND_SAVANT)
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.sandSavant), 'maximumStacks')
      : maximum;
  },
  modifyEffects: (_runtime, cast, effects) => (SHADE_SKILLS.has(Number(cast.skill.id)) ? [] : effects),
  onCastStart(runtime, cast) {
    if (cast.skill.id === ID.MANIFEST_SAND_SHADE && !cast.cancelled)
      runtime.schedule(MANIFEST, canonicalTime(cast.start + ((cast.fullEnd - cast.start) * 11) / 12), cast);
  },
  onCastComplete: completeShade,
  tasks: {
    [EXPIRE](runtime) {
      purgeScourgeTimedState(scourgeState.from(runtime), runtime.time);
      refreshShadeExpiry(runtime);
    },
    [MANIFEST](runtime, data) {
      shadeStrike(runtime, data as RuntimeCast);
    },
    [BARRIER](runtime, data) {
      const { cast, event } = data as { cast: RuntimeCast; event: Gw2ResolverEvent };
      barrierTraits(runtime, cast);
      const packet = assertSimulationEvent({ ...event, audience: party(runtime) });
      queueResolverBoon(runtime, packet, { ...packet, kind: String(packet.kind), duration: Number(packet.duration) });
    }
  },
  reactions: {
    'condition.applied'(runtime, event) {
      scourgeResolverEventReactions.condition(runtime, event);
      const state = scourgeState.from(runtime);
      if (
        event.condition !== 'Burning' ||
        !hasTrait(runtime, TRAIT.NOURISHING_ASHES) ||
        !isInternalCooldownReady(runtime.time, state.nourishingAshesReadyAt)
      )
        return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.nourishingAshes);
      state.nourishingAshesReadyAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'cooldown'));
      grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
    }
  }
};
