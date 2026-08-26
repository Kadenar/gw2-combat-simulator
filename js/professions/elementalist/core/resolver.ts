import { enqueueOrdered } from '../../../platform/engine/events/queue.js';
import { EPSILON } from '../../../platform/engine/core/clock.js';
import type { SchedulerRecord } from '../../../platform/engine/types.js';
import { onResolvedCriticalHit } from '../../../platform/gw2/authoring/mechanics.js';
import type { NativeResolvedDamageDetails } from '../../../platform/gw2/authoring/module-types.js';
import { gw2StatsForWeaponSet } from '../../../platform/gw2/combat/query/runtime-rules.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import type { Gw2EventDraft } from '../../../platform/gw2/equipment/relics/types.js';
import type { Gw2ResolverEvent, Gw2ResolverRuntime } from '../../../platform/gw2/resolver/types.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type { ElementalistResolverContext, ElementalistResolverEvent } from '../types.js';
import { isElementalistAttunement, type ElementalistAuraState, type ElementalistCoreState } from './state.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceEffect,
  elementalistBalanceValue
} from './profiles.js';

const PERSISTING_FLAMES_FIELD_SKILLS = new Set([
  'Flamewall',
  'Pyroclastic Blast',
  'Burning Retreat',
  'Burning Speed',
  'Flame Uprising',
  'Ring of Fire',
  'Lava Font',
  'Wildfire'
]);
const BOON_KINDS = new Set([
  'aegis',
  'alacrity',
  'fury',
  'might',
  'protection',
  'quickness',
  'regeneration',
  'resistance',
  'resolution',
  'stability',
  'swiftness',
  'vigor'
]);
function coreState(context: Gw2ResolverRuntime): ElementalistCoreState {
  const profession = context.profession as {
    core?: ElementalistCoreState;
  } & SchedulerRecord;
  return profession.core || (profession as unknown as ElementalistCoreState);
}

/** Routes attunement events to Core and to an active specialization that owns a secondary attunement. */
export function applyElementalistResolverAttunement(
  context: ElementalistResolverContext,
  event: ElementalistResolverEvent
): void {
  const core = coreState(context);
  if (isElementalistAttunement(event.to)) core.primaryAttunement = event.to;
  core.attunementEnteredAt = event.at;

  const specialization = context.profession.specialization.state as SchedulerRecord;
  if (Object.hasOwn(specialization, 'secondaryAttunement')) {
    specialization.secondaryAttunement = isElementalistAttunement(event.secondaryAttunement)
      ? event.secondaryAttunement
      : null;
  }
}

export function elementalistSourceSkill(event: Gw2ResolverEvent): string {
  return String(event.skillName || event.name || event.source || '');
}

function titleCase(value: string): string {
  const normalized = value.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// Apply boon-duration stats and named bonuses with GW2's lower and upper duration
// bounds before a resolver-owned buff is queued.
function buffDuration(context: Gw2ResolverRuntime, event: Gw2ResolverEvent, kind: string, duration: number): number {
  const normalized = kind.toLowerCase();
  if (!BOON_KINDS.has(normalized)) return duration;
  const weaponSet = context.activeWeaponSet === 2 ? 2 : 1;
  const stats = context.query.statsAt(
    event.at,
    {
      ...event,
      type: 'buff',
      actorType: 'player',
      kind: normalized
    },
    context
  );
  const staticStats = gw2StatsForWeaponSet(context.config, weaponSet);
  const sigils = context.config.sigilSets?.[weaponSet - 1] || {};
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(staticStats.boonDurationBonus || 0) / 100 +
    Number(staticStats.boonDurationBonuses?.[titleCase(normalized)] || 0) / 100 +
    Number(sigils.boonDurationBonus || 0) / 100;
  return duration * Math.min(2, Math.max(1, 1 + bonus));
}

// Build Elementalist attribution around a derived condition and apply it
// immediately so same-timestamp condition reactions see canonical state.
function applyElementalistDerivedCondition(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  {
    source,
    sourceId = event.skillId ?? event.sourceId,
    condition,
    stacks,
    duration
  }: {
    readonly source: string;
    readonly sourceId?: Gw2EventDraft['sourceId'];
    readonly condition: string;
    readonly stacks: number;
    readonly duration: number;
  }
): void {
  const application: Gw2EventDraft = {
    type: 'condition',
    at: event.at,
    source,
    sourceId,
    actorType: 'player',
    skillName: source,
    name: `${source} — ${condition}`,
    condition,
    stacks,
    duration,
    triggeredBy: elementalistSourceSkill(event)
  };
  context.applyCondition(application);
}

export function queueElementalistBuff(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  kind: string,
  stacks: number,
  duration: number,
  source: string
): void {
  const adjustedDuration = buffDuration(context, event, kind, duration);
  const application: Gw2ResolverEvent = {
    type: 'buff',
    at: event.at,
    source,
    sourceId: event.skillId ?? event.sourceId ?? source,
    actorType: 'player',
    skillName: source,
    name: source,
    kind: kind.toLowerCase(),
    stacks,
    duration: adjustedDuration,
    triggeredBy: elementalistSourceSkill(event),
    ...(Number(event.priority || 0) ? { priority: Number(event.priority) } : {})
  };
  // Resolver-created buffs are not recorded by the generic buff handler, so
  // retain this derived application for event inspection before queueing it.
  context.resolved.push(application);
  enqueueOrdered(context.queue, application);
}

export function activeElementalistBuffs(context: Gw2ResolverRuntime, kind: string, at: number) {
  return (context.boons.get(kind.toLowerCase()) || []).filter(
    (application) => application.at <= at + EPSILON && application.expiresAt > at + EPSILON
  );
}

export function refreshElementalistBuffs(
  context: Gw2ResolverRuntime,
  kind: string,
  at: number,
  expiresAt: (currentExpiresAt: number) => number
) {
  const normalized = kind.toLowerCase();
  const applications = context.boons.get(normalized) || [];
  const active = new Set(activeElementalistBuffs(context, normalized, at));
  context.boons.set(
    normalized,
    applications.map((application) =>
      active.has(application)
        ? {
            ...application,
            expiresAt: expiresAt(application.expiresAt)
          }
        : application
    )
  );
  return [...active];
}

export function queueElementalistAura(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  aura: string,
  duration: number,
  skillName: string
): void {
  const adjustedDuration = hasTrait(context, 'Smothering Auras')
    ? duration * elementalistBalanceValue(context, PROFILE.smotheringAuras, 'durationMultiplier', 1.33)
    : duration;
  enqueueOrdered(context.queue, {
    type: 'elementalist.aura',
    at: event.at,
    source: skillName,
    sourceId: event.skillId ?? event.sourceId ?? skillName,
    actorType: 'effect',
    skillName,
    aura,
    duration: adjustedDuration,
    elementalistResolverGeneratedAura: true
  });
}

// Record an aura once, materialize its resolver-side trait boons, and dispatch
// the normalized aura reaction without recursively processing generated events.
export function applyElementalistResolverAura(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (event.elementalistAuraReactionDispatched === true) return;
  const skillName = elementalistSourceSkill(event);
  const duration = Math.max(0, Number(event.duration || 0));
  const auraState: ElementalistAuraState = {
    type: String(event.aura || ''),
    appliedAt: event.at,
    expiresAt: event.at + duration,
    skillName
  };
  coreState(context).activeAuras.push(auraState);
  if (event.elementalistResolverGeneratedAura === true) {
    context.resolved.push(event);
  }

  if (context.combatStartTime != null && event.at < context.combatStartTime) {
    return;
  }

  if (event.elementalistResolverGeneratedAura === true || event.type === 'aura') {
    if (hasTrait(context, "Zephyr's Boon")) {
      const fury = elementalistBalanceEffect(context, PROFILE.zephyrsBoon, 'boon', 'Fury');
      const swiftness = elementalistBalanceEffect(context, PROFILE.zephyrsBoon, 'boon', 'Swiftness');
      queueElementalistBuff(
        context,
        event,
        String(fury?.boon || 'Fury'),
        Number(fury?.stacks ?? 1),
        Number(fury?.duration ?? 5),
        skillName
      );
      queueElementalistBuff(
        context,
        event,
        String(swiftness?.boon || 'Swiftness'),
        Number(swiftness?.stacks ?? 1),
        Number(swiftness?.duration ?? 5),
        skillName
      );
    }

    if (hasTrait(context, 'Elemental Shielding')) {
      const protection = elementalistBalanceEffect(context, PROFILE.elementalShielding, 'boon', 'Protection');
      queueElementalistBuff(
        context,
        event,
        String(protection?.boon || 'Protection'),
        Number(protection?.stacks ?? 1),
        Number(protection?.duration ?? 3),
        skillName
      );
    }
  }

  if (event.type === 'elementalist.aura') {
    Object.assign(event, { elementalistAuraReactionDispatched: true });
    context.dispatchReaction('aura.applied', event);
  }
}

export function recordElementalistResolvedEvent(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  context.resolved.push(event);
}

export function recordElementalistTraitProc(context: Gw2ResolverRuntime, event: Gw2ResolverEvent, name: string): void {
  context.recordProc('trait', name, event.at, elementalistSourceSkill(event));
}

function criticalTraitEligible(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails,
  trait: string
): boolean {
  return (
    hasTrait(context, trait) &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    details.hitContext?.critEligible === true
  );
}

// Declare output-only critical traits as resolver reactions so they share the
// canonical hit fact and the platform's expected-progress/RNG contract.
export const elementalistCoreCriticalReactions = Object.freeze([
  onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.raging-storm',
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Raging Storm'),
    expectedProgress: {
      get: (context) => Number(coreState(context).criticalProcProgress.ragingStorm || 0),
      set: (context, progress) => {
        coreState(context).criticalProcProgress.ragingStorm = progress;
      }
    },
    internalCooldown: {
      duration: (context) => elementalistBalanceValue(context, PROFILE.ragingStorm, 'internalCooldown', 8),
      readyAt: (context) => Number(coreState(context).procReadyAt.ragingStorm || 0),
      setReadyAt: (context, readyAt) => {
        coreState(context).procReadyAt.ragingStorm = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.RAGING_STORM },
    handler: (context, event) => {
      const fury = elementalistBalanceEffect(context, PROFILE.ragingStorm, 'boon', 'Fury');
      queueElementalistBuff(
        context,
        event,
        String(fury?.boon || 'Fury'),
        Number(fury?.stacks ?? 1),
        Number(fury?.duration ?? 4),
        'Raging Storm'
      );
    }
  }),
  onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.arcane-precision',
    chanceOnCriticalHit: (context) => elementalistBalanceValue(context, PROFILE.arcanePrecision, 'procChance', 0.33),
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Arcane Precision'),
    expectedProgress: {
      get: (context) => Number(coreState(context).criticalProcProgress.arcanePrecision || 0),
      set: (context, progress) => {
        coreState(context).criticalProcProgress.arcanePrecision = progress;
      }
    },
    internalCooldown: {
      duration: (context) => elementalistBalanceValue(context, PROFILE.arcanePrecision, 'internalCooldown', 3),
      readyAt: (context) => Number(coreState(context).procReadyAt.arcanePrecision || 0),
      setReadyAt: (context, readyAt) => {
        coreState(context).procReadyAt.arcanePrecision = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    randomStream: 'elementalist.arcane-precision',
    attribution: { kind: 'trait', id: TRAIT.ARCANE_PRECISION },
    handler: (context, event) => {
      const attunement = coreState(context).primaryAttunement;
      const condition = elementalistBalanceEffect(context, PROFILE.arcanePrecision, 'condition', attunement);
      const fallback = {
        Fire: { condition: 'Burning', duration: 1.5 },
        Water: { condition: 'Vulnerability', duration: 10 },
        Air: { condition: 'Weakness', duration: 3 },
        Earth: { condition: 'Bleeding', duration: 5 }
      }[attunement];
      applyElementalistDerivedCondition(context, event, {
        source: 'Arcane Precision',
        sourceId: TRAIT.ARCANE_PRECISION,
        condition: String(condition?.condition || fallback.condition),
        stacks: Number(condition?.stacks ?? 1),
        duration: Number(condition?.duration ?? fallback.duration)
      });
      recordElementalistTraitProc(context, event, 'Arcane Precision');
    }
  }),
  onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.renewing-stamina',
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Renewing Stamina'),
    expectedProgress: {
      get: (context) => Number(coreState(context).criticalProcProgress.renewingStamina || 0),
      set: (context, progress) => {
        coreState(context).criticalProcProgress.renewingStamina = progress;
      }
    },
    internalCooldown: {
      duration: (context) => elementalistBalanceValue(context, PROFILE.renewingStamina, 'internalCooldown', 10),
      readyAt: (context) => Number(coreState(context).procReadyAt.renewingStamina || 0),
      setReadyAt: (context, readyAt) => {
        coreState(context).procReadyAt.renewingStamina = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.RENEWING_STAMINA },
    handler: (context, event) => {
      const vigor = elementalistBalanceEffect(context, PROFILE.renewingStamina, 'boon', 'Vigor');
      queueElementalistBuff(
        context,
        event,
        String(vigor?.boon || 'Vigor'),
        Number(vigor?.stacks ?? 1),
        Number(vigor?.duration ?? 5),
        'Renewing Stamina'
      );
    }
  }),
  onResolvedCriticalHit<Gw2ResolverRuntime, Gw2ResolverEvent, NativeResolvedDamageDetails>({
    id: 'elementalist.burning-precision',
    chanceOnCriticalHit: (context) => elementalistBalanceValue(context, PROFILE.burningPrecision, 'procChance', 0.33),
    when: (context, event, details) => criticalTraitEligible(context, event, details, 'Burning Precision'),
    expectedProgress: {
      get: (context) => coreState(context).burningPrecisionProgress,
      set: (context, progress) => {
        coreState(context).burningPrecisionProgress = progress;
      }
    },
    internalCooldown: {
      duration: (context) => elementalistBalanceValue(context, PROFILE.burningPrecision, 'internalCooldown', 5),
      readyAt: (context) => Number(coreState(context).procReadyAt.burningPrecision || 0),
      setReadyAt: (context, readyAt) => {
        coreState(context).procReadyAt.burningPrecision = readyAt;
      }
    },
    progressDuringCooldown: 'accumulate',
    randomStream: 'elementalist.burning-precision',
    attribution: { kind: 'trait', id: TRAIT.BURNING_PRECISION },
    handler: (context, event) => {
      const burning = elementalistBalanceEffect(context, PROFILE.burningPrecision, 'condition', 'Burning Precision');
      applyElementalistDerivedCondition(context, event, {
        source: 'Burning Precision',
        sourceId: TRAIT.BURNING_PRECISION,
        condition: String(burning?.condition || 'Burning'),
        stacks: Number(burning?.stacks ?? 1),
        duration: Number(burning?.duration ?? 3)
      });
      recordElementalistTraitProc(context, event, 'Burning Precision');
    }
  })
]);

function grantPersistingFlames(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, 'Persisting Flames')) return;
  queueElementalistBuff(
    context,
    event,
    'Persisting Flames',
    1,
    elementalistBalanceValue(context, PROFILE.persistingFlames, 'durationMultiplier', 15),
    elementalistSourceSkill(event)
  );
}

export function applyElementalistResolvedDamage(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  _details: NativeResolvedDamageDetails = {}
): void {
  if (event.damageKind === 'field-tick' && PERSISTING_FLAMES_FIELD_SKILLS.has(elementalistSourceSkill(event))) {
    grantPersistingFlames(context, event);
  }
}

// React to canonical conditions with trait follow-ups only after their source
// application has entered resolver state.
export function applyElementalistResolvedCondition(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (
    ['Immobilize', 'Immobilized'].includes(String(event.condition)) &&
    hasTrait(context, 'Strength of Stone') &&
    (context.combatStartTime == null || event.at >= context.combatStartTime)
  ) {
    const state = coreState(context);
    if (Number(state.procReadyAt.strengthOfStone || 0) < event.at - EPSILON) {
      state.procReadyAt.strengthOfStone =
        event.at + elementalistBalanceValue(context, PROFILE.strengthOfStone, 'internalCooldown', 3);
      const bleeding = elementalistBalanceEffect(context, PROFILE.strengthOfStone, 'condition', 'Strength of Stone');
      applyElementalistDerivedCondition(context, event, {
        source: 'Strength of Stone',
        sourceId: 'Strength of Stone',
        condition: String(bleeding?.condition || 'Bleeding'),
        stacks: Number(bleeding?.stacks ?? 3),
        duration: Number(bleeding?.duration ?? 10)
      });
      recordElementalistTraitProc(context, event, 'Strength of Stone');
    }
  }

  if (event.condition === 'Burning') grantPersistingFlames(context, event);
}

export function applyElementalistResolverSignetFire(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const core = coreState(context);
  core.signetOfFireDisabledUntil = Number(event.disabledUntil || event.at);
}
