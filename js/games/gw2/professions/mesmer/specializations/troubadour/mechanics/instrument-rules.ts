import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { illusionSource, timedActive } from '#gw2/professions/mesmer/core/traits/modifiers.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';

import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { isCommittedInterruptedPhantasm } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { EPSILON } from '#kernel/core/clock.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';

const EMPTY_EVENTS: readonly SimulationEvent[] = Object.freeze([]);
function instrumentEvents(context: Gw2ModifierContext): readonly SimulationEvent[] {
  return context.events?.filter((event) => event.type === 'mesmer.instrument') ?? EMPTY_EVENTS;
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
    ? 1 +
      instrumentCount *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FORTISSIMO), 'attributeConversion')
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
export function completeTroubadourPhantasm(context: MesmerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as MesmerSkill;
  if (skill.resource?.mode !== 'phantasm') return;
  const interrupted = castWasInterrupted(cast);
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  if (interrupted && !completedInterruptedPhantasm) return;

  const runtime = mesmerMechanicsFor(context);
  const harmonizeProfile = requireBalanceProfileFromContext(context, TRAIT.HARMONIZE);
  runtime.resources.queueResources(
    context.time,
    balanceProfileNumber(harmonizeProfile, 'resourceGain'),
    runtime.activePrimaryWeapon(),
    'Harmonize',
    { traitId: TRAIT.HARMONIZE, traitName: 'Harmonize' }
  );
}

/** Dodge affordability reads the shared live endurance pool. */
export function troubadourAvailability(context: MesmerRuntime, skill: MesmerSkill): AvailabilityResult {
  const cost = Number(skill.resourceCost ?? 50);
  if (skill.id !== ID.DODGE_TROUBADOUR || troubadourState.from(context).endurance >= cost - EPSILON)
    return { ready: true };
  return {
    ready: false,
    retryAt: context.endurance.readyAt(cost) ?? Infinity,
    code: 'mesmer.endurance',
    reason: `Dodge requires ${cost} endurance.`
  };
}

/** Flute adds 25% to base recovery only during its committed playing window, alongside Vigor's 50%. */
export const troubadourEndurance: EndurancePolicy<MesmerRuntime> = {
  state: (context) => troubadourState.from(context),
  maximum: () => 100,
  regenerationBoundaries: (context) =>
    context.history
      .filter((event) => event.type === 'mesmer.instrument')
      .filter((event) => event.instrument === 'Flute')
      .flatMap((event) => [event.at, Number(event.expiresAt)]),
  regenerationRate: (context, vigor, at) => {
    const flutePlaying = activeTroubadourInstrumentsAt(
      context.history.filter((event) => event.type === 'mesmer.instrument'),
      at
    ).has('Flute');
    const fluteBonus = flutePlaying
      ? balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.SYMPHONIC_RESONANCE),
          'enduranceRegenerationMultiplier'
        ) - 1
      : 0;
    return 5 * Math.min(2, 1 + (vigor ? 0.5 : 0) + fluteBonus);
  }
};
