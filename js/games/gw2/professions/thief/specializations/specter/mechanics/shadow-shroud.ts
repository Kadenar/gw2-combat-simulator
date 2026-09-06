import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitThiefShroudSwap } from '#gw2/professions/thief/core/mechanics/resource-events.js';

import { completeStealWithStoredSkills } from '#gw2/professions/thief/core/mechanics/steal.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import type { ThiefCastContext, ThiefSchedulerContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';

export const SHADOW_SHROUD_DEPLETION_TASK = 'thief.shadow-shroud-depleted';

// Stop advancement at the zero crossing; gains can postpone it when the task rechecks the remaining force.
function scheduleShadowShroudDepletion(context: ThiefSchedulerContext): void {
  const state = specterState.from(context);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  const drain = state.maximumShadowForce * Number(resources?.lifeForceDrain ?? 0.02);
  if (!(drain > 0)) return;
  const remaining = state.shadowForce / drain;
  context.tasks.schedule({
    type: SHADOW_SHROUD_DEPLETION_TASK,
    at: state.shadowForceUpdatedAt + remaining,
    priority: -10,
    ownerId: SHADOW_SHROUD_DEPLETION_TASK
  });
}

export function handleShadowShroudDepletion(context: ThiefSchedulerContext): void {
  const state = specterState.from(context);
  if (!state.shadowShroudActive) return;
  if (state.shadowForce > context.epsilon) {
    scheduleShadowShroudDepletion(context);
    return;
  }

  state.shadowForce = 0;
  state.shadowShroudActive = false;
  emitThiefShroudSwap(context, { id: SHADOW_SHROUD_DEPLETION_TASK, name: 'Exit Shadow Shroud' }, context.state.time);
  emitThiefStateSnapshot(context, context.state.time, 'shadow-shroud-depleted');
}

export function completeSiphon(context: ThiefCastContext): void {
  const state = specterState.from(context);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce +
      (hasTrait(context.config, TRAIT.AMPLIFIED_SIPHONING)
        ? Number(balanceProfileFromContext(context, PROFILE.amplifiedSiphoning)?.resourceGain ?? 27.5)
        : Number(resources?.lifeForceGain ?? 25))
  );
  // Siphon is a profession skill, not a steal; null clears any stored stolen skill.
  completeStealWithStoredSkills(context, []);
}

export function enterShadowShroud(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = specterState.from(context);
  const at = context.effectiveEnd;
  const profile = balanceProfileFromContext(context, PROFILE.enterShadowShroud);
  const barrier = balanceProfileEffect(profile, 'buff');
  state.shadowShroudActive = true;
  state.shadowForceUpdatedAt = at;
  scheduleShadowShroudDepletion(context);
  // Enter Shadow Shroud barriers one tethered ally, not the caster or whole party.
  const alliedRecipients = Math.min(
    Number(profile?.maximumTargets ?? 1),
    gw2AlliedPlayerAssumptions(context.config).count
  );
  if (alliedRecipients > 0) {
    emitSkillBuff(context, {
      at,
      source: 'thief',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Enter Shadow Shroud - Barrier',
      kind: 'barrier',
      duration: Number(barrier?.duration ?? 5),
      stacks: Number(barrier?.stacks ?? 1),
      audience: { recipients: 'party' as const, affectsSelf: false, maximumRecipients: alliedRecipients }
    });
    context.tasks.schedule({
      type: 'thief.specter-dark-sentry',
      at,
      payload: { allyIndices: [1] }
    });
  }

  emitThiefShroudSwap(context, skill, at);
  emitThiefStateSnapshot(context, at, 'enter-shadow-shroud');
}

export function exitShadowShroud(context: ThiefCastContext, skill: ThiefSkill): void {
  const at = context.effectiveEnd;
  specterState.from(context).shadowShroudActive = false;
  context.tasks.cancelOwner(SHADOW_SHROUD_DEPLETION_TASK);
  emitThiefShroudSwap(context, skill, at);
  emitThiefStateSnapshot(context, at, 'exit-shadow-shroud');
}

// Specter converts spent initiative into shadow force instead of consuming it for damage.
// The core thief handler still deducts initiative; this is a parallel gain on top of that.
export function spendSpecterResources(context: ThiefCastContext, skill: ThiefSkill): void {
  const cost = Number(skill.initiativeCost || 0);
  if (!(cost > 0)) return;
  const state = specterState.from(context);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + cost * Number(resources?.resourceGain ?? 1)
  );
  // Emit at cast start so the resource timeline reflects the gain immediately.
  emitThiefStateSnapshot(context, context.start, 'shadow-force');
}

export function advanceSpecterResources(context: ThiefSchedulerContext, target: number): void {
  const state = specterState.from(context);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  state.maximumShadowForce = Number(resources?.maximumStacks ?? 100);
  state.shadowForcePoolCapacity =
    Number(professionCoreState(context).maximumHealth || 0) * Number(resources?.attributeConversion ?? 0.69);
  state.shadowForce = Math.min(state.maximumShadowForce, state.shadowForce);
  const shadowFrom = Number(state.shadowForceUpdatedAt || 0);
  if (target > shadowFrom && state.shadowShroudActive) {
    state.shadowForce = Math.max(
      0,
      state.shadowForce - (target - shadowFrom) * state.maximumShadowForce * Number(resources?.lifeForceDrain ?? 0.02)
    );
  }

  state.shadowForceUpdatedAt = target;
  emitThiefStateSnapshot(context, target, 'resources');
}
