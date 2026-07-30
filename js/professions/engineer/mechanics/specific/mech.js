import { emitEngineerState } from "./shared.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasEngineerTrait } from "../../state.js";

const JADE_CANNON_ARM_GAP = 0.5;
const JADE_CANNON_CYCLE_GAP = 1.075;
const MELEE_CHAIN_INTERVALS = [0.25, 0.5, 0.5];
// Mech strikes use the mech's native damage packet rather than the engineer's
// equipped weapon strength. These reference values apply to every build; the
// inherited mech attributes and live modifiers are resolved separately.
const MECH_REFERENCE_POWER = 1500;
const MECH_COMMAND_DAMAGE_PER_COEFFICIENT = 1662;
const MECH_BASIC_DAMAGE_PER_COEFFICIENT = 1445;
// The mech takes roughly one-third of a second after a command's activation
// ends before resuming its basic attack chain.
const MECH_COMMAND_RECOVERY = 0.35;
const MECH_COMMAND_DURATIONS = Object.freeze({
  [ID.SPARK_REVOLVER]: 1.401 + MECH_COMMAND_RECOVERY,
  [ID.CORE_REACTOR_SHOT]: 1 + MECH_COMMAND_RECOVERY,
  [ID.JADE_MORTAR]: 1.085 + MECH_COMMAND_RECOVERY,
});

const MECH_BASIC_SKILL_IDS = new Set([
  ID.HARD_STRIKE,
  ID.HEAVY_SMASH_MECH,
  ID.TWIN_STRIKE_MECH,
  ID.JADE_ENERGY_SHOT,
  ID.JADE_ENERGY_SHOT_ID_63348,
  ID.ROCKET_PUNCH_MECH,
]);

function selectedSkillNames(config = {}) {
  const selected = config.selectedSkills || [];
  return new Set(
    (Array.isArray(selected) ? selected : Object.values(selected)).map(String),
  );
}

function mechAttackRate(context) {
  return (
    context.config.boons?.quickness
    && selectedSkillNames(context.config).has("Shift Signet")
  ) ? 1.5 : 1;
}

function emitMechStrike(context, {
  at,
  coefficient,
  hits = 1,
  name,
  skillId,
  hitIndex = 1,
  totalHits = hits,
  basicAttack = true,
}) {
  context.emit({
    type: "damage",
    at,
    source: "engineer",
    sourceId: skillId,
    actorType: "summon",
    skillId,
    skillName: name,
    name,
    coefficient,
    hits,
    hitIndex,
    totalHits,
    skillWeapon: "Unequipped",
    independentSummonStrike: true,
    summonInheritsAttributes: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: MECH_REFERENCE_POWER,
    summonDamagePerCoefficient: basicAttack
      ? MECH_BASIC_DAMAGE_PER_COEFFICIENT
      : MECH_COMMAND_DAMAGE_PER_COEFFICIENT,
    engineerMech: true,
    mechBasicAttack: basicAttack,
  });
}

export function observeEngineerMechEvent(context, event) {
  if (
    context.config.specialization !== "Mechanist"
    || event.actorType !== "summon"
  ) return;
  const skill = context.catalog?.skillsById?.get(
    event.skillId ?? event.sourceId,
  );
  const slot = Number(skill?.mechanicSlot || 0);
  const engineerMech =
    event.engineerMech === true
    || MECH_BASIC_SKILL_IDS.has(event.skillId)
    || event.skillId === ID.JADE_BUSTER_CANNON
    || (slot >= 1 && slot <= 3);
  if (!engineerMech) return;

  const updates = { engineerMech: true };
  if (event.type === "damage" && Number(event.coefficient) > 0) {
    const basicAttack =
      event.mechBasicAttack === true
      || MECH_BASIC_SKILL_IDS.has(event.skillId);
    Object.assign(updates, {
      independentSummonStrike: true,
      summonInheritsAttributes: true,
      summonUsesProfessionModifiers: true,
      summonBasePower: MECH_REFERENCE_POWER,
      summonDamagePerCoefficient: basicAttack
        ? MECH_BASIC_DAMAGE_PER_COEFFICIENT
        : MECH_COMMAND_DAMAGE_PER_COEFFICIENT,
      mechBasicAttack: basicAttack,
    });
  }
  context.replaceEvent(event, updates);
}

function scheduleMechAttack(context, at, payload) {
  context.state.profession.mech.nextAttackAt = at;
  context.tasks.schedule({
    type: "engineer.mech-attack",
    at,
    ownerId: "engineer.mech",
    payload,
  });
}

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

export function isEngineerMechCommand(skill) {
  const slot = Number(skill?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

function emitRocketPunch(context, skill, at) {
  context.emit({
    type: "damage",
    at,
    source: "Trait",
    sourceId: TRAIT.MECH_FIGHTER,
    actorType: "summon",
    skillId: ID.ROCKET_PUNCH_MECH,
    skillName: "Rocket Punch (Mech)",
    name: "Rocket Punch (Mech)",
    coefficient: 1,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    independentSummonStrike: true,
    summonInheritsAttributes: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: MECH_REFERENCE_POWER,
    summonDamagePerCoefficient: MECH_BASIC_DAMAGE_PER_COEFFICIENT,
    engineerMech: true,
    explosion: true,
    triggeredBy: skill.name,
  });
  context.emit({
    type: "condition",
    at,
    source: "Trait",
    sourceId: TRAIT.MECH_FIGHTER,
    actorType: "summon",
    skillId: ID.ROCKET_PUNCH_MECH,
    skillName: "Rocket Punch (Mech)",
    name: "Rocket Punch (Mech) — Burning",
    condition: "Burning",
    stacks: 1,
    duration: 5,
    engineerMech: true,
    triggeredBy: skill.name,
  });
  context.emit({
    type: "control",
    at,
    source: "Trait",
    sourceId: TRAIT.MECH_FIGHTER,
    actorType: "summon",
    skillId: ID.ROCKET_PUNCH_MECH,
    skillName: "Rocket Punch (Mech)",
    name: "Rocket Punch (Mech)",
    controlKind: "defiance",
    duration: 100,
    engineerMech: true,
    triggeredBy: skill.name,
  });
}

export function applyEngineerMechCastTraits(context, skill) {
  if (context.config.specialization !== "Mechanist") return;
  const state = context.state.profession;
  const at = context.effectiveEnd;

  if (state.mech.active && isEngineerMechCommand(skill)) {
    const busyUntil = at + Number(MECH_COMMAND_DURATIONS[skill.id] || 0);
    state.mech.busyUntil = Math.max(
      Number(state.mech.busyUntil || 0),
      busyUntil,
    );
  }

  if (
    state.mech.active
    && skill.type === "Weapon"
    && !skill.kit
    && skill.slot === "Weapon_3"
    && Number(state.traitProcReadyAt.rocketPunch || 0)
      <= at + context.epsilon
  ) {
    state.traitProcReadyAt.rocketPunch = at + 5;
    emitRocketPunch(context, skill, at);
  }

  if (
    isEngineerMechCommand(skill)
    && hasEngineerTrait(context.config, TRAIT.MECH_CORE_JADE_DYNAMO)
  ) {
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.MECH_CORE_JADE_DYNAMO,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Jade Dynamo — quickness",
      kind: "quickness",
      stacks: 1,
      duration: 2.5,
    });
  }
}

export function initializeEngineerMech(context) {
  const state = context.state.profession;
  if (!state.mech.enabled || !state.mech.active) return;
  scheduleMechAttack(context, 1, { phase: 0 });
}

export function handleEngineerMechAttack(context, task) {
  const state = context.state.profession;
  if (!state.mech.enabled) return;
  if (!state.mech.active) {
    scheduleMechAttack(context, task.at + 1, { phase: 0 });
    return;
  }

  const busyUntil = Number(state.mech.busyUntil || 0);
  if (task.at < busyUntil - context.epsilon) {
    scheduleMechAttack(context, busyUntil, task.payload || { phase: 0 });
    return;
  }

  const rate = mechAttackRate(context);
  const phase = Number(task.payload?.phase || 0);
  if (hasEngineerTrait(context.config, TRAIT.MECH_ARMS_JADE_CANNONS)) {
    const firstArm = phase === 0;
    emitMechStrike(context, {
      at: task.at,
      coefficient: 0.42,
      name: "Jade Energy Shot",
      skillId: firstArm
        ? ID.JADE_ENERGY_SHOT
        : ID.JADE_ENERGY_SHOT_ID_63348,
    });
    scheduleMechAttack(
      context,
      task.at + (
        firstArm ? JADE_CANNON_ARM_GAP : JADE_CANNON_CYCLE_GAP
      ) / rate,
      { phase: firstArm ? 1 : 0 },
    );
    return;
  }

  const melee = [
    { coefficient: 0.45, name: "Hard Strike", skillId: ID.HARD_STRIKE },
    {
      coefficient: 0.45,
      name: "Heavy Smash (Mech)",
      skillId: ID.HEAVY_SMASH_MECH,
    },
    {
      coefficient: 0.8,
      hits: 2,
      name: "Twin Strike (Mech)",
      skillId: ID.TWIN_STRIKE_MECH,
    },
  ][phase] || {
    coefficient: 0.45,
    name: "Hard Strike",
    skillId: ID.HARD_STRIKE,
  };
  emitMechStrike(context, {
    at: task.at,
    ...melee,
  });
  scheduleMechAttack(
    context,
    task.at + MELEE_CHAIN_INTERVALS[phase] / rate,
    { phase: (phase + 1) % 3 },
  );
}

export function activateOverclockSignet(context, skill) {
  const state = context.state.profession;
  if (!state.mech?.active) return;
  const at = context.effectiveEnd;
  const interval = 0.65;
  const hits = 5;
  state.mech.busyUntil = Math.max(
    Number(state.mech.busyUntil || 0),
    at + interval * hits,
  );
  for (let hit = 1; hit <= hits; hit += 1) {
    const impactAt = at + interval * hit;
    emitMechStrike(context, {
      at: impactAt,
      coefficient: 0.95,
      hits: 1,
      name: "Jade Buster Cannon",
      skillId: ID.JADE_BUSTER_CANNON,
      hitIndex: hit,
      totalHits: hits,
      basicAttack: false,
    });
    context.emit({
      type: "condition",
      at: impactAt,
      source: "engineer",
      sourceId: ID.JADE_BUSTER_CANNON,
      actorType: "summon",
      skillId: ID.JADE_BUSTER_CANNON,
      skillName: "Jade Buster Cannon",
      name: "Jade Buster Cannon — Burning",
      condition: "Burning",
      stacks: 1,
      duration: 6,
      engineerMech: true,
      triggeredBy: skill.name,
    });
  }
}

export const engineerMechSkillHandlers = Object.freeze({
  "engineer.mech-summon": summonMech,
  "engineer.mech-recall": recallMech,
});
