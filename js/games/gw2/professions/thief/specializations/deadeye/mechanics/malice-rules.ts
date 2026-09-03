import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/state/boons.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefEventSkill, thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/traits/modifiers.js';
import { deadeyeCastAvailability } from '#gw2/professions/thief/specializations/deadeye/mechanics/availability.js';
import {
  initializeDeadeyeMalice,
  observeDeadeyeScheduledEvent,
  updateDeadeyeCastState
} from '#gw2/professions/thief/specializations/deadeye/mechanics/malice.js';
import { deadeyeTaskHandlers } from '#gw2/professions/thief/specializations/deadeye/mechanics/task-handlers.js';
import type { ThiefSimulationEvent } from '#gw2/professions/thief/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';

import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

export const deadeyeSchedulerHooks = Object.freeze({
  initialize: {
    id: 'thief.deadeye-critical-facts',
    order: 10,
    handler: initializeDeadeyeMalice
  },
  afterCast: Object.freeze([
    {
      id: 'thief.deadeye-malice',
      order: 30,
      handler: updateDeadeyeCastState
    }
  ]),
  onEventScheduled: {
    id: 'thief.deadeye-malice-hit',
    order: 20,
    handler: observeDeadeyeScheduledEvent
  },
  taskHandlers: deadeyeTaskHandlers
});

const SHADOW_FLARE_SKILL_IDS: ReadonlySet<number> = new Set([ID.SHADOW_FLARE, ID.SHADOW_SWAP]);
const MALICIOUS_DAMAGE_SCALING_SKILL_IDS: ReadonlySet<number> = new Set([
  ID.MALICIOUS_BACKSTAB,
  ID.MALICIOUS_DEATHS_JUDGMENT
]);

function activeBoonCount(context: Gw2ModifierContext): number {
  return GW2_STANDARD_BOONS.filter((boon) => boonActive(context, boon)).length;
}

function markedTarget(context: Gw2ModifierContext): boolean {
  const state = thiefRuntimeSpecializationState(context, 'Deadeye');
  return Boolean(state.markedTargetId) && Number(state.markExpiresAt || Infinity) > context.time;
}

function modifyDeadeyeAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  // These stat bonuses come from the GW2 build panel (professionStaticRules); skip them if the build already includes them to avoid double-counting
  if (!professionStaticRulesApplied(context.config)) {
    if (hasTrait(context, TRAIT.SILENT_SCOPE)) {
      result.precision += Number(balanceProfileFromContext(context, PROFILE.silentScope)?.attributeBonus || 120);
    }

    if (hasTrait(context, TRAIT.PREMEDITATION)) {
      result.concentration += Number(balanceProfileFromContext(context, PROFILE.premeditation)?.attributeBonus || 180);
    }
  }

  if (hasTrait(context, TRAIT.BE_QUICK_OR_BE_KILLED) && boonActive(context, 'quickness')) {
    const bonus = Number(balanceProfileFromContext(context, PROFILE.beQuickOrBeKilled)?.attributeBonus || 200);
    result.power += bonus;
    result.precision += bonus;
  }

  return result;
}

export const deadeyeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'thief.iron-sight',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.IRON_SIGHT) && markedTarget(context)
  },
  {
    id: 'thief.premeditation',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerBoon: 0.01 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + activeBoonCount(context) * parameters.damagePerBoon,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.PREMEDITATION)
  },
  {
    id: 'thief.one-in-the-chamber',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.ONE_IN_THE_CHAMBER) &&
      Boolean(thiefEventSkill(context)?.categories?.includes('stolen skill'))
  },
  {
    id: 'thief.shadow-flare-marked',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      markedTarget(context) &&
      SHADOW_FLARE_SKILL_IDS.has(Number(thiefEventSkill(context)?.id))
  },
  {
    id: 'thief.malicious-backstab-position',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    // Malicious Backstab belongs to Deadeye; its rear-position rule stays out of the base Thief modifier set.
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      thiefEventSkill(context)?.id === ID.MALICIOUS_BACKSTAB &&
      Boolean(context.config?.target?.defiant)
  },
  {
    id: 'thief.relic-of-the-deadeye',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      context.config?.relic === 'Deadeye' &&
      Number(thiefRuntimeSpecializationState(context, 'Deadeye').deadeyeRelicUntil || 0) > context.time
  },
  {
    id: 'thief.malicious-stealth-attack',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // Malice at cast time is snapshotted onto the event so the resolver sees the pre-consumption value even after malice is zeroed
    parameters: { damagePerMalice: 0.1 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      Math.max(0, Number((context.event as ThiefSimulationEvent | undefined)?.deadeyeMaliceSnapshot || 0)) *
      parameters.damagePerMalice,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      markedTarget(context) &&
      MALICIOUS_DAMAGE_SCALING_SKILL_IDS.has(Number(thiefEventSkill(context)?.id))
  }
]);

export const deadeyeAttributeRules = Object.freeze({
  modifyAttributes: modifyDeadeyeAttributes,
  modifierRules: deadeyeModifierRules
});

export const deadeyeCastRules = Object.freeze({
  availability: {
    id: 'thief.deadeye-availability',
    order: 20,
    handler: deadeyeCastAvailability
  }
});
