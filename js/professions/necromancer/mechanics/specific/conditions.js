/**
 * Condition-manipulation skill handlers.
 *
 * Necromancer corruption skills self-inflict a condition (tracked in
 * `state.selfConditions` with duration scaled by the player's condition-duration
 * stats) which transfer skills later fling onto the target. Also holds the
 * direct condition bursts (Devouring Darkness, Dark Barrage). Exports the
 * `necromancerConditionSkillHandlers` map plus the self-condition
 * apply/purge/transfer helpers reused by shroud/scheduler code.
 */
import {
  createGw2CombatQuery,
  selectedGw2TraitValues,
} from "../../../../platform/gw2/query.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  emitCondition,
  emitDamage,
  hasTrait,
} from "./shared.js";

const DAMAGING_CONDITIONS = new Set([
  "Bleeding",
  "Burning",
  "Confusion",
  "Poison",
  "Poisoned",
  "Torment",
]);

const CORRUPTION_SELF_CONDITIONS = Object.freeze({
  [ID.CONSUME_CONDITIONS]: Object.freeze({
    base: Object.freeze([["Vulnerability", 5, 4]]),
    master: Object.freeze([["Vulnerability", 5, 4]]),
  }),
  [ID.BLOOD_IS_POWER]: Object.freeze({
    base: Object.freeze([["Bleeding", 2, 10]]),
    master: Object.freeze([["Torment", 2, 10]]),
  }),
  [ID.CORROSIVE_POISON_CLOUD]: Object.freeze({
    base: Object.freeze([["Weakness", 1, 6]]),
    master: Object.freeze([["Crippled", 1, 2]]),
  }),
  [ID.CORRUPT_BOON]: Object.freeze({
    base: Object.freeze([["Poisoned", 1, 6]]),
    master: Object.freeze([["Bleeding", 2, 12]]),
  }),
  [ID.EPIDEMIC]: Object.freeze({
    base: Object.freeze([["Vulnerability", 3, 6]]),
    master: Object.freeze([["Weakness", 1, 6]]),
  }),
  [ID.PLAGUELANDS]: Object.freeze({
    base: Object.freeze([["Bleeding", 1, 10]]),
    master: Object.freeze([["Poisoned", 1, 6]]),
  }),
});

function conditionDurationMultiplier(context, skill, condition, at) {
  const event = {
    type: "self-condition",
    at,
    skillId: skill.id,
    skillName: skill.name,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    condition,
    selfCondition: true,
  };
  const traits = selectedGw2TraitValues(
    context.config,
    context.profession.catalog,
  );
  const query = createGw2CombatQuery({
    profession: context.profession,
    config: context.config,
    events: context.events,
    traits,
  });
  const stats = query.statsAt(at, event, context.state);
  return query.conditionDurationMultiplier(
    condition,
    at,
    stats,
    event,
    context.state,
  );
}

export function purgeNecromancerSelfConditions(state, at) {
  state.selfConditions = (state.selfConditions || [])
    .filter(application =>
      application.appliedAt <= at && application.expiresAt > at);
  return state.selfConditions;
}

export function applyNecromancerSelfCondition(
  context,
  skill,
  condition,
  stacks,
  duration,
  at = context.effectiveEnd,
) {
  const effectiveDuration =
    Math.max(0, Number(duration || 0))
    * conditionDurationMultiplier(context, skill, condition, at);
  if (!(effectiveDuration > 0) || !(Number(stacks) > 0)) return null;
  const application = {
    condition,
    stacks: Number(stacks),
    appliedAt: at,
    expiresAt: at + effectiveDuration,
    sourceSkillId: skill.id,
    sourceSkillName: skill.name,
  };
  purgeNecromancerSelfConditions(context.state.profession, at);
  context.state.profession.selfConditions.push(application);
  context.emit({
    type: "self_condition",
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — self ${condition}`,
    condition,
    stacks: Number(stacks),
    duration: effectiveDuration,
    expiresAt: application.expiresAt,
  });
  return application;
}

function emitTransferredApplication(context, skill, application, at) {
  const duration = application.expiresAt - at;
  const common = {
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — Transferred ${application.condition}`,
    stacks: application.stacks,
    duration,
    fixedDuration: true,
    transferredCondition: true,
    transferredFromSkillId: application.sourceSkillId,
  };
  if (application.condition === "Vulnerability") {
    context.emit({
      ...common,
      type: "buff",
      kind: "target-vulnerability",
    });
    return;
  }
  context.emit({
    ...common,
    type: "condition",
    condition: application.condition,
    nonDamaging: !DAMAGING_CONDITIONS.has(application.condition),
  });
}

export function transferNecromancerSelfConditions(
  context,
  skill,
  maximumConditionTypes,
  at = context.effectiveEnd,
) {
  const state = context.state.profession;
  const active = purgeNecromancerSelfConditions(state, at);
  const selected = new Set();
  for (const application of active) {
    if (selected.size >= maximumConditionTypes) break;
    selected.add(application.condition);
  }
  if (!selected.size) return 0;
  const transferred = active.filter(application =>
    selected.has(application.condition));
  state.selfConditions = active.filter(application =>
    !selected.has(application.condition));
  for (const application of transferred) {
    emitTransferredApplication(context, skill, application, at);
  }
  return transferred.length;
}

function corruption(context, skill) {
  const mechanics = CORRUPTION_SELF_CONDITIONS[skill.id];
  if (!mechanics) return false;
  for (const application of mechanics.base) {
    applyNecromancerSelfCondition(context, skill, ...application);
  }
  if (hasTrait(context, TRAIT.MASTER_OF_CORRUPTION)) {
    for (const application of mechanics.master) {
      applyNecromancerSelfCondition(context, skill, ...application);
    }
  }
  return false;
}

function transfer(context, skill) {
  const maximum = {
    [ID.PLAGUE_SIGNET]: 5,
    [ID.DEATHLY_SWARM]: 2,
    [ID.PUTRID_MARK]: 3,
    [ID.SUFFER]: 2,
  }[skill.id];
  if (!maximum) return false;
  transferNecromancerSelfConditions(context, skill, maximum);
  return false;
}

function devouringDarkness(context, skill) {
  const count = Math.min(
    5,
    Object.values(context.config.target?.conditions || {})
      .filter(value => value === true || Number(value) > 0)
      .length,
  );
  emitDamage(context, skill, 1.16);
  if (count > 0) {
    emitCondition(context, skill, "Torment", count, 4);
  }
  return true;
}

function darkBarrage(context, skill) {
  if (!hasTrait(context, TRAIT.DOOM_APPROACHES)) return false;
  const hits = 8;
  const interval = 0.75 / hits;
  const at = context.start + interval;
  emitDamage(context, skill, 4.8, {
    at,
    hits,
    interval,
  });
  for (let index = 0; index < hits; index += 1) {
    emitCondition(context, skill, "Torment", 1, 3, {
      at: at + index * interval,
    });
  }
  return true;
}

export const necromancerConditionSkillHandlers = Object.freeze({
  "necromancer.corruption": corruption,
  "necromancer.condition-transfer": transfer,
  "necromancer.devouring-darkness": devouringDarkness,
  "necromancer.dark-barrage": darkBarrage,
});
