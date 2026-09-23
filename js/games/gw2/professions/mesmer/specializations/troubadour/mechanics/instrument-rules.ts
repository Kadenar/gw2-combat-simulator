import { observeSyncopateEvent } from '#gw2/professions/mesmer/specializations/troubadour/traits/syncopate.js';
import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { illusionSource, timedActive } from '#gw2/professions/mesmer/core/traits/modifiers.js';
import { initializeTroubadourRuntime } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/runtime.js';
import { completeTroubadourPerformance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { resolveTroubadourTale } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/tales.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';

import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { isCommittedInterruptedPhantasm } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type {
  MesmerCastContext,
  MesmerRechargeContext,
  MesmerSchedulerContext
} from '#gw2/professions/mesmer/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

const EMPTY_EVENTS: readonly SimulationEvent[] = Object.freeze([]);
const instrumentEventIndex = new WeakMap<readonly SimulationEvent[], readonly SimulationEvent[]>();

function instrumentEvents(context: Gw2ModifierContext): readonly SimulationEvent[] {
  const events = context.events;
  if (!Array.isArray(events)) return EMPTY_EVENTS;
  let indexed = instrumentEventIndex.get(events);
  if (!indexed) {
    indexed = events.filter((event) => event.type === 'mesmer.instrument');
    instrumentEventIndex.set(events, indexed);
  }

  return indexed;
}

function instrumentChecksEnabled(context: Gw2ModifierContext): boolean {
  const specialization = context.config?.specialization;
  return !specialization || specialization === 'Troubadour';
}

// Damage modifiers and historical skill queries share the scheduler's replacement and expiry policies.
function activeInstrumentCount(context: Gw2ModifierContext): number {
  if (!instrumentChecksEnabled(context)) return 0;
  return activeTroubadourInstrumentsAt(instrumentEvents(context), context.time, context.event).size;
}

function hasLute(context: Gw2ModifierContext): boolean {
  if (!instrumentChecksEnabled(context)) return false;
  return activeTroubadourInstrumentsAt(instrumentEvents(context), context.time, context.event).has('Lute');
}

// Scale every primary combat attribute once per active instrument when Fortissimo
// is selected, leaving the original attribute object untouched when inactive.
export function applyTroubadourAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const instrumentCount = hasTrait(context, TRAIT.FORTISSIMO) ? activeInstrumentCount(context) : 0;
  const fortissimo = instrumentCount
    ? 1 + instrumentCount * balanceProfileNumberFromContext(context, TRAIT.FORTISSIMO, 'attributeConversion')
    : 1;
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
    healingPower: Number(attributes.healingPower || 0) * fortissimo
  };
}

export const troubadourModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.lute',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    // Lute Playing buffs only the Troubadour, so illusion attacks must not inherit its damage bonus.
    when: (context) => hasLute(context) && !illusionSource(context)
  },
  {
    id: 'mesmer.shredding',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) => hasTrait(context, TRAIT.SHREDDING) && hasLute(context) && !illusionSource(context)
  },
  {
    id: 'mesmer.altered-chord',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.25,
    when: (context) => timedActive(context, 'altered-chord') && !illusionSource(context)
  }
]);

export const troubadourAttributeRules = Object.freeze({
  modifyAttributes: applyTroubadourAttributes,
  modifierRules: troubadourModifierRules
});

/** Grants Harmonize's resource only once a phantasm has crossed its summon point. */
function completeTroubadourPhantasm(context: MesmerCastContext, skill: MesmerSkill): void {
  if (skill.resource?.mode !== 'phantasm') return;
  const interrupted = castWasInterrupted(context);
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(context, skill);
  if (interrupted && !completedInterruptedPhantasm) return;

  const runtime = mesmerRuntimeFor(context);
  runtime.resources.queueResources(
    context.fullEnd,
    balanceProfileNumberFromContext(context, TRAIT.HARMONIZE, 'resourceGain'),
    runtime.activePrimaryWeapon(),
    'Harmonize',
    { traitId: TRAIT.HARMONIZE, traitName: 'Harmonize' }
  );
}

/** Expires instruments at their exact exclusive deadline, matching damage queries and the palette. */
function advanceTroubadourScheduler(context: MesmerSchedulerContext, target: number): void {
  const instruments = troubadourState.from(context).instruments;
  for (const [instrument, expiresAt] of Object.entries(instruments)) {
    if (expiresAt <= target) delete instruments[instrument];
  }
}

/** Applies Troubadour's Flute endurance-recharge bonus only to its dodge action. */
function modifyTroubadourRecharge(context: MesmerRechargeContext, sharedDuration: number): number {
  if (context.ammoCastLockout || context.skill.id !== ID.DODGE_TROUBADOUR) return sharedDuration;
  const runtime = mesmerRuntimeFor(context);
  const flutePlaying = troubadourState.from(runtime.context).instruments.Flute > runtime.context.state.time;
  return (
    Number(context.skill.cooldown || 0) /
    (flutePlaying ? balanceProfileNumberFromContext(context, TRAIT.SYMPHONIC_RESONANCE, 'dodgeRechargeSpeed') : 1)
  );
}

export const troubadourCastRules = Object.freeze({
  modifyRechargeDuration: modifyTroubadourRecharge
});

export const troubadourSchedulerHooks = Object.freeze({
  initialize: initializeTroubadourRuntime,
  advance: {
    id: 'mesmer.troubadour.instruments',
    order: 20,
    handler: advanceTroubadourScheduler
  },
  // Instruments and Crescendo resolve here because their cast-start packets and Harp interruption belong to Troubadour.
  onCastComplete: Object.freeze([
    {
      id: 'mesmer.troubadour.performance',
      order: 20,
      handler: completeTroubadourPerformance
    },
    {
      id: 'mesmer.troubadour.harmonize',
      order: 30,
      handler: completeTroubadourPhantasm
    }
  ]),
  onEventScheduled: {
    id: 'mesmer.troubadour.syncopate',
    order: 20,
    handler: observeSyncopateEvent
  }
});

/** Routes every Tale through the specialization-owned resolver at cast completion. */
export const troubadourSkillMechanicHandlers = Object.freeze({
  'mesmer.troubadour.resolve-tale': resolveTroubadourTale,
  'mesmer.troubadour.dodge': ({
    context,
    skill,
    at
  }: {
    context: MesmerSchedulerContext;
    skill: MesmerSkill;
    at: number;
  }): void => {
    const runtime = mesmerRuntimeFor(context);
    if (!runtime.traits.has(TRAIT.MAYHEM)) return;
    const flute = runtime.skillsById.get(ID.FLUSTERING_FLUTE);
    const readyAt = flute ? context.state.cooldowns.get(flute.id) : null;
    if (!flute || readyAt == null) return;
    context.cooldownController.reduceSkillRecharge(
      flute,
      balanceProfileNumberFromContext(context, TRAIT.MAYHEM, 'rechargeReduction'),
      at
    );
    runtime.addTraitProc('Mayhem', at, skill.name);
  }
});
