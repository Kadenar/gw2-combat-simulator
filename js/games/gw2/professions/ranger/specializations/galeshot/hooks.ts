import { canonicalTime } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { galeshotState, galeshotArrows } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { applyGaleshotCycloneBowTraits } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { galeshotCastAvailability } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import {
  completeGaleshotSkill,
  reactToGaleshotMissile,
  reactToGaleshotPet,
  reactToGaleshotControl
} from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { applyRangerWeaponSwapTraits } from '#gw2/professions/ranger/core/traits/index.js';
import { rangerEvent } from '#gw2/professions/ranger/core/events.js';

/** Arrow spending is immediate; Wind Force and completion traits become visible only at their own queue boundary. */
export const galeshotHooks: Partial<RuntimeProfession<RangerRuntimeState>> = {
  resources: { arrows: galeshotArrows },
  availability: galeshotCastAvailability,
  onCastStart(runtime, cast) {
    const state = galeshotState.from(runtime);
    const skill = cast.skill;
    runtime.resourceController.spend('arrows', Number(skill.arrowCost || 0));
    if (skill.id === ID.HAWKEYE) state.windForce = 0;
    if (cancelledBeforeInterruptCommit(skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    if (Number(skill.windForceGain) > 0) {
      const at = canonicalTime(cast.start + Number(skill.windForceApplyMs ?? skill.castTimeMs) / 1000);
      if (!castWasInterrupted(cast) || at <= cast.effectiveEnd)
        runtime.schedule('ranger.wind-force', at, Number(skill.windForceGain));
    }

    if (Number(skill.arrowsRestored) > 0) runtime.resourceController.grant('arrows', Number(skill.arrowsRestored));
    if (skill.id === ID.MISTRAL)
      state.mistralUntil = canonicalTime(
        runtime.time +
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.mistral), 'durationMultiplier')
      );
  },
  onCastComplete(runtime, cast) {
    if (cancelledBeforeInterruptCommit(cast.skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    const state = galeshotState.from(runtime);
    const skill = cast.skill;
    if (skill.id === ID.SUMMON_CYCLONE_BOW || skill.id === ID.DISMISS_CYCLONE_BOW) {
      state.cycloneBowActive = skill.id === ID.SUMMON_CYCLONE_BOW;
      if (!state.cycloneBowActive) state.windForce = 0;
      resetAutoattackChains(runtime);
      runtime.emit(
        rangerEvent(
          {
            at: runtime.time,
            skillId: skill.id,
            skillName: skill.name,
            weaponSet: runtime.activeWeaponSet,
            bundleSwap: true
          },
          'weapon_set'
        )
      );
      applyRangerWeaponSwapTraits(runtime, skill);
    }

    if (skill.cycloneBowSkill) applyGaleshotCycloneBowTraits(runtime, skill);
    if (skill.id === ID.PET_SWAP) state.wutheringWindReady = false;
    completeGaleshotSkill(runtime, skill);
  },
  tasks: {
    'ranger.wind-force'(runtime, gain) {
      const state = galeshotState.from(runtime);
      state.windForce = Math.min(
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'minimumStacks'),
        state.windForce + Number(gain)
      );
    }
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      reactToGaleshotMissile(runtime, event);
      reactToGaleshotPet(runtime, event);
    },
    'control.resolved': reactToGaleshotControl
  }
};
