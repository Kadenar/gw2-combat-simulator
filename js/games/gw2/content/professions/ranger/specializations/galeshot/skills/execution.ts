/** Registers scheduler-phase skill activations for this module. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chains.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import { applyRangerWeaponSwapTraits } from '#gw2/content/professions/ranger/core/traits/index.js';
import { applyGaleshotCycloneBowTraits } from '#gw2/content/professions/ranger/specializations/galeshot/mechanics/cyclone-bow-rules.js';
import { galeshotState } from '#gw2/content/professions/ranger/specializations/galeshot/state.js';
import type { RangerCastContext, RangerSkill } from '#gw2/content/professions/ranger/types.js';

import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/specializations/galeshot/profiles.js';

function emitGaleshotState(context: RangerCastContext, skill: RangerSkill, at = context.effectiveEnd) {
  const state = galeshotState.from(context);
  context.emit({
    type: 'ranger.galeshot-state',
    at,
    source: 'ranger',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    windForce: state.windForce,
    galeForceUntil: state.galeForceUntil,
    mistralUntil: state.mistralUntil,
    wutheringWindReady: state.wutheringWindReady,
    wutheringWindReadyAt: state.wutheringWindReadyAt
  });
}

function countAsWeaponSwap(context: RangerCastContext, skill: RangerSkill): void {
  // Entering/exiting the Cyclone Bow resets auto-attack chains the same way a
  // real weapon swap does, so the next auto starts at chain position 0.
  resetAutoattackChains(context);
  context.emit({
    type: 'weapon_set',
    at: context.effectiveEnd,
    source: 'ranger',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
    bundleSwap: true
  });
  applyRangerWeaponSwapTraits(context, skill);
}

function restoreArrows(context: RangerCastContext, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  state.maximumArrows = balanceProfileValueFromContext(context, PROFILE.resources, 'maximumStacks', 8);
  state.arrows = Math.min(state.maximumArrows, state.arrows + Number(skill.arrowsRestored || 0));
}

export const galeshotSkillHandlers = Object.freeze({
  'ranger.cyclone-bow-enter': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      galeshotState.from(context).cycloneBowActive = true;
      countAsWeaponSwap(context, skill);
      // State is emitted at context.start so the resolver sees it before any
      // mid-cast events that might fire during the cast animation.
      emitGaleshotState(context, skill, context.start);
    }
  },
  'ranger.cyclone-bow-exit': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const state = galeshotState.from(context);
      state.cycloneBowActive = false;
      state.windForce = 0;
      countAsWeaponSwap(context, skill);
      emitGaleshotState(context, skill, context.start);
    }
  },
  'ranger.cyclone-bow-skill': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const state = galeshotState.from(context);
      state.arrows = Math.max(0, state.arrows - Number(skill.arrowCost || 0));
      if (skill.id === ID.HAWKEYE) {
        // Hawkeye consumes all five stacks; windForce resets to 0 on cast.
        state.windForce = 0;
      } else {
        state.windForce = Math.min(
          balanceProfileValueFromContext(context, PROFILE.resources, 'minimumStacks', 5),
          state.windForce + Number(skill.windForceGain || 0)
        );
      }

      applyGaleshotCycloneBowTraits(context, skill);
      // Wind Force is gained partway through the cast (windForceApplyMs), not
      // at cast-end; Hawkeye emits at start because it resets WF before firing.
      emitGaleshotState(
        context,
        skill,
        skill.id === ID.HAWKEYE
          ? context.start
          : context.start + Number(skill.windForceApplyMs ?? skill.quicknessCastTimeMs) / 1000
      );
    }
  },
  'ranger.galeshot-arrows': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      restoreArrows(context, skill);
      emitGaleshotState(context, skill, context.start);
    }
  },
  'ranger.mistral': {
    mode: 'augment' as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const state = galeshotState.from(context);
      restoreArrows(context, skill);
      state.mistralUntil =
        context.start + balanceProfileValueFromContext(context, PROFILE.mistral, 'durationMultiplier', 6);
      emitGaleshotState(context, skill);
    }
  }
});
