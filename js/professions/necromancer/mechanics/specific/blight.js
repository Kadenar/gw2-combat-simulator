/**
 * Harbinger blight skill handlers.
 *
 * Elixirs and blight ("shroud") skills consume accumulated blight to fire an
 * empowered variant (higher coefficient, extra conditions/boons), then add
 * fresh blight. Consuming blight also feeds the Cascading Corruption trait,
 * which procs Meltdown every 20 stacks. Exports `necromancerBlightSkillHandlers`.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import {
  addBlight,
  consumeBlight,
  emitBuff,
  emitCondition,
  emitControl,
  emitDamage,
  emitState,
  hasTrait,
} from "./shared.js";

export const MELTDOWN_ICON =
  "https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png";

const CASCADING_CORRUPTION_EFFECT = Object.freeze({
  id: ID.CASCADING_CORRUPTION,
  name: "Cascading Corruption",
  type: "Trait",
  skillWeapon: "Unequipped",
});

function applyCascadingCorruption(context, skill, consumed, at) {
  if (
    !hasTrait(context, TRAIT.CASCADING_CORRUPTION) ||
    !consumed ||
    (context.hasExplicitCombatStart &&
      (context.combatStartTime == null || at < Number(context.combatStartTime)))
  )
    return;
  const state = context.state.profession;
  state.cascadingCorruptionStacks += consumed;
  if (state.cascadingCorruptionStacks < 20) return;
  state.cascadingCorruptionStacks -= 20;
  state.meltdownUntil = at + 10;
  context.emit({
    type: "proc",
    procType: "trait",
    at,
    name: "Meltdown",
    sourceSkill: skill.name,
    detail: "Consumed 20 Cascading Corruption stacks",
    icon: MELTDOWN_ICON,
    source: "Trait",
    sourceId: TRAIT.CASCADING_CORRUPTION,
    actorType: "effect",
  });
  emitDamage(
    context,
    CASCADING_CORRUPTION_EFFECT,
    MECHANICS.traitStrikeCoefficient[TRAIT.CASCADING_CORRUPTION],
    {
      at,
      source: "Trait",
      sourceId: TRAIT.CASCADING_CORRUPTION,
      actorType: "effect",
      metadata: {
        parentSkillName: skill.name,
      },
    },
  );
  emitCondition(context, CASCADING_CORRUPTION_EFFECT, "Torment", 6, 6, {
    at,
    source: "Trait",
    sourceId: TRAIT.CASCADING_CORRUPTION,
    actorType: "effect",
    metadata: {
      parentSkillName: skill.name,
    },
  });
}

function elixir(context, skill) {
  const at = context.effectiveEnd;
  const state = context.state.profession;
  const ambition = skill.id === ID.ELIXIR_OF_AMBITION;
  const threshold = ambition ? 10 : 5;
  const empowered = state.blight >= threshold;
  const consumed = empowered ? consumeBlight(state, threshold, at) : 0;
  applyCascadingCorruption(context, skill, consumed, at);
  emitState(context, at, "blight-consumed");
  const elixirMechanics = MECHANICS.elixirs;
  const durationMultiplier = empowered ? elixirMechanics.durationMultiplier : 1;
  const coefficient = elixirMechanics.coefficientBySkillId[skill.id] || 0;
  if (hasTrait(context, TRAIT.BOLSTERING_BREW)) {
    emitBuff(context, skill, "protection", 3);
  }
  emitDamage(
    context,
    skill,
    coefficient *
      (empowered ? elixirMechanics.empoweredCoefficientMultiplier : 1),
    {
      metadata: {
        blightEmpowered: empowered,
        necromancerBlight: state.blight,
      },
    },
  );
  if (skill.id === ID.ELIXIR_OF_PROMISE) {
    const [name, stacks, duration] =
      elixirMechanics.conditionBySkillId[skill.id];
    emitCondition(context, skill, name, stacks, duration * durationMultiplier);
  } else if (skill.id === ID.ELIXIR_OF_RISK) {
    const [name, stacks, duration] =
      elixirMechanics.conditionBySkillId[skill.id];
    emitCondition(context, skill, name, stacks, duration * durationMultiplier);
    emitBuff(context, skill, "might", 10, 10);
    emitBuff(context, skill, "fury", 10);
  } else if (skill.id === ID.ELIXIR_OF_IGNORANCE) {
    context.emit({
      type: "blind",
      at,
      source: "necromancer",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
    });
  } else if (skill.id === ID.ELIXIR_OF_ANGUISH) {
    emitBuff(context, skill, "quickness", 5);
  } else if (skill.id === ID.ELIXIR_OF_AMBITION) {
    for (const name of elixirMechanics.ambitionConditions) {
      emitCondition(
        context,
        skill,
        name,
        elixirMechanics.ambitionConditionStacks,
        elixirMechanics.ambitionConditionDuration * durationMultiplier,
      );
    }
    emitBuff(context, skill, "might", 5, 25);
    emitBuff(context, skill, "fury", 5);
    emitBuff(context, skill, "quickness", 5);
    emitBuff(context, skill, "alacrity", 5);
  }
  addBlight(state, ambition ? 15 : 10, at);
  emitState(context, at, "blight-gained");
  return true;
}

function blightSkill(context, skill) {
  const at = context.effectiveEnd;
  const state = context.state.profession;
  const empowered = state.blight >= 5;
  const consumed = empowered ? consumeBlight(state, 5, at) : 0;
  // The strike snapshots Blight after the five-stack activation cost. Blight
  // generated during the cast is advanced afterward and affects later skills.
  const damageBlight = state.blight;
  applyCascadingCorruption(context, skill, consumed, at);
  emitState(context, at, "blight-skill");
  const skillMechanics = MECHANICS.blightSkills[skill.id];
  if (!skillMechanics) return false;
  emitDamage(
    context,
    skill,
    empowered
      ? skillMechanics.empoweredCoefficient
      : skillMechanics.coefficient,
    {
      metadata: {
        blightEmpowered: empowered,
        necromancerBlight: damageBlight,
      },
    },
  );
  if (empowered) {
    emitCondition(context, skill, ...skillMechanics.empoweredCondition);
  }
  if (skill.id !== ID.DEVOURING_CUT) {
    emitControl(
      context,
      skill,
      hasTrait(context, TRAIT.DOOM_APPROACHES) ? "fear" : "daze",
      context.effectiveEnd,
      0.5,
    );
  }
  return true;
}

export const necromancerBlightSkillHandlers = Object.freeze({
  "necromancer.elixir": elixir,
  "necromancer.blight-skill": blightSkill,
});
