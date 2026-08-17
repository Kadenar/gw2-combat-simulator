import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import { warriorBalanceProfile } from "../../core/profiles.js";
import type { WarriorSchedulerContext } from "../../types.js";
import { paragonState } from "./state.js";
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from "./profiles.js";
import {
  advanceParagon,
  beginParagonCast,
  handleParagonCommandEchoTask,
  observeParagonEvent,
  updateParagonCast,
} from "./traits.js";

export const paragonSchedulerHooks = Object.freeze({
  initialize: (context: WarriorSchedulerContext) => {
    const state = paragonState.from(context);
    state.maximumMotivation = Number(
      warriorBalanceProfile(context, PROFILE.resources)?.maximumStacks ?? 10,
    );
    state.motivation = Math.min(state.maximumMotivation, state.motivation);
  },
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
  parameters: Readonly<Record<string, number>>,
): number {
  const current = motivation(context);
  if (current <= 0) return 0;
  const strike =
    current >= parameters.highThreshold
      ? parameters.strikeHigh
      : current >= parameters.middleThreshold
        ? parameters.strikeMiddle
        : parameters.strikeLow;
  const condition =
    current >= parameters.highThreshold
      ? parameters.conditionHigh
      : current >= parameters.middleThreshold
        ? parameters.conditionMiddle
        : parameters.conditionLow;
  return target === MODIFIER_TARGET.CONDITION_DAMAGE ? condition : strike;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.strengthening-stanzas",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    parameters: {
      strikeBonus: 0.15,
      conditionBonus: 0.1,
    } as Readonly<Record<string, number>>,
    amount: (_context, target, parameters) =>
      target === MODIFIER_TARGET.CONDITION_DAMAGE
        ? parameters.conditionBonus
        : parameters.strikeBonus,
    when: (context) =>
      hasTrait(context, TRAIT.STRENGTHENING_STANZAS) &&
      paragonRuntimeState(context).activeRefrain === "Chant of Action",
  },
  {
    id: "warrior.brisk-pacing",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    parameters: {
      middleThreshold: 4,
      highThreshold: 7,
      strikeLow: 0.1,
      strikeMiddle: 0.2,
      strikeHigh: 0.3,
      conditionLow: 0.05,
      conditionMiddle: 0.15,
      conditionHigh: 0.25,
    } as Readonly<Record<string, number>>,
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
    concentration:
      Number(attributes.concentration || 0) +
      Number(
        warriorBalanceProfile(context, PROFILE.inspiringImplements)
          ?.attributeBonus ?? 180,
      ),
  };
}

export const paragonAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules,
});
