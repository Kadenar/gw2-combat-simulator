/** Owns Signet of Illusions passive scheduling and Core Mesmer signet mechanic callbacks. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { EPSILON } from '#kernel/core/clock.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type {
  MesmerSchedulerContext,
  MesmerSchedulerTask,
  MesmerSkill
} from '#gw2/content/professions/mesmer/types.js';
import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/mesmer/core/profiles.js';

const SIGNET_ILLUSIONS_OWNER = 'mesmer.signet-illusions-passive';

/**
 * Resolves Signet of Illusions when it is present in the configured utility
 * loadout.
 *
 * @param {object} context Scheduler context.
 * @returns {object|null} Catalog skill when equipped, otherwise null.
 */
function equippedSignetOfIllusions(context: MesmerSchedulerContext): MesmerSkill | null {
  const skill = context.catalog.skillsById.get(ID.SIGNET_OF_ILLUSIONS);
  if (!skill) return null;
  const equipped = selectedSkillNameSet(context.config.selectedSkills).has(skill.name);
  return equipped ? skill : null;
}

/**
 * Replaces any pending Signet of Illusions passive task with one at the
 * requested timestamp.
 *
 * @param {object} context Scheduler context.
 * @param {number} at Requested task timestamp.
 * @returns {void}
 */
function scheduleSignetIllusionsPassive(context: MesmerSchedulerContext, at: number): void {
  if (!equippedSignetOfIllusions(context)) return;
  context.tasks.cancelOwner(SIGNET_ILLUSIONS_OWNER);
  context.tasks.schedule({
    type: 'mesmer.signet-illusions-passive',
    at: Math.max(context.state.time, Number(at)),
    priority: -20,
    ownerId: SIGNET_ILLUSIONS_OWNER,
    payload: {}
  });
}

/**
 * Restarts Signet of Illusions' passive interval after both the supplied time
 * and the signet's current cooldown.
 *
 * @param {object} context Scheduler context.
 * @param {number} activeAt Earliest time the passive may resume.
 * @returns {void}
 */
export function restartSignetIllusionsPassive(context: MesmerSchedulerContext, activeAt: number): void {
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  scheduleSignetIllusionsPassive(
    context,
    Math.max(Number(activeAt), readyAt) +
      balanceProfileValueFromContext(context, PROFILE.signetOfIllusions, 'pulseInterval', 10)
  );
}

/**
 * Grants Signet of Illusions' passive resource when available or defers the
 * pulse until its cooldown and combat-start requirements are satisfied.
 *
 * @param {object} context Scheduler task context.
 * @param {object} task Signet passive task.
 * @returns {void}
 */
export function handleSignetIllusionsPassiveTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'signetIllusionsPassive'>
): void {
  const runtime = mesmerRuntimeFor(context);
  const skill = equippedSignetOfIllusions(context);
  if (!skill) return;
  if (context.hasExplicitCombatStart && context.combatStartTime == null) return;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (readyAt > task.at + EPSILON) {
    restartSignetIllusionsPassive(context, readyAt);
    return;
  }

  runtime.resources.gainResources(
    task.at,
    balanceProfileValueFromContext(context, PROFILE.signetOfIllusions, 'resourceGain', 1),
    runtime.activePrimaryWeapon(),
    skill.name,
    { sourceSkillId: skill.id }
  );
  scheduleSignetIllusionsPassive(
    context,
    task.at + balanceProfileValueFromContext(context, PROFILE.signetOfIllusions, 'pulseInterval', 10)
  );
}

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
