import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  armWeakeningStrikes,
  grantEnduranceThief,
  refundStaffMaster,
  weakeningStrike
} from '#gw2/professions/thief/specializations/daredevil/traits/behavior.js';
import { openDodgeWindow, queueDodgePackets } from '#gw2/professions/thief/specializations/daredevil/traits/dodges.js';

import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';

import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { thiefEndurance } from '#gw2/professions/thief/core/mechanics/resources.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';

import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';

import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const DAREDEVIL_COMPLETE = 'thief.daredevil-complete';

/** After the dodge's own packets, the dodge opens its window and Weakening Strikes arms the next landed strike. */
function completeDaredevilDodge(runtime: ThiefRuntime, cast: RuntimeCast): void {
  openDodgeWindow(runtime, cast);
  armWeakeningStrikes(runtime, cast);
}

function completeDaredevilCast(runtime: ThiefRuntime, cast: RuntimeCast): void {
  if (cast.skill.id === SHARED_SKILL_IDS.DODGE) completeDaredevilDodge(runtime, cast);
  // Endurance Thief follows Core's steal resources.
  grantEnduranceThief(runtime, cast);
}

/** Daredevil hooks: the larger endurance pool, selected dodges, trait refunds, and Palm Strike. */
export const daredevilHooks: Partial<RuntimeProfession<ThiefRuntimeState>> = {
  // Daredevil replaces only the capacity while retaining Core's pool and regeneration.
  endurance: {
    ...thiefEndurance,
    maximum: (runtime) =>
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks')
  },
  availability(runtime, skill) {
    if (
      skill.id !== ID.PALM_STRIKE ||
      skillFlipReady(runtime.profession.core.availableFlips[ID.PALM_STRIKE], runtime.time)
    )
      return { ready: true };
    // No timer can open the window; only a connecting Fist Flurry does.
    return {
      ready: false,
      retryAt: null,
      code: 'thief.palm-strike',
      reason: 'Palm Strike is unavailable — Fist Flurry must connect first.'
    };
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill as ThiefSkill;

    // Staff Master refunds endurance per initiative spent on staff skills.
    refundStaffMaster(runtime, cast);
    if (skill.id === SHARED_SKILL_IDS.DODGE && !cast.cancelled) queueDodgePackets(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    deferThiefCompletion(runtime, DAREDEVIL_COMPLETE, cast);
  },
  reactions: {
    'damage.resolved': weakeningStrike
  },
  tasks: {
    [DAREDEVIL_COMPLETE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast };
      completeDaredevilCast(runtime, cast);
    }
  }
};
