import { EPSILON } from '#kernel/core/clock.js';
/** Owns Signet of Illusions passive scheduling and Core Mesmer signet mechanic callbacks. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { applySideEffect, type ActionContext } from '#gw2/platform/simulation/side-effects.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

const SIGNET_ILLUSIONS_OWNER = 'mesmer.signet-illusions-passive';

/** Applies active signet resets to the cooldown and ammo state shared by later casts. */
export function applyMesmerSignetReset(state: MesmerRuntime, context: ActionContext): void {
  const { shatters, instruments, addEvent } = mesmerMechanicsFor(state);
  const phantasms = context.skill.id === ID.SIGNET_OF_THE_ETHER;
  const targets = state.helpers.skills.filter((candidate) =>
    phantasms
      ? candidate.phantasm
      : Boolean(instruments[Number(candidate.id)]) ||
        (shatters[Number(candidate.id)] && shatters[Number(candidate.id)].resetBySignetOfIllusions !== false)
  );
  // Catalog selection stays local; the shared actions own recharge and existing ammo restoration.
  if (!phantasms)
    applySideEffect(state, context, {
      type: 'ammoRestore',
      skillIds: targets.filter((target) => state.ammo.has(target.id)).map((target) => target.id),
      count: 1
    });
  applySideEffect(state, context, { type: 'rechargeReset', skillIds: targets.map((target) => target.id) });
  addEvent({
    type: 'marker',
    at: state.time,
    name: context.skill.name,
    detail: phantasms ? 'Phantasm skill cooldowns reset' : 'Eligible shatter and instrument cooldowns reset'
  });
}

/**
 * Resolves Signet of Illusions when it is present in the configured utility
 * loadout.
 *
 * Catalog skill when equipped, otherwise null.
 */
function equippedSignetOfIllusions(context: MesmerRuntime): MesmerSkill | null {
  const skill = context.helpers.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
  if (!skill) return null;
  const equipped = selectedSkillNameSet(context.config.selectedSkills).has(skill.name);
  return equipped ? (skill as MesmerSkill) : null;
}

/** Replace the passive deadline when a cast or explicit combat boundary restarts its interval. */
export function restartSignetIllusionsPassive(context: MesmerRuntime, activeAt: number): void {
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  const interval = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.signetOfIllusions),
    'pulseInterval'
  );
  if (!(interval > 0)) return;
  const at = Math.max(context.time, Math.max(activeAt, context.cooldowns.get(skill.id) ?? 0) + interval);
  context.profession.core.signetIllusionsAt = at;
  context.schedule(SIGNET_ILLUSIONS_OWNER, at, at, undefined, -20);
}

/** A due pulse reads current cooldown and resources; it never grants a predicted future clone. */
export function signetIllusionsPulse(context: MesmerRuntime, data: unknown): void {
  if (context.profession.core.signetIllusionsAt !== data) return;
  const skill = equippedSignetOfIllusions(context);
  if (!skill || context.combatStartPending) return;
  const ready = context.cooldowns.get(skill.id) ?? 0;
  if (ready > context.time + EPSILON) {
    restartSignetIllusionsPassive(context, ready);
    return;
  }

  const mechanics = mesmerMechanicsFor(context);
  mechanics.resources.gainResources(
    context.time,
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.signetOfIllusions), 'resourceGain'),
    mechanics.activePrimaryWeapon(),
    skill.name,
    { sourceSkillId: skill.id }
  );
  restartSignetIllusionsPassive(context, context.time);
}
