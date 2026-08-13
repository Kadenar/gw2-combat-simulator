import { attributeProvenance } from "../../../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { GUARDIAN_TRAIT_IDS } from "../../data/ids.js";
import { guardianBoonActive } from "../../core/rules.js";
import {
  advanceTomeState,
  tomePageAvailability,
  validateTomeCast,
} from "./tomes.js";
import {
  observeFirebrandScheduledEvent,
  updateFirebrandCastState,
} from "./traits.js";
import {
  advanceFirebrandMantras,
  completeFirebrandMantra,
  firebrandMantraAvailability,
  initializeFirebrandMantras,
} from "./mantras.js";
import type {
  Gw2ModifierContext,
  Gw2ResolvedStats,
} from "../../../../platform/gw2/types.js";

function modifyFirebrandAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.IMBUED_HASTE)) {
    return attributes;
  }
  const result = { ...attributes };
  const staticApplied = attributeProvenance(
    context.config,
  ).professionStaticRulesApplied;
  const runtimeActive = guardianBoonActive(context, "quickness");
  const staticallyActive =
    staticApplied && Boolean(context.config?.boons?.quickness);
  const delta = (Number(runtimeActive) - Number(staticallyActive)) * 250;
  result.conditionDamage += delta;
  result.healingPower += delta;
  result.vitality += delta;
  return result;
}

export const firebrandAttributeRules = Object.freeze({
  modifyAttributes: modifyFirebrandAttributes,
});

export const firebrandCastRules = Object.freeze({
  availability: Object.freeze([
    {
      id: "guardian.firebrand.mantras",
      order: 20,
      handler: firebrandMantraAvailability,
    },
    {
      id: "guardian.tome-pages",
      order: 30,
      handler: tomePageAvailability,
    },
  ]),
  validateCast: Object.freeze([
    {
      id: "guardian.tomes",
      order: 30,
      handler: validateTomeCast,
    },
  ]),
});

export const firebrandSchedulerHooks = Object.freeze({
  initialize: Object.freeze([
    {
      id: "guardian.firebrand.mantras",
      order: 10,
      handler: initializeFirebrandMantras,
    },
  ]),
  advance: Object.freeze([
    {
      id: "guardian.firebrand.mantras",
      order: 5,
      handler: advanceFirebrandMantras,
    },
    {
      id: "guardian.tomes",
      order: 10,
      handler: advanceTomeState,
    },
  ]),
  afterCast: Object.freeze([
    {
      id: "guardian.firebrand.traits",
      order: 30,
      handler: updateFirebrandCastState,
    },
  ]),
  onCastComplete: Object.freeze([
    {
      id: "guardian.firebrand.mantras",
      order: 20,
      handler: completeFirebrandMantra,
    },
  ]),
  onEventScheduled: Object.freeze([
    {
      id: "guardian.firebrand.traits",
      order: 20,
      handler: observeFirebrandScheduledEvent,
    },
  ]),
});
