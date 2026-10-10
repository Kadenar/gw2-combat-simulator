import { daredevilBuffPolicies } from '#gw2/professions/thief/specializations/daredevil/effect-state.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  daredevilCastCompleted,
  daredevilCastStarted,
  daredevilDodged,
  daredevilStruck,
  physicalSkillStarted
} from '#gw2/professions/thief/specializations/daredevil/mechanics/boundaries.js';
import { queueDodgePackets } from '#gw2/professions/thief/specializations/daredevil/mechanics/dodges.js';

import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';

import { deferThiefCompletion } from '#gw2/professions/thief/core/events.js';
import { thiefEndurance } from '#gw2/professions/thief/core/mechanics/resources.js';
import { storeThiefStolenSkillChoices, THIEF_STOLEN_SKILL_IDS } from '#gw2/professions/thief/core/mechanics/steal.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';

import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefConfig, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

const DAREDEVIL_COMPLETE = 'thief.daredevil-complete';

/** After the dodge's own packets, the dodge opens its window and Weakening Strikes arms the next landed strike. */
function completeDaredevilDodge(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  runtime.fireTrigger(daredevilDodged, { cast });
}

function completeDaredevilCast(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  if (cast.skill.id === SHARED_SKILL_IDS.DODGE) completeDaredevilDodge(runtime, cast);
  // Endurance Thief follows Core's steal resources.
  runtime.fireTrigger(daredevilCastCompleted, { cast });
}

/** Daredevil hooks: the larger endurance pool, selected dodges, trait refunds, and Palm Strike. */
export const daredevilHooks: RuntimeHooks<ThiefRuntimeState, ThiefSkill> = {
  // Daredevil opts into Core's stolen inventory without triggering its steal or dodge traits during setup.
  initialize(runtime) {
    if ((runtime.config as ThiefConfig).initialPreSteal === 1)
      storeThiefStolenSkillChoices(runtime, THIEF_STOLEN_SKILL_IDS);
  },
  buffPolicies: daredevilBuffPolicies,
  sideEffectHandlers: {
    'thief.physical-skill'(runtime, context) {
      runtime.fireTrigger(physicalSkillStarted, { context });
    }
  },
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
    const skill = cast.skill;

    runtime.fireTrigger(daredevilCastStarted, { cast });
    if (skill.id === SHARED_SKILL_IDS.DODGE && !cast.cancelled) queueDodgePackets(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    deferThiefCompletion(runtime, DAREDEVIL_COMPLETE, cast);
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      runtime.fireTrigger(daredevilStruck, { cause: event });
    }
  },
  tasks: {
    [DAREDEVIL_COMPLETE](runtime, data) {
      const { cast } = data as { cast: RuntimeCast<ThiefSkill> };
      completeDaredevilCast(runtime, cast);
    }
  }
};
