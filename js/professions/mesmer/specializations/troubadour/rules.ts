import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/combat/modifiers/rules.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { illusionSource, timedActive } from '../../core/rules.js';
import { initializeTroubadourRuntime } from './runtime.js';
import { completeTroubadourPerformance } from './instruments.js';
import { resolveTroubadourTale } from './tales.js';
import { troubadourState } from './state.js';
import { mesmerBalanceValue } from '../../core/profiles.js';
import { mesmerRuntimeFor } from '../../core/runtime.js';
import type { MesmerCastContext, MesmerRechargeContext, MesmerSchedulerContext, MesmerSkill } from '../../types.js';
import type { SimulationEvent } from '../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '../../../../platform/gw2/combat/query/types.js';

const EPSILON = 0.0001;
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

// Count distinct, unexpired instruments at the query time so repeated events for
// one performance cannot inflate Fortissimo.
function activeInstrumentCount(context: Gw2ModifierContext): number {
  if (!instrumentChecksEnabled(context)) return 0;
  const active = new Set<string>();
  for (const event of instrumentEvents(context)) {
    if (event.at <= context.time + EPSILON && Number(event.expiresAt || 0) > context.time) {
      active.add(String(event.instrument || ''));
    }
  }

  return active.size;
}

function hasLute(context: Gw2ModifierContext): boolean {
  if (!instrumentChecksEnabled(context)) return false;
  return instrumentEvents(context).some(
    (event) =>
      event.instrument === 'Lute' && event.at <= context.time + EPSILON && Number(event.expiresAt || 0) > context.time
  );
}

// Scale every primary combat attribute once per active instrument when Fortissimo
// is selected, leaving the original attribute object untouched when inactive.
export function applyTroubadourAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const instrumentCount = hasTrait(context, TRAIT.FORTISSIMO) ? activeInstrumentCount(context) : 0;
  const fortissimo = instrumentCount
    ? 1 + instrumentCount * mesmerBalanceValue(context, TRAIT.FORTISSIMO, 'attributeConversion', 0.04)
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
  const interrupted = context.effectiveEnd < context.fullEnd - context.epsilon;
  const summonProgress = Number(skill.phantasmSummonProgress);
  const summonAt = context.start + (context.fullEnd - context.start) * summonProgress;
  const completedInterruptedPhantasm =
    interrupted && Number.isFinite(summonProgress) && context.effectiveEnd >= summonAt - context.epsilon;

  if (interrupted && !completedInterruptedPhantasm) return;

  const runtime = mesmerRuntimeFor(context);
  runtime.resources.queueResources(
    context.fullEnd + context.epsilon,
    mesmerBalanceValue(context, TRAIT.HARMONIZE, 'resourceGain', 1),
    runtime.activePrimaryWeapon(),
    'Harmonize',
    { traitId: TRAIT.HARMONIZE, traitName: 'Harmonize' }
  );
}

/** Expires Troubadour instruments when their performance duration ends. */
function advanceTroubadourScheduler(context: MesmerSchedulerContext, target: number): void {
  const instruments = troubadourState.from(context).instruments;
  for (const [instrument, expiresAt] of Object.entries(instruments)) {
    if (expiresAt <= target + context.epsilon) delete instruments[instrument];
  }
}

/** Applies Troubadour's Flute endurance-recharge bonus only to its dodge action. */
function modifyTroubadourRecharge(context: MesmerRechargeContext, sharedDuration: number): number {
  if (context.ammoCastLockout || context.skill.id !== ID.DODGE_TROUBADOUR) return sharedDuration;
  const runtime = mesmerRuntimeFor(context);
  const flutePlaying = troubadourState.from(runtime.context).instruments.Flute > runtime.context.state.time;
  return Number(context.skill.cooldown || 0) / (flutePlaying ? 1.25 : 1);
}

/** Resolves Syncopate from Troubadour control and Method of Madness proc events. */
function observeTroubadourEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  const runtime = mesmerRuntimeFor(context);

  if (!runtime.traits.has(TRAIT.SYNCOPATE)) return;
  const damage = runtime.traitDamage.Syncopate;

  if (!damage) return;

  if (event.type === 'control') {
    const skillName = String(event.skillName || event.name || 'Control effect');
    runtime.addDamage(
      { id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false },
      event.at,
      {
        coefficient: damage.coefficient,
        hits: damage.hits,
        source: 'Trait',
        actorType: 'player',
        weapon: 'utility',
        weaponStrengthProfileId: 'nonweapon.unequipped'
      },
      { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'player' }
    );
    runtime.addTraitProc('Syncopate', event.at, skillName);
    return;
  }

  if (event.type !== 'proc' || event.sourceId !== 'Method of Madness') return;
  runtime.addDamage({ id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false }, event.at, {
    coefficient: damage.coefficient,
    hits: damage.hits,
    source: 'Player',
    weapon: 'utility'
  });
  runtime.addTraitProc('Syncopate', event.at, 'Lesser Chaos Storm');
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
    handler: observeTroubadourEvent
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
    context.state.cooldowns.set(
      flute.id,
      Math.max(at, readyAt - mesmerBalanceValue(context, TRAIT.MAYHEM, 'rechargeReduction', 1.5))
    );
    runtime.addTraitProc('Mayhem', at, skill.name);
  }
});
