import { validateComboOwnership } from '#gw2/platform/combos/ownership.js';
import {
  normalizeEffectAudience,
  normalizeEffectMetadata
} from '#gw2/platform/effects/audience-metadata-validation.js';
import type { ConditionTick, SkillEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import { ACTOR_TYPES } from '#gw2/platform/events/actors.js';
import type { BalanceProfile, Skill } from '#gw2/platform/skills/types.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
import { weaponStrengthProfile } from '#gw2/platform/equipment/weapons/strength.js';
/** Validate authored effects and retain canonical immutable lists before any runtime consumes them. */

// Closed vocabulary sets used for fast membership checks during catalog validation.
// Any value outside these sets is rejected as an authoring error.
const EFFECT_TYPES = new Set(['strike', 'condition', 'control', 'boon', 'buff', 'custom']);

const TIMING_ANCHORS = new Set(['castStart', 'castEnd']);

const TIMING_SCALES = new Set(['cast', 'fixed']);

// Allowlist used to catch typos in hand-authored effect objects at catalog-build time.
const EFFECT_FIELDS = new Set([
  'type',
  'reactions',
  'when',
  'coefficient',
  'coefficientModifiers',
  'hits',
  'applications',
  'allyStacks',
  'ticks',
  'condition',
  'stacks',
  'duration',
  'maximumDuration',
  'durationPerAffinity',
  'durationReductionPerAffinity',
  'damageIncreasePerStack',
  'damagePerCoefficient',
  'boon',
  'kind',
  'name',
  'icon',
  'atMs',
  'intervalMs',
  'intervalTimingScale',
  'timingAnchor',
  'timingScale',
  'castProgress',
  'castTimeMs',
  'packetLabel',
  'damageBreakdownName',
  'phantasmEntityIndex',
  'requiredTrait',
  'source',
  'sourceId',
  'actorType',
  'ownerActorType',
  'summonKind',
  'summonOwner',
  'skillName',
  'parentSkillName',
  'weapon',
  'weaponStrength',
  'weaponStrengthProfileId',
  'weaponStrengthSource',
  'skillWeapon',
  'canCrit',
  'flatDamage',
  'flatStrikeBase',
  'flatStrikePowerCoeff',
  'flatStrikeMultiplier',
  'flatStrikeHealthThreshold',
  'flatStrikeThresholdMultiplier',
  'damageKind',
  'forceCrit',
  'projectile',
  'controlKind',
  'target',
  'persistsAfterInterrupt',
  'interruptCommitMs',
  'audience',
  'metadata',
  'eventType',
  'event',
  'comboFields',
  'comboFinishers'
]);

/** Names identify procedural packets independently of their position after patch deletion. */
export function skillEffectKey(type: SkillEffect['type'], name: string): string {
  if (typeof name !== 'string' || !name.trim()) throw new TypeError('Effect keys require a non-empty name.');
  return JSON.stringify([type, name]);
}

/** Required numeric data must be authored as finite numbers, never coerced from missing or textual values. */
export function requireBalanceNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(
      `Invalid balance data: ${label} expected=finite number received=${String(value)} (${typeof value})`
    );
  }

  return value;
}

/** Validate optional numeric fields on both aggregate packets and per-tick overrides. */
function validateEffectNumbers(candidate: UnvalidatedFields, label: string): void {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError(`${label} expected=effect object received=${String(candidate)}`);
  }

  // Optional fields stay optional, but a supplied numeric field must have its actual numeric type.
  for (const field of [
    'coefficient',
    'hits',
    'applications',
    'allyStacks',
    'stacks',
    'duration',
    'durationPerAffinity',
    'durationReductionPerAffinity',
    'damageIncreasePerStack',
    'damagePerCoefficient',
    'atMs',
    'intervalMs',
    'castProgress',
    'castTimeMs',
    'phantasmEntityIndex',
    'weaponStrength',
    'flatDamage',
    'flatStrikeBase',
    'flatStrikePowerCoeff',
    'flatStrikeMultiplier',
    'flatStrikeHealthThreshold',
    'flatStrikeThresholdMultiplier',
    'interruptCommitMs'
  ]) {
    if (candidate[field] !== undefined) requireBalanceNumber(candidate[field], `${label} field=${field}`);
  }
}

/** Only construction boundaries may introduce effect lists; readers share their immutable declarations. */
export function requireCanonicalSkillEffects(owner: Skill | BalanceProfile): readonly SkillEffect[] {
  const effects = owner.effects;
  if (!effects || !canonicalEffectLists.has(effects)) {
    const metadata = owner.balanceDataContext as BalanceProfile['balanceDataContext'];
    throw new TypeError(
      `Invalid balance data: profession=${metadata?.professionId ?? '<unknown>'} patch=${metadata?.patchId ?? '<unknown>'} ${'profileKind' in owner ? 'balance-profile' : 'skill'}=${owner.id} effects must be normalized at construction`
    );
  }

  return effects;
}

/** Validate complete surviving lists at both catalog assembly and patch boundaries. */
export function normalizeSkillEffects(effects: readonly SkillEffect[], label: string): readonly SkillEffect[] {
  if (!Array.isArray(effects)) throw new TypeError(`${label} effects must be an array.`);
  const keys = new Set<string>();
  const normalizedEffects = Object.freeze(
    effects.map((effect) => {
      const effectLabel = `${label} effect=${effect?.type}/${effect?.name ?? '<unnamed>'}`;
      const normalized = normalizeEffect(effect, effectLabel);
      if (effect?.name !== undefined) {
        const key = skillEffectKey(effect.type, effect.name);
        if (keys.has(key)) throw new TypeError(`Invalid balance data: ${effectLabel} duplicate effect key`);
        keys.add(key);
      }

      return normalized;
    })
  );
  canonicalEffectLists.add(normalizedEffects);
  return normalizedEffects;
}

/**
 * Validates explicit strike timelines and freezes each hit descriptor.
 */
function normalizeStrikeTicks(value: unknown): readonly StrikeTick[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('Strike tick timelines require at least one hit.');
  }

  const ticks = value as UnvalidatedFields[];
  let previousAtMs = -Infinity;
  return Object.freeze(
    ticks.map((tick, index) => {
      validateEffectNumbers(tick, `tick=${index}`);
      const atMs = requireBalanceNumber(tick?.atMs, `tick=${index} field=atMs`);
      const coefficient = requireBalanceNumber(tick?.coefficient, `tick=${index} field=coefficient`);
      if (!(atMs >= 0) || !Number.isFinite(atMs)) {
        throw new TypeError(`Strike tick ${index + 1} requires a valid atMs.`);
      }

      if (!(coefficient >= 0) || !Number.isFinite(coefficient)) {
        throw new TypeError(`Strike tick ${index + 1} requires a non-negative coefficient.`);
      }

      if (atMs < previousAtMs) {
        throw new TypeError('Strike tick timelines must be chronological.');
      }

      previousAtMs = atMs;
      const metadata = normalizeEffectMetadata(tick.metadata);
      return Object.freeze({
        ...tick,
        atMs,
        coefficient,
        ...(metadata ? { metadata } : {})
      });
    })
  );
}

/**
 * Validates explicit condition-application timelines and freezes each entry.
 */
function normalizeConditionTicks(value: unknown): readonly ConditionTick[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('Condition tick timelines require at least one application.');
  }

  const ticks = value as UnvalidatedFields[];
  let previousAtMs = -Infinity;
  return Object.freeze(
    ticks.map((tick, index) => {
      validateEffectNumbers(tick, `tick=${index}`);
      const atMs = requireBalanceNumber(tick?.atMs, `tick=${index} field=atMs`);
      const condition = tick?.condition;
      const stacks = requireBalanceNumber(tick?.stacks, `tick=${index} field=stacks`);
      const duration = requireBalanceNumber(tick?.duration, `tick=${index} field=duration`);
      if (!(atMs >= 0) || !Number.isFinite(atMs)) {
        throw new TypeError(`Condition application ${index + 1} requires a valid atMs.`);
      }

      if (atMs < previousAtMs) {
        throw new TypeError('Condition tick timelines must be chronological.');
      }

      if (typeof condition !== 'string' || !condition.trim()) {
        throw new TypeError(`Condition application ${index + 1} requires a condition id.`);
      }

      if (!(stacks > 0) || !Number.isFinite(stacks)) {
        throw new TypeError(`Condition application ${index + 1} requires positive stacks.`);
      }

      if (!(duration > 0) || !Number.isFinite(duration)) {
        throw new TypeError(`Condition application ${index + 1} requires a positive duration.`);
      }

      previousAtMs = atMs;
      const metadata = normalizeEffectMetadata(tick.metadata);
      return Object.freeze({
        ...tick,
        atMs,
        condition,
        stacks,
        duration,
        ...(metadata ? { metadata } : {})
      });
    })
  );
}

/**
 * Validates one declarative effect and normalizes any embedded timelines.
 */
export function normalizeEffect(effect: unknown, label = 'Skill effect'): SkillEffect {
  try {
    return normalizeEffectFields(effect, label);
  } catch (error) {
    throw new TypeError(`${label}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

function normalizeEffectFields(effect: unknown, label: string): SkillEffect {
  const candidate =
    effect && typeof effect === 'object' && !Array.isArray(effect) ? (effect as UnvalidatedFields) : null;
  if (!candidate || typeof candidate.type !== 'string' || !EFFECT_TYPES.has(candidate.type)) {
    throw new TypeError(`Invalid skill effect type: ${candidate?.type}`);
  }

  // Profiles and procedural effects also enter here, so their combo ownership cannot bypass catalog checks.
  validateComboOwnership(candidate, label);
  if (Array.isArray(candidate.ticks)) {
    candidate.ticks.forEach((tick, index) => {
      if (tick && typeof tick === 'object' && !Array.isArray(tick)) {
        validateComboOwnership(tick, `${label} tick=${index + 1}`);
      }
    });
  }

  const normalizedEffect = candidate as unknown as SkillEffect;
  validateEffectNumbers(candidate, label);
  // Validate explicit profiles before authored effects enter the runtime.
  if (candidate.weaponStrengthProfileId !== undefined) weaponStrengthProfile(candidate.weaponStrengthProfileId);

  // Custom packets must declare their dispatch type and payload before they can enter the event queue.
  if (normalizedEffect.type === 'custom') {
    if (typeof normalizedEffect.eventType !== 'string' || !normalizedEffect.eventType.trim()) {
      throw new TypeError(`field=eventType expected=non-empty string received=${String(normalizedEffect.eventType)}`);
    }

    if (
      !normalizedEffect.event ||
      typeof normalizedEffect.event !== 'object' ||
      Array.isArray(normalizedEffect.event)
    ) {
      throw new TypeError(`field=event expected=object received=${String(normalizedEffect.event)}`);
    }

    validateComboOwnership(normalizedEffect.event, `${label} event`);
  }

  for (const field of ['name', 'condition', 'boon', 'kind']) {
    if (candidate[field] !== undefined && (typeof candidate[field] !== 'string' || !candidate[field].trim())) {
      throw new TypeError(`field=${field} expected=non-empty string received=${String(candidate[field])}`);
    }
  }

  if (
    normalizedEffect.type === 'strike' &&
    normalizedEffect.coefficient !== undefined &&
    normalizedEffect.coefficient < 0
  ) {
    throw new TypeError('field=coefficient expected=non-negative number');
  }

  const unknownFields = Object.keys(candidate).filter((field) => !EFFECT_FIELDS.has(field));
  if (unknownFields.length) {
    throw new TypeError(
      `Skill effect has unsupported field${unknownFields.length === 1 ? '' : 's'}: ` + unknownFields.join(', ')
    );
  }

  if (normalizedEffect.when != null && typeof normalizedEffect.when !== 'function')
    throw new TypeError('Skill effect when must be a predicate.');

  // Effect ownership must already use the canonical actor vocabulary at catalog assembly.
  if (normalizedEffect.actorType !== undefined && !ACTOR_TYPES.has(normalizedEffect.actorType)) {
    throw new TypeError('Skill effect actorType is invalid.');
  }

  if (normalizedEffect.ownerActorType !== undefined && !ACTOR_TYPES.has(normalizedEffect.ownerActorType)) {
    throw new TypeError('Skill effect ownerActorType is invalid.');
  }

  if (
    normalizedEffect.summonKind !== undefined &&
    (typeof normalizedEffect.summonKind !== 'string' || !normalizedEffect.summonKind)
  ) {
    throw new TypeError('Skill effect summonKind must be a non-empty string.');
  }

  const interruptCommitMs =
    normalizedEffect.interruptCommitMs == null ? null : Number(normalizedEffect.interruptCommitMs);
  if (interruptCommitMs != null && (!(interruptCommitMs >= 0) || !Number.isFinite(interruptCommitMs))) {
    throw new TypeError('Effect interruptCommitMs must be a non-negative finite number.');
  }

  if (interruptCommitMs != null && normalizedEffect.persistsAfterInterrupt !== true) {
    throw new TypeError('Effect interruptCommitMs requires persistsAfterInterrupt.');
  }

  const metadata = normalizeEffectMetadata(normalizedEffect.metadata);
  // Autonomous summon packets may declare an animation separately from their fixed idle interval.
  if (
    normalizedEffect.castTimeMs != null &&
    (normalizedEffect.type !== 'strike' ||
      normalizedEffect.actorType !== 'summon' ||
      typeof normalizedEffect.castTimeMs !== 'number' ||
      !Number.isFinite(normalizedEffect.castTimeMs) ||
      normalizedEffect.castTimeMs < 0)
  ) {
    throw new TypeError('Effect castTimeMs requires a non-negative finite duration on a summon strike.');
  }

  const audience = normalizeEffectAudience(normalizedEffect.audience);
  if (audience && normalizedEffect.type !== 'boon' && normalizedEffect.type !== 'buff') {
    throw new TypeError('Skill effect audience is only valid on boon and buff effects.');
  }

  if (
    normalizedEffect.weaponStrengthSource != null &&
    (normalizedEffect.type !== 'strike' || normalizedEffect.weaponStrengthSource !== 'equipped')
  ) {
    throw new TypeError('Effect weaponStrengthSource must be "equipped" on a strike effect.');
  }

  if (normalizedEffect.ticks != null && normalizedEffect.type !== 'strike' && normalizedEffect.type !== 'condition') {
    throw new TypeError(`Effect type ${normalizedEffect.type} does not support tick timelines.`);
  }

  const strikeTicks =
    normalizedEffect.type === 'strike' && normalizedEffect.ticks != null
      ? normalizeStrikeTicks(normalizedEffect.ticks)
      : null;
  const conditionTicks =
    normalizedEffect.type === 'condition' && normalizedEffect.ticks != null
      ? normalizeConditionTicks(normalizedEffect.ticks)
      : null;
  // "Explicit timing" means the effect carries its own schedule rather than
  // inheriting placement from the parent skill's cast window.
  const hasTicks = Boolean(strikeTicks || conditionTicks);
  const hasAtMs = normalizedEffect.atMs != null;
  const hasInterval = normalizedEffect.intervalMs != null;
  const hasExplicitTiming = hasTicks || hasAtMs || hasInterval;

  // `applications` drives repeated non-strike pulses (e.g. multi-application boons).
  // Mutually exclusive with tick timelines because ticks already encode per-packet timing.
  let applications = null;
  if (normalizedEffect.applications != null) {
    if (
      normalizedEffect.type !== 'condition' &&
      normalizedEffect.type !== 'control' &&
      normalizedEffect.type !== 'boon' &&
      normalizedEffect.type !== 'buff' &&
      normalizedEffect.type !== 'custom'
    ) {
      throw new TypeError(`Effect type ${normalizedEffect.type} does not support repeated applications.`);
    }

    applications = Number(normalizedEffect.applications);
    if (!Number.isInteger(applications) || !(applications > 0)) {
      throw new TypeError('Repeated effects require a positive integer application count.');
    }

    if (hasTicks) {
      throw new TypeError('Repeated applications cannot be combined with a tick timeline.');
    }

    if (applications > 1 && !hasInterval) {
      throw new TypeError('Repeated effects require an intervalMs value.');
    }
  }

  // `coefficientModifiers` scale strike damage based on target health thresholds
  // (e.g. execute-style bonuses). Only the "target-health-below" kind is supported.
  let coefficientModifiers = null;
  if (normalizedEffect.coefficientModifiers != null) {
    if (normalizedEffect.type !== 'strike' || !Array.isArray(normalizedEffect.coefficientModifiers)) {
      throw new TypeError('Coefficient modifiers are only valid on strike effects.');
    }

    coefficientModifiers = Object.freeze(
      normalizedEffect.coefficientModifiers.map((modifier, index) => {
        requireBalanceNumber(modifier?.threshold, `modifier=${index} field=threshold`);
        requireBalanceNumber(modifier?.multiplier, `modifier=${index} field=multiplier`);
        if (
          !modifier ||
          modifier.kind !== 'target-health-below' ||
          !(Number(modifier.threshold) > 0) ||
          !(Number(modifier.threshold) < 1) ||
          !(Number(modifier.multiplier) > 0)
        ) {
          throw new TypeError(`Invalid strike coefficient modifier ${index + 1}.`);
        }

        return Object.freeze({
          kind: modifier.kind,
          threshold: Number(modifier.threshold),
          multiplier: Number(modifier.multiplier)
        });
      })
    );
  }

  // timingAnchor and timingScale are only meaningful when the effect carries an
  // explicit schedule; bare effects inherit timing from the cast window implicitly.
  if (hasExplicitTiming) {
    if (normalizedEffect.timingAnchor != null && !TIMING_ANCHORS.has(String(normalizedEffect.timingAnchor))) {
      throw new TypeError('Explicit effect timing requires timingAnchor castStart or castEnd.');
    }

    if (normalizedEffect.timingScale != null && !TIMING_SCALES.has(String(normalizedEffect.timingScale))) {
      throw new TypeError('Explicit effect timing requires timingScale cast or fixed.');
    }

    // "cast" effect values are authored on the Quickness timeline and expand
    // proportionally for slower casts. They must be relative to cast start.
    if (normalizedEffect.timingScale === 'cast' && normalizedEffect.timingAnchor !== 'castStart') {
      throw new TypeError('Cast-scaled effect timing must be anchored to castStart.');
    }

    // An interval with no atMs means "start immediately after the anchor" — castEnd
    // is the only sensible anchor for that pattern (castStart + 0 = during cast).
    if (!hasTicks && !hasAtMs && normalizedEffect.timingAnchor != null && normalizedEffect.timingAnchor !== 'castEnd') {
      throw new TypeError('An interval without atMs must be anchored to castEnd.');
    }

    if (hasAtMs) {
      const atMs = Number(normalizedEffect.atMs);
      const castEndOffset = normalizedEffect.timingAnchor !== 'castStart';
      if (!Number.isFinite(atMs) || (atMs < 0 && !castEndOffset)) {
        throw new TypeError('Effect atMs must be finite and may only be negative when anchored to castEnd.');
      }
    }

    if (hasInterval) {
      const intervalMs = Number(normalizedEffect.intervalMs);
      if (!(intervalMs >= 0) || !Number.isFinite(intervalMs)) {
        throw new TypeError('Effect intervalMs must be a non-negative finite number.');
      }
    }
  } else if (normalizedEffect.timingAnchor != null || normalizedEffect.timingScale != null) {
    throw new TypeError('Timing metadata is only valid for explicitly timed effects.');
  }

  // Tick timelines own packet count and timing; formula defaults may still apply to every tick.
  if (
    strikeTicks &&
    (normalizedEffect.coefficient != null ||
      normalizedEffect.hits != null ||
      normalizedEffect.atMs != null ||
      normalizedEffect.intervalMs != null)
  ) {
    throw new TypeError('Strike tick timelines cannot use aggregate coefficient or timing fields.');
  }

  if (
    conditionTicks &&
    (normalizedEffect.condition != null ||
      normalizedEffect.stacks != null ||
      normalizedEffect.duration != null ||
      normalizedEffect.atMs != null ||
      normalizedEffect.intervalMs != null)
  ) {
    throw new TypeError('Condition tick timelines cannot use aggregate application or timing fields.');
  }

  if (
    normalizedEffect.type === 'strike' &&
    !strikeTicks &&
    !(Number(normalizedEffect.coefficient) >= 0) &&
    !Number.isFinite(Number(normalizedEffect.flatDamage)) &&
    !Number.isFinite(Number(normalizedEffect.flatStrikeBase)) &&
    !Number.isFinite(Number(normalizedEffect.flatStrikePowerCoeff))
  ) {
    throw new TypeError('Strike effects require a non-negative coefficient or flat strike data.');
  }

  if (
    normalizedEffect.type === 'strike' &&
    !strikeTicks &&
    (!Number.isInteger(Number(normalizedEffect.hits ?? 1)) || !(Number(normalizedEffect.hits ?? 1) > 0))
  ) {
    throw new TypeError('Strike effects require a positive integer hit count.');
  }

  if (normalizedEffect.type === 'strike' && !strikeTicks && normalizedEffect.intervalMs != null) {
    throw new TypeError('Strike intervals must be authored as an explicit tick timeline.');
  }

  if (
    normalizedEffect.type === 'strike' &&
    !strikeTicks &&
    Number(normalizedEffect.hits) > 1 &&
    normalizedEffect.atMs == null
  ) {
    throw new TypeError('Simultaneous multi-hit strikes require one explicit atMs timestamp.');
  }

  if (normalizedEffect.type === 'condition') {
    if (!conditionTicks) {
      requireBalanceNumber(normalizedEffect.stacks, 'field=stacks');
      requireBalanceNumber(normalizedEffect.duration, 'field=duration');
    }

    if (!conditionTicks && !String(normalizedEffect.condition || '')) {
      throw new TypeError('Condition effects require a condition id.');
    }

    if (!conditionTicks && (!(Number(normalizedEffect.stacks) > 0) || !(Number(normalizedEffect.duration) > 0))) {
      throw new TypeError('Condition effects require positive stacks and duration.');
    }
  }

  if (normalizedEffect.type === 'boon' || normalizedEffect.type === 'buff') {
    requireBalanceNumber(normalizedEffect.duration, 'field=duration');
    if (normalizedEffect.maximumDuration != null) {
      requireBalanceNumber(normalizedEffect.maximumDuration, 'field=maximumDuration');
      if (normalizedEffect.maximumDuration < 0) throw new TypeError('Status maximumDuration must be nonnegative.');
    }

    if (normalizedEffect.stacks !== undefined && !(normalizedEffect.stacks > 0)) {
      throw new TypeError('Boon and buff statuses require positive stacks.');
    }

    if (!String(normalizedEffect.boon || normalizedEffect.kind || normalizedEffect.name || '')) {
      throw new TypeError('Boon and buff statuses require a name.');
    }

    if (!(Number(normalizedEffect.duration) > 0)) {
      throw new TypeError('Boon and buff statuses require a positive duration.');
    }
  }

  // Spread normalized numeric fields on top so runtime consumers always get typed values.
  return Object.freeze({
    ...normalizedEffect,
    ...(normalizedEffect.type === 'strike' && !strikeTicks ? { hits: normalizedEffect.hits ?? 1 } : {}),
    ...(normalizedEffect.type === 'boon' || normalizedEffect.type === 'buff'
      ? { stacks: normalizedEffect.stacks ?? 1 }
      : {}),
    ...(hasAtMs ? { atMs: Number(normalizedEffect.atMs) } : {}),
    ...(hasInterval ? { intervalMs: Number(normalizedEffect.intervalMs) } : {}),
    ...(interruptCommitMs == null ? {} : { interruptCommitMs }),
    ...(applications ? { applications } : {}),
    ...(strikeTicks ? { ticks: strikeTicks } : {}),
    ...(conditionTicks ? { ticks: conditionTicks } : {}),
    ...(coefficientModifiers ? { coefficientModifiers } : {}),
    ...(audience ? { audience } : {}),
    ...(metadata ? { metadata } : {})
  }) as SkillEffect;
}

// Track validated lists without retaining discarded catalogs or revalidating their effects on every read.
const canonicalEffectLists = new WeakSet<readonly SkillEffect[]>();
