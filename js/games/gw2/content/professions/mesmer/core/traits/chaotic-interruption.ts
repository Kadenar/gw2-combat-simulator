/** Owns scheduler-side Chaotic Interruption cooldown mutation at control impact time. */
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import type { MesmerSchedulerContext, MesmerSchedulerTask } from '#gw2/content/professions/mesmer/types.js';
import { mesmerBalanceValue } from '#gw2/content/professions/mesmer/core/profiles.js';

/**
 * Chaotic Interruption recharges a random equipped-weapon skill when you
 * interrupt a foe. The random pick is resolved deterministically to the active
 * weapon set's phantasm — Staff → Warlock, offhand Pistol → Duelist, offhand
 * Torch → Mage. Modeled on {@link triggerIneptitudeFromInterrupt} (same
 * activating-target gate and defiant internal-cooldown pattern) but lives
 * scheduler-side because the recharge mutates scheduler-owned cooldown state
 * the resolver-only trait module cannot reach.
 */
export function triggerChaoticInterruption(
  context: MesmerSchedulerContext,
  event: SimulationEvent,
  skillName: string
): void {
  const runtime = context.mesmerRuntime;
  if (!runtime?.traits.has(TRAIT.CHAOTIC_INTERRUPTION) || !context.config.target?.activatingSkills) {
    return;
  }

  const defiant = Boolean(context.config.target?.defiant);
  const core = professionCoreState(context);
  if (defiant && !isInternalCooldownReady(event.at, Number(core.traitReadyAt[TRAIT.CHAOTIC_INTERRUPTION] || 0))) {
    return;
  }

  const set = context.state.activeWeaponSet;
  const [configuredMainhand, configuredOffhand] = gw2ConfiguredWeaponSet(context.config, set);
  const [primaryMainhand, primaryOffhand] = gw2ConfiguredWeaponSet(context.config, 1);
  const mainhand = configuredMainhand || primaryMainhand;
  const offhand = configuredOffhand || primaryOffhand;

  let targetId: number | null = null;
  if (mainhand === 'Staff') targetId = ID.PHANTASMAL_WARLOCK;
  else if (offhand === 'Pistol') targetId = ID.PHANTASMAL_DUELIST;
  else if (offhand === 'Torch') targetId = ID.PHANTASMAL_MAGE;

  if (targetId == null) return;

  // Only affects weapon skills that are recharging.
  const readyAt = Number(context.state.cooldowns.get(targetId) || 0);
  if (!(readyAt > event.at + EPSILON)) return;
  const reduction = mesmerBalanceValue(context, TRAIT.CHAOTIC_INTERRUPTION, 'recharge', 5);

  const reduced = Math.max(event.at, readyAt - reduction);
  if (reduced > event.at + EPSILON) {
    context.state.cooldowns.set(targetId, reduced);
  } else {
    context.state.cooldowns.delete(targetId);
  }

  if (defiant) {
    core.traitReadyAt[TRAIT.CHAOTIC_INTERRUPTION] =
      event.at + mesmerBalanceValue(context, TRAIT.CHAOTIC_INTERRUPTION, 'internalCooldown', 1);
  }

  runtime.addTraitProc(
    'Chaotic Interruption',
    event.at,
    skillName,
    `${runtime.skillsById.get(targetId)?.name || 'weapon skill'} recharge -${reduction}s`
  );
}

/** Evaluates Chaotic Interruption when a delayed control packet actually lands. */
export function handleChaoticInterruptionTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'chaoticInterruption'>
): void {
  triggerChaoticInterruption(
    context,
    { type: 'control', at: task.at, source: 'Skill', sourceId: task.payload.skillId },
    task.payload.skillName
  );
}
