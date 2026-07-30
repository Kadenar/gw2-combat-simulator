/**
 * Minion summon and command handlers.
 *
 * `summonMinion` records the minion in `state.activeMinions`, arms its command
 * flip skill, and queues recurring `necromancer.summon-attack` events for the
 * minion's autoattack. `minionCommand` fires the active (damage/condition/
 * control), optionally consuming the minion. `summonMadness` spawns the timed
 * Unstable Horrors (attack + explosion per summon). Exports
 * `necromancerMinionSkillHandlers`.
 */
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import {
  emitCondition,
  emitControl,
  emitCreatureSummonTraits,
  emitDamage,
  emitState,
  gainNecromancerLifeForce,
} from "./shared.js";

const MINIONS = MECHANICS.minions;
const COMMANDS = MECHANICS.minionCommands;
const MINION_COMMAND_IMPACT_TASK = "necromancer.minion-command-impact";

function minionDefinitionFor(key) {
  return Object.values(MINIONS).find(definition => definition.key === key);
}

function summonStrikeMetadata(definition) {
  if (
    !Number.isFinite(Number(definition?.basePower))
    || !Number.isFinite(Number(definition?.damagePerCoefficient))
  ) {
    return {};
  }
  return {
    summonBasePower: Number(definition.basePower),
    summonDamagePerCoefficient: Number(definition.damagePerCoefficient),
    summonCriticalChance: Number(definition.criticalChance ?? 0.05),
    summonCriticalDamage: Number(definition.criticalDamage ?? 1.5),
    independentSummonStrike: true,
  };
}

function queueSummonAttacks(
  context,
  skill,
  definition,
  at,
  { initialDelay = definition.initialDelay ?? definition.interval } = {},
) {
  const generation = Number(
    context.state.profession.minionGenerations[definition.key] || 0,
  );
  const attackGeneration = Number(
    context.state.profession.minionAttackGenerations[definition.key] || 0,
  );
  const horizon = at + Math.max(180, Number(context.config.duration || 0));
  const attacks = definition.attacks || [{
    name: `${skill.name} — Minion Attack`,
    coefficient: definition.coefficient,
    offset: 0,
  }];
  for (
    let cycleAt = at + Number(initialDelay);
    cycleAt <= horizon;
    cycleAt += definition.interval
  ) {
    for (const attack of attacks) {
      for (let index = 0; index < definition.count; index += 1) {
        context.emit({
          type: "necromancer.summon-attack",
          at: cycleAt + Number(attack.offset || 0),
          source: "Minion",
          sourceId: attack.skillId ?? skill.id,
          actorType: "summon",
          skillId: attack.skillId ?? skill.id,
          skillName: attack.name,
          parentSkillName: attack.skillId ? skill.name : "",
          name: attack.name,
          icon: attack.icon || skill.icon || "",
          coefficient: attack.coefficient,
          ...(
            Number.isFinite(Number(definition.damagePerCoefficient))
              ? {}
              : {
                  weaponStrength:
                    attack.weaponStrength
                    ?? definition.weaponStrength
                    ?? MECHANICS.summonWeaponStrength,
                }
          ),
          requiresMinion: definition.key,
          requiresMinionIndex: index,
          requiresMinionGeneration: generation,
          requiresMinionAttackGeneration: attackGeneration,
          summonKind: "minion",
          summonCount: 1,
          summonOwner: `minion:${definition.key}:${index}`,
          summonOwnerBase: `minion:${definition.key}`,
          ...summonStrikeMetadata(definition),
        });
      }
    }
  }
}

function summonMinion(context, skill) {
  const definition = MINIONS[skill.id];
  if (!definition) return false;
  const state = context.state.profession;
  state.activeMinions[definition.key] = definition.count;
  state.minionGenerations[definition.key] =
    Number(state.minionGenerations[definition.key] || 0) + 1;
  state.minionAttackGenerations[definition.key] =
    Number(state.minionAttackGenerations[definition.key] || 0) + 1;
  if (definition.commandId) {
    state.availableFlips[definition.commandId] = Number.POSITIVE_INFINITY;
  }
  if (skill.rechargeOnMinionDeath) {
    context.state.cooldowns.delete(skill.id);
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

function emitMinionCommandEffects(context, skill, definition, at) {
  const minion = minionDefinitionFor(definition.minion);
  if (definition.coefficient > 0) {
    emitDamage(context, skill, definition.coefficient, {
      at,
      source: "Minion",
      actorType: "summon",
      metadata: {
        summonKind: "minion",
        ...summonStrikeMetadata(minion),
      },
    });
  }
  if (definition.condition) {
    emitCondition(
      context,
      skill,
      definition.condition[0],
      definition.condition[1],
      definition.condition[2],
      { at, source: "Minion", actorType: "summon" },
    );
  }
  for (const condition of definition.conditions || []) {
    emitCondition(context, skill, ...condition, {
      at,
      source: "Minion",
      actorType: "summon",
    });
  }
  if (definition.control && definition.control !== "blind") {
    emitControl(context, skill, definition.control);
  }
  if (definition.control === "blind") {
    context.emit({
      type: "blind",
      at,
      source: "Minion",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: skill.name,
      duration: Number(definition.blindDuration || 0),
    });
  }
}

function restartMinionAttacks(context, skill, definition) {
  const minion = minionDefinitionFor(definition.minion);
  if (
    !minion
    || !Number.isFinite(Number(minion.commandRecoveryDelay))
  ) return;
  const state = context.state.profession;
  state.minionAttackGenerations[minion.key] =
    Number(state.minionAttackGenerations[minion.key] || 0) + 1;
  const summonSkill = context.catalog.skillsById.get(skill.flipParentId);
  if (!summonSkill) return;
  queueSummonAttacks(context, summonSkill, minion, context.effectiveEnd, {
    initialDelay: minion.commandRecoveryDelay,
  });
}

function minionCommand(context, skill) {
  const definition = COMMANDS[skill.id];
  if (!definition) return false;
  restartMinionAttacks(context, skill, definition);
  const impactDelay = Math.max(0, Number(definition.impactDelay || 0));
  if (impactDelay > 0) {
    context.tasks.schedule({
      id: `${context.reservationId}:minion-command-impact`,
      type: MINION_COMMAND_IMPACT_TASK,
      at: context.effectiveEnd + impactDelay,
      ownerId: context.reservationId,
      payload: { skillId: skill.id },
    });
  } else {
    emitMinionCommandEffects(
      context,
      skill,
      definition,
      context.effectiveEnd,
    );
  }
  if (definition.consumes) {
    const remaining = Math.max(
      0,
      Number(context.state.profession.activeMinions[definition.minion] || 0) -
        definition.consumes,
    );
    if (remaining) {
      context.state.profession.activeMinions[definition.minion] = remaining;
      context.state.profession.availableFlips[skill.id] =
        Number.POSITIVE_INFINITY;
    } else {
      delete context.state.profession.activeMinions[definition.minion];
      delete context.state.profession.availableFlips[skill.id];
      const summon = context.catalog.skillsById.get(skill.flipParentId);
      if (summon?.rechargeOnMinionDeath) {
        const recharge = context.rechargeDurationFor(
          summon,
          context.effectiveEnd,
          { minionDeathRecharge: true },
        );
        if (recharge > 0) {
          context.state.cooldowns.set(
            summon.id,
            context.effectiveEnd + recharge,
          );
        }
      }
    }
  } else if (
    Number(context.state.profession.activeMinions[definition.minion] || 0) > 0
  ) {
    context.state.profession.availableFlips[skill.id] =
      Number.POSITIVE_INFINITY;
  }
  emitState(context, context.effectiveEnd, "minion-command");
  return true;
}

function handleMinionCommandImpact(context, task) {
  const skill = context.catalog.skillsById.get(task.payload.skillId);
  const definition = COMMANDS[task.payload.skillId];
  if (
    !skill
    || !definition
    || !(
      Number(context.state.profession.activeMinions[definition.minion] || 0)
      > 0
    )
  ) return;
  emitMinionCommandEffects(context, skill, definition, task.at);
  gainNecromancerLifeForce(
    context,
    definition.lifeForceGain,
    task.at,
    "minion-command-hit",
  );
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

export const necromancerMinionTaskHandlers = Object.freeze({
  [MINION_COMMAND_IMPACT_TASK]: handleMinionCommandImpact,
});
