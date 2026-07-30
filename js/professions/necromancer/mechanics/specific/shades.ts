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
import {
  normalizedNecromancerLifeForceCost,
  syncNecromancerResources,
} from "../../state.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import { removeNecromancerSelfCondition } from "./conditions.js";
import {
  emitBuff,
  emitCondition,
  emitControl,
  emitDamage,
  emitState,
  hasTrait,
} from "./shared.js";
import type {
  NecromancerCastContext,
  NecromancerSkill,
} from "../../types.js";

function emitShadeCondition(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  condition: readonly (string | number)[],
  options?: Parameters<typeof emitCondition>[5],
): void {
  emitCondition(
    context,
    skill,
    String(condition[0]),
    Number(condition[1]),
    Number(condition[2]),
    options,
  );
}

function applyBarrierTraits(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at = context.effectiveEnd,
): void {
  const shadeMechanics = MECHANICS.shade;
  if (hasTrait(context, TRAIT.ABRASIVE_GRIT)) {
    emitBuff(
      context,
      skill,
      "might",
      shadeMechanics.abrasiveGrit.mightDuration,
      shadeMechanics.abrasiveGrit.mightStacks,
      { at },
    );
  }
  if (hasTrait(context, TRAIT.DESERT_EMPOWERMENT)) {
    emitBuff(
      context,
      skill,
      "alacrity",
      shadeMechanics.desertEmpowerment.alacrityDuration,
      1,
      { at },
    );
  }
}

function barrier(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  applyBarrierTraits(context, skill);
  return true;
}

function shade(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const shadeMechanics = MECHANICS.shade;
  if (skill.id === ID.MANIFEST_SAND_SHADE) {
    const maximum = hasTrait(context, TRAIT.SAND_SAVANT) ? 1 : 3;
    const duration = hasTrait(context, TRAIT.SAND_SAVANT)
      ? shadeMechanics.manifest.sandSavantDuration
      : shadeMechanics.manifest.duration;
    state.shades = [...state.shades, at + duration]
      .sort((left, right) => left - right)
      .slice(-maximum);
    if (hasTrait(context, TRAIT.DESERT_EMPOWERMENT)) {
      applyBarrierTraits(context, skill, at);
    }
  } else {
    state.lifeForce = Math.max(
      0,
      state.lifeForce
        - normalizedNecromancerLifeForceCost(
          state,
          Number(skill.lifeForceCost || 0),
        ),
    );
    if (
      new Set<string | number>([
        ID.DESERT_SHROUD,
        ID.SANDSTORM_SHROUD,
      ]).has(skill.id) &&
      hasTrait(context, TRAIT.PLAGUE_SENDING)
    ) {
      const hasActiveSelfCondition = (state.selfConditions || []).some(
        application =>
          application.appliedAt <= at && application.expiresAt > at,
      );
      state.plagueSendingArmed = true;
      state.plagueSendingEntrySkillId = hasActiveSelfCondition
        ? null
        : skill.id;
    }
    if (skill.id === ID.NEFARIOUS_FAVOR) {
      removeNecromancerSelfCondition(state, at, 1);
    }
  }
  syncNecromancerResources(state);
  emitState(context, at, "shade");

  // ArcDPS records the automatic shade strike under two Manifest Sand Shade
  // packet identities: Nefarious Favor uses one, while F1/F5 use the other.
  // Keep the parent cast for mechanics, but report those packets separately.
  const shadeStrikeName =
    skill.id === ID.NEFARIOUS_FAVOR
      ? "Manifest Sand Shade"
      : "Manifest Sand Shade (F1/F5)";
  emitDamage(context, skill, shadeMechanics.manifest.coefficient, {
    name: "Sand Shade — Strike",
    sourceId: ID.MANIFEST_SAND_SHADE,
    skillWeapon: "Unequipped",
    metadata: {
      skillName: shadeStrikeName,
      parentSkillName: skill.name,
    },
  });
  emitShadeCondition(context, skill, shadeMechanics.manifest.condition, {
    sourceId: ID.MANIFEST_SAND_SHADE,
  });

  if (
    skill.id === ID.NEFARIOUS_FAVOR &&
    hasTrait(context, TRAIT.SADISTIC_SEARING)
  ) {
    emitShadeCondition(
      context,
      skill,
      shadeMechanics.sadisticSearing.condition,
      {
      source: "Trait",
      sourceId: TRAIT.SADISTIC_SEARING,
      actorType: "effect",
      },
    );
  } else if (skill.id === ID.SAND_CASCADE) {
    applyBarrierTraits(context, skill, at);
  } else if (skill.id === ID.GARISH_PILLAR) {
    emitControl(
      context,
      skill,
      "fear",
      at,
      shadeMechanics.garishPillar.fearDuration,
    );
  } else if (skill.id === ID.DESERT_SHROUD) {
    if (hasTrait(context, TRAIT.SOUL_BARBS)) {
      emitBuff(context, skill, "necromancer-soul-barbs", 15, 1, { at });
    }
    applyBarrierTraits(context, skill, at);
    emitDamage(context, skill, shadeMechanics.desertShroud.coefficient, {
      at,
      hits: shadeMechanics.desertShroud.hits,
      interval: shadeMechanics.desertShroud.interval,
    });
    for (let index = 0; index < shadeMechanics.desertShroud.hits; index += 1) {
      emitShadeCondition(
        context,
        skill,
        shadeMechanics.desertShroud.condition,
        { at: at + index * shadeMechanics.desertShroud.interval },
      );
    }
  } else if (skill.id === ID.SANDSTORM_SHROUD) {
    const sandstorm = shadeMechanics.sandstormShroud;
    if (hasTrait(context, TRAIT.SOUL_BARBS)) {
      emitBuff(context, skill, "necromancer-soul-barbs", 15, 1, { at });
    }
    for (let index = 0; index < sandstorm.pulseCount; index += 1) {
      const pulseAt = at + index * sandstorm.pulseInterval;
      applyBarrierTraits(context, skill, pulseAt);
      emitBuff(
        context,
        skill,
        "protection",
        sandstorm.pulseProtectionDuration,
        1,
        { at: pulseAt },
      );
    }
    applyBarrierTraits(context, skill, at + sandstorm.delay);
    emitBuff(
      context,
      skill,
      "protection",
      sandstorm.detonationProtectionDuration,
      1,
      { at: at + sandstorm.delay },
    );
    emitDamage(context, skill, sandstorm.coefficient, {
      at: at + sandstorm.delay,
    });
    emitShadeCondition(context, skill, sandstorm.condition, {
      at: at + sandstorm.delay,
    });
  }
  return true;
}

export const necromancerShadeSkillHandlers = Object.freeze({
  "necromancer.shade": shade,
  "necromancer.barrier": barrier,
});
