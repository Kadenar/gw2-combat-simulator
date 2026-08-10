import { MESMER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { illusionSource, timedActive } from "../../core/rules.js";
import { initializeTroubadourRuntime } from "./runtime.js";
import type { SimulationEvent } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2ResolvedStats,
} from "../../../../platform/gw2/types.js";

const EPSILON = 0.0001;
const EMPTY_EVENTS: readonly SimulationEvent[] = Object.freeze([]);
const instrumentEventIndex = new WeakMap<
  readonly SimulationEvent[],
  readonly SimulationEvent[]
>();

function instrumentEvents(
  context: Gw2ModifierContext,
): readonly SimulationEvent[] {
  const events = context.events;
  if (!Array.isArray(events)) return EMPTY_EVENTS;
  let indexed = instrumentEventIndex.get(events);
  if (!indexed) {
    indexed = events.filter((event) => event.type === "mesmer.instrument");
    instrumentEventIndex.set(events, indexed);
  }
  return indexed;
}

function instrumentChecksEnabled(context: Gw2ModifierContext): boolean {
  const specialization = context.config?.specialization;
  return !specialization || specialization === "Troubadour";
}

function activeInstrumentCount(context: Gw2ModifierContext): number {
  if (!instrumentChecksEnabled(context)) return 0;
  const active = new Set<string>();
  for (const event of instrumentEvents(context)) {
    if (
      event.at <= context.time + EPSILON &&
      Number(event.expiresAt || 0) > context.time
    ) {
      active.add(String(event.instrument || ""));
    }
  }
  return active.size;
}

function hasLute(context: Gw2ModifierContext): boolean {
  if (!instrumentChecksEnabled(context)) return false;
  return instrumentEvents(context).some(
    (event) =>
      event.instrument === "Lute" &&
      event.at <= context.time + EPSILON &&
      Number(event.expiresAt || 0) > context.time,
  );
}

export function applyTroubadourAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  const instrumentCount = hasTrait(context, TRAIT.FORTISSIMO)
    ? activeInstrumentCount(context)
    : 0;
  const fortissimo = instrumentCount ? 1 + instrumentCount * 0.04 : 1;
  if (fortissimo === 1) return attributes;
  return {
    ...attributes,
    power: Number(attributes.power || 0) * fortissimo,
    precision: Number(attributes.precision || 0) * fortissimo,
    toughness: Number(attributes.toughness || 0) * fortissimo,
    vitality: Number(attributes.vitality || 0) * fortissimo,
    ferocity: Number(attributes.ferocity || 0) * fortissimo,
    conditionDamage: Number(attributes.conditionDamage || 0) * fortissimo,
    expertise: Number(attributes.expertise || 0) * fortissimo,
    concentration: Number(attributes.concentration || 0) * fortissimo,
    healingPower: Number(attributes.healingPower || 0) * fortissimo,
  };
}

export const troubadourModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "mesmer.lute",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.1,
      when: hasLute,
    },
    {
      id: "mesmer.shredding",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.15,
      when: (context) =>
        hasTrait(context, TRAIT.SHREDDING) &&
        hasLute(context) &&
        !illusionSource(context),
    },
    {
      id: "mesmer.altered-chord",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.25,
      when: (context) =>
        timedActive(context, "altered-chord") && !illusionSource(context),
    },
  ]);

export const troubadourAttributeRules = Object.freeze({
  modifyAttributes: applyTroubadourAttributes,
  modifierRules: troubadourModifierRules,
});

export const troubadourSchedulerHooks = Object.freeze({
  initialize: initializeTroubadourRuntime,
});
