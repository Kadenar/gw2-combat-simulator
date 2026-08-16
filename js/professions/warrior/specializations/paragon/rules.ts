import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import {
  advanceParagon,
  beginParagonCast,
  handleParagonCommandEchoTask,
  observeParagonEvent,
  updateParagonCast,
} from "./traits.js";

export const paragonSchedulerHooks = Object.freeze({
  onCastStart: beginParagonCast,
  advance: {
    id: "warrior.paragon-refrain",
    order: 20,
    handler: advanceParagon,
  },
  afterCast: {
    id: "warrior.paragon-motivation",
    order: 20,
    handler: updateParagonCast,
  },
  onEventScheduled: {
    id: "warrior.paragon-call-to-action",
    order: 20,
    handler: observeParagonEvent,
  },
  taskHandlers: Object.freeze({
    "warrior.paragon-command-echo": handleParagonCommandEchoTask,
  }),
});

function paragonRuntimeState(context: Gw2ModifierContext): {
  motivation?: number;
  activeRefrain?: string;
} {
  const specialization = (
    context.runtime as
      | {
          profession?: {
            specialization?: {
              kind?: string;
              state?: { motivation?: number; activeRefrain?: string };
            };
          };
        }
      | undefined
  )?.profession?.specialization;
  return specialization?.kind === "Paragon" ? specialization.state || {} : {};
}

function motivation(context: Gw2ModifierContext): number {
  return Number(paragonRuntimeState(context).motivation || 0);
}

function briskPacingAmount(
  context: Gw2ModifierContext,
  target: string,
): number {
  const current = motivation(context);
  if (current <= 0) return 0;
  const strike = current >= 7 ? 0.3 : current >= 4 ? 0.2 : 0.1;
  const condition = current >= 7 ? 0.25 : current >= 4 ? 0.15 : 0.05;
  return target === MODIFIER_TARGET.CONDITION_DAMAGE ? condition : strike;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.strengthening-stanzas",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (_context, target) =>
      target === MODIFIER_TARGET.CONDITION_DAMAGE ? 0.1 : 0.15,
    when: (context) =>
      hasTrait(context, TRAIT.STRENGTHENING_STANZAS) &&
      paragonRuntimeState(context).activeRefrain === "Chant of Action",
  },
  {
    id: "warrior.brisk-pacing",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: briskPacingAmount,
    when: (context) =>
      hasTrait(context, TRAIT.BRISK_PACING) && motivation(context) > 0,
  },
]);

function modifyAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  // Skip when attributes have already been pre-computed in the static pass to
  // prevent the concentration bonus from being applied twice.
  if (
    !hasTrait(context, TRAIT.INSPIRING_IMPLEMENTS) ||
    professionStaticRulesApplied(context.config)
  ) {
    return attributes;
  }
  return {
    ...attributes,
    concentration: Number(attributes.concentration || 0) + 180,
  };
}

export const paragonAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules,
});
