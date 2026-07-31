/**
 * Chronomancer-owned Continuum Split checkpoints and restoration.
 */
import type {
  SchedulerState,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  MesmerAddEvent,
  MesmerProfessionState,
  MesmerRefreshAmmo,
  MesmerSkill,
} from "../../types.js";

interface ContinuumControllerOptions {
  readonly state: SchedulerState<MesmerProfessionState>;
  readonly unaffectedCooldownIds: ReadonlySet<SkillId>;
  readonly epsilon: number;
  readonly skillsById: ReadonlyMap<SkillId, MesmerSkill>;
  readonly refreshAmmo: MesmerRefreshAmmo;
  readonly consumeResources: (at: number) => number;
  readonly triggerShatterTraits: (
    skill: MesmerSkill,
    at: number,
    spent: number,
    bladeSong?: boolean,
  ) => void;
  readonly addEvent: MesmerAddEvent;
  readonly scheduleExpiry?: ((at: number) => unknown) | null;
}

export interface ContinuumController {
  beginContinuumSplit(skill: MesmerSkill, at: number): void;
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
  scheduleExpiry = null,
}: ContinuumControllerOptions): ContinuumController {
  const restoreContinuum = (at: number, reason: string) => {
    if (!state.profession.continuum) return;
    const splitReady = state.profession.continuum.splitReady;
    const unaffectedCooldowns = [...state.cooldowns].filter(([id]) =>
      unaffectedCooldownIds.has(id),
    );
    state.cooldowns = new Map([
      ...unaffectedCooldowns,
      ...[...state.profession.continuum.remainingCooldowns]
        .filter(([, remaining]) => remaining > epsilon)
        .map(
          ([id, remaining]): [SkillId, number] => [
            id,
            at + remaining,
          ],
        ),
    ]);
    if (splitReady)
      state.cooldowns.set(state.profession.continuum.splitId, at + splitReady);
    state.ammo = new Map(
      [...state.profession.continuum.ammo].map(([id, ammo]) => [
        id,
        {
          ...ammo,
          nextRechargeAt:
            ammo.nextRechargeRemaining == null
              ? null
              : at + ammo.nextRechargeRemaining,
        },
      ]),
    );
    state.profession.autoattackChains = {
      ...(state.profession.continuum.autoattackChains || {}),
    };
    for (const [id] of state.ammo) {
      const ammoSkill = skillsById.get(id);
      if (ammoSkill) refreshAmmo(ammoSkill, at);
    }
    addEvent({
      type: "marker",
      at,
      name: "Continuum Shift",
      detail: reason,
    });
    addEvent({
      type: "cooldown_snapshot",
      at,
      cooldowns: Object.fromEntries(state.cooldowns),
    });
    state.profession.continuum = null;
  };

  const beginContinuumSplit = (skill: MesmerSkill, at: number) => {
    const spent = consumeResources(at);
    const remainingCooldowns = new Map(
      [...state.cooldowns]
        .filter(([id]) => id !== skill.id && !unaffectedCooldownIds.has(id))
        .map(([id, ready]) => [id, ready - at]),
    );
    const ammo = new Map(
      [...state.ammo].map(([id, value]) => [
        id,
        {
          charges: value.charges,
          maximum: value.maximum,
          rechargeDuration: value.rechargeDuration,
          nextRechargeRemaining:
            value.nextRechargeAt == null
              ? null
              : Math.max(0, value.nextRechargeAt - at),
        },
      ]),
    );
    state.profession.continuum = {
      splitId: skill.id,
      splitReady: state.cooldowns.get(skill.id),
      remainingCooldowns,
      ammo,
      autoattackChains: { ...state.profession.autoattackChains },
      expiresAt: at + 1.5 * (spent + 1),
    };
    scheduleExpiry?.(state.profession.continuum.expiresAt);
    triggerShatterTraits(skill, at, spent, false);
    addEvent({
      type: "marker",
      at,
      name: "Continuum Split",
      detail: `${(1.5 * (spent + 1)).toFixed(1)}s window`,
    });
  };

  return {
    beginContinuumSplit,
    restoreContinuum,
  };
}
