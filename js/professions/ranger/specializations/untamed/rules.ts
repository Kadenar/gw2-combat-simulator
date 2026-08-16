import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { isGw2PlayerModifierOwnedEvent } from "../../../../platform/gw2/event-ownership.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  RangerCastContext,
  RangerPrecastContext,
  RangerSkill,
} from "../../types.js";
import { untamedState } from "./state.js";

const BLINDING_OUTBURST_SKILL_IDS = new Set<number>([
  ID.VENOMOUS_OUTBURST,
  ID.RELENTLESS_WHIRL,
  ID.DEFT_STRIKE,
]);

function deny(
  skill: RangerSkill,
  code: string,
  cause: string,
): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`,
  };
}

export function untamedCastAvailability(
  context: RangerPrecastContext,
  skill: RangerSkill,
): AvailabilityResult {
  const state = untamedState.from(context);
  if (skill.name === "Unleash Ranger" && state.rangerUnleashed) {
    return deny(
      skill,
      "ranger.ranger-unleashed",
      "the ranger is already unleashed.",
    );
  }
  if (skill.name === "Unleash Pet" && !state.rangerUnleashed) {
    return deny(skill, "ranger.pet-unleashed", "the pet is already unleashed.");
  }
  if (skill.unleashedPetSkill && state.rangerUnleashed) {
    return deny(skill, "ranger.pet-not-unleashed", "Unleash Pet first.");
  }
  if (skill.unleashedAmbushSkill) {
    if (!state.rangerUnleashed) {
      return deny(skill, "ranger.not-unleashed", "Unleash Ranger first.");
    }
    // ambushReadyUntil is a deadline, not a cooldown: the window closes when time reaches it.
    if (context.start >= state.ambushReadyUntil - context.epsilon) {
      return deny(
        skill,
        "ranger.ambush-unavailable",
        "unleash to make an ambush available.",
      );
    }
  }
  return { ready: true };
}

// Modifier context does not carry typed profession state, so we navigate the runtime via cast.
function rangerUnleashed(context: Gw2ModifierContext): boolean {
  const profession = context.runtime?.profession as
    | {
        specialization?: {
          kind?: string;
          state?: { rangerUnleashed?: boolean };
        };
      }
    | undefined;
  return (
    profession?.specialization?.kind === "Untamed" &&
    profession.specialization.state?.rangerUnleashed === true
  );
}

export const untamedModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "ranger.vow-of-the-untamed",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      // Pet strikes don't benefit from Vow even when Ranger is unleashed.
      context.event?.source !== "ranger-pet" &&
      rangerUnleashed(context) &&
      hasTrait(context, TRAIT.VOW_OF_THE_UNTAMED),
  },
  {
    id: "ranger.blinding-outburst",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.25,
    when: (context) =>
      hasTrait(context, TRAIT.BLINDING_OUTBURST) &&
      BLINDING_OUTBURST_SKILL_IDS.has(
        Number(context.event?.skillId ?? context.skillId),
      ),
  },
  {
    id: "ranger.ferocious-symbiosis",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => {
      const state = (
        context.runtime as
          | {
              profession?: {
                specialization?: {
                  kind?: string;
                  state?: {
                    ferociousSymbiosisPlayerStacks?: number;
                    ferociousSymbiosisPlayerUntil?: number;
                    ferociousSymbiosisPetStacks?: number;
                    ferociousSymbiosisPetUntil?: number;
                  };
                };
              };
            }
          | undefined
      )?.profession?.specialization;
      if (state?.kind !== "Untamed") return 1;
      const pet = context.event?.source === "ranger-pet";
      // Pet strikes use Pet stacks; player strikes use Player stacks (each built by the other).
      const stacks = pet
        ? context.time < Number(state.state?.ferociousSymbiosisPetUntil || 0)
          ? Number(state.state?.ferociousSymbiosisPetStacks || 0)
          : 0
        : context.time < Number(state.state?.ferociousSymbiosisPlayerUntil || 0)
          ? Number(state.state?.ferociousSymbiosisPlayerStacks || 0)
          : 0;
      return 1 + Math.min(5, stacks) * 0.05;
    },
    when: (context) =>
      hasTrait(context, TRAIT.FEROCIOUS_SYMBIOSIS) &&
      (isGw2PlayerModifierOwnedEvent(context.event) ||
        context.event?.source === "ranger-pet"),
  },
]);

export const untamedAttributeRules = Object.freeze({
  modifierRules: untamedModifierRules,
});
export const untamedCastRules = Object.freeze({
  availability: {
    id: "ranger.untamed-availability",
    order: 20,
    handler: untamedCastAvailability,
  },
});

export const untamedSchedulerHooks = Object.freeze({
  onCastComplete(context: RangerCastContext, skill: RangerSkill): void {
    if (skill.id === ID.UNLEASH_RANGER || skill.id === ID.UNLEASH_PET) {
      // The F5 flip is a fixed one-second shared recharge, independent of
      // Alacrity.
      const readyAt = context.start + 1;
      context.state.cooldowns.set(ID.UNLEASH_RANGER, readyAt);
      context.state.cooldowns.set(ID.UNLEASH_PET, readyAt);
      context.replaceEvent(context.action, { rechargeReadyAt: readyAt });
    }
    if (
      skill.id !== ID.SWAP_WEAPONS ||
      !hasTrait(context, TRAIT.LET_LOOSE) ||
      // Pre-combat weapon swaps don't trigger Let Loose; only in-combat swaps count.
      context.combatStartTime == null ||
      context.start < context.combatStartTime
    ) {
      return;
    }
    const state = untamedState.from(context);
    if (context.start + context.epsilon < state.letLooseReadyAt) return;
    state.letLooseReadyAt = context.start + 9;
    // Weapon swap resets Unleashed Power so the next Unleash Ranger re-opens an ambush window.
    state.unleashedPowerReadyAt = 0;
    if (state.rangerUnleashed) {
      // Weapon-swap ambush window is counted from effectiveEnd (post-cast), not cast start.
      state.ambushReadyUntil = context.effectiveEnd + 4;
    }
  },
});
