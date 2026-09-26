/**
 * Canonical catalog assembly for profession-neutral skill metadata. This is the
 * boundary where generated API data, hand-authored mechanics, explicit
 * overrides, and resolver handlers become one validated immutable lookup.
 */
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
import { deriveAutoattackChains, indexAutoattackChains } from '#gw2/platform/engine/skills/autoattack-chains.js';
import { normalizeEffectAudience, normalizeEffectMetadata } from '#gw2/platform/engine/effects/contracts.js';
import type {
  AutoattackChainPosition,
  BalanceProfile,
  CanonicalCatalog,
  CatalogEntity,
  ConditionTick,
  Skill,
  SkillEffect,
  SkillId,
  SkillLockout,
  StrikeTick
} from '#gw2/platform/engine/skills/types.js';

/** Corrects derived catalog chains with authored additions and exclusions shared by module contributions. */
export interface AutoattackChainOptions {
  readonly additional?: readonly (readonly SkillId[])[];
  readonly excludeSkillIds?: readonly SkillId[];
}

interface CanonicalCatalogOptions {
  readonly generated?: readonly Skill[];
  readonly mechanics?: Readonly<Record<string, Partial<Skill>>>;
  readonly overrides?: Readonly<Record<string, Partial<Skill>>>;
  readonly extraSkills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly autoattackChains?: AutoattackChainOptions;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNormalizer?: (skill: Partial<Skill>) => Partial<Skill>;
}

interface NormalizedAutoattackChains {
  readonly chains: readonly (readonly number[])[];
  readonly positions: Map<number, AutoattackChainPosition>;
}

// Closed vocabulary sets used for fast membership checks during catalog validation.
// Any value outside these sets is rejected as an authoring error.
const EFFECT_TYPES = new Set(['strike', 'condition', 'control', 'blind', 'boon', 'buff', 'custom']);
const EFFECT_ACTOR_TYPES = new Set(['player', 'summon', 'effect', 'environment', 'unknown']);
const TIMING_ANCHORS = new Set(['castStart', 'castEnd']);
const TIMING_SCALES = new Set(['cast', 'fixed']);
const RECHARGE_ANCHORS = new Set(['castStart', 'castEnd']);
// Summons retain both timelines; player fragments supply their effective castTimeMs directly.
const QUICKNESS_ACTION_RATE = 1.5;
// Allowlist used to catch typos in hand-authored effect objects at catalog-build time.
const EFFECT_FIELDS = new Set([
  'type',
  'coefficient',
  'coefficientModifiers',
  'hits',
  'applications',
  'allyStacks',
  'ticks',
  'condition',
  'stacks',
  'duration',
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
  'noCrit',
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

/** Validate complete surviving lists at both catalog assembly and patch boundaries. */
export function normalizeSkillEffects(effects: readonly SkillEffect[], label: string): readonly SkillEffect[] {
  if (!Array.isArray(effects)) throw new TypeError(`${label} effects must be an array.`);
  const keys = new Set<string>();
  return Object.freeze(
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
}

/**
 * Discovers the catalog's normal weapon chains, applies the small number of
 * API-data corrections supplied by a profession, and creates the shared
 * per-skill position index used by runtime rules.
 */
function normalizeAutoattackChains(
  skills: readonly Skill[],
  options: AutoattackChainOptions = {}
): NormalizedAutoattackChains {
  if (options == null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Autoattack-chain options must be an object.');
  }

  const additional = options.additional ?? [];
  const excluded = options.excludeSkillIds ?? [];
  if (!Array.isArray(additional) || !Array.isArray(excluded)) {
    throw new TypeError('Autoattack-chain additions and exclusions must be arrays.');
  }

  const excludedIds = new Set(excluded.map(Number));
  const chainSources: readonly (readonly SkillId[])[] = [
    ...deriveAutoattackChains(skills), // derived from API data flip-skill links
    ...additional // hand-authored corrections from the profession
  ];
  // Entire chains containing an excluded skill are dropped; partial chains would
  // break the chain-step index and produce incorrect autoattack sequencing.
  const chains = Object.freeze(
    chainSources
      .filter((chain) => !chain.some((skillId) => excludedIds.has(Number(skillId))))
      .map((chain) => Object.freeze(chain.map(Number)))
  );
  // All chain members must exist in the skill list — a missing id means the API
  // data and hand-authored corrections are out of sync.
  const skillIds = new Set(skills.map((skill) => skill.id));
  for (const chain of chains) {
    for (const skillId of chain) {
      if (!skillIds.has(skillId)) {
        throw new TypeError(`Autoattack chain references missing skill ${skillId}.`);
      }
    }
  }

  return {
    chains,
    positions: indexAutoattackChains(chains)
  };
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

  const normalizedEffect = candidate as unknown as SkillEffect;
  validateEffectNumbers(candidate, label);

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

  // Effect ownership must already use the canonical actor vocabulary at catalog assembly.
  if (normalizedEffect.actorType !== undefined && !EFFECT_ACTOR_TYPES.has(normalizedEffect.actorType)) {
    throw new TypeError('Skill effect actorType is invalid.');
  }

  if (normalizedEffect.ownerActorType !== undefined && !EFFECT_ACTOR_TYPES.has(normalizedEffect.ownerActorType)) {
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
      normalizedEffect.type !== 'blind' &&
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

/**
 * Validates the skill-family lockouts applied when a skill activates.
 */
function normalizeLockouts(lockouts: unknown, skillId: SkillId): readonly SkillLockout[] {
  if (lockouts == null) return Object.freeze([]);
  if (!Array.isArray(lockouts)) {
    throw new TypeError(`Skill ${skillId} lockouts must be an array.`);
  }

  const candidates = lockouts as unknown[];
  const groups = new Set<string>();
  return Object.freeze(
    candidates.map((lockout, index) => {
      if (!lockout || typeof lockout !== 'object' || Array.isArray(lockout)) {
        throw new TypeError(`Skill ${skillId} lockout ${index + 1} must be an object.`);
      }

      const candidate = lockout as UnvalidatedFields;
      const group = String(candidate.group || '').trim();
      const durationMs = Number(candidate.durationMs);
      if (!group) {
        throw new TypeError(`Skill ${skillId} lockout ${index + 1} requires a group.`);
      }

      if (!(durationMs > 0) || !Number.isFinite(durationMs)) {
        throw new TypeError(`Skill ${skillId} lockout ${group} requires a positive durationMs.`);
      }

      if (groups.has(group)) {
        throw new TypeError(`Skill ${skillId} declares duplicate lockout group ${group}.`);
      }

      groups.add(group);
      return Object.freeze({ group, durationMs });
    })
  );
}

/**
 * Builds the immutable catalog consumed by the shared runtime and
 * app adapters.
 */
export function createCanonicalCatalog({
  generated = [],
  mechanics = {},
  overrides = {},
  extraSkills = [],
  balanceProfiles = [],
  autoattackChains = {},
  traits = [],
  specializations = [],
  weapons = [],
  weaponHands = {},
  skillNameCollision = 'first',
  skillNormalizer
}: CanonicalCatalogOptions = {}): Readonly<CanonicalCatalog> {
  if (!['first', 'last'].includes(skillNameCollision)) {
    throw new TypeError(`Invalid skill name collision policy: ${skillNameCollision}`);
  }

  const declared = [...generated, ...extraSkills];
  const declaredIds = new Set();
  for (const skill of declared) {
    if (declaredIds.has(skill.id)) {
      throw new Error(`Duplicate skill id: ${skill.id}`);
    }

    declaredIds.add(skill.id);
  }

  const generatedById = new Map(generated.map((skill) => [skill.id, skill]));
  const allIds = new Set([
    ...generatedById.keys(),
    ...Object.keys(mechanics).map(Number),
    ...Object.keys(overrides).map(Number),
    ...extraSkills.map((skill) => skill.id)
  ]);
  const normalizedSkills: Skill[] = [...allIds].map((id) => {
    // Merge priority (lowest → highest): generated API data → hand-authored mechanics
    // → explicit overrides → extraSkills. Each layer shadows fields from the layer below.
    const mergedSource = {
      ...(generatedById.get(id) || {}),
      ...(mechanics[id] || {}),
      ...(overrides[id] || {}),
      ...(extraSkills.find((candidate) => candidate.id === id) || {})
    };
    const merged = skillNormalizer ? skillNormalizer(mergedSource) : mergedSource;
    const quicknessCastTimeMs = merged.quicknessCastTimeMs == null ? null : Number(merged.quicknessCastTimeMs);
    if (quicknessCastTimeMs != null && (!(quicknessCastTimeMs >= 0) || !Number.isFinite(quicknessCastTimeMs))) {
      throw new TypeError(`Skill ${id} has an invalid quicknessCastTimeMs.`);
    }

    // Only summon metadata supplies quicknessCastTimeMs and needs a derived base duration.
    const castTimeMs = Number(
      merged.castTimeMs ?? (quicknessCastTimeMs == null ? 0 : quicknessCastTimeMs * QUICKNESS_ACTION_RATE)
    );
    if (!(castTimeMs >= 0) || !Number.isFinite(castTimeMs)) {
      throw new TypeError(`Skill ${id} requires a non-negative finite castTimeMs.`);
    }

    const interruptCommitMs = merged.interruptCommitMs == null ? null : Number(merged.interruptCommitMs);
    if (interruptCommitMs != null && (!(interruptCommitMs >= 0) || !Number.isFinite(interruptCommitMs))) {
      throw new TypeError(`Skill ${id} has an invalid interruptCommitMs.`);
    }

    // Commit is the safe default; only explicitly classified channels retain packets individually.
    const interruptMode = merged.interruptMode == null ? 'commit' : String(merged.interruptMode);
    if (interruptMode !== 'commit' && interruptMode !== 'per-packet') {
      throw new TypeError(`Skill ${id} has invalid interruptMode "${interruptMode}".`);
    }

    const effects = normalizeSkillEffects(merged.effects || [], `skill=${id}`);
    // Every persistent effect needs an explicit launch cutoff, either on itself
    // or inherited from the skill, before future packets may survive an interrupt.
    if (
      effects.some(
        (effect) =>
          effect.persistsAfterInterrupt === true && effect.interruptCommitMs == null && interruptCommitMs == null
      )
    ) {
      throw new TypeError(`Skill ${id} retains future packets but has no interruptCommitMs.`);
    }

    if (
      merged.retainsCastLockoutAfterInterrupt != null &&
      typeof merged.retainsCastLockoutAfterInterrupt !== 'boolean'
    ) {
      throw new TypeError(`Skill ${id} has an invalid retainsCastLockoutAfterInterrupt.`);
    }

    if (merged.rechargeAnchor != null && !RECHARGE_ANCHORS.has(merged.rechargeAnchor)) {
      throw new TypeError(`Skill ${id} has invalid rechargeAnchor ` + `"${merged.rechargeAnchor}".`);
    }

    const rechargeOffsetMs = Number(merged.rechargeOffsetMs ?? 0);
    if (!(rechargeOffsetMs >= 0) || !Number.isFinite(rechargeOffsetMs)) {
      throw new TypeError(`Skill ${id} requires a non-negative finite rechargeOffsetMs.`);
    }

    const baseSkill = {
      ...merged,
      castTimeMs,
      ...(rechargeOffsetMs ? { rechargeOffsetMs } : {}),
      ...(quicknessCastTimeMs == null ? {} : { quicknessCastTimeMs }),
      interruptMode,
      ...(interruptCommitMs == null ? {} : { interruptCommitMs }),
      lockouts: normalizeLockouts(merged.lockouts, id)
    };
    return {
      ...baseSkill,
      effects,
      tags: Object.freeze([...(baseSkill.tags || [])])
    } as Skill;
  });
  const normalizedAutoattacks = normalizeAutoattackChains(normalizedSkills, autoattackChains);
  // Inject chain position data (root id + step index) into each skill after the chain
  // index is built, since chains depend on the complete normalized skill list.
  const skills = normalizedSkills.map((skill) => {
    const position = normalizedAutoattacks.positions.get(Number(skill.id));
    return Object.freeze({
      ...skill,
      chainRoot: position?.root ?? null,
      chainStep: position?.step ?? null
    });
  });
  // skillsByName is used for name-based lookups (e.g. from trait/effect references).
  // The collision policy controls which skill wins when two share the same name.
  const skillsByName = new Map<string, Skill>();
  for (const skill of skills) {
    if (skillNameCollision === 'last' || !skillsByName.has(skill.name)) {
      skillsByName.set(skill.name, skill);
    }
  }

  const profiles: readonly BalanceProfile[] = balanceProfiles.map((profile) =>
    Object.freeze({
      ...profile,
      effects: normalizeSkillEffects(profile.effects || [], `profile=${profile.id}`)
    })
  );
  const profileIds = new Set<SkillId>();
  const procRateIds = new Set<string>();
  for (const profile of profiles) {
    if (profileIds.has(profile.id)) {
      throw new TypeError(`Duplicate balance profile id: ${String(profile.id)}`);
    }

    profileIds.add(profile.id);
    if (!String(profile.name || '')) {
      throw new TypeError(`Balance profile ${String(profile.id)} has no name.`);
    }

    if (!profile.profileKind) {
      throw new TypeError(`Balance profile ${String(profile.id)} has no profileKind.`);
    }

    // Proc declarations compose with Core/elite catalogs and must not silently share an override key.
    if (profile.procRate) {
      const { id, traitId, field, opportunity } = profile.procRate;
      const chance = profile[field];
      if (
        !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(id) ||
        procRateIds.has(id) ||
        !traits.some((trait) => trait.id === traitId) ||
        !opportunity ||
        typeof chance !== 'number' ||
        !Number.isFinite(chance) ||
        chance < 0 ||
        chance > 1
      ) {
        throw new TypeError(`Balance profile ${String(profile.id)} has an invalid or duplicate procRate declaration.`);
      }

      procRateIds.add(id);
    }
  }

  const catalog: CanonicalCatalog = {
    skills: Object.freeze(skills),
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillsByName,
    balanceProfiles: Object.freeze(profiles),
    balanceProfilesById: new Map(profiles.map((profile) => [profile.id, profile])),
    balanceProfilesByName: new Map(profiles.map((profile) => [profile.name, profile])),
    autoattackChains: normalizedAutoattacks.chains,
    autoattackChainPositions: normalizedAutoattacks.positions,
    traits: Object.freeze(traits.map((trait) => Object.freeze({ ...trait }))),
    specializations: Object.freeze(specializations.map((specialization) => Object.freeze({ ...specialization }))),
    weapons: new Set(weapons),
    weaponHands: new Map(weaponHands instanceof Map ? weaponHands : Object.entries(weaponHands || {}))
  };
  validateCanonicalCatalog(catalog);
  return Object.freeze(catalog);
}

/**
 * Enforces referential integrity and shape rules for a canonical catalog.
 */
function validateCanonicalCatalog(catalog: CanonicalCatalog): void {
  const validWeaponHands = new Set(['mh', 'oh', 'mh+oh', '2h', '-']);
  for (const [weapon, wielding] of catalog?.weaponHands || []) {
    if (!catalog.weapons?.has(weapon)) {
      throw new Error(`Weapon hand metadata references unknown weapon ${weapon}.`);
    }

    if (!validWeaponHands.has(wielding)) {
      throw new Error(`Weapon ${weapon} has invalid wielding metadata ${wielding}.`);
    }
  }

  const ids = new Set();
  for (const skill of catalog?.skills || []) {
    if (skill.id === undefined || skill.id === null || ids.has(skill.id)) {
      throw new Error(`Duplicate or missing skill id: ${skill.id}`);
    }

    ids.add(skill.id);
    if (!String(skill.name || '')) throw new Error(`Skill ${skill.id} has no name.`);
    for (const reference of [skill.parentId, skill.flipParentId]) {
      if (reference != null && !catalog.skillsById.has(reference)) {
        throw new Error(`Skill ${skill.id} references missing parent ${reference}.`);
      }
    }

    // Weapon validation only runs when the catalog declares a weapon set; professions
    // that don't restrict weapons leave the set empty and skip this check.
    if (skill.weapon && catalog.weapons.size && !catalog.weapons.has(skill.weapon)) {
      throw new Error(`Skill ${skill.id} uses invalid weapon ${skill.weapon}.`);
    }

    if (
      skill.slot != null &&
      !Number.isInteger(Number(skill.slot)) &&
      !/^(?:Weapon_[1-5]|Profession_[1-5]|Heal|Utility|Elite|Action)$/.test(String(skill.slot))
    ) {
      throw new Error(`Skill ${skill.id} has invalid slot metadata.`);
    }
  }

  // Track catalog identities separately so duplicate trait definitions fail fast.
  const seenTraitIds = new Set();
  for (const trait of catalog?.traits || []) {
    if (trait.id === undefined || trait.id === null || seenTraitIds.has(trait.id)) {
      throw new Error(`Duplicate or missing trait id: ${trait.id}`);
    }

    if (!String(trait.name || '')) {
      throw new Error(`Trait ${trait.id} has no name.`);
    }

    seenTraitIds.add(trait.id);
  }

  const specializationIds = new Set();
  for (const specialization of catalog?.specializations || []) {
    if (specialization.id === undefined || specialization.id === null || specializationIds.has(specialization.id)) {
      throw new Error(`Duplicate or missing specialization id: ${specialization.id}`);
    }

    if (!String(specialization.name || '')) {
      throw new Error(`Specialization ${specialization.id} has no name.`);
    }

    specializationIds.add(specialization.id);
  }
}
