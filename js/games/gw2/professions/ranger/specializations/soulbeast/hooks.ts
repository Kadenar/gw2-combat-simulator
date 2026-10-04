import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { setRangerPetActive } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { applyRangerBeastSkillTraits } from '#gw2/professions/ranger/core/traits/dispatch.js';
import { applyMergedResoundingTimbre } from '#gw2/professions/ranger/core/traits/pet-behavior.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import {
  reactToRangerWinterBite,
  reactToSoulbeastBuff,
  reactToSoulbeastDamage,
  scheduleSharedStance,
  soulbeastCastAvailability,
  soulbeastEventHandlers
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { setBeastmode } from '#gw2/professions/ranger/specializations/soulbeast/skills/beastmode-skills.js';
import { activateSoulbeastStance } from '#gw2/professions/ranger/specializations/soulbeast/skills/stance-skills.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import type { RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Merge, stance grants, and hit reactions mutate their sole state slice at the owning cast boundary. */
export const soulbeastHooks: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    soulbeastState.from(runtime).beastmodeActive = Boolean(skill?.beastmodeSkill || inputs.merged);
  },

  initialize(runtime) {
    setRangerPetActive(runtime, !soulbeastState.from(runtime).beastmodeActive);
  },
  onCombatStart(runtime) {
    for (const event of soulbeastState.from(runtime).pendingSharedStances.splice(0))
      scheduleSharedStance(runtime, event);
  },
  availability: soulbeastCastAvailability,
  sideEffectHandlers: {
    'ranger.beastmode-enter'(runtime, context) {
      setBeastmode(runtime, context.skill, true);
    },
    'ranger.beastmode-leave'(runtime, context) {
      setBeastmode(runtime, context.skill, false);
    },
    'ranger.vulture-stance'(runtime, context) {
      activateSoulbeastStance(runtime, context.skill, 'vulture-stance', PROFILE.vultureStance);
    },
    'ranger.one-wolf-pack'(runtime, context) {
      soulbeastState.from(runtime).oneWolfPackUntil =
        runtime.time + activateSoulbeastStance(runtime, context.skill, 'one-wolf-pack', PROFILE.oneWolfPack);
    }
  },
  onCastCommit(runtime, cast) {
    const state = soulbeastState.from(runtime);
    const skill = cast.skill;
    if (skill.id === ID.PET_SWAP) state.archetype = rangerPetByName(runtime.profession.core.activePet).archetype;
    if (!state.beastmodeActive) return;
    applyMergedResoundingTimbre(runtime, skill, runtime.time);
    if (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE)
      applyRangerBeastSkillTraits(runtime, skill, false);
  },
  eventHandlers: soulbeastEventHandlers,
  reactions: {
    'damage.resolved'(runtime, event) {
      reactToSoulbeastDamage(runtime, event);
      reactToRangerWinterBite(runtime, event);
    },
    'buff.applied': reactToSoulbeastBuff
  }
};
