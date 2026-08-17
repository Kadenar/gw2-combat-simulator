import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import {
  gw2BoonDurationMultiplier,
  gw2SigilSet,
  gw2StatsForWeaponSet,
} from "../../../../platform/gw2/runtime-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { activeBoonStacks, playerStrike } from "../../core/rule-helpers.js";
import { hasEngineerTrait } from "../../core/state.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  SchedulerRecord,
  SimulationEvent,
} from "../../../../platform/engine/types.js";
import type {
  EngineerMaximumAmmoContext,
  EngineerSchedulerContext,
} from "../../types.js";
import { SCRAPPER_KINETIC_ACCELERATORS } from "./mechanics.js";
import { scrapperState } from "./state.js";
import { applyScrapperCastTraits } from "./traits.js";

function kineticAcceleratorsTriggerAllowed(
  context: EngineerSchedulerContext,
  event: SimulationEvent,
): boolean {
  if (
    !hasEngineerTrait(context.config, TRAIT.KINETIC_ACCELERATORS) ||
    event.type !== "combo" ||
    event.schedulerPrediction !== "combo-result" ||
    !["Blast", "Leap", "Whirl"].includes(String(event.finisherType))
  ) {
    return false;
  }
  if (event.finisherType !== "Whirl") return true;
  const state = scrapperState.from(context);
  if (state.kineticAcceleratorsWhirlReadyAt > event.at + context.epsilon) {
    return false;
  }
  state.kineticAcceleratorsWhirlReadyAt =
    event.at + SCRAPPER_KINETIC_ACCELERATORS.whirlInternalCooldown;
  return true;
}

function observeScrapperScheduledEvent(
  context: EngineerSchedulerContext,
  event: SimulationEvent,
): void {
  if (!kineticAcceleratorsTriggerAllowed(context, event)) return;
  const weaponSet = context.state.activeWeaponSet;
  const stats = gw2StatsForWeaponSet(context.config, weaponSet);
  const sigils = gw2SigilSet(context.config, weaponSet);
  const emitBoon = (
    kind: string,
    baseDuration: number,
    stacks: number,
  ): void => {
    // Keep this as a canonical buff event: the scheduler needs it for cast
    // timing and the result timeline needs it for effects-over-time graphs.
    context.emitDerived(event, {
      type: "buff",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.KINETIC_ACCELERATORS,
      actorType: "effect",
      skillId: event.skillId,
      skillName: event.skillName,
      name: `Kinetic Accelerators — ${kind}`,
      kind,
      duration: baseDuration * gw2BoonDurationMultiplier(kind, stats, sigils),
      stacks,
      recipients: "party",
    });
  };
  emitBoon("quickness", SCRAPPER_KINETIC_ACCELERATORS.quicknessDuration, 1);
  emitBoon(
    "might",
    SCRAPPER_KINETIC_ACCELERATORS.mightDuration,
    SCRAPPER_KINETIC_ACCELERATORS.mightStacks,
  );
}

export const scrapperSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: "engineer.kinetic-accelerators",
    order: 30,
    handler: observeScrapperScheduledEvent,
  },
  // order 30 runs after core engineer hooks (10/20) but before any finisher hooks
  afterCast: {
    id: "engineer.scrapper-traits",
    order: 30,
    handler: applyScrapperCastTraits,
  },
});

export const scrapperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    // Object in Motion: +5% strike damage per active movement boon (stability/swiftness/superspeed).
    // Multiplicative — three boons = 1.05^3 ≈ +15.8%.
    id: "engineer.object-in-motion",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => {
      const count = ["stability", "swiftness", "superspeed"].filter(
        (kind) => activeBoonStacks(context, kind, 1) > 0,
      ).length;
      return 1.05 ** count;
    },
    when: (context) =>
      playerStrike(context) && hasTrait(context, TRAIT.OBJECT_IN_MOTION),
  },
]);

// Applied Force (GM trait): each might stack (capped at 25) adds 30 flat power at cast time.
function modifyScrapperAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  if (!hasTrait(context, TRAIT.APPLIED_FORCE)) return attributes;
  return {
    ...attributes,
    power:
      Number(attributes.power || 0) +
      activeBoonStacks(context, "might", 25) * 30,
  };
}

// Ex Machina (adept trait): Function Gyro gets a minimum of 2 ammo charges.
function modifyScrapperMaximumAmmo(
  context: EngineerMaximumAmmoContext,
  maximum: number,
): number {
  return context.skill?.name === "Function Gyro" &&
    hasEngineerTrait(context.config, TRAIT.EX_MACHINA)
    ? Math.max(2, Number(maximum || 0))
    : maximum;
}

export const scrapperAttributeRules = Object.freeze({
  modifyAttributes: modifyScrapperAttributes,
  modifierRules: scrapperModifierRules,
});

export const scrapperCastRules = Object.freeze({
  modifyMaximumAmmo: modifyScrapperMaximumAmmo,
});
