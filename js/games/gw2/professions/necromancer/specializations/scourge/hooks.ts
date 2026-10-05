import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { assertSimulationEvent } from '#gw2/platform/events/events.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { removeNecromancerSelfCondition } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { party } from '#gw2/professions/necromancer/specializations/scourge/mechanics/audiences.js';
import { shadeDhuumfireParameters } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shade-projection.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import { purgeScourgeTimedState, scourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import {
  barrierTraits,
  desertEmpowermentManifest,
  reactToScourgeTraits,
  sandSavantShadeProfile,
  shadeTraits
} from '#gw2/professions/necromancer/specializations/scourge/traits/behavior.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
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
function emitShroudEffects(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  effects: readonly SkillEffect[]
): void {
  runtime.effects.emit({
    kind: 'profile',
    profile: cast.skill,
    effects,
    at: runtime.time,
    attribution: {
      source: 'necromancer',
      sourceId: cast.skill.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      actorType: 'player',
      activationId: cast.id
    },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => {
      // Barrier pulses are mechanic transactions: their traits settle before the resulting party boon.
      if (event.type === 'buff') {
        runtime.scheduleForCast(BARRIER, event.at, cast, { event });
        return null;
      }

      return {
        ...event,
        ...(event.type === 'damage' ? { name: cast.skill.name } : {}),
        offTarget: cast.command.offTarget,
        at: canonicalTime(event.at + (isHostileTargetEvent(event) ? (cast.command.impactDelayMs ?? 0) / 1000 : 0))
      };
    }
  });
}

/** Every shade command owns one common strike and Torment application, independent of the number of active shades. */
function shadeStrike(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
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
  if (strike) {
    // Shared emission owns transport; the mechanic selects attribution and delivery.
    const emissionRuntime: NecromancerRuntime = runtime;
    const emissionCast: RuntimeCast<NecromancerSkill> = cast;
    const emissionEvent: SimulationEventBase = buildResolverStrike({
      ...attribution,
      name: 'Sand Shade - Strike',
      skillWeapon: 'Unequipped',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      metadata: {
        necromancerShroudSkillOne: true,
        ...shadeDhuumfireParameters(profile)
      }
    });

    emissionRuntime.effects.emit({
      kind: 'packet',
      event: {
        ...emissionEvent,
        activationId: emissionCast.id,
        offTarget: emissionCast.command.offTarget,
        at: canonicalTime(
          emissionEvent.at +
            (isHostileTargetEvent(emissionEvent) ? (emissionCast.command.impactDelayMs ?? 0) / 1000 : 0)
        )
      }
    });
  }

  const torment = requireEffect(profile, 'condition', 'Torment');
  if (torment) {
    // Shared emission owns transport; the mechanic selects attribution and delivery.
    const emissionRuntime: NecromancerRuntime = runtime;
    const emissionCast: RuntimeCast<NecromancerSkill> = cast;
    const emissionEvent: SimulationEventBase = buildResolverCondition({
      ...attribution,
      condition: String(torment.condition),
      stacks: effectNumber(profile, torment, 'stacks'),
      duration: effectNumber(profile, torment, 'duration')
    });

    emissionRuntime.effects.emit({
      kind: 'packet',
      event: {
        ...emissionEvent,
        activationId: emissionCast.id,
        offTarget: emissionCast.command.offTarget,
        at: canonicalTime(
          emissionEvent.at +
            (isHostileTargetEvent(emissionEvent) ? (emissionCast.command.impactDelayMs ?? 0) / 1000 : 0)
        )
      }
    });
  }
}

/** Manifest refreshes the capped shade lifetime before its queued impact. */
function manifestShade(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
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
export const scourgeHooks: RuntimeHooks<NecromancerRuntimeState, NecromancerSkill> = {
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
      if (requireEffect(profile, 'control', 'Control')) {
        // Shared emission owns transport; the mechanic selects attribution and delivery.
        const emissionRuntime: NecromancerRuntime = runtime;
        const emissionCast: RuntimeCast<NecromancerSkill> = context.cast;
        const emissionEvent: SimulationEventBase = {
          type: 'control',
          at: runtime.time,
          source: 'necromancer',
          sourceId: context.skill.id,
          actorType: 'player',
          skillId: context.skill.id,
          skillName: context.skill.name,
          controlKind: 'fear'
        };

        emissionRuntime.effects.emit({
          kind: 'packet',
          event: {
            ...emissionEvent,
            activationId: emissionCast.id,
            offTarget: emissionCast.command.offTarget,
            at: canonicalTime(
              emissionEvent.at +
                (isHostileTargetEvent(emissionEvent) ? (emissionCast.command.impactDelayMs ?? 0) / 1000 : 0)
            )
          }
        });
      }
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
      shadeStrike(runtime, (data as { cast: RuntimeCast<NecromancerSkill> }).cast);
    },
    [BARRIER](runtime, data) {
      const { cast, event } = data as { cast: RuntimeCast<NecromancerSkill>; event: Gw2ResolverEvent };
      barrierTraits(runtime, cast);
      const packet = assertSimulationEvent({ ...event, audience: party(runtime) });
      runtime.effects.emit({
        kind: 'packet',
        event: { ...packet, kind: String(packet.kind), duration: Number(packet.duration) },
        durationContext: packet
      });
    }
  },
  reactions: {
    'condition.applied': reactToScourgeTraits
  }
};
