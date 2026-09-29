import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { assertSimulationEvent } from '#gw2/platform/engine/events/events.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { removeNecromancerSelfCondition } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { emitPacket, party } from '#gw2/professions/necromancer/specializations/scourge/mechanics/emission.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import { purgeScourgeTimedState, scourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import {
  barrierTraits,
  desertEmpowermentManifest,
  reactToScourgeTraits,
  sandSavantShadeProfile,
  shadeTraits
} from '#gw2/professions/necromancer/specializations/scourge/traits/behavior.js';
import type { NecromancerRuntime, NecromancerRuntimeState } from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

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
      if (event.type === 'buff') runtime.scheduleForCast(BARRIER, event.at, cast, { event });
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

/** Manifest refreshes the capped shade lifetime before its queued impact. */
function manifestShade(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  const profile = sandSavantShadeProfile(runtime);
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

  desertEmpowermentManifest(runtime, cast);
}

/** Scourge consumes Core life force once at acceptance; its specialization owns shades, barrier pulses, and trait claims. */
export const scourgeHooks: Partial<RuntimeProfession<NecromancerRuntimeState>> = {
  sideEffectHandlers: {
    'scourge.manifest-start'(runtime, context) {
      if (context.kind === 'cast' && !context.cast.cancelled)
        runtime.scheduleForCast(
          MANIFEST,
          canonicalTime(context.cast.start + ((context.cast.fullEnd - context.cast.start) * 11) / 12),
          context.cast
        );
    },
    'scourge.manifest'(runtime, context) {
      if (context.kind === 'cast') manifestShade(runtime, context.cast);
    },
    'scourge.strike'(runtime, context) {
      if (context.kind === 'cast') shadeStrike(runtime, context.cast);
    },
    'scourge.barrier'(runtime, context) {
      if (context.kind === 'cast') barrierTraits(runtime, context.cast);
    },
    'scourge.cleanse'(runtime) {
      removeNecromancerSelfCondition(runtime.profession.core, runtime.time, 1);
    },
    'scourge.garish-pillar'(runtime, context) {
      if (context.kind !== 'cast') return;
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.garishPillar);
      if (requireEffect(profile, 'control', 'Control'))
        emitPacket(runtime, context.cast, {
          type: 'control',
          at: runtime.time,
          source: 'necromancer',
          sourceId: context.skill.id,
          actorType: 'player',
          skillId: context.skill.id,
          skillName: context.skill.name,
          controlKind: 'fear'
        });
    },
    'scourge.desert-shroud'(runtime, context) {
      if (context.kind === 'cast')
        emitShroudEffects(
          runtime,
          context.cast,
          requireBalanceProfileFromContext(runtime, PROFILE.desertShroud).effects ?? []
        );
    },
    'scourge.sandstorm-shroud'(runtime, context) {
      if (context.kind === 'cast')
        emitShroudEffects(
          runtime,
          context.cast,
          requireBalanceProfileFromContext(runtime, PROFILE.sandstormShroud).effects ?? []
        );
    }
  },
  onCastCommit: shadeTraits,
  tasks: {
    [EXPIRE](runtime) {
      purgeScourgeTimedState(scourgeState.from(runtime), runtime.time);
      refreshShadeExpiry(runtime);
    },
    [MANIFEST](runtime, data) {
      shadeStrike(runtime, (data as { cast: RuntimeCast }).cast);
    },
    [BARRIER](runtime, data) {
      const { cast, event } = data as { cast: RuntimeCast; event: Gw2ResolverEvent };
      barrierTraits(runtime, cast);
      const packet = assertSimulationEvent({ ...event, audience: party(runtime) });
      queueResolverBoon(runtime, packet, { ...packet, kind: String(packet.kind), duration: Number(packet.duration) });
    }
  },
  reactions: {
    'condition.applied': reactToScourgeTraits
  }
};
