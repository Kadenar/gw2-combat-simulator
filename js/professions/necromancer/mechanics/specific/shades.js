/**
 * Scourge sand shade handlers.
 *
 * A single `shade` handler covers Manifest Sand Shade (which spawns a timed
 * shade, capped by Sand Savant) and every shade-triggered F-skill (Nefarious
 * Favor, Sand Cascade, Garish Pillar, Desert Shroud, Sandstorm Shroud). Each
 * emits the base sand-shade strike/condition plus its skill-specific payload;
 * non-Manifest casts pay the shade's life-force cost. Exports
 * `necromancerShadeSkillHandlers`.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { syncNecromancerResources } from "../../state.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../skill-mechanics.js";
import {
  emitBuff,
  emitCondition,
  emitControl,
  emitDamage,
  emitState,
  hasTrait,
} from "./shared.js";

function shade(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const shadeMechanics = MECHANICS.shade;
  if (skill.id === ID.MANIFEST_SAND_SHADE) {
    const maximum = hasTrait(context, TRAIT.SAND_SAVANT) ? 1 : 3;
    state.shades = [...state.shades, at + 15]
      .sort((left, right) => left - right)
      .slice(-maximum);
    if (hasTrait(context, TRAIT.DESERT_EMPOWERMENT)) {
      emitBuff(context, skill, "alacrity", 2);
      emitBuff(context, skill, "vigor", 2);
    }
  } else {
    state.lifeForce = Math.max(
      0,
      state.lifeForce - Number(skill.lifeForceCost || 0),
    );
  }
  syncNecromancerResources(state);
  emitState(context, at, "shade");

  emitDamage(context, skill, shadeMechanics.manifest.coefficient, {
    name: "Sand Shade — Strike",
    sourceId: ID.MANIFEST_SAND_SHADE,
    skillWeapon: "Unequipped",
  });
  emitCondition(context, skill, ...shadeMechanics.manifest.condition, {
    sourceId: ID.MANIFEST_SAND_SHADE,
  });

  if (
    skill.id === ID.NEFARIOUS_FAVOR
    && hasTrait(context, TRAIT.SADISTIC_SEARING)
  ) {
    emitCondition(context, skill, ...shadeMechanics.sadisticSearing.condition, {
      source: "Trait",
      sourceId: TRAIT.SADISTIC_SEARING,
      actorType: "effect",
    });
  } else if (skill.id === ID.SAND_CASCADE) {
    emitBuff(context, skill, "might", 6, 2);
  } else if (skill.id === ID.GARISH_PILLAR) {
    emitDamage(context, skill, shadeMechanics.garishPillar.coefficient);
    emitControl(context, skill, "fear");
  } else if (skill.id === ID.DESERT_SHROUD) {
    emitDamage(context, skill, shadeMechanics.desertShroud.coefficient, {
      at,
      hits: shadeMechanics.desertShroud.hits,
      interval: shadeMechanics.desertShroud.interval,
    });
    for (
      let index = 0;
      index < shadeMechanics.desertShroud.hits;
      index += 1
    ) {
      emitCondition(context, skill, ...shadeMechanics.desertShroud.condition, {
        at: at + index * shadeMechanics.desertShroud.interval,
      });
    }
  } else if (skill.id === ID.SANDSTORM_SHROUD) {
    const sandstorm = shadeMechanics.sandstormShroud;
    emitDamage(context, skill, sandstorm.coefficient, {
      at: at + sandstorm.delay,
    });
    emitCondition(context, skill, ...sandstorm.condition, {
      at: at + sandstorm.delay,
    });
  }
  return true;
}

export const necromancerShadeSkillHandlers = Object.freeze({
  "necromancer.shade": shade,
});
