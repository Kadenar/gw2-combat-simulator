import { emitEngineerState } from "./shared.js";
import {
  ENGINEER_TRIGGERED_MECHANICS,
} from "../skill-mechanics.js";

const MECH_ATTACK = ENGINEER_TRIGGERED_MECHANICS[
  "engineer.mech-basic-attack"
];

function summonMech(context) {
  const at = context.effectiveEnd;
  context.state.profession.mech.active = true;
  emitEngineerState(context, at, "summon-mech");
}

function recallMech(context) {
  const at = context.effectiveEnd;
  context.state.profession.mech.active = false;
  emitEngineerState(context, at, "recall-mech");
}

export function initializeEngineerMech(context) {
  const state = context.state.profession;
  if (!state.mech.enabled || !state.mech.active) return;
  context.tasks.schedule({
    type: "engineer.mech-attack",
    at: 1,
    ownerId: "engineer.mech",
    payload: {},
  });
}

export function handleEngineerMechAttack(context, task) {
  const state = context.state.profession;
  if (!state.mech.enabled) return;
  if (state.mech.active) {
    context.emit({
      type: "damage",
      at: task.at,
      source: "engineer",
      sourceId: "engineer.mech-basic-attack",
      actorType: "summon",
      skillName: "Jade Energy Shot",
      name: "Jade Energy Shot",
      coefficient: MECH_ATTACK.coefficient,
      hits: MECH_ATTACK.hits,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: "Unequipped",
    });
  }
  state.mech.nextAttackAt = task.at + MECH_ATTACK.interval;
  context.tasks.schedule({
    type: "engineer.mech-attack",
    at: state.mech.nextAttackAt,
    ownerId: "engineer.mech",
    payload: {},
  });
}

export const engineerMechSkillHandlers = Object.freeze({
  "engineer.mech-summon": summonMech,
  "engineer.mech-recall": recallMech,
});
