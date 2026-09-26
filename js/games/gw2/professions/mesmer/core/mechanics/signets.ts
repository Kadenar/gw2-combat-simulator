import { EPSILON } from '#kernel/core/clock.js';
/** Owns Signet of Illusions passive scheduling and Core Mesmer signet mechanic callbacks. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerAddEvent, MesmerInstrument, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

const SIGNET_ILLUSIONS_OWNER = 'mesmer.signet-illusions-passive';

/** Applies active signet resets to the cooldown and ammo state shared by later casts. */
export function applyMesmerSignetReset(
  state: MesmerRuntime,
  allSkills: readonly MesmerSkill[],
  shatters: Readonly<Record<number, MesmerShatter>>,
  instruments: Readonly<Record<number, MesmerInstrument>>,
  addEvent: MesmerAddEvent,
  skill: MesmerSkill,
  at: number
): void {
  if (skill.id === ID.SIGNET_OF_THE_ETHER) {
    for (const phantasmSkill of allSkills.filter((candidate) => candidate.phantasm)) {
      state.cooldownController.clear(phantasmSkill.id);
    }

    addEvent({ type: 'marker', at, name: 'Signet of the Ether', detail: 'Phantasm skill cooldowns reset' });
  }

  if (skill.id !== ID.SIGNET_OF_ILLUSIONS) return;
  for (const target of allSkills.filter(
    (candidate) =>
      Boolean(instruments[candidate.id]) ||
      Boolean(shatters[candidate.id] && shatters[candidate.id].resetBySignetOfIllusions !== false)
  )) {
    if (state.ammo.has(target.id)) state.cooldownController.restoreAmmo(target, 1, at, 'reset');
    state.cooldownController.clear(target.id);
  }

  addEvent({
    type: 'marker',
    at,
    name: 'Signet of Illusions',
    detail: 'Eligible shatter and instrument cooldowns reset'
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
  const at = Math.max(context.time, Math.max(activeAt, Number(context.cooldowns.get(skill.id) ?? 0)) + interval);
  context.profession.core.signetIllusionsAt = at;
  context.schedule(SIGNET_ILLUSIONS_OWNER, at, at, undefined, -20);
}

/** A due pulse reads current cooldown and resources; it never grants a predicted future clone. */
export function signetIllusionsPulse(context: MesmerRuntime, data: unknown): void {
  if (context.profession.core.signetIllusionsAt !== data) return;
  const skill = equippedSignetOfIllusions(context);
  if (!skill || context.combatStartPending) return;
  const ready = Number(context.cooldowns.get(skill.id) ?? 0);
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
