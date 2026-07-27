import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../skill-mechanics.js";
import {
  emitCondition,
  emitControl,
  emitCreatureSummonTraits,
  emitDamage,
  emitState,
} from "./shared.js";

const MINIONS = MECHANICS.minions;
const COMMANDS = MECHANICS.minionCommands;

function queueSummonAttacks(context, skill, definition, at) {
  const horizon = at + Math.max(180, Number(context.config.duration || 0));
  for (
    let attackAt = at + definition.interval;
    attackAt <= horizon;
    attackAt += definition.interval
  ) {
    context.emit({
      type: "necromancer.summon-attack",
      at: attackAt,
      source: "Minion",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: `${skill.name} — Minion Attack`,
      name: `${skill.name} — Minion Attack`,
      coefficient: definition.coefficient * definition.count,
      requiresMinion: definition.key,
      summonKind: "minion",
    });
  }
}

function summonMinion(context, skill) {
  const definition = MINIONS[skill.id];
  if (!definition) return false;
  const state = context.state.profession;
  state.activeMinions[definition.key] = definition.count;
  if (definition.commandId) {
    state.availableFlips[definition.commandId] = Number.POSITIVE_INFINITY;
  }
  emitState(context, context.effectiveEnd, "minion-summoned");
  emitCreatureSummonTraits(
    context,
    skill,
    context.effectiveEnd,
    definition.count,
  );
  queueSummonAttacks(context, skill, definition, context.effectiveEnd);
  return true;
}

function minionCommand(context, skill) {
  const definition = COMMANDS[skill.id];
  if (!definition) return false;
  if (definition.coefficient > 0) {
    emitDamage(context, skill, definition.coefficient, {
      source: "Minion",
      actorType: "summon",
      metadata: { summonKind: "minion" },
    });
  }
  if (definition.condition) {
    emitCondition(
      context,
      skill,
      definition.condition[0],
      definition.condition[1],
      definition.condition[2],
      { source: "Minion", actorType: "summon" },
    );
  }
  if (definition.control && definition.control !== "blind") {
    emitControl(context, skill, definition.control);
  }
  if (definition.control === "blind") {
    context.emit({
      type: "blind",
      at: context.effectiveEnd,
      source: "Minion",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: skill.name,
    });
  }
  if (definition.consumes) {
    const remaining = Math.max(
      0,
      Number(context.state.profession.activeMinions[definition.minion] || 0)
        - definition.consumes,
    );
    if (remaining) {
      context.state.profession.activeMinions[definition.minion] = remaining;
    } else {
      delete context.state.profession.activeMinions[definition.minion];
      delete context.state.profession.availableFlips[skill.id];
    }
  }
  emitState(context, context.effectiveEnd, "minion-command");
  return true;
}

function summonMadness(context, skill) {
  const start = context.effectiveEnd;
  const madness = MECHANICS.summonMadness;
  for (let index = 0; index < madness.summons; index += 1) {
    const summonAt = start + index * madness.summonInterval;
    emitCreatureSummonTraits(context, skill, summonAt);
    emitDamage(context, skill, madness.attack.coefficient, {
      at: summonAt + madness.attack.delay,
      name: "Unstable Horror — Attack",
      source: "Minion",
      sourceId: `unstable-horror.${index}`,
      actorType: "summon",
      metadata: { summonKind: "minion" },
    });
    emitDamage(context, skill, madness.explosion.coefficient, {
      at: summonAt + madness.explosion.delay,
      name: "Unstable Horror — Explosion",
      source: "Minion",
      sourceId: `unstable-horror.${index}`,
      actorType: "summon",
      metadata: { summonKind: "minion" },
    });
  }
  return true;
}

export const necromancerMinionSkillHandlers = Object.freeze({
  "necromancer.minion": summonMinion,
  "necromancer.minion-command": minionCommand,
  "necromancer.summon-madness": summonMadness,
});
