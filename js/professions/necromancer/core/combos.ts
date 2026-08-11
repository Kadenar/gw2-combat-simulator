import { professionCoreState } from "../../../platform/engine/profession.js";
import { NECROMANCER_SKILL_IDS as ID } from "../data/ids.js";
import type {
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
} from "../types.js";

const DARK_FIELD_DURATIONS: ReadonlyMap<number, number> = new Map([
  [ID.NIGHTFALL, 3],
  [ID.WELL_OF_DARKNESS, 5],
]);

// These counts are the whirl pulses that can connect with one target, rather
// than the number of strike packets belonging to the weapon skill.
const DARK_WHIRL_BOLTS: ReadonlyMap<number, number> = new Map([
  [ID.GRAVEDIGGER, 3],
  [ID.DEATH_SPIRAL, 2],
  [ID.EXTIRPATE, 3],
]);

function emitLeechingBolt(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent,
  index: number,
  total: number,
): void {
  context.emit({
    type: "damage",
    at: event.at,
    source: "Combo",
    sourceId: ID.LEECHING_BOLTS,
    actorType: "effect",
    skillId: ID.LEECHING_BOLTS,
    skillName: "Leeching Bolts",
    parentSkillName: event.skillName,
    name: "Leeching Bolts",
    coefficient: 0,
    hits: 1,
    hitIndex: index,
    totalHits: total,
    skillWeapon: "Unequipped",
    flatStrikeBase: 170,
    flatStrikePowerCoeff: 0.03,
    noCrit: true,
    damageKind: "life-steal",
  });
}

/**
 * Tracks Necromancer dark fields and emits their whirl-finisher life steals as
 * independently attributed Leeching Bolts damage.
 */
export function darkFieldComboFinishers(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent,
): void {
  if (event.type !== "damage" || event.actorType !== "player") return;

  const skillId = Number(event.skillId);
  const fieldDuration = DARK_FIELD_DURATIONS.get(skillId);
  if (fieldDuration != null && Number(event.hitIndex || 1) === 1) {
    const state = professionCoreState(context);
    state.darkFieldUntil = Math.max(
      Number(state.darkFieldUntil || 0),
      event.at + fieldDuration,
    );
  }

  const bolts = DARK_WHIRL_BOLTS.get(skillId);
  const darkFieldUntil = Number(
    professionCoreState(context).darkFieldUntil || 0,
  );
  if (
    bolts == null ||
    !(Number(event.coefficient) > 0) ||
    Number(event.hitIndex || 1) !== 1 ||
    !(darkFieldUntil > 0) ||
    darkFieldUntil < event.at - context.epsilon
  )
    return;

  for (let index = 1; index <= bolts; index += 1) {
    emitLeechingBolt(context, event, index, bolts);
  }
}
