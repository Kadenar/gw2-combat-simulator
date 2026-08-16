import { harbingerState } from "./state.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
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
import { HARBINGER_MECHANICS as MECHANICS } from "./mechanics.js";
import {
  addBlight,
  consumeBlight,
  emitBuff,
  emitCondition,
  emitControl,
  emitDamage,
  emitState,
  hasTrait,
  necromancerPartyBoonRecipients,
} from "../../core/shared.js";
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill,
} from "../../types.js";

export const MELTDOWN_ICON =
  "https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png";

const CASCADING_CORRUPTION_EFFECT: NecromancerSkill = Object.freeze({
  id: ID.CASCADING_CORRUPTION,
  name: "Cascading Corruption",
  type: "Trait",
  skillWeapon: "Unequipped",
});

export function advanceHarbingerBlight(
  context: NecromancerSchedulerContext,
  target: number,
): void {
  const state = harbingerState.from(context);
  const coreState = professionCoreState(context);
  // Blight only accrues while inside Harbinger Shroud; advancing outside shroud is a no-op.
  if (coreState.activeShroud !== "harbinger") return;
  const start = Number(coreState.lastResourceAt || 0);
  const end = Math.max(start, Number(target || 0));
  // Life force drains at 5% of maximum per second inside Harbinger Shroud.
  const drainRate = Number(coreState.maximumLifeForce || 100) * 0.05;
  // exitAt is the moment life force would hit 0 — Blight stops accruing if shroud exits before `end`.
  const exitAt =
    drainRate > 0 && drainRate * (end - start) >= coreState.lifeForce
      ? start + coreState.lifeForce / drainRate
      : end;
  // Doom Approaches doubles the passive Blight gain rate (2 → 4 stacks/s).
  const stacksPerSecond = hasTrait(context, TRAIT.DOOM_APPROACHES) ? 4 : 2;
  // nextBlightAt is a whole-second cursor; each tick adds stacksPerSecond stacks and advances the cursor by 1 s.
  while (
    Number(state.nextBlightAt ?? Number.POSITIVE_INFINITY) <=
    exitAt + context.epsilon
  ) {
    const nextBlightAt = Number(state.nextBlightAt);
    addBlight(state, stacksPerSecond, nextBlightAt);
    state.nextBlightAt = nextBlightAt + 1;
  }
}

function applyCascadingCorruption(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  consumed: number,
  at: number,
): void {
  if (
    !hasTrait(context, TRAIT.CASCADING_CORRUPTION) ||
    !consumed ||
    // Pre-combat Blight consumption (e.g. from initialBlight config) must not trigger Meltdown before the fight starts.
    (context.hasExplicitCombatStart &&
      (context.combatStartTime == null || at < Number(context.combatStartTime)))
  )
    return;
  const state = harbingerState.from(context);
  state.cascadingCorruptionStacks += consumed;
  // Every 20 accumulated stacks triggers exactly one Meltdown; remainder carries over to the next threshold.
  if (state.cascadingCorruptionStacks < 20) return;
  state.cascadingCorruptionStacks -= 20;
  // Meltdown lasts 10 s and grants the Cascading Corruption damage bonus during that window.
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
    MECHANICS.cascadingCorruptionCoefficient,
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

function elixir(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const at = context.effectiveEnd;
  // These three elixirs have a mid-cast impact time; others (Bliss, Ignorance, Anguish) impact at cast end.
  // The fraction represents hit-frame / total-cast-time from wiki frame data.
  const impactProgress =
    (
      {
        [ID.ELIXIR_OF_PROMISE]: 10 / 17,
        [ID.ELIXIR_OF_RISK]: 20 / 27,
        [ID.ELIXIR_OF_AMBITION]: 10 / 17,
      } as Readonly<Record<string | number, number>>
    )[skill.id] ?? 1;
  const impactAt =
    context.start + (context.fullEnd - context.start) * impactProgress;
  const state = harbingerState.from(context);
  const ambition = skill.id === ID.ELIXIR_OF_AMBITION;
  // Elixir of Ambition requires 10 Blight to empower (larger effect); all other elixirs need only 5.
  const threshold = ambition ? 10 : 5;
  const empowered = state.blight >= threshold;
  const consumed = empowered ? consumeBlight(state, threshold, at) : 0;
  applyCascadingCorruption(context, skill, consumed, at);
  emitState(context, at, "blight-consumed");
  const elixirMechanics = MECHANICS.elixirs;
  const durationMultiplier = empowered ? elixirMechanics.durationMultiplier : 1;
  const boonOptions = hasTrait(context, TRAIT.TWISTED_MEDICINE)
    ? { metadata: necromancerPartyBoonRecipients(context) }
    : undefined;
  const coefficient =
    (
      elixirMechanics.coefficientBySkillId as Readonly<
        Record<string | number, number>
      >
    )[skill.id] || 0;
  if (hasTrait(context, TRAIT.BOLSTERING_BREW)) {
    emitBuff(context, skill, "protection", 3, 1, boonOptions);
  }
  emitDamage(
    context,
    skill,
    coefficient *
      (empowered ? elixirMechanics.empoweredCoefficientMultiplier : 1),
    {
      at: impactAt,
      metadata: {
        blightEmpowered: empowered,
        necromancerBlight: state.blight,
      },
    },
  );
  if (skill.id === ID.ELIXIR_OF_PROMISE) {
    const [name, stacks, duration] = (
      elixirMechanics.conditionBySkillId as Readonly<
        Record<string | number, readonly (string | number)[]>
      >
    )[skill.id];
    emitCondition(
      context,
      skill,
      String(name),
      Number(stacks),
      Number(duration) * durationMultiplier,
      { at: impactAt },
    );
  } else if (skill.id === ID.ELIXIR_OF_RISK) {
    const [name, stacks, duration] = (
      elixirMechanics.conditionBySkillId as Readonly<
        Record<string | number, readonly (string | number)[]>
      >
    )[skill.id];
    emitCondition(
      context,
      skill,
      String(name),
      Number(stacks),
      Number(duration) * durationMultiplier,
      { at: impactAt },
    );
    emitCondition(context, skill, "Weakness", 1, 5 * durationMultiplier, {
      at: impactAt,
    });
    emitBuff(context, skill, "might", 10, 10, boonOptions);
    emitBuff(context, skill, "fury", 10, 1, boonOptions);
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
    emitBuff(context, skill, "quickness", 5, 1, boonOptions);
  } else if (skill.id === ID.ELIXIR_OF_AMBITION) {
    for (const name of elixirMechanics.ambitionConditions) {
      emitCondition(
        context,
        skill,
        name,
        elixirMechanics.ambitionConditionStacks,
        elixirMechanics.ambitionConditionDuration * durationMultiplier,
        { at: impactAt },
      );
    }
    emitBuff(context, skill, "might", 5, 25, boonOptions);
    emitBuff(context, skill, "fury", 5, 1, boonOptions);
    emitBuff(context, skill, "quickness", 5, 1, boonOptions);
    emitBuff(context, skill, "alacrity", 5, 1, boonOptions);
  }
  // Elixir of Ambition grants more Blight than other elixirs, consistent with its higher empowerment threshold.
  addBlight(state, ambition ? 15 : 10, at);
  emitState(context, at, "blight-gained");
  return true;
}

function blightSkill(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const at = context.effectiveEnd;
  // Blight skills have mid-cast hit frames; these fractions come from wiki frame data, not approximations.
  const impactProgress =
    skill.id === ID.DEVOURING_CUT
      ? 0.75
      : skill.id === ID.VORACIOUS_ARC
        ? 20 / 21
        : 1;
  const impactAt =
    context.start + (context.fullEnd - context.start) * impactProgress;
  const state = harbingerState.from(context);
  const empowered = state.blight >= 5;
  const consumed = empowered ? consumeBlight(state, 5, at) : 0;
  // The strike snapshots Blight after the five-stack activation cost. Blight
  // generated during the cast is advanced afterward and affects later skills.
  const damageBlight = state.blight;
  applyCascadingCorruption(context, skill, consumed, at);
  emitState(context, at, "blight-skill");
  const skillMechanics = (
    MECHANICS.blightSkills as Readonly<
      Record<
        string | number,
        {
          readonly coefficient: number;
          readonly empoweredCoefficient: number;
          readonly empoweredCondition: readonly (string | number)[];
        }
      >
    >
  )[skill.id];
  if (!skillMechanics) return false;
  emitDamage(
    context,
    skill,
    empowered
      ? skillMechanics.empoweredCoefficient
      : skillMechanics.coefficient,
    {
      at: impactAt,
      metadata: {
        blightEmpowered: empowered,
        necromancerBlight: damageBlight,
      },
    },
  );
  if (empowered) {
    const [name, stacks, duration] = skillMechanics.empoweredCondition;
    emitCondition(
      context,
      skill,
      String(name),
      Number(stacks),
      Number(duration),
      { at: impactAt },
    );
  }
  // Devouring Cut has no CC; Voracious Arc normally dazes but Doom Approaches upgrades the daze to a fear.
  if (skill.id !== ID.DEVOURING_CUT) {
    emitControl(
      context,
      skill,
      hasTrait(context, TRAIT.DOOM_APPROACHES) ? "fear" : "daze",
      impactAt,
      0.5,
    );
  }
  return true;
}

export const necromancerBlightSkillHandlers = Object.freeze({
  "necromancer.elixir": elixir,
  "necromancer.blight-skill": blightSkill,
});
