/**
 * Revenant dodge execution.
 *
 * Pays the core or Vindicator endurance cost, snapshots the new resource
 * state, and emits the selected dodge replacement's delayed strike from the
 * immutable profile in handler-mechanics.js.
 */
import { emitRevenantState } from "./shared.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";

/** Executes the configured dodge replacement as a complete skill profile. */
export function performRevenantDodge(context, skill) {
  const state = context.state.profession;
  const cost =
    context.config.specialization === "Vindicator"
      ? MECHANICS.endurance.vindicatorDodgeCost
      : MECHANICS.endurance.dodgeCost;
  state.endurance = Math.max(0, state.endurance - cost);
  emitRevenantState(context, context.start, "dodge");
  const dodge = state.selectedDodge;
  const effect = MECHANICS.endurance.dodgeByName[dodge];
  if (!(Number(effect?.coefficient) > 0)) return;
  context.emit({
    type: "damage",
    at: context.start + MECHANICS.endurance.dodgeStrikeDelay,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: dodge,
    name: dodge,
    coefficient: Number(effect.coefficient),
    hits: Number(effect.hits || 1),
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
  });
}
