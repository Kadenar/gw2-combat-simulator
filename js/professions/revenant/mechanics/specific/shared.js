import { snapshotRevenantState } from "../../state.js";

export function swapRevenantWeapons(context, skill) {
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

export function emitRevenantState(context, at, reason) {
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
