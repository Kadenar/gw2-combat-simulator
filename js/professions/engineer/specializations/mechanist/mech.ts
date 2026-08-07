import { mechanistState } from "./state.js";
import {
  professionCoreState,
} from "../../../../platform/engine/profession.js";
import { emitEngineerState } from "../../core/events.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasEngineerTrait } from "../../core/state.js";
import {
  MECHANIST_ATTACK_TIMING,
  MECHANIST_COMMAND_DURATIONS,
} from "./mechanics.js";
import {
  weaponStrengthMidpoint,
  weaponStrengthProfile,
} from "../../../../platform/gw2/weapon-strength.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  EngineerCastContext,
  EngineerConfig,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  EngineerSkill,
} from "../../types.js";

// Mech strikes use the mech's native damage packet rather than the engineer's
// equipped weapon strength. The skill-specific native weapon profile is
// resolved separately from inherited mech attributes and live modifiers.
const MECH_REFERENCE_POWER = 1500;
const STANDARD_TARGET_ARMOR = 2597;
const MECH_TYPE_1_PROFILE_ID = "summon.weapon-type-1";
const MECH_TYPE_2_PROFILE_ID = "summon.weapon-type-2";
const MECH_TYPE_3_PROFILE_ID = "summon.weapon-type-3";
// The mech takes roughly one-third of a second after a command's activation
// ends before resuming its basic attack chain.
const MECH_BASIC_SKILL_IDS = new Set<SkillId>([
  ID.HARD_STRIKE,
  ID.HEAVY_SMASH_MECH,
  ID.TWIN_STRIKE_MECH,
  ID.JADE_ENERGY_SHOT,
  ID.JADE_ENERGY_SHOT_ID_63348,
  ID.ROCKET_PUNCH_MECH,
]);

const MECH_WEAPON_PROFILE_BY_SKILL_ID: ReadonlyMap<SkillId, string> =
  new Map<SkillId, string>([
    [ID.JADE_ENERGY_SHOT, MECH_TYPE_1_PROFILE_ID],
    [ID.JADE_ENERGY_SHOT_ID_63348, MECH_TYPE_1_PROFILE_ID],
    [ID.CORE_REACTOR_SHOT, MECH_TYPE_1_PROFILE_ID],
    [ID.ROCKET_PUNCH_MECH, MECH_TYPE_1_PROFILE_ID],
    [ID.JADE_MORTAR, MECH_TYPE_2_PROFILE_ID],
    [ID.SPARK_REVOLVER, MECH_TYPE_2_PROFILE_ID],
    [ID.EXPLOSIVE_KNUCKLE, MECH_TYPE_2_PROFILE_ID],
    [ID.HARD_STRIKE, MECH_TYPE_2_PROFILE_ID],
    [ID.HEAVY_SMASH_MECH, MECH_TYPE_2_PROFILE_ID],
    [ID.TWIN_STRIKE_MECH, MECH_TYPE_2_PROFILE_ID],
    [ID.JADE_BUSTER_CANNON, MECH_TYPE_3_PROFILE_ID],
  ]);

function mechWeaponScaling(
  skillId: SkillId | null | undefined,
): Readonly<{
  damagePerCoefficient: number;
  profileId: string;
}> {
  // Preserve the previous command-strength behavior for mech attacks whose
  // native profile has not yet been measured.
  const profileId =
    (skillId == null
      ? null
      : MECH_WEAPON_PROFILE_BY_SKILL_ID.get(skillId)) ||
    MECH_TYPE_2_PROFILE_ID;
  const midpoint = weaponStrengthMidpoint(
    weaponStrengthProfile(profileId),
  );
  return {
    damagePerCoefficient:
      midpoint * MECH_REFERENCE_POWER / STANDARD_TARGET_ARMOR,
    profileId,
  };
}

interface MechAttackPayload extends SchedulerRecord {
  readonly phase: number;
}

interface MechStrikeOptions {
  readonly at: number;
  readonly coefficient: number;
  readonly hits?: number;
  readonly name: string;
  readonly skillId: SkillId;
  readonly hitIndex?: number;
  readonly totalHits?: number;
  readonly basicAttack?: boolean;
}

function selectedSkillNames(config: EngineerConfig = {}): Set<string> {
  const selected = config.selectedSkills || [];
  return new Set(
    (Array.isArray(selected) ? selected : Object.values(selected)).map(String),
  );
}

function mechAttackRate(context: EngineerSchedulerContext): number {
  return context.config.boons?.quickness &&
    selectedSkillNames(context.config).has("Shift Signet")
    ? 1.5
    : 1;
}

function emitMechStrike(
  context: EngineerSchedulerContext,
  {
    at,
    coefficient,
    hits = 1,
    name,
    skillId,
    hitIndex = 1,
    totalHits = hits,
    basicAttack = true,
  }: MechStrikeOptions,
): void {
  const scaling = mechWeaponScaling(skillId);
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
    summonDamagePerCoefficient: scaling.damagePerCoefficient,
    weaponStrengthProfileId: scaling.profileId,
    engineerMech: true,
    mechBasicAttack: basicAttack,
  });
}

export function observeEngineerMechEvent(
  context: EngineerSchedulerContext,
  event: EngineerSimulationEvent,
): void {
  if (
    context.config.specialization !== "Mechanist" ||
    event.actorType !== "summon"
  )
    return;
  const skill = context.catalog?.skillsById?.get(
    event.skillId ?? event.sourceId,
  );
  const slot = Number(skill?.mechanicSlot || 0);
  const engineerMech =
    event.engineerMech === true ||
    (event.skillId != null && MECH_BASIC_SKILL_IDS.has(event.skillId)) ||
    event.skillId === ID.JADE_BUSTER_CANNON ||
    (slot >= 1 && slot <= 3);
  if (!engineerMech) return;

  const updates = { engineerMech: true };
  if (event.type === "damage" && Number(event.coefficient) > 0) {
    const basicAttack =
      event.mechBasicAttack === true ||
      (event.skillId != null && MECH_BASIC_SKILL_IDS.has(event.skillId));
    const scaling = mechWeaponScaling(
      event.skillId ?? event.sourceId,
    );
    Object.assign(updates, {
      independentSummonStrike: true,
      summonInheritsAttributes: true,
      summonUsesProfessionModifiers: true,
      summonBasePower: MECH_REFERENCE_POWER,
      summonDamagePerCoefficient: scaling.damagePerCoefficient,
      weaponStrengthProfileId: scaling.profileId,
      mechBasicAttack: basicAttack,
    });
  }
  context.replaceEvent(event, updates);
}

function scheduleMechAttack(
  context: EngineerSchedulerContext,
  at: number,
  payload: MechAttackPayload,
): void {
  mechanistState.from(context).mech.nextAttackAt = at;
  context.tasks.schedule({
    type: "engineer.mech-attack",
    at,
    ownerId: "engineer.mech",
    payload,
  });
}

function summonMech(context: EngineerCastContext): void {
  const at = context.effectiveEnd;
  mechanistState.from(context).mech.active = true;
  emitEngineerState(context, at, "summon-mech");
}

function recallMech(context: EngineerCastContext): void {
  const at = context.effectiveEnd;
  mechanistState.from(context).mech.active = false;
  emitEngineerState(context, at, "recall-mech");
}

export function isEngineerMechCommand(
  skill: EngineerSkill | undefined,
): boolean {
  const slot = Number(skill?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

function emitRocketPunch(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
): void {
  const scaling = mechWeaponScaling(ID.ROCKET_PUNCH_MECH);
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
    summonDamagePerCoefficient: scaling.damagePerCoefficient,
    weaponStrengthProfileId: scaling.profileId,
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

export function applyEngineerMechCastTraits(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  if (context.config.specialization !== "Mechanist") return;
  const state = mechanistState.from(context);
  const at = context.effectiveEnd;

  if (state.mech.active && isEngineerMechCommand(skill)) {
    const busyUntil =
      at + Number(MECHANIST_COMMAND_DURATIONS[Number(skill.id)] || 0);
    state.mech.busyUntil = Math.max(
      Number(state.mech.busyUntil || 0),
      busyUntil,
    );
  }

  if (
    state.mech.active &&
    skill.type === "Weapon" &&
    !skill.kit &&
    skill.slot === "Weapon_3" &&
    Number(
      professionCoreState(context).traitProcReadyAt.rocketPunch || 0
    ) <= at + context.epsilon
  ) {
    professionCoreState(context).traitProcReadyAt.rocketPunch = at + 5;
    emitRocketPunch(context, skill, at);
  }

  if (
    isEngineerMechCommand(skill) &&
    hasEngineerTrait(context.config, TRAIT.MECH_CORE_JADE_DYNAMO)
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

export function initializeEngineerMech(
  context: EngineerSchedulerContext,
): void {
  const state = mechanistState.from(context);
  if (!state.mech.enabled || !state.mech.active) return;
  scheduleMechAttack(context, 1, { phase: 0 });
}

export function handleEngineerMechAttack(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<MechAttackPayload>,
): void {
  const state = mechanistState.from(context);
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
      skillId: firstArm ? ID.JADE_ENERGY_SHOT : ID.JADE_ENERGY_SHOT_ID_63348,
    });
    scheduleMechAttack(
      context,
      task.at + (
        firstArm
          ? MECHANIST_ATTACK_TIMING.jadeCannonArmGap
          : MECHANIST_ATTACK_TIMING.jadeCannonCycleGap
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
    task.at
      + MECHANIST_ATTACK_TIMING.meleeChainIntervals[phase] / rate,
    {
      phase: (phase + 1) % 3,
    },
  );
}

export function activateOverclockSignet(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const state = mechanistState.from(context);
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
