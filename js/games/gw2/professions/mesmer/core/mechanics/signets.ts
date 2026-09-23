import { EPSILON } from '#kernel/core/clock.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
/** Owns Signet of Illusions passive scheduling and Core Mesmer signet mechanic callbacks. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type {
  MesmerAddEvent,
  MesmerInstrument,
  MesmerRuntimeState,
  MesmerSchedulerContext
} from '#gw2/professions/mesmer/types.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import type { SchedulerState } from '#gw2/platform/execution/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

const SIGNET_ILLUSIONS_OWNER = 'mesmer.signet-illusions-passive';

/** Applies active signet resets to the cooldown and ammo state shared by later casts. */
export function applyMesmerSignetReset(
  state: SchedulerState<MesmerRuntimeState>,
  allSkills: readonly MesmerSkill[],
  shatters: Readonly<Record<number, MesmerShatter>>,
  instruments: Readonly<Record<number, MesmerInstrument>>,
  addEvent: MesmerAddEvent,
  skill: MesmerSkill,
  at: number
): void {
  if (skill.id === ID.SIGNET_OF_THE_ETHER) {
    for (const phantasmSkill of allSkills.filter((candidate) => candidate.phantasm)) {
      state.cooldowns.delete(phantasmSkill.id);
    }

    addEvent({ type: 'marker', at, name: 'Signet of the Ether', detail: 'Phantasm skill cooldowns reset' });
  }

  if (skill.id !== ID.SIGNET_OF_ILLUSIONS) return;
  for (const target of allSkills.filter(
    (candidate) =>
      Boolean(instruments[candidate.id]) ||
      Boolean(shatters[candidate.id] && shatters[candidate.id].resetBySignetOfIllusions !== false)
  )) {
    const ammo = state.ammo.get(target.id);
    if (ammo) {
      ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
      if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
    }

    state.cooldowns.delete(target.id);
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
function equippedSignetOfIllusions(context: MesmerSchedulerContext): MesmerSkill | null {
  const skill = context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
  if (!skill) return null;
  const equipped = selectedSkillNameSet(context.config.selectedSkills).has(skill.name);
  return equipped ? skill : null;
}

/**
 * Restarts Signet of Illusions' passive interval after both the supplied time
 * and the signet's current cooldown.
 */
export function restartSignetIllusionsPassive(context: MesmerSchedulerContext, activeAt: number): void {
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  const signetOfIllusionsProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfIllusions);
  signetIllusionsPassive.start(context, {
    key: SIGNET_ILLUSIONS_OWNER,
    at: Math.max(
      context.state.time,
      Math.max(activeAt, readyAt) + balanceProfileNumber(signetOfIllusionsProfile, 'pulseInterval')
    ),
    captured: {}
  });
}

/**
 * Grants Signet of Illusions' passive resource when available or defers the
 * pulse until its cooldown and combat-start requirements are satisfied.
 */
export const signetIllusionsPassive = timedEffect<MesmerSchedulerContext, object>({
  id: SIGNET_ILLUSIONS_OWNER,
  priority: -20,
  interval: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.signetOfIllusions), 'pulseInterval'),
  effectsAt(context, at) {
    const runtime = mesmerRuntimeFor(context);
    const skill = equippedSignetOfIllusions(context);
    if (!skill) return false;
    if (context.hasExplicitCombatStart && context.combatStartTime == null) return false;
    const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
    if (readyAt > at + EPSILON) {
      restartSignetIllusionsPassive(context, readyAt);
      return;
    }

    const signetOfIllusionsProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfIllusions);
    runtime.resources.gainResources(
      at,
      balanceProfileNumber(signetOfIllusionsProfile, 'resourceGain'),
      runtime.activePrimaryWeapon(),
      skill.name,
      { sourceSkillId: skill.id }
    );
  }
});

/** Runs skill-authored Core mechanics at their resolved scheduler timestamps. */
export const mesmerCoreSignetSkillMechanicHandlers = Object.freeze({
  'mesmer.core.relock-signet-ether': ({
    context,
    skill,
    at
  }: {
    context: MesmerSchedulerContext;
    skill: MesmerSkill;
    at: number;
  }): void => {
    const readyAt = at + context.rechargeDurationFor(skill, at);
    context.state.cooldowns.set(skill.id, Math.max(Number(context.state.cooldowns.get(skill.id) || 0), readyAt));
  },
  'mesmer.core.restart-signet-illusions-passive': ({
    context,
    at
  }: {
    context: MesmerSchedulerContext;
    at: number;
  }): void => {
    restartSignetIllusionsPassive(context, at);
  }
});
