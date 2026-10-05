import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const GUARDIAN_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.JUSTICE]: {
    // A committed activation entitles the next eligible hit to the selected active burn.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.arm-justice' } }],
    castTimeMs: 0,
    effects: []
  },
  [ID.COURAGE]: {
    castTimeMs: 0,
    effects: []
  },
  [ID.RESOLVE]: {
    castTimeMs: 0,
    effects: []
  }
});

export const guardianJusticeActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] = {
  'guardian.arm-justice'(runtime) {
    runtime.profession.core.justiceActiveArmed = Boolean(
      requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.justice), 'condition', 'Burning (active)')
    );
  }
};
