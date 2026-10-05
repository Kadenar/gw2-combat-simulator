import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import type { WarriorResourcePolicy } from '#gw2/professions/warrior/core/mechanics/resource-policy.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Motivation starts empty and changes only through rewards and the existing refrain tasks, never passive recovery. */
export const paragonMotivationPolicy: ResourcePolicy<MechanicContext<WarriorRuntimeState, WarriorSkill>> = {
  kind: 'continuous',
  state: (runtime) => paragonState.from(runtime).motivation,
  maximum: (runtime) =>
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks'),
  initial: () => 0,
  recovery: () => 0
};

/** The selected paragon owns its burst cost policy while sharing Core's adrenaline pool operations. */
export const paragonResourcePolicy: WarriorResourcePolicy = {
  ...coreAdrenalinePolicy,
  burstSpend: (runtime, skill) => Math.min(runtime.profession.core.adrenaline, skill.adrenalineCost ?? 0)
};
