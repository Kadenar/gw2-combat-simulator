import { emitRevenantState } from "./shared.js";
import {
  gw2AlliedPlayerAssumptions,
} from "../../../../platform/gw2/allied-players.js";
import {
  emitRevenantBoon,
  gainConduitAffinity,
} from "./conduit.js";
import {
  REVENANT_HANDLER_MECHANICS as MECHANICS,
} from "../handler-mechanics.js";
import { REVENANT_SKILL_IDS as ID } from "../../data/ids.js";

function emitDamage(context, skill, at, coefficient, options = {}) {
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: options.actorType || "player",
    skillId: skill.id,
    skillName: skill.name,
    name: options.name || skill.name,
    coefficient,
    hits: 1,
    hitIndex: options.hitIndex || 1,
    totalHits: options.totalHits || 1,
    skillWeapon: "Unequipped",
    ...(options.extendsResolutionHorizon
      ? { extendsResolutionHorizon: true }
      : {}),
  });
}

function emitCondition(
  context,
  skill,
  at,
  condition,
  stacks,
  duration,
) {
  context.emit({
    type: "condition",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — ${condition}`,
    condition,
    stacks,
    duration,
  });
}

function upkeepPulseInterval(skill) {
  const profile = MECHANICS.upkeep;
  if (skill?.id === ID.VENGEFUL_HAMMERS) {
    return profile.vengefulHammersPulseInterval;
  }
  if (skill?.facet) return profile.facetPulseInterval;
  return profile.defaultPulseInterval;
}

export function toggleRevenantUpkeep(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const index = state.activeUpkeeps.findIndex(upkeep =>
    upkeep.skillId === skill.id);
  if (index >= 0) {
    state.activeUpkeeps.splice(index, 1);
    const consumeId = MECHANICS.upkeep.facetConsumeBySkillId[skill.id];
    const consume = context.catalog.skillsById.get(consumeId);
    if (consume) delete state.availableFlips[consume.id];
    context.tasks.cancelOwner(`revenant.upkeep:${skill.id}`);
    emitRevenantState(context, at, "upkeep-disabled");
    return;
  }
  state.activeUpkeeps.push({
    skillId: skill.id,
    upkeepCost: Number(skill.upkeepCost || 0),
    empoweredNextPulse: false,
    nextAlliedProcAt: (() => {
      const allies = gw2AlliedPlayerAssumptions(context.config);
      return allies.count && allies.strikesPerSecond
        ? at + Math.max(1, 1 / allies.strikesPerSecond)
        : null;
    })(),
    nextAffinityAt:
      context.config.specialization === "Conduit"
        ? at + MECHANICS.upkeep.enigmaticUpkeep.interval
        : null,
  });
  const consumeId = MECHANICS.upkeep.facetConsumeBySkillId[skill.id];
  const consume = context.catalog.skillsById.get(consumeId);
  if (consume) state.availableFlips[consume.id] = true;
  const release = skill.flipSkillId == null
    ? null
    : context.catalog.skillsById.get(skill.flipSkillId);
  if (release) state.availableFlips[release.id] = true;
  context.tasks.schedule({
    type: "revenant.upkeep-pulse",
    at: at + upkeepPulseInterval(skill),
    ownerId: `revenant.upkeep:${skill.id}`,
    payload: { skillId: skill.id },
  });
  emitRevenantState(context, at, "upkeep-enabled");
}

export function releaseRevenantUpkeep(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const parent = skill.flipParentId == null
    ? null
    : context.catalog.skillsById.get(skill.flipParentId);
  if (!parent) return;
  state.activeUpkeeps = state.activeUpkeeps.filter(upkeep =>
    upkeep.skillId !== parent.id);
  delete state.availableFlips[skill.id];
  context.tasks.cancelOwner(`revenant.upkeep:${parent.id}`);
  const cooldown = Math.max(0, Number(parent.manualReleaseCooldown || 0));
  if (cooldown > 0) {
    context.state.cooldowns.set(parent.id, at + cooldown);
  }
  emitRevenantState(context, at, "upkeep-released");
}

export function castInspiringReinforcement(context, skill) {
  const profile = MECHANICS.upkeep.inspiringReinforcement;
  const at = context.effectiveEnd;
  emitDamage(context, skill, at, profile.coefficient);
  emitCondition(
    context,
    skill,
    at,
    "Weakness",
    profile.weaknessStacks,
    profile.weaknessDuration,
  );
  emitRevenantBoon(
    context,
    skill,
    "stability",
    profile.stabilityDuration,
    profile.stabilityStacks,
    { at },
  );
  for (let index = 0; index < profile.pulses; index += 1) {
    emitRevenantBoon(
      context,
      skill,
      "stability",
      profile.stabilityDuration,
      profile.stabilityStacks,
      {
      at:
        at + profile.firstPulseDelay + index * profile.pulseInterval,
      name: `Inspiring Reinforcement — Stability ${index + 1}`,
      extendsResolutionHorizon:
        index === profile.pulses - 1,
      },
    );
  }
}

export function castElementalBlast(context, skill) {
  const profile = MECHANICS.upkeep.elementalBlast;
  const firstAt = context.effectiveEnd;
  const pulses = profile.conditions.length;
  for (let pulse = 1; pulse <= pulses; pulse += 1) {
    const at = firstAt + (pulse - 1) * profile.pulseInterval;
    emitDamage(context, skill, at, profile.coefficientPerPulse, {
      name: `Elemental Blast — Pulse ${pulse}`,
      hitIndex: pulse,
      totalHits: pulses,
      extendsResolutionHorizon: pulse === pulses,
    });
    const [condition, stacks, duration] = profile.conditions[pulse - 1];
    emitCondition(context, skill, at, condition, stacks, duration);
  }
}

export function consumeRevenantFacet(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const facetId = MECHANICS.upkeep.facetSkillByConsumeId[skill.id];
  const facet = context.catalog.skillsById.get(facetId);
  state.activeUpkeeps = state.activeUpkeeps.filter(upkeep =>
    upkeep.skillId !== facet?.id);
  delete state.availableFlips[skill.id];
  if (facet) context.tasks.cancelOwner(`revenant.upkeep:${facet.id}`);
  emitRevenantState(context, at, "facet-consumed");
}

function emitUpkeepEffects(context, skill, at) {
  for (const effect of skill.upkeepEffects || []) {
    if (effect.type === "strike") {
      const hits = Math.max(1, Number(effect.hits || 1));
      for (let index = 0; index < hits; index += 1) {
        context.emit({
          type: "damage",
          at,
          source: "revenant",
          sourceId: skill.id,
          actorType: effect.actorType || "player",
          skillId: skill.id,
          skillName: skill.name,
          name: effect.name || skill.name,
          coefficient: Number(effect.coefficient || 0) / hits,
          hits: 1,
          hitIndex: index + 1,
          totalHits: hits,
          skillWeapon: "Unequipped",
        });
      }
    } else if (effect.type === "condition") {
      context.emit({
        type: "condition",
        at,
        source: "revenant",
        sourceId: skill.id,
        actorType: effect.actorType || "player",
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} — ${effect.condition}`,
        condition: effect.condition,
        stacks: effect.stacks,
        duration: effect.duration,
      });
    }
  }
}

export function handleRevenantUpkeepPulse(context, task) {
  const active = context.state.profession.activeUpkeeps.find(upkeep =>
    upkeep.skillId === task.payload.skillId);
  if (!active) return;
  const skill = context.catalog.skillsById.get(task.payload.skillId);
  if (skill?.id === ID.EMBRACE_THE_DARKNESS) {
    const profile = MECHANICS.upkeep.embraceTheDarkness;
    emitDamage(context, skill, task.at, profile.coefficient);
    emitCondition(
      context,
      skill,
      task.at,
      "Torment",
      active.empoweredNextPulse
        ? profile.empoweredTormentStacks
        : profile.tormentStacks,
      profile.tormentDuration,
    );
    active.empoweredNextPulse = false;
  } else if (skill?.id === ID.VENGEFUL_HAMMERS) {
    const profile = MECHANICS.upkeep.vengefulHammers;
    for (let hammer = 1; hammer <= profile.hammers; hammer += 1) {
      emitDamage(context, skill, task.at, profile.coefficientPerHammer, {
        name: `Vengeful Hammers — Hammer ${hammer}`,
        hitIndex: hammer,
        totalHits: profile.hammers,
      });
    }
  } else if (skill?.facet) {
    for (const effect of skill.upkeepEffects || []) {
      if (effect.type !== "boon") continue;
      emitRevenantBoon(
        context,
        skill,
        effect.boon,
        effect.duration,
        effect.stacks,
        { at: task.at },
      );
    }
  } else if (skill?.id === ID.SOULCLEAVES_SUMMIT) {
    const profile = MECHANICS.soulcleave;
    const allies = gw2AlliedPlayerAssumptions(context.config);
    if (
      active.nextAlliedProcAt != null
      && task.at + context.epsilon >= active.nextAlliedProcAt
    ) {
      for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1) {
        emitDamage(context, skill, task.at, profile.coefficient, {
          actorType: "effect",
          name: `Soulcleave's Summit â€” Ally ${allyIndex} Additional Strike`,
        });
        context.emit({
          type: "damage",
          at: task.at,
          source: "revenant",
          sourceId: skill.id,
          actorType: "effect",
          skillId: skill.id,
          skillName: skill.name,
          name: `Soulcleave's Summit â€” Ally ${allyIndex} Life Siphon`,
          coefficient: 0,
          flatStrikeBase: profile.siphon.flatStrikeBase,
          flatStrikePowerCoeff: profile.siphon.flatStrikePowerCoeff,
          noCrit: true,
          hits: 1,
          hitIndex: 1,
          totalHits: 1,
          skillWeapon: "Unequipped",
          extendsResolutionHorizon: true,
        });
      }
      active.nextAlliedProcAt += Math.max(
        profile.interval,
        1 / allies.strikesPerSecond,
      );
    }
  }
  if (
    context.config.specialization === "Conduit"
    && active.nextAffinityAt != null
    && task.at + context.epsilon >= active.nextAffinityAt
  ) {
    const profile = MECHANICS.upkeep.enigmaticUpkeep;
    gainConduitAffinity(context, profile.affinity, "enigmatic-upkeep");
    active.nextAffinityAt += profile.interval;
  }
  context.tasks.schedule({
    type: "revenant.upkeep-pulse",
    at: task.at + upkeepPulseInterval(skill),
    ownerId: `revenant.upkeep:${task.payload.skillId}`,
    payload: task.payload,
  });
}
