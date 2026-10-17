import { CONDITION } from '#gw2/platform/effects/conditions.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { assertSimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { removeNecromancerSelfCondition } from '#gw2/professions/necromancer/core/mechanics/conditions.js';
import { necromancerPartyAudience } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { scourgeBarrierApplied } from '#gw2/professions/necromancer/specializations/scourge/mechanics/trigger-points.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const BARRIER = 'scourge.barrier-pulse';

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

/** Shroud commands own their cleanse, control, and delayed barrier effects. */
const scourgeShroudActions = {
  'scourge.barrier'(runtime, context) {
    if (context.kind === 'cast')
      runtime.fireTrigger(scourgeBarrierApplied, {
        cast: context.cast,
        at: runtime.time,
        activationId: context.cast.id
      });
  },
  'scourge.cleanse'(runtime) {
    removeNecromancerSelfCondition(runtime.profession.core, runtime.time, 1);
  },
  'scourge.garish-pillar'(runtime, context) {
    if (context.kind !== 'cast') return;

    const profile = requireBalanceProfileFromContext(runtime, PROFILE.garishPillar);
    const fear = requireEffect(profile, 'condition', CONDITION.FEAR);

    if (fear) {
      // Shared emission owns transport; the mechanic selects attribution and delivery.
      const emissionRuntime: NecromancerRuntime = runtime;
      const emissionCast: RuntimeCast<NecromancerSkill> = context.cast;
      const emissionEvent: SimulationEventBase = {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: Number(fear.stacks),
        duration: Number(fear.duration),
        at: runtime.time,
        source: 'necromancer',
        sourceId: context.skill.id,
        actorType: 'player',
        skillId: context.skill.id,
        skillName: context.skill.name
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
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['sideEffectHandlers']>;

/** Barrier traits settle before the boon samples its live party audience. */
const scourgeShroudTasks = {
  [BARRIER](runtime, data) {
    const { cast, event } = data as { cast: RuntimeCast<NecromancerSkill>; event: Gw2ResolverEvent };
    runtime.fireTrigger(scourgeBarrierApplied, { cast, at: runtime.time, activationId: cast.id });
    const packet = assertSimulationEvent({ ...event, audience: necromancerPartyAudience(runtime) });
    runtime.effects.emit({
      kind: 'packet',
      event: { ...packet, kind: String(packet.kind), duration: Number(packet.duration) },
      durationContext: packet
    });
  }
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['tasks']>;

/** Scourge shroud actions and their delayed tasks share one owner. */
export const scourgeShroudLifecycle = {
  sideEffectHandlers: scourgeShroudActions,
  tasks: scourgeShroudTasks
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
