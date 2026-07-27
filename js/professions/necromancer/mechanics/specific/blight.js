import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../skill-mechanics.js";
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

function applyCascadingCorruption(context, skill, consumed, at) {
  if (!hasTrait(context, TRAIT.CASCADING_CORRUPTION) || !consumed) return;
  const state = context.state.profession;
  state.cascadingCorruptionStacks += consumed;
  if (state.cascadingCorruptionStacks < 20) return;
  state.cascadingCorruptionStacks -= 20;
  state.meltdownUntil = at + 10;
  emitDamage(
    context,
    skill,
    MECHANICS.traitStrikeCoefficient[TRAIT.CASCADING_CORRUPTION],
    {
    at,
    name: "Cascading Corruption",
    source: "Trait",
    sourceId: TRAIT.CASCADING_CORRUPTION,
    actorType: "effect",
    skillWeapon: "Unequipped",
    },
  );
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
  const durationMultiplier = empowered
    ? elixirMechanics.durationMultiplier
    : 1;
  const coefficient = elixirMechanics.coefficientBySkillId[skill.id] || 0;
  emitDamage(
    context,
    skill,
    coefficient * (empowered
      ? elixirMechanics.empoweredCoefficientMultiplier
      : 1),
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
      metadata: { blightEmpowered: empowered, necromancerBlight: state.blight },
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
    );
  }
  return true;
}

export const necromancerBlightSkillHandlers = Object.freeze({
  "necromancer.elixir": elixir,
  "necromancer.blight-skill": blightSkill,
});
