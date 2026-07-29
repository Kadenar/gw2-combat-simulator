import { ENGINEER_SKILL_IDS as ID } from "../../data/ids.js";
import { emitEngineerState } from "./shared.js";

const TURRET_PROFILES = Object.freeze({
  [ID.RIFLE_TURRET]: {
    name: "Rifle Turret",
    coefficient: 0.75,
    interval: 2,
  },
  [ID.FLAME_TURRET]: {
    name: "Flame Turret",
    coefficient: 0.2,
    interval: 3,
    condition: "Burning",
    conditionDuration: 2,
  },
  [ID.THUMPER_TURRET]: {
    name: "Thumper Turret",
    coefficient: 1,
    interval: 3,
    condition: "Crippled",
    conditionDuration: 3,
  },
  [ID.ROCKET_TURRET]: {
    name: "Rocket Turret",
    coefficient: 2.25,
    interval: 4,
  },
});

export function turretOwnerId(skillId) {
  return `engineer.turret.${Number(skillId)}`;
}

export function deployEngineerTurret(context, skill) {
  const at = context.effectiveEnd;
  const flipSkillId = Number(
    skill.paletteFlipSkillId ?? skill.flipSkillId,
  );
  if (Number.isFinite(flipSkillId)) {
    context.state.profession.availableFlips[flipSkillId] = true;
  }
  if (skill.id === ID.HEALING_TURRET) {
    context.emit({
      type: "buff",
      at,
      source: "engineer",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      kind: "regeneration",
      stacks: 1,
      duration: 3,
    });
  }
  if (TURRET_PROFILES[skill.id]) {
    context.tasks.schedule({
      type: "engineer.turret-attack",
      at,
      ownerId: turretOwnerId(skill.id),
      payload: {
        skillId: skill.id,
        attackIndex: 1,
      },
    });
  }
  emitEngineerState(context, at, "deploy-turret");
}

export function handleEngineerTurretAttack(context, task) {
  const skillId = Number(task.payload.skillId);
  const profile = TURRET_PROFILES[skillId];
  if (!profile) return;
  const attackIndex = Number(task.payload.attackIndex || 1);
  context.emit({
    type: "damage",
    at: task.at,
    source: "engineer",
    sourceId: skillId,
    actorType: "summon",
    skillId,
    skillName: profile.name,
    name: profile.name,
    coefficient: profile.coefficient,
    hits: 1,
    hitIndex: attackIndex,
    totalHits: 5,
    skillWeapon: "Unequipped",
  });
  if (profile.condition) {
    context.emit({
      type: "condition",
      at: task.at,
      source: "engineer",
      sourceId: skillId,
      actorType: "summon",
      skillId,
      skillName: profile.name,
      name: `${profile.name} — ${profile.condition}`,
      condition: profile.condition,
      stacks: 1,
      duration: profile.conditionDuration,
    });
  }
  if (attackIndex >= 5) return;
  context.tasks.schedule({
    type: "engineer.turret-attack",
    at: task.at + profile.interval,
    ownerId: turretOwnerId(skillId),
    payload: {
      skillId,
      attackIndex: attackIndex + 1,
    },
  });
}
