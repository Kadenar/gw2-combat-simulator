import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { replaceAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
/**
 * Chronomancer-owned Continuum Split checkpoints and restoration.
 */
import type { AvailabilityResult, CooldownController } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { MesmerAddEvent, MesmerRefreshAmmo } from '#gw2/professions/mesmer/types.js';
import type { MesmerResourceSpendDetails } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerContinuumController } from '#gw2/professions/mesmer/specializations/chronomancer/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

interface ContinuumControllerOptions {
  readonly state: MesmerRuntime;
  readonly cooldownController: CooldownController;
  readonly unaffectedCooldownIds: ReadonlySet<SkillId>;
  readonly skillsById: ReadonlyMap<SkillId, MesmerSkill>;
  readonly refreshAmmo: MesmerRefreshAmmo;
  readonly consumeResources: (at: number, details?: MesmerResourceSpendDetails) => number;
  readonly triggerShatterTraits: (resolution: MesmerShatterResolution) => void;
  readonly addEvent: MesmerAddEvent;
  readonly durationPerSource: number;
  readonly bonusDuration?: number;
  readonly scheduleExpiry?: ((at: number) => unknown) | null;
}

export function createContinuumController({
  state,
  cooldownController,
  unaffectedCooldownIds,
  skillsById,
  refreshAmmo,
  consumeResources,
  triggerShatterTraits,
  addEvent,
  durationPerSource,
  bonusDuration = 0,
  scheduleExpiry = null
}: ContinuumControllerOptions): MesmerContinuumController {
  // Restore the captured Continuum Split resources and cooldowns exactly once,
  // then invalidate the active snapshot and emit its exit reason.
  const restoreContinuum = (at: number, reason: string) => {
    const chronomancer = chronomancerState.from(state);
    const continuum = chronomancer.continuum;
    if (!continuum) return;
    const splitReady = continuum.splitReady;
    const openAt = continuum.openAt;
    const unaffectedCooldowns = [...state.cooldowns].filter(([id]) => unaffectedCooldownIds.has(id));
    const restoredCooldowns = new Map([
      ...unaffectedCooldowns,
      ...[...continuum.remainingCooldowns]
        .filter(([, remaining]) => remaining > 0)
        .map(([id, remaining]): [SkillId, number] => [id, at + remaining])
    ]);
    state.cooldowns.clear();
    for (const [id, ready] of restoredCooldowns) state.cooldowns.set(id, ready);
    if (splitReady) state.cooldowns.set(continuum.splitId, at + splitReady - openAt);
    // Restore the saved base work at the rewind timestamp so later reductions retain the checkpoint progress.
    const restoredProgress = new Map([
      ...[...state.rechargeProgress].filter(([id]) => unaffectedCooldownIds.has(id)),
      ...[...continuum.remainingRechargeWork].map(([id, work]) => [id, { startedAt: at, work }] as const)
    ]);
    state.rechargeProgress.clear();
    for (const [id, progress] of restoredProgress) state.rechargeProgress.set(id, progress);
    const restoredAmmo = new Map(
      [...continuum.ammo].map(([id, ammo]) => [
        id,
        {
          // Relative deadlines belong to the checkpoint; live ammo only stores absolute deadlines.
          charges: ammo.charges,
          maximum: ammo.maximum,
          rechargeWork: ammo.rechargeWork,
          ...(ammo.pendingRechargeWork == null
            ? {}
            : { rechargeProgress: { startedAt: at, work: ammo.pendingRechargeWork } }),
          ...(ammo.pendingLockoutWork == null
            ? {}
            : { lockoutProgress: { startedAt: at, work: ammo.pendingLockoutWork } }),
          nextRechargeAt: ammo.nextRechargeRemaining == null ? null : at + ammo.nextRechargeRemaining,
          // Rewind the cast lockout independently of the next charge's recharge.
          lockoutReadyAt: ammo.lockoutRemaining > 0 ? at + ammo.lockoutRemaining : 0
        }
      ])
    );
    state.ammo.clear();
    for (const [id, ammo] of restoredAmmo) state.ammo.set(id, ammo);
    replaceAutoattackChains(state, continuum.autoattackChains || {});
    cooldownController.refresh(at);
    for (const [id] of state.ammo) {
      const ammoSkill = skillsById.get(id);
      if (ammoSkill) refreshAmmo(ammoSkill, at);
    }

    addEvent({
      type: 'marker',
      at,
      name: 'Continuum Shift',
      detail: reason
    });
    chronomancer.continuum = null;
  };

  const beginContinuumSplit = (
    skill: MesmerSkill,
    at: number,
    spendDetails: MesmerResourceSpendDetails = {}
  ): MesmerShatterResolution => {
    // Publish Split's exact clone spend against its rotation entry so the timeline can show the standard shatter badge.
    const spent = consumeResources(at, spendDetails);
    const remainingCooldowns = new Map(
      [...state.cooldowns]
        .filter(([id]) => id !== skill.id && !unaffectedCooldownIds.has(id))
        .map(([id, ready]) => [id, ready - at])
    );
    const remainingRechargeWork = new Map(
      [...state.rechargeProgress].flatMap(([id, progress]) => {
        const cooldownSkill = skillsById.get(id);
        return cooldownSkill &&
          !unaffectedCooldownIds.has(id) &&
          gw2CooldownReadyAt(cooldownController.project(cooldownSkill, progress)) > at
          ? [[id, cooldownController.remaining(cooldownSkill, progress, at)] as const]
          : [];
      })
    );
    const ammo = new Map(
      [...state.ammo].map(([id, value]) => [
        id,
        {
          charges: value.charges,
          maximum: value.maximum,
          rechargeWork: value.rechargeWork,
          ...(value.rechargeProgress && skillsById.has(id)
            ? { pendingRechargeWork: cooldownController.remaining(skillsById.get(id)!, value.rechargeProgress, at) }
            : {}),
          ...(value.lockoutProgress && gw2CooldownReadyAt(value.lockoutReadyAt ?? 0) > at && skillsById.has(id)
            ? { pendingLockoutWork: cooldownController.remaining(skillsById.get(id)!, value.lockoutProgress, at) }
            : {}),
          nextRechargeRemaining: value.nextRechargeAt == null ? null : Math.max(0, value.nextRechargeAt - at),
          lockoutRemaining: Math.max(0, (value.lockoutReadyAt ?? 0) - at)
        }
      ])
    );
    const chronomancer = chronomancerState.from(state);
    // Fragmentation extends the base window once, independently of the number of clones spent.
    const duration = durationPerSource * (spent + 1) + bonusDuration;
    chronomancer.continuum = {
      splitId: skill.id,
      splitReady: state.cooldowns.get(skill.id),
      openAt: at,
      remainingCooldowns,
      remainingRechargeWork,
      ammo,
      autoattackChains: { ...professionCoreState(state).autoattackChains },
      expiresAt: at + duration
    };
    scheduleExpiry?.(chronomancer.continuum.expiresAt);
    const resolution: MesmerShatterResolution = {
      skill,
      at,
      spent,
      traitHits: [{ at, count: spent + 1 }]
    };
    triggerShatterTraits(resolution);
    addEvent({
      type: 'marker',
      at,
      name: 'Continuum Split',
      detail: `${duration.toFixed(1)}s window`
    });
    return resolution;
  };

  return {
    beginContinuumSplit,
    restoreContinuum
  };
}

/** Continuum Shift is castable only while Continuum Split is active. */
export function chronomancerAvailability(context: MesmerRuntime, skill: MesmerSkill): AvailabilityResult {
  if (skill.id !== ID.CONTINUUM_SHIFT || chronomancerState.from(context).continuum) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.continuum-inactive',
    reason: `${skill.name} requires an active Continuum Split.`
  };
}
