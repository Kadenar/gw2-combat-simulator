/**
 * Shared Revenant mechanic primitives.
 *
 * Provides the ordinary weapon-set transition and the canonical scheduler-to-
 * resolver state handoff. State events always contain a detached snapshot so
 * later scheduler mutations cannot rewrite earlier timeline state.
 */
import { snapshotRevenantState } from "./state.js";
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSkill,
} from "../types.js";

/** Switches equipped weapon sets and emits the shared weapon-set event. */
export function swapRevenantWeapons(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  context.state.profession.autoattackChains = {};
  context.emit({
    type: "weapon_set",
    at: context.effectiveEnd,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet,
  });
}

/** Emits a point-in-time profession snapshot for resolver synchronization. */
export function emitRevenantState(
  context: RevenantSchedulerContext,
  at: number,
  reason: string,
): void {
  context.emit({
    type: "revenant.state",
    at,
    source: "revenant",
    sourceId: `revenant.state.${reason}`,
    actorType: "player",
    reason,
    state: snapshotRevenantState(context.state.profession),
  });
}
