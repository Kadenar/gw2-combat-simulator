/**
 * Conduit and Legendary Entity runtime mechanics.
 *
 * Owns affinity gain, Entity skill packets, legend resonances, Numinous Gift,
 * Shared Wisdom additions, Release Potential variants, and Cosmic Wisdom
 * state. It also handles delayed affinity-hit tasks and exports the feature's
 * raw skill callbacks for composition by handlers.js.
 */
import { emitRevenantState } from "./shared.js";
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from "../../legend-rules.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  hasRevenantTrait,
  revenantConduitFormIsActive,
} from "../../state.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";

function hasLegend(context, legendId) {
  return context.state.profession.selectedLegendIds.includes(legendId);
}

function hasTrait(context, traitId) {
  return hasRevenantTrait(context.config, traitId);
}

function activeComboField(context, type, at) {
  return context.events.some(event => {
    if (
      event.type !== "action" ||
      event.cancelled === true ||
      Number(event.endsAt) > at + context.epsilon
    ) return false;
    const field = context.catalog.skillsById.get(event.skillId);
    return (
      field?.comboField === type &&
      Number(event.endsAt) + Number(field.duration || 0) >=
        at - context.epsilon
    );
  });
}

function effectiveAffinity(context) {
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT) ? 2 : 0;
  return Math.min(
    MECHANICS.conduit.affinityMaximum,
    Number(context.state.profession.affinity || 0) + bonus,
  );
}

function targetsHit(context, maximum = 5) {
  return Math.max(
    1,
    Math.min(
      maximum,
      Math.trunc(
        Number(
          context.command?.targetsHit ??
            context.config.targetsHit ??
            context.config.targetCount ??
            1,
        ),
      ),
    ),
  );
}

function activeWeapon(context) {
  return Number(context.state.activeWeaponSet) === 2
    ? context.config.weaponSet2Primary
    : context.config.primaryWeapon;
}

function emitDamage(context, skill, options = {}) {
  const {
    at = context.effectiveEnd,
    coefficient,
    name = skill.name,
    actorType = "player",
    hitIndex = 1,
    totalHits = 1,
    affinityOnHit = false,
  } = options;
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType,
    skillId: skill.id,
    skillName: skill.name,
    name,
    coefficient,
    hits: 1,
    hitIndex,
    totalHits,
    ...(affinityOnHit ? { affinityOnHit: true } : {}),
    // Utility, elite, and triggered attacks use GW2's standard level-based
    // strength. Profession mechanic attacks use the active weapon.
    skillWeapon:
      skill.weapon ||
      (skill.type === "Profession" ? activeWeapon(context) : "Unequipped"),
  });
}

export function emitDervishFormAttack(
  context,
  skill,
  { elite = false } = {},
) {
  const state = context.state.profession;
  if (
    context.config.specialization !== "Conduit" ||
    state.conduitForm !== "Dervish" ||
    Number(state.cosmicWisdomUntil || 0) <= context.start
  )
    return;
  const skillId = elite
    ? ID.FORM_OF_THE_DERVISH_ATTACK_ELITE
    : ID.FORM_OF_THE_DERVISH_ATTACK;
  const icon = context.catalog.skillsById.get(skillId)?.icon || "";
  context.emit({
    type: "damage",
    at: context.effectiveEnd,
    source: "revenant",
    sourceId: skillId,
    actorType: "player",
    skillId,
    skillName: "Form of the Dervish",
    icon,
    name: elite
      ? "Form of the Dervish (Attack - Elite)"
      : "Form of the Dervish (Attack)",
    coefficient: MECHANICS.conduit.formOfTheDervishCoefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    triggeredBy: skill.name,
  });
}

/** Emits Form of the Assassin's one-second/legend-skill dagger strike. */
export function emitLesserEnchantedDaggers(context, sourceSkill, at) {
  if (
    !revenantConduitFormIsActive(
      context.state.profession,
      "Assassin",
      at,
    )
  ) return;
  const skill = context.catalog.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS);
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    icon: skill.icon || "",
    name: "Lesser Enchanted Daggers",
    coefficient:
      MECHANICS.conduit.formOfTheAssassin
        .lesserEnchantedDaggersCoefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    triggeredBy: sourceSkill.name,
  });
}

/** Applies the active Assassin or Dervish form after a legend skill cast. */
export function applyCosmicWisdomAfterCast(context, skill) {
  const at = context.effectiveEnd;
  if (
    skill.legendId === LEGEND.ASSASSIN &&
    revenantConduitFormIsActive(
      context.state.profession,
      "Assassin",
      at,
    )
  ) {
    emitLesserEnchantedDaggers(context, skill, at);
  }
  if (
    skill.legendId !== LEGEND.ENTITY ||
    !revenantConduitFormIsActive(
      context.state.profession,
      "Dervish",
      at,
    )
  ) return;
  emitDervishFormAttack(context, skill);
  if ([ID.TWIN_MOON_SWEEP, ID.TWIN_MOON_SWEEP_ID_77001].includes(skill.id)) {
    emitDervishFormAttack(context, skill, { elite: true });
  }
}

function emitCondition(context, skill, options = {}) {
  const {
    at = context.effectiveEnd,
    condition,
    stacks = 1,
    duration,
    name = `${skill.name} — ${condition}`,
  } = options;
  context.emit({
    type: "condition",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name,
    condition,
    stacks,
    duration,
  });
}

/** Emits a Revenant-owned boon with optional recipient/horizon metadata. */
export function emitRevenantBoon(
  context,
  skill,
  boon,
  duration,
  stacks = 1,
  options = {},
) {
  context.emit({
    type: "buff",
    at: options.at ?? context.effectiveEnd,
    source: "revenant",
    sourceId: options.sourceId ?? skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: options.name ?? `${skill.name} — ${boon}`,
    kind: boon,
    duration,
    stacks,
    ...(options.recipients ? { recipients: options.recipients } : {}),
    ...(options.extendsResolutionHorizon
      ? { extendsResolutionHorizon: true }
      : {}),
  });
}

function emitControl(context, skill, controlKind, duration) {
  context.emit({
    type: "control",
    at: context.effectiveEnd,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    controlKind,
    duration,
  });
}

/** Adds capped Conduit affinity and snapshots the resource change. */
export function gainConduitAffinity(context, amount, reason) {
  if (context.config.specialization !== "Conduit") return 0;
  const state = context.state.profession;
  const previous = Number(state.affinity || 0);
  state.affinity = Math.min(
    MECHANICS.conduit.affinityMaximum,
    previous + Math.max(0, Number(amount || 0)),
  );
  if (
    previous < MECHANICS.conduit.affinityMaximum &&
    state.affinity === MECHANICS.conduit.affinityMaximum &&
    hasTrait(context, TRAIT.EXPANDED_CONSCIOUSNESS)
  ) {
    state.energy = Math.min(
      state.maximumEnergy,
      state.energy + MECHANICS.conduit.expandedConsciousnessEnergy,
    );
  }
  if (state.affinity !== previous) {
    emitRevenantState(context, context.start ?? context.state.time, reason);
  }
  return state.affinity - previous;
}

/** Resolves a delayed affinity gain scheduled for a qualifying hit. */
export function handleConduitAffinityHit(context, task) {
  gainConduitAffinity(context, task.payload.amount, "enigmatic-connection-hit");
}

/** Emits Numinous Gift's base and equipped-legend boon profile. */
export function emitNuminousGift(context, skill, options = {}) {
  if (context.config.specialization !== "Conduit") return;
  const profile = MECHANICS.conduit.numinousGift;
  const recipients = options.allies ? "allies" : "self";
  emitRevenantBoon(
    context,
    skill,
    "might",
    profile.mightDuration,
    profile.mightStacks,
    { recipients },
  );
  for (const legendId of context.state.profession.selectedLegendIds) {
    const boon = profile.boons[legendId];
    if (boon) {
      emitRevenantBoon(context, skill, boon[0], boon[1], 1, { recipients });
    }
  }
}

/** Emits Beguiling Haze or consumes one of its follow-up charges. */
export function castBeguilingHaze(context, skill) {
  const profile = MECHANICS.conduit.beguilingHaze;
  const state = context.state.profession;
  const followUp = Number(state.beguilingHazeCharges || 0) > 0;
  if (followUp) {
    state.beguilingHazeCharges -= 1;
    emitDamage(context, skill, {
      coefficient: profile.followUpCoefficient,
      name: "Beguiling Haze — Follow-Up",
    });
  } else {
    state.beguilingHazeMainReservations.push(context.reservationId);
    emitDamage(context, skill, {
      coefficient: profile.mainCoefficient,
      name: "Beguiling Haze",
    });
  }
  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    emitRevenantBoon(context, skill, "fury", profile.sharedWisdomFury);
  }
  emitRevenantState(context, context.effectiveEnd, "beguiling-haze");
}

/** Arms Beguiling Haze follow-up charges after the primary cast completes. */
export function completeBeguilingHaze(context, skill) {
  if (skill.handlerId !== "revenant.beguiling-haze") return;
  const state = context.state.profession;
  const index = state.beguilingHazeMainReservations.indexOf(
    context.reservationId,
  );
  const mainCast = index >= 0;
  if (mainCast) {
    state.beguilingHazeMainReservations.splice(index, 1);
    state.beguilingHazeCharges =
      MECHANICS.conduit.beguilingHaze.followUpCharges;
    state.beguilingHazeReadyAt =
      context.effectiveEnd +
      (context.hasBuff?.("alacrity", context.effectiveEnd) ? 8 : 10);
  }
  const ammo = context.state.ammo.get(skill.id);
  if (ammo) {
    if (state.beguilingHazeCharges > 0) {
      ammo.maximum = MECHANICS.conduit.beguilingHaze.followUpCharges;
      ammo.charges = state.beguilingHazeCharges;
      ammo.nextRechargeAt = null;
      context.state.cooldowns.delete(skill.id);
    } else {
      // Follow-up charges are temporary. Only the main cast rearms when its
      // original cooldown finishes.
      ammo.maximum = 1;
      ammo.charges = 0;
      ammo.rechargeDuration = Math.max(
        0,
        state.beguilingHazeReadyAt - context.effectiveEnd,
      );
      ammo.nextRechargeAt = state.beguilingHazeReadyAt;
      context.state.cooldowns.set(skill.id, state.beguilingHazeReadyAt);
    }
  }
  emitRevenantState(context, context.effectiveEnd, "beguiling-haze-follow-up");
}

function activeSelfConditions(context, at) {
  const state = context.state.profession;
  state.selfConditions = (state.selfConditions || []).filter(
    (application) => Number(application.expiresAt || 0) > at,
  );
  const configured = Math.max(0, Number(state.selfConditionCount || 0));
  return configured + state.selfConditions.length;
}

/** Resolves projectile-count-scaled Hex Eater Vortex effects. */
export function castHexEaterVortex(context, skill) {
  const profile = MECHANICS.conduit.hexEaterVortex;
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const projectileCount = hasLegend(context, LEGEND.DEMON)
    ? profile.maximumProjectiles
    : Math.min(profile.maximumProjectiles, activeSelfConditions(context, at));
  const conditionsRemoved = Math.min(
    profile.maximumProjectiles,
    activeSelfConditions(context, at),
  );
  if (conditionsRemoved > 0) {
    const configuredRemoved = Math.min(
      conditionsRemoved,
      Number(state.selfConditionCount || 0),
    );
    state.selfConditionCount -= configuredRemoved;
    state.selfConditions.splice(0, conditionsRemoved - configuredRemoved);
  }
  for (let index = 0; index < projectileCount; index += 1) {
    emitDamage(context, skill, {
      at,
      coefficient: profile.projectileCoefficient,
      name: `Hex-Eater Vortex — Projectile ${index + 1}`,
      hitIndex: index + 1,
      totalHits: projectileCount,
    });
    emitCondition(context, skill, {
      at,
      condition: "Torment",
      stacks: profile.tormentStacks,
      duration: profile.tormentDuration,
      name: `Hex-Eater Vortex — Projectile ${index + 1}`,
    });
  }
  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    emitRevenantBoon(
      context,
      skill,
      "resolution",
      profile.sharedWisdomResolution,
    );
  }
  emitRevenantState(context, at, "hex-eater-vortex");
}

/** Resolves Gladiator's Defense and its legend/trait-dependent boons. */
export function castGladiatorsDefense(context, skill) {
  const profile = MECHANICS.conduit.gladiatorsDefense;
  emitDamage(context, skill, { coefficient: profile.coefficient });
  emitCondition(context, skill, {
    condition: "Weakness",
    stacks: 1,
    duration: profile.weaknessDuration,
  });
  emitRevenantBoon(context, skill, "resolution", profile.resolutionDuration);
  emitRevenantBoon(context, skill, "resistance", profile.resistanceDuration);
  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    emitRevenantBoon(
      context,
      skill,
      "stability",
      profile.sharedWisdomStability,
    );
  }
}

/** Emits both Twin Moon attackers and every equipped-legend resonance. */
export function castTwinMoonSweep(context, skill) {
  const profile = MECHANICS.conduit.twinMoonSweep;
  const at = context.effectiveEnd;
  emitDamage(context, skill, {
    at,
    coefficient: profile.playerCoefficient,
    name: "Twin Moon Sweep — Player",
    hitIndex: 1,
    totalHits: profile.packets,
    affinityOnHit: true,
  });
  emitDamage(context, skill, {
    at,
    coefficient: profile.fragmentCoefficient,
    name: "Twin Moon Sweep — Fragment",
    actorType: "player",
    hitIndex: 2,
    totalHits: profile.packets,
  });
  for (let index = 0; index < profile.packets; index += 1) {
    emitCondition(context, skill, {
      at,
      condition: "Bleeding",
      stacks: profile.bleedStacks,
      duration: profile.bleedDuration,
      name: `Twin Moon Sweep — Bleeding ${index + 1}`,
    });
    emitRevenantBoon(
      context,
      skill,
      "might",
      profile.mightDuration,
      profile.mightStacks,
      {
        at,
        name: `Twin Moon Sweep — Might ${index + 1}`,
      },
    );
  }
  if (hasLegend(context, LEGEND.ASSASSIN)) {
    emitCondition(context, skill, {
      condition: "Immobilized",
      stacks: 1,
      duration: profile.assassinImmobilize,
    });
  }
  if (hasLegend(context, LEGEND.DEMON)) {
    for (let index = 0; index < profile.packets; index += 1) {
      emitDamage(context, skill, {
        at,
        coefficient: profile.demonShatterCoefficient,
        name: `Twin Moon Sweep — Shatter ${index + 1}`,
        hitIndex: index + 1,
        totalHits: profile.packets,
      });
      emitCondition(context, skill, {
        at,
        condition: "Confusion",
        stacks: profile.demonConfusionStacks,
        duration: profile.demonConfusionDuration,
        name: `Twin Moon Sweep — Confusion ${index + 1}`,
      });
    }
  }
  if (activeComboField(context, "Fire", at)) {
    for (let index = 0; index < profile.burningBolts; index += 1) {
      emitCondition(context, skill, {
        at: at + profile.burningBoltDelay,
        condition: "Burning",
        stacks: 1,
        duration: profile.burningBoltDuration,
        name: `Twin Moon Sweep — Burning Bolts ${index + 1}`,
      });
    }
  }
  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    for (let index = 0; index < profile.packets; index += 1) {
      emitRevenantBoon(
        context,
        skill,
        "might",
        profile.sharedWisdomMightDuration,
        profile.sharedWisdomMightStacks,
        {
          at,
          name: `Shared Wisdom — Might ${index + 1}`,
        },
      );
    }
  }
}

/** Resolves the active Release Potential variant from affinity and legends. */
export function castReleasePotential(context, skill) {
  const affinity = effectiveAffinity(context);
  const allLegendEffects =
    affinity >= MECHANICS.conduit.allReleaseEffectsAffinity;
  const profile = MECHANICS.conduit.releasePotential[skill.id];
  switch (skill.id) {
    case ID.RELEASE_POTENTIAL_MONK:
      emitRevenantBoon(
        context,
        skill,
        "resistance",
        profile.resistanceDuration,
      );
      emitRevenantBoon(
        context,
        skill,
        "regeneration",
        profile.regenerationDuration,
      );
      break;
    case ID.RELEASE_POTENTIAL_DERVISH:
      emitDamage(context, skill, { coefficient: profile.coefficient });
      if (hasLegend(context, LEGEND.DEMON) || allLegendEffects) {
        emitCondition(context, skill, {
          condition: "Bleeding",
          stacks: profile.demonBleedStacks,
          duration: profile.demonBleedDuration,
        });
      }
      if (hasLegend(context, LEGEND.CENTAUR) || allLegendEffects) {
        emitRevenantBoon(
          context,
          skill,
          "might",
          profile.centaurMightDuration,
          profile.centaurMightStacks,
        );
        emitRevenantBoon(context, skill, "fury", profile.centaurFuryDuration);
      }
      break;
    case ID.RELEASE_POTENTIAL_MESMER: {
      emitDamage(context, skill, { coefficient: profile.coefficient });
      emitCondition(context, skill, {
        condition: "Torment",
        stacks: profile.tormentStacks,
        duration:
          profile.tormentBaseDuration *
          (1 + affinity * profile.tormentDurationPerAffinity),
      });
      const selfDuration =
        profile.selfTormentBaseDuration *
        Math.max(0, 1 - affinity * profile.selfDurationReductionPerAffinity);
      const count = targetsHit(context);
      for (let index = 0; index < count; index += 1) {
        context.state.profession.selfConditions.push({
          condition: "Torment",
          stacks: 1,
          at: context.effectiveEnd,
          expiresAt: context.effectiveEnd + selfDuration,
          sourceId: skill.id,
          skillName: skill.name,
        });
      }
      emitControl(context, skill, "daze", profile.dazeDuration);
      break;
    }
    case ID.RELEASE_POTENTIAL_ASSASSIN:
      for (let index = 0; index < profile.hits; index += 1) {
        emitDamage(context, skill, {
          at:
            context.start +
            ((context.effectiveEnd - context.start) * (index + 1)) /
              profile.hits,
          coefficient: profile.coefficientPerHit,
          hitIndex: index + 1,
          totalHits: profile.hits,
        });
      }
      emitCondition(context, skill, {
        condition: "Crippled",
        duration:
          profile.conditionBaseDuration *
          (1 + affinity * profile.conditionDurationPerAffinity),
      });
      emitCondition(context, skill, {
        condition: "Immobilized",
        duration:
          profile.conditionBaseDuration *
          (1 + affinity * profile.conditionDurationPerAffinity),
      });
      break;
    case ID.RELEASE_POTENTIAL_WARRIOR:
      emitDamage(context, skill, { coefficient: profile.coefficient });
      break;
    default:
      break;
  }
}

/** Grants Ancient Echo's fixed Energy refund. */
export function gainAncientEchoEnergy(context) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.energy = Math.min(
    state.maximumEnergy,
    state.energy + MECHANICS.conduit.ancientEchoEnergy,
  );
  emitRevenantState(context, at, "ancient-echo");
}

/** Toggles the active Luxon/Kurzick Alliance skill side. */
export function switchAllianceTactics(context) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.allianceSide = state.allianceSide === "luxon" ? "kurzick" : "luxon";
  emitRevenantState(context, at, "alliance-tactics");
}

/** Starts Cosmic Wisdom and selects the current legend-derived form. */
export function activateCosmicWisdom(context) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  // Mistfire resolves as part of the activation, before Cosmic Wisdom's
  // doubled Bolstered Bonds attributes become active.
  if (hasTrait(context, TRAIT.MISTFIRE)) {
    const profile = MECHANICS.traitProcs.mistfire;
    context.emit({
      type: "damage",
      at,
      source: "revenant",
      sourceId: TRAIT.MISTFIRE,
      actorType: "effect",
      skillId: TRAIT.MISTFIRE,
      skillName: "Mistfire",
      name: "Mistfire",
      coefficient: profile.coefficient,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: "Unequipped",
    });
    context.emit({
      type: "condition",
      at,
      source: "revenant",
      sourceId: TRAIT.MISTFIRE,
      actorType: "effect",
      skillId: TRAIT.MISTFIRE,
      skillName: "Mistfire",
      name: "Mistfire — Burning",
      condition: "Burning",
      stacks: profile.burningStacks,
      duration: profile.burningDuration,
    });
  }
  state.cosmicWisdomUntil = at + MECHANICS.conduit.cosmicWisdomDuration;
  state.conduitForm =
    REVENANT_RELEASE_POTENTIAL_BY_LEGEND[state.activeLegendId]?.replace(
      "Release Potential: ",
      "",
    ) || "";
  emitRevenantState(context, at, "cosmic-wisdom");
  emitNuminousGift(context, context.skill);
}

/** Raw Conduit callbacks consumed by the central handler registry. */
export const revenantConduitSkillHandlers = Object.freeze({
  "revenant.ancient-echo": gainAncientEchoEnergy,
  "revenant.alliance-tactics": switchAllianceTactics,
  "revenant.beguiling-haze": castBeguilingHaze,
  "revenant.gladiators-defense": castGladiatorsDefense,
  "revenant.hex-eater-vortex": castHexEaterVortex,
  "revenant.twin-moon-sweep": castTwinMoonSweep,
  "revenant.release-potential": castReleasePotential,
  "revenant.cosmic-wisdom": activateCosmicWisdom,
});
