import { professionCoreState } from "../../../platform/engine/profession.js";
import { snapshotThiefState } from "./state.js";

export function emitThiefState(context, at, reason) {
  context.emit({
    type: "thief.state",
    at,
    source: "thief",
    sourceId: `thief.state.${reason}`,
    actorType: "player",
    reason,
    state: snapshotThiefState(context.state.profession),
  });
}

export function emitThiefShroudSwap(context, skill, at) {
  context.emit({
    type: "weapon_set",
    at,
    source: "thief",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true,
  });
}

export function gainThiefInitiative(context, amount, at, reason) {
  const state = professionCoreState(context);
  state.initiative = Math.min(
    state.maximumInitiative,
    state.initiative + Math.max(0, Number(amount || 0)),
  );
  emitThiefState(context, at, reason);
}

export function gainThiefEndurance(context, amount, at, reason) {
  const state = professionCoreState(context);
  state.endurance = Math.min(
    state.maximumEndurance,
    state.endurance + Math.max(0, Number(amount || 0)),
  );
  emitThiefState(context, at, reason);
}

export function emitThiefCondition(context, {
  at,
  condition,
  duration,
  stacks = 1,
  sourceId,
  name,
}) {
  context.emit({
    type: "condition",
    at,
    source: "Trait",
    sourceId,
    actorType: "player",
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name,
    condition,
    stacks,
    duration,
  });
}
