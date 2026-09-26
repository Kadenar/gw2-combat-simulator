import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { soulbeastCastAvailability } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import {
  soulbeastEventHandlers,
  reactToRangerWinterBite,
  reactToSoulbeastBuff,
  reactToSoulbeastCondition,
  reactToSoulbeastControl,
  reactToSoulbeastDamage
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
import { setRangerPetActive } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { applyRangerBeastSkillTraits } from '#gw2/professions/ranger/core/traits/index.js';
import {
  applyUnstoppableUnion,
  emitSoulbeastStance
} from '#gw2/professions/ranger/specializations/soulbeast/traits/index.js';
import { emitRangerBuff, rangerEvent } from '#gw2/professions/ranger/core/live-events.js';
import { scheduleSharedStance } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';

const commands = new Set<number>([ID.STRENGTH_OF_THE_PACK, ID.PROTECT_ME, ID.GUARD, ID.SIC_EM, ID.WE_HEAL_AS_ONE]);

/** Merge, stance grants, and hit reactions mutate their sole live slice at the owning cast boundary. */
export const soulbeastLive: Partial<RuntimeProfession<RangerRuntimeState>> = {
  initialize(runtime) {
    setRangerPetActive(runtime, !soulbeastState.from(runtime).beastmodeActive);
  },
  onCombatStart(runtime) {
    for (const event of soulbeastState.from(runtime).pendingSharedStances.splice(0))
      scheduleSharedStance(runtime, event);
  },
  availability: soulbeastCastAvailability,
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    if (cancelledBeforeInterruptCommit(skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
    if (skill.id === ID.BEASTMODE || skill.id === ID.LEAVE_BEASTMODE) {
      soulbeastState.from(runtime).beastmodeActive = skill.id === ID.BEASTMODE;
      setRangerPetActive(runtime, skill.id !== ID.BEASTMODE);
      applyUnstoppableUnion(runtime, skill);
    }

    if (skill.id === ID.ONE_WOLF_PACK || skill.id === ID.VULTURE_STANCE) {
      const wolf = skill.id === ID.ONE_WOLF_PACK;
      const duration = emitSoulbeastStance(
        runtime,
        skill,
        wolf ? 'one-wolf-pack' : 'vulture-stance',
        balanceProfileNumber(
          requireBalanceProfileFromContext(runtime, wolf ? PROFILE.oneWolfPack : PROFILE.vultureStance),
          'durationMultiplier'
        )
      );
      if (wolf) soulbeastState.from(runtime).oneWolfPackUntil = runtime.time + duration;
    }

    if (soulbeastState.from(runtime).beastmodeActive && skill.id === ID.SIC_EM)
      emitRangerBuff(
        runtime,
        rangerEvent(
          {
            at: runtime.time,
            skillId: skill.id,
            skillName: skill.name,
            kind: 'sic-em',
            priority: -20,
            stacks: 1,
            duration: balanceProfileNumber(
              requireBalanceProfileFromContext(runtime, CORE_PROFILE.sicEm),
              'durationMultiplier'
            )
          },
          'buff'
        )
      );
  },
  onCastComplete(runtime, cast) {
    if (castWasInterrupted(cast)) return;
    const state = soulbeastState.from(runtime);
    const skill = cast.skill;
    if (skill.id === ID.PET_SWAP) state.archetype = rangerPetByName(runtime.profession.core.activePet).archetype;
    if (!state.beastmodeActive) return;
    if (commands.has(Number(skill.id)) && hasTrait(runtime, TRAIT.RESOUNDING_TIMBRE))
      runtime.emit(
        rangerEvent(
          {
            at: runtime.time,
            sourceId: TRAIT.RESOUNDING_TIMBRE,
            skillId: skill.id,
            skillName: 'Resounding Timbre',
            duration: balanceProfileNumber(
              requireBalanceProfileFromContext(runtime, CORE_PROFILE.resoundingTimbre),
              'durationMultiplier'
            )
          },
          'boon_extension'
        )
      );
    if (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE)
      applyRangerBeastSkillTraits(runtime, skill, false);
  },
  eventHandlers: soulbeastEventHandlers,
  reactions: {
    'damage.resolved'(runtime, event) {
      reactToSoulbeastDamage(runtime, event);
      reactToRangerWinterBite(runtime, event);
    },
    'control.resolved': reactToSoulbeastControl,
    'condition.applied': reactToSoulbeastCondition,
    'buff.applied': reactToSoulbeastBuff
  }
};
