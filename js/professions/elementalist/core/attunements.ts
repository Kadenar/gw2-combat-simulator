import { hasTrait as hasGw2Trait } from "../../../platform/gw2/trait-state.js";
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from "../data/ids.js";
import type { SchedulerRecord, Skill } from "../../../platform/engine/types.js";
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext,
} from "../types.js";
import {
  ELEMENTALIST_ATTUNEMENTS,
  elementalistCoreState,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement,
} from "./state.js";
import {
  ATTUNEMENT_RECHARGE_SECONDS,
  DUAL_ATTUNEMENT_RECHARGE_SECONDS,
  OFF_ATTUNEMENT_RECHARGE_SECONDS,
} from "./constants.js";
import {
  combatStarted,
  emitBuff,
  emitProfiledBuff,
  profiledEffect,
} from "./mechanics.js";
import {
  grantElementalAttunementBoon,
  grantElementalistRockSolid,
  triggerElementalistBountifulPower,
  triggerElementalistEarthenBlast,
  triggerElementalistElectricDischarge,
  triggerElementalistFlameExpulsion,
  triggerElementalistSunspot,
} from "./traits.js";
import {
  inFlightAutoattackCarryover,
  progressedAutoattackCarryover,
} from "./weapon-state.js";
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceValue,
} from "./profiles.js";

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

export function projectedFreshAirReadyAt(
  context: ElementalistCastContext,
  upTo: number,
): number | null {
  if (!hasTrait(context, "Fresh Air")) return null;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (state.primaryAttunement === "Air") return null;
  let progress = state.freshAirProgress;
  const candidates = [...state.freshAirCandidates].sort(
    (left, right) => left.at - right.at,
  );
  for (const candidate of candidates) {
    if (candidate.at > upTo + context.epsilon) break;
    progress += candidate.criticalChance;
    if (progress + context.epsilon >= 1) return candidate.at;
  }
  return null;
}

export function targetAttunement(skill: Skill): ElementalistAttunement | null {
  const candidate = skill.name.replace(/ Attunement$/, "");
  return ELEMENTALIST_ATTUNEMENTS.includes(candidate as ElementalistAttunement)
    ? (candidate as ElementalistAttunement)
    : null;
}

export function elementalistAlacrityAdjustedDuration(
  context: ElementalistLifecycleContext,
  seconds: number,
): number {
  return context.config.boons?.alacrity ? seconds / 1.25 : seconds;
}

export function elementalistAttunementRechargeDuration(
  context: ElementalistLifecycleContext,
  seconds: number,
): number {
  let adjusted = seconds;
  if (hasTrait(context, "Flow State")) {
    adjusted = Math.max(
      0,
      adjusted -
        elementalistBalanceValue(
          context,
          TRAIT.FLOW_STATE,
          "rechargeReduction",
          1,
        ),
    );
  }
  if (hasTrait(context, "Elemental Enchantment")) {
    adjusted *= elementalistBalanceValue(
      context,
      PROFILE.elementalEnchantment,
      "rechargeMultiplier",
      0.85,
    );
  }
  return elementalistAlacrityAdjustedDuration(context, adjusted);
}

export function onAttunementComplete(
  context: ElementalistLifecycleContext,
  skill: Skill,
  target: ElementalistAttunement,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  const previous = state.primaryAttunement;
  const attunementReadyAtBefore = { ...state.attunementReadyAt };
  state.autoattackCarryover = progressedAutoattackCarryover(
    context,
    state,
    previous,
  );
  state.pendingAutoattackCarryover = state.autoattackCarryover
    ? null
    : inFlightAutoattackCarryover(context, previous);
  const dualAttunement = state.secondaryAttunement !== null;
  if (dualAttunement) {
    state.secondaryAttunement = state.primaryAttunement;
    state.primaryAttunement = target;
    const recharge = elementalistAttunementRechargeDuration(
      context,
      elementalistBalanceValue(
        context,
        PROFILE.resources,
        "durationMultiplier",
        DUAL_ATTUNEMENT_RECHARGE_SECONDS,
      ),
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      setElementalistAttunementReadyAt(context, attunement, at + recharge);
    }
  } else {
    state.primaryAttunement = target;
    state.secondaryAttunement = null;
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        state.attunementReadyAt[previous],
        at +
          elementalistAttunementRechargeDuration(
            context,
            elementalistBalanceValue(
              context,
              PROFILE.resources,
              "recharge",
              ATTUNEMENT_RECHARGE_SECONDS,
            ),
          ),
      ),
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      if (attunement === target || attunement === previous) continue;
      const existingReadyAt = state.attunementReadyAt[attunement];
      const defaultReadyAt =
        at +
        elementalistAttunementRechargeDuration(
          context,
          elementalistBalanceValue(
            context,
            PROFILE.resources,
            "initialDelay",
            OFF_ATTUNEMENT_RECHARGE_SECONDS,
          ),
        );
      let nextReadyAt = Math.max(existingReadyAt, defaultReadyAt);
      if (attunement === "Air" && hasTrait(context, "Fresh Air")) {
        const freshAirReadyAt = projectedFreshAirReadyAt(
          context as unknown as ElementalistCastContext,
          nextReadyAt,
        );
        if (freshAirReadyAt != null) {
          nextReadyAt = Math.min(nextReadyAt, freshAirReadyAt);
        }
      }
      setElementalistAttunementReadyAt(context, attunement, nextReadyAt);
    }
  }
  state.attunementEnteredAt = at;
  context.emit({
    type: "elementalist.attunement",
    at,
    priority: -20,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    commandIndex: context.commandIndex,
    from: previous,
    to: target,
    secondaryAttunement: state.secondaryAttunement,
    attunementReadyAtBefore,
  });
  context.emit({
    type: "sigil_swap",
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
  });
  if (!combatStarted(context, at)) return;
  if (previous === "Fire" && target !== "Fire") {
    triggerElementalistFlameExpulsion(context, at, skill.id);
  }
  if (target === "Fire") triggerElementalistSunspot(context, at, skill.id);
  if (target === "Air") {
    triggerElementalistElectricDischarge(context, at, skill.id);
    if (previous !== "Air" && hasTrait(context, "Fresh Air")) {
      state.freshAirLastResetAt = at;
      const freshAir = profiledEffect(context, PROFILE.freshAir, "buff");
      emitBuff(
        context,
        at,
        "Fresh Air",
        Number(freshAir?.stacks ?? 1),
        Number(freshAir?.duration ?? 5),
        skill.name,
        skill.id,
        -10,
      );
    }
    if (hasTrait(context, "One with Air")) {
      emitProfiledBuff(
        context,
        at,
        PROFILE.oneWithAir,
        "Superspeed",
        "Superspeed",
        1,
        3,
        skill.name,
        skill.id,
      );
    }
    if (hasTrait(context, "Inscription")) {
      emitProfiledBuff(
        context,
        at,
        PROFILE.inscription,
        "Air Entry",
        "Resistance",
        1,
        3,
        skill.name,
        skill.id,
      );
    }
  }
  if (target === "Water" && hasTrait(context, "Latent Stamina")) {
    const readyAt = Number(state.procReadyAt.latentStamina || 0);
    if (readyAt <= at + context.epsilon) {
      state.procReadyAt.latentStamina =
        at +
        elementalistBalanceValue(
          context,
          TRAIT.LATENT_STAMINA,
          "internalCooldown",
          10,
        );
      emitProfiledBuff(
        context,
        at,
        TRAIT.LATENT_STAMINA,
        "Vigor",
        "Vigor",
        1,
        3,
        "Latent Stamina",
        skill.id,
      );
    }
  }
  if (target === "Earth") {
    triggerElementalistEarthenBlast(context, at, skill.id);
    grantElementalistRockSolid(context, at, skill.id);
  }
  if (hasTrait(context, "Arcane Prowess")) {
    emitProfiledBuff(
      context,
      at,
      PROFILE.arcaneProwess,
      "Might",
      "Might",
      1,
      8,
      "Arcane Prowess",
      skill.id,
    );
  }
  if (!dualAttunement || target !== previous) {
    grantElementalAttunementBoon(context, at, target, skill.id);
  }
  if (!dualAttunement) {
    triggerElementalistBountifulPower(context, at, 1, skill.id);
  }
}
