import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { removeNecromancerSelfCondition } from '#gw2/professions/necromancer/core/mechanics/condition-management.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import type {
  NecromancerRuntime,
  NecromancerRuntimeState,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Finite area pulses survive their creating cast; shared buff delivery samples recipients at application. */
function emitShroudEffects(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  effects: readonly SkillEffect[]
): void {
  // Delay hostile Desert Shroud packets intrinsically; barrier and activation traits keep their own timing.
  const impactDelayMs =
    cast.skill.id === ID.DESERT_SHROUD
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.desertShroud), 'impactDelayMs')
      : 0;
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
      actorType: ACTOR.PLAYER,
      activationId: cast.id
    },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => {
      return {
        ...event,
        ...(event.type === 'damage' ? { name: cast.skill.name } : {}),
        offTarget: cast.command.offTarget,
        at: canonicalTime(
          event.at + (isHostileTargetEvent(event) ? (impactDelayMs + (cast.command.impactDelayMs ?? 0)) / 1000 : 0)
        )
      };
    }
  });
}

/** Shroud commands own their cleanse, control, and delayed barrier effects. */
const scourgeShroudActions = {
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
        actorType: ACTOR.PLAYER,
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

/** Shroud actions author effects; barrier rewards observe accepted buffs through the shared resolver. */
export const scourgeShroudLifecycle = {
  sideEffectHandlers: scourgeShroudActions
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
