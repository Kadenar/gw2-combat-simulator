import { isHostileTargetEvent } from '#gw2/platform/combat/state/targets.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { cleanseNecromancerSelfCondition } from '#gw2/professions/necromancer/core/mechanics/condition-management.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
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
  const impactDelayMs = cast.skill.id === ID.DESERT_SHROUD ? skillNumber(cast.skill, 'impactDelayMs') : 0;
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
    cleanseNecromancerSelfCondition(runtime);
  },
  'scourge.garish-pillar'(runtime, context) {
    if (context.kind === 'cast')
      emitShroudEffects(runtime, context.cast, requireSkillAction(context.skill, 'garishPillar').effects);
  },
  'scourge.desert-shroud'(runtime, context) {
    if (context.kind === 'cast')
      emitShroudEffects(runtime, context.cast, requireSkillAction(context.skill, 'desertShroud').effects);
  },
  'scourge.sandstorm-shroud'(runtime, context) {
    if (context.kind === 'cast')
      emitShroudEffects(runtime, context.cast, requireSkillAction(context.skill, 'sandstormShroud').effects);
  }
} satisfies NonNullable<RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>['sideEffectHandlers']>;

/** Shroud actions author effects; barrier rewards observe accepted buffs through the shared resolver. */
export const scourgeShroudLifecycle = {
  sideEffectHandlers: scourgeShroudActions
} satisfies RuntimeHooks<NecromancerRuntimeState, NecromancerSkill>;
