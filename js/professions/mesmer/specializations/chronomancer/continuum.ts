import { chronomancerState } from './state.js';
import { professionCoreState } from '../../../../platform/engine/profession.js';
/**
 * Chronomancer-owned Continuum Split checkpoints and restoration.
 */
import type { SchedulerState, SkillId } from '../../../../platform/engine/types.js';
import type {
  MesmerAddEvent,
  MesmerRuntimeState,
  MesmerRefreshAmmo,
  MesmerResourceSpendDetails,
  MesmerShatterResolution,
  MesmerSkill
} from '../../types.js';

interface ContinuumControllerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly unaffectedCooldownIds: ReadonlySet<SkillId>;
  readonly epsilon: number;
  readonly skillsById: ReadonlyMap<SkillId, MesmerSkill>;
  readonly refreshAmmo: MesmerRefreshAmmo;
  readonly consumeResources: (at: number, details?: MesmerResourceSpendDetails) => number;
  readonly triggerShatterTraits: (resolution: MesmerShatterResolution) => void;
  readonly addEvent: MesmerAddEvent;
  readonly durationPerSource: number;
  readonly scheduleExpiry?: ((at: number) => unknown) | null;
}

export interface ContinuumController {
  beginContinuumSplit(
    skill: MesmerSkill,
    at: number,
    spendDetails?: MesmerResourceSpendDetails
  ): MesmerShatterResolution;
  restoreContinuum(at: number, reason: string): void;
}

export function createContinuumController({
  state,
  unaffectedCooldownIds,
  epsilon,
  skillsById,
  refreshAmmo,
  consumeResources,
  triggerShatterTraits,
  addEvent,
  durationPerSource,
  scheduleExpiry = null
}: ContinuumControllerOptions): ContinuumController {
  const restoreContinuum = (at: number, reason: string) => {
    const chronomancer = chronomancerState.from(state);
    const continuum = chronomancer.continuum;
    if (!continuum) return;
    const splitReady = continuum.splitReady;
    const openAt = continuum.openAt;
    const unaffectedCooldowns = [...state.cooldowns].filter(([id]) => unaffectedCooldownIds.has(id));
    state.cooldowns = new Map([
      ...unaffectedCooldowns,
      ...[...continuum.remainingCooldowns]
        .filter(([, remaining]) => remaining > epsilon)
        .map(([id, remaining]): [SkillId, number] => [id, at + remaining])
    ]);
    if (splitReady) state.cooldowns.set(continuum.splitId, at + splitReady - openAt);
    state.ammo = new Map(
      [...continuum.ammo].map(([id, ammo]) => [
        id,
        {
          ...ammo,
          nextRechargeAt: ammo.nextRechargeRemaining == null ? null : at + ammo.nextRechargeRemaining
        }
      ])
    );
    professionCoreState(state).autoattackChains = {
      ...(continuum.autoattackChains || {})
    };
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
    addEvent({
      type: 'cooldown_snapshot',
      at,
      cooldowns: Object.fromEntries(state.cooldowns)
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
    const ammo = new Map(
      [...state.ammo].map(([id, value]) => [
        id,
        {
          charges: value.charges,
          maximum: value.maximum,
          rechargeDuration: value.rechargeDuration,
          nextRechargeRemaining: value.nextRechargeAt == null ? null : Math.max(0, value.nextRechargeAt - at)
        }
      ])
    );
    const chronomancer = chronomancerState.from(state);
    chronomancer.continuum = {
      splitId: skill.id,
      splitReady: state.cooldowns.get(skill.id),
      openAt: at,
      remainingCooldowns,
      ammo,
      autoattackChains: { ...professionCoreState(state).autoattackChains },
      expiresAt: at + durationPerSource * (spent + 1)
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
      detail: `${(durationPerSource * (spent + 1)).toFixed(1)}s window`
    });
    return resolution;
  };

  return {
    beginContinuumSplit,
    restoreContinuum
  };
}
