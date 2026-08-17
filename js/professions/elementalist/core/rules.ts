import { elementalistCoreAvailability } from "./availability.js";
import {
  elementalistAttunementRechargeDuration,
  onAttunementComplete,
  targetAttunement,
} from "./attunements.js";
import {
  AURA_TRANSMUTE_SKILLS,
  DODGE_ENDURANCE_COST,
  ETCHING_CHAINS,
  FULL_ETCHING_CHARGE_SKILLS,
} from "./constants.js";
import { applyConjureState } from "./conjures.js";
import { prepareElementalistHitboxEvent } from "./events.js";
import { applyHammerState, scheduleGrandFinaleProfile } from "./hammer.js";
import {
  applyElementalistAura,
  etchingChain,
  emitProfiledCondition,
  profiledEffect,
  skillWeapon,
} from "./mechanics.js";
import { applyPistolState } from "./pistol.js";
import { updateEndurance } from "./resources.js";
import {
  applyGenericPostCast,
  extendPersistingFlamesField,
  extendPersistingFlamesPackets,
  observeElementalistTraitEvent,
  processFreshAirCandidates,
  triggerEvasiveArcana,
} from "./traits.js";
import {
  shareAttunementVariantRecharge,
  updateAutoattackChainState,
} from "./weapon-state.js";

export { elementalistCoreAvailability } from "./availability.js";
export {
  elementalistAlacrityAdjustedDuration,
  elementalistAttunementRechargeDuration,
} from "./attunements.js";
export {
  applyElementalistAura,
  elementalistBuffDuration,
  emitElementalistBuff,
  emitElementalistProc,
} from "./mechanics.js";
export {
  grantElementalistRockSolid,
  triggerElementalistBountifulPower,
  triggerElementalistEarthenBlast,
  triggerElementalistElectricDischarge,
  triggerElementalistFlameExpulsion,
  triggerElementalistSunspot,
} from "./traits.js";

import { criticalChance } from "../../../platform/gw2/damage.js";
import { produceGw2OwnedComboEvents } from "../../../platform/gw2/scheduler/combo-materializer.js";
import { hasTrait as hasGw2Trait } from "../../../platform/gw2/trait-state.js";
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
export { elementalistCoreAttributeRules } from "./modifiers.js";
import type {
  AvailabilityResult,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  SimulationEventInput,
  Skill,
} from "../../../platform/engine/types.js";
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext,
  ElementalistSchedulerContext,
} from "../types.js";
import {
  ELEMENTALIST_ATTUNEMENTS,
  elementalistCoreState,
  resetElementalistAttunementCooldowns,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement,
  type ElementalistAuraState,
  type ElementalistCoreState,
} from "./state.js";
import {
  beginElementalistGlyphCast,
  completeElementalistElementalCommand,
  completeElementalistGlyphCast,
  elementalistElementalAvailability,
  elementalistElementalTaskHandlers,
  observeElementalistElementalEvent,
} from "./elementals.js";
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceEffect,
  elementalistBalanceValue,
  elementalistEffectValue,
} from "./profiles.js";

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

function scheduleElementalistSkill(
  context: ElementalistLifecycleContext,
  skill: Skill,
): boolean {
  return scheduleGrandFinaleProfile(context, skill);
}

function applySkillAura(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (!skill.aura) return;
  const [element, rawDuration] = String(skill.aura).split("|");
  const duration = Number(rawDuration || 0);
  if (!element || !(duration > 0)) return;
  applyElementalistAura(context, {
    at: context.effectiveEnd,
    aura: `${element} Aura`,
    duration,
    skillName: skill.name,
    sourceId: skill.id,
  });
}

export function elementalistOnCastStart(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  // Aura-bearing skills grant their aura before same-time strike/condition
  // packets, so aura-triggered modifiers can affect the skill that granted it.
  applySkillAura(context, skill);
  beginElementalistGlyphCast(context, skill);
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const chain = etchingChain(skill.name);
  if (chain && skill.name === chain.etching && skillWeapon(skill) === "Spear") {
    state.etchings[chain.etching] = { stage: "lesser", otherCasts: 0 };
  }

  if (skill.name === "Grand Finale") {
    const activations = new Set(
      Object.values(state.hammerOrbActivationIds).filter(
        (value): value is string => Boolean(value),
      ),
    );
    for (const event of [...context.events]) {
      if (
        activations.has(String(event.activationId || "")) &&
        event.at >= context.start &&
        (event.type === "damage" || event.type === "condition")
      ) {
        context.replaceEvent(event, {
          type: "marker",
          cancelled: true,
          detail: "cancelled by Grand Finale",
        });
      }
    }
  }

  if (
    skillWeapon(skill) === "Spear" &&
    String(skill.slot || "") !== "Weapon_1"
  ) {
    const followup = {
      damage: state.spearNextDamageBonus,
      critical: state.spearNextGuaranteedCritical,
      control: state.spearNextControlHit,
    };
    if (followup.damage || followup.critical || followup.control) {
      state.spearFollowups[context.reservationId] = followup;
      state.spearNextDamageBonus = false;
      state.spearNextGuaranteedCritical = false;
      state.spearNextControlHit = false;
    }
  }
}

export function elementalistAfterCast(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  extendPersistingFlamesPackets(context, skill);
  const activationEvents = context.events
    .filter(
      (event) =>
        event.activationId === context.reservationId &&
        event.type === "damage" &&
        Number(event.coefficient || 0) > 0,
    )
    .sort((left, right) => left.at - right.at);

  if (skill.name === "Frigid Flurry" && state.pistolBullets.Water === true) {
    for (const [index, event] of activationEvents.entries()) {
      const replacement = context.replaceEvent(event, {
        comboFinishers: [
          {
            ownerId: "elementalist",
            attemptGroup: `runtime:${index + 1}`,
            finisherType: "Projectile",
            chance: elementalistBalanceValue(
              context,
              PROFILE.frigidFlurry,
              "procChance",
              0.2,
            ),
            ambiguousFieldSelection: "oldest",
          },
        ],
      });
      produceGw2OwnedComboEvents(
        context as unknown as SchedulerContext,
        replacement,
      );
    }
  }

  const followup = state.spearFollowups[context.reservationId];
  if (!followup) return;
  for (const event of activationEvents) {
    context.replaceEvent(event, {
      ...(followup.damage
        ? {
            coefficient:
              Number(event.coefficient || 0) *
              elementalistBalanceValue(
                context,
                PROFILE.spearEmpowerments,
                "damageMultiplier",
                1.2,
              ),
          }
        : {}),
      ...(followup.critical ? { forceCrit: true } : {}),
    });
  }
  if (followup.control && activationEvents[0]) {
    const first = activationEvents[0];
    context.emit({
      type: "control",
      at: first.at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      skillId: skill.id,
      controlKind: "crowd-control",
    });
  }
  delete state.spearFollowups[context.reservationId];
}

function applySpecialSkillProgression(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;

  if (skill.name === "Rock Barrier") {
    state.rockBarrierExpiresAt =
      at +
      elementalistBalanceValue(
        context,
        PROFILE.rockBarrier,
        "durationMultiplier",
        30,
      );
  } else if (skill.name === "Hurl") {
    state.rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsByName.get("Rock Barrier");
    if (root) {
      context.state.cooldowns.set(
        root.id,
        at +
          context.rechargeDurationFor(root, at, { rockBarrierRelease: true }),
      );
    }
  }

  const aura = AURA_TRANSMUTE_SKILLS[skill.name];
  if (aura) {
    state.activeAuras = state.activeAuras.filter(
      (candidate) => candidate.type !== aura || candidate.expiresAt <= at,
    );
  }

  if (skill.name === "Elemental Explosion") {
    const auraByAttunement: Readonly<
      Record<ElementalistAttunement, readonly [string, number]>
    > = {
      Fire: ["Fire Aura", 4],
      Water: ["Frost Aura", 4],
      Air: ["Shocking Aura", 3],
      Earth: ["Magnetic Aura", 3],
    };
    const [fallbackAura, fallbackDuration] =
      auraByAttunement[state.primaryAttunement];
    const auraEffect = profiledEffect(
      context,
      PROFILE.elementalExplosion,
      "buff",
      state.primaryAttunement,
    );
    applyElementalistAura(context, {
      at,
      aura: String(auraEffect?.kind || fallbackAura),
      duration: Number(auraEffect?.duration ?? fallbackDuration),
      skillName: skill.name,
      sourceId: skill.id,
    });
    for (const element of ELEMENTALIST_ATTUNEMENTS) {
      state.pistolBullets[element] = false;
    }
  }

  const chain = etchingChain(skill.name);
  if (chain && skill.name !== chain.etching && skillWeapon(skill) === "Spear") {
    state.etchings[chain.etching] = null;
  } else if (!chain || skill.name === chain.etching) {
    for (const candidate of ETCHING_CHAINS) {
      const progress = state.etchings[candidate.etching];
      if (!progress || progress.stage !== "lesser") continue;
      if (skill.name === candidate.etching) continue;
      const otherCasts =
        progress.otherCasts +
        (FULL_ETCHING_CHARGE_SKILLS.has(skill.name)
          ? elementalistBalanceValue(
              context,
              PROFILE.spearEmpowerments,
              "playerStacks",
              3,
            )
          : 1);
      state.etchings[candidate.etching] = {
        stage:
          otherCasts >=
          elementalistBalanceValue(
            context,
            PROFILE.spearEmpowerments,
            "maximumStacks",
            3,
          )
            ? "full"
            : "lesser",
        otherCasts,
      };
    }
  }

  if (skill.name === "Seethe") state.spearNextDamageBonus = true;
  if (skill.name === "Ripple") state.spearNextRechargeReduction = true;
  if (skill.name === "Energize") state.spearNextGuaranteedCritical = true;
  if (skill.name === "Harden") state.spearNextControlHit = true;

  if (
    state.secondaryAttunement != null &&
    skillWeapon(skill) === "Spear" &&
    String(skill.slot || "") === "Weapon_3" &&
    String(skill.attunement || "").includes("+") &&
    state.primaryAttunement !== state.secondaryAttunement
  ) {
    setElementalistAttunementReadyAt(context, state.primaryAttunement, at);
  }

  if (Number(skill.resourceGain || 0) > 0) {
    updateEndurance(
      context as unknown as ElementalistSchedulerContext,
      state,
      at,
      Boolean(context.config.boons?.vigor),
    );
    state.endurance = Math.min(
      elementalistBalanceValue(
        context,
        PROFILE.resources,
        "maximumStacks",
        100,
      ),
      state.endurance + Number(skill.resourceGain),
    );
  }

  if (
    skill.name === "Signet of Fire" &&
    !hasTrait(context, "Written in Stone")
  ) {
    state.signetOfFireDisabledUntil = Number(context.rechargeReadyAt || at);
    context.emit({
      type: "elementalist.signet-fire",
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      disabledUntil: state.signetOfFireDisabledUntil,
    });
  }
}

export function elementalistOnCastComplete(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  completeElementalistGlyphCast(context, skill);
  completeElementalistElementalCommand(context, skill);
  const target = targetAttunement(skill);
  if (target) {
    onAttunementComplete(context, skill, target);
    // Elementalist spear etchings count attunement swaps among the three
    // completed casts required to upgrade their release skill.
    applySpecialSkillProgression(context, skill);
    return;
  }
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  applyConjureState(context, skill);
  applySpecialSkillProgression(context, skill);
  updateAutoattackChainState(context, skill, state);
  shareAttunementVariantRecharge(context, skill);
  if (skill.name === "Dodge") {
    updateEndurance(
      context as unknown as ElementalistSchedulerContext,
      state,
      context.effectiveEnd,
      Boolean(context.config.boons?.vigor),
    );
    state.endurance = Math.max(
      0,
      state.endurance -
        elementalistBalanceValue(
          context,
          PROFILE.resources,
          "resourceCost",
          DODGE_ENDURANCE_COST,
        ),
    );
    triggerEvasiveArcana(context, skill);
  }
  if (skill.name === "Arcane Echo") {
    state.arcaneEchoUntil =
      context.effectiveEnd +
      elementalistBalanceValue(
        context,
        PROFILE.arcaneEcho,
        "durationMultiplier",
        10,
      );
  } else if (
    state.arcaneEchoUntil >= context.effectiveEnd &&
    skill.type === "Weapon" &&
    Number(skill.cooldown || 0) > 0
  ) {
    state.arcaneEchoUntil = 0;
    context.state.cooldowns.set(
      skill.id,
      context.effectiveEnd +
        elementalistBalanceValue(context, PROFILE.arcaneEcho, "recharge", 1),
    );
    const arcaneEcho = context.catalog.skillsByName.get("Arcane Echo");
    if (arcaneEcho) {
      const currentReadyAt = Number(
        context.state.cooldowns.get(arcaneEcho.id) || context.effectiveEnd,
      );
      context.state.cooldowns.set(
        arcaneEcho.id,
        currentReadyAt + context.rechargeDuration,
      );
    }
  }
  if (skill.name === "Fulgor") {
    const pulse = profiledEffect(context, PROFILE.fulgor, "strike");
    const hits = Math.max(0, Math.trunc(Number(pulse?.hits ?? 6)));
    const delay = elementalistBalanceValue(
      context,
      PROFILE.fulgor,
      "initialDelay",
      0.32,
    );
    const interval = elementalistBalanceValue(
      context,
      PROFILE.fulgor,
      "pulseInterval",
      1,
    );
    for (let index = 0; index < hits; index += 1) {
      context.emit({
        type: "damage",
        at: context.start + delay + index * interval,
        source: skill.name,
        sourceId: skill.id,
        actorType: "effect",
        skillName: skill.name,
        skillId: skill.id,
        coefficient: Number(pulse?.coefficient ?? 0),
        flatStrikeBase: Number(pulse?.flatStrikeBase ?? 200),
        flatStrikePowerCoeff: Number(pulse?.flatStrikePowerCoeff ?? 0.4),
        noCrit: true,
      });
    }
  }
  applyPistolState(context, skill);
  applyHammerState(context, skill);
  applyGenericPostCast(context, skill);
}

export function observeElementalistEvent(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  observeElementalistElementalEvent(context, event);
  extendPersistingFlamesField(context, event);
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    event.type === "damage" &&
    event.actorType !== "summon" &&
    Number(event.coefficient || 0) > 0 &&
    state.shatteringStoneHitsRemaining > 0 &&
    event.at <= state.shatteringStoneUntil + context.epsilon
  ) {
    state.shatteringStoneHitsRemaining -= 1;
    if (state.shatteringStoneHitsRemaining === 0) {
      state.shatteringStoneUntil = 0;
    }
    emitProfiledCondition(
      context,
      event.at + context.epsilon,
      PROFILE.shatteringStone,
      "Triggered Bleeding",
      "Bleeding",
      1,
      5,
      "Shattering Stone",
      event.skillId ?? event.sourceId,
    );
  }
  observeElementalistTraitEvent(context, event);
}

export function advanceElementalistState(
  context: ElementalistSchedulerContext,
  at: number,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  processFreshAirCandidates(context, at);
  updateEndurance(context, state, at, Boolean(context.config.boons?.vigor));
  state.activeAuras = state.activeAuras.filter((aura) => aura.expiresAt > at);
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    if (Number(state.hammerOrbs[element] || 0) < at) {
      state.hammerOrbs[element] = null;
      state.hammerOrbGrantedBy[element] = null;
      state.hammerOrbActivationIds[element] = null;
    }
  }
  for (const [weapon, expiresAt] of Object.entries(state.conjurePickups)) {
    if (expiresAt < at) delete state.conjurePickups[weapon];
  }
  if (state.shatteringStoneUntil < at) {
    state.shatteringStoneUntil = 0;
    state.shatteringStoneHitsRemaining = 0;
  }
  if (state.dazingDischargeUntil < at) state.dazingDischargeUntil = 0;
  if (state.rockBarrierExpiresAt > 0 && state.rockBarrierExpiresAt <= at) {
    const expiresAt = state.rockBarrierExpiresAt;
    state.rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsByName.get("Rock Barrier");
    if (root) {
      context.state.cooldowns.set(
        root.id,
        expiresAt +
          context.rechargeDurationFor(root, expiresAt, {
            rockBarrierRelease: true,
          }),
      );
      delete state.autoattackChains[Number(root.id)];
    }
  }
}

export function modifyElementalistRechargeDuration(
  context: ElementalistSchedulerContext & { skill?: Skill },
  duration: number,
): number {
  const skill = context.skill;
  if (!skill) return duration;
  if (skill.name === "Glyph of Elementals") return 0;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = Number(
    (context as unknown as SchedulerRecord).start ?? context.state.time ?? 0,
  );
  if (
    skill.name === "Rock Barrier" &&
    !(context as unknown as SchedulerRecord).rockBarrierRelease
  ) {
    return 0;
  }
  if (skill.type !== "Weapon") {
    return (skill.overload || skill.skillFamily === "Jade Sphere") &&
      hasTrait(context, "Elemental Enchantment")
      ? duration *
          elementalistBalanceValue(
            context,
            PROFILE.elementalEnchantment,
            "rechargeMultiplier",
            0.85,
          )
      : duration;
  }
  let adjustedDuration = duration;
  let weaponRechargeMultiplier = 1;
  if (
    state.spearNextRechargeReduction &&
    skillWeapon(skill) === "Spear" &&
    String(skill.slot || "") !== "Weapon_1"
  ) {
    weaponRechargeMultiplier *= elementalistBalanceValue(
      context,
      PROFILE.spearEmpowerments,
      "rechargeMultiplier",
      0.67,
    );
    state.spearNextRechargeReduction = false;
  }
  if (
    state.dazingDischargeUntil > at &&
    skillWeapon(skill) === "Pistol" &&
    String(skill.slot || "") !== "Weapon_1"
  ) {
    weaponRechargeMultiplier *= elementalistBalanceValue(
      context,
      PROFILE.dazingDischarge,
      "rechargeMultiplier",
      0.67,
    );
    state.dazingDischargeUntil = 0;
  }
  adjustedDuration *= Math.max(0, weaponRechargeMultiplier);
  if (skill.name === "Purblinding Plasma" && state.pistolBullets.Air) {
    adjustedDuration *= elementalistBalanceValue(
      context,
      PROFILE.purblindingPlasma,
      "rechargeMultiplier",
      2 / 3,
    );
  }
  if (skill.name === "Ride the Lightning") {
    adjustedDuration *= elementalistBalanceValue(
      context,
      PROFILE.rideTheLightning,
      "rechargeMultiplier",
      0.5,
    );
  }
  const attunement = String(skill.attunement || "");
  if (
    (attunement === "Fire" && hasTrait(context, "Pyromancer's Training")) ||
    (attunement === "Air" && hasTrait(context, "Aeromancer's Training")) ||
    (attunement === "Earth" && hasTrait(context, "Geomancer's Training")) ||
    (attunement === "Water" && hasTrait(context, "Aquamancer's Training")) ||
    (String(skill.slot) === "Weapon_3" &&
      attunement.includes("+") &&
      hasTrait(context, "Flow State"))
  ) {
    const profileId =
      attunement === "Fire"
        ? PROFILE.pyromancersTraining
        : attunement === "Air"
          ? PROFILE.aeromancersTraining
          : attunement === "Earth"
            ? PROFILE.geomancersTraining
            : attunement === "Water"
              ? PROFILE.aquamancersTraining
              : TRAIT.FLOW_STATE;
    adjustedDuration *= elementalistBalanceValue(
      context,
      profileId,
      "rechargeMultiplier",
      0.8,
    );
  }
  return adjustedDuration;
}

export const elementalistCoreCastRules = Object.freeze({
  availability: {
    id: "elementalist.core-availability",
    order: 10,
    handler: elementalistCoreAvailability,
  },
  modifyRechargeDuration: modifyElementalistRechargeDuration,
});

export const elementalistCoreSchedulerHooks = Object.freeze({
  taskHandlers: elementalistElementalTaskHandlers,
  prepareEvent: {
    id: "elementalist.hitbox",
    order: 10,
    handler: prepareElementalistHitboxEvent,
  },
  onCastStart: {
    id: "elementalist.core-cast-start",
    order: 10,
    handler: elementalistOnCastStart,
  },
  scheduleSkill: {
    id: "elementalist.special-skill-profile",
    order: 10,
    handler: scheduleElementalistSkill,
  },
  afterCast: {
    id: "elementalist.core-after-cast",
    order: 10,
    handler: elementalistAfterCast,
  },
  advance: {
    id: "elementalist.core-state",
    order: 10,
    handler: advanceElementalistState,
  },
  onEventScheduled: {
    id: "elementalist.combos-and-fresh-air",
    order: 10,
    handler: observeElementalistEvent,
  },
  onCastComplete: {
    id: "elementalist.core-cast-complete",
    order: 10,
    handler: elementalistOnCastComplete,
  },
  onCooldownReset: {
    id: "elementalist.attunement-cooldown-reset",
    order: 10,
    handler: resetElementalistAttunementCooldowns,
  },
});
