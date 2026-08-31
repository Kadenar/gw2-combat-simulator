/**
 * Canonical catalog assembly for profession-neutral skill metadata. This is the
 * boundary where generated API data, hand-authored mechanics, explicit
 * overrides, and resolver handlers become one validated immutable lookup.
 */
import { normalizeSkillHandler, SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { deriveAutoattackChains, indexAutoattackChains } from '#gw2/platform/engine/skills/autoattack-chains.js';
import { toEntries } from '#kernel/core/collections.js';
import type {
  AutoattackChainPosition,
  BalanceProfile,
  CanonicalCatalog,
  CatalogEntity,
  ConditionTick,
  SchedulerRecord,
  Skill,
  SkillEffect,
  SkillFragment,
  SkillHandlerStrategy,
  SkillId,
  SkillLockout,
  StrikeTick
} from '#gw2/platform/engine/types.js';

interface AutoattackChainOptions {
  readonly additional?: readonly (readonly SkillId[])[];
  readonly excludeSkillIds?: readonly SkillId[];
}

interface CanonicalCatalogOptions {
  readonly generated?: readonly Skill[];
  readonly mechanics?: Readonly<Record<string, SkillFragment>>;
  readonly overrides?: Readonly<Record<string, SkillFragment>>;
  readonly extraSkills?: readonly Skill[];
  readonly balanceProfiles?: readonly BalanceProfile[];
  readonly autoattackChains?: AutoattackChainOptions;
  readonly skillHandlers?: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;
  readonly traits?: readonly CatalogEntity[];
  readonly specializations?: readonly CatalogEntity[];
  readonly weapons?: readonly string[];
  readonly weaponHands?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly skillNameCollision?: 'first' | 'last';
  readonly skillNormalizer?: (skill: SkillFragment) => SkillFragment;
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
// Quickness increases action speed by 50 %, so unquickened cast time = quicknessCastTimeMs * 1.5.
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
  'packetLabel',
  'requiredTrait',
  'source',
  'sourceId',
  'actorType',
  'ownerActorType',
  'summonKind',
  'weapon',
  'weaponStrength',
  'weaponStrengthProfileId',
  'weaponStrengthSource',
  'skillWeapon',
  'canCrit',
  'flatDamage',
  'flatStrikeBase',
  'flatStrikePowerCoeff',
  'persistsAfterInterrupt',
  'interruptCommitMs',
  'recipients',
  'affectsSelf',
  'affectsSummons',
  'maximumRecipients',
  'targetCap',
  'companionIds',
  'metadata',
  'eventType',
  'event',
  'comboFields',
  'comboFinishers'
]);
const EFFECT_METADATA_FIELDS = new Set([
  'skillName',
  'parentSkillName',
  'controlKind',
  'duration',
  'breakbar',
  'bonusDefianceBreak',
  'damageKind',
  'flatDamage',
  'flatStrikeBase',
  'flatStrikePowerCoeff',
  'flatStrikeMultiplier',
  'flatStrikeHealthThreshold',
  'flatStrikeThresholdMultiplier',
  'noCrit',
  'forceCrit',
  'projectile',
  'summonKind',
  'recipients',
  'affectsSelf',
  'affectsSummons',
  'maximumRecipients',
  'targetCap',
  'companionIds',
  'hitboxIndex',
  'smallHitboxCap',
  'largeHitboxOnly',
  'affinityOnHit',
  'legendId',
  'target',
  'trigger'
]);

/**
 * Normalizes handler maps so catalog lookup is always string-keyed regardless
 * of whether the source used a plain object or Map.
 *
 * @param {ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>> | null | undefined} value
 * @returns {Map<string, SkillHandlerStrategy<SchedulerRecord>>}
 */
function normalizeSkillHandlers(
  value: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>> | null | undefined
): Map<string, SkillHandlerStrategy<SchedulerRecord>> {
  return new Map(toEntries(value).map(([id, handler]) => [id, normalizeSkillHandler(id, handler)]));
}

/**
 * Discovers the catalog's normal weapon chains, applies the small number of
 * API-data corrections supplied by a profession, and creates the shared
 * per-skill position index used by runtime rules.
 *
 * @param {readonly Skill[]} skills
 * @param {{additional?: readonly (readonly import("#gw2/platform/engine/skills/types.d.ts").SkillId[])[], excludeSkillIds?: readonly import("#gw2/platform/engine/skills/types.d.ts").SkillId[]}} [options]
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
 *
 * @param {unknown} value
 * @returns {readonly StrikeTick[]}
 */
function normalizeStrikeTicks(value: unknown): readonly StrikeTick[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('Strike tick timelines require at least one hit.');
  }

  const ticks = value as SchedulerRecord[];
  let previousAtMs = -Infinity;
  return Object.freeze(
    ticks.map((tick, index) => {
      const atMs = Number(tick?.atMs);
      const coefficient = Number(tick?.coefficient);
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
      return Object.freeze({ ...tick, atMs, coefficient });
    })
  );
}

/**
 * Validates explicit condition-application timelines and freezes each entry.
 *
 * @param {unknown} value
 * @returns {readonly ConditionTick[]}
 */
function normalizeConditionTicks(value: unknown): readonly ConditionTick[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('Condition tick timelines require at least one application.');
  }

  const ticks = value as SchedulerRecord[];
  let previousAtMs = -Infinity;
  return Object.freeze(
    ticks.map((tick, index) => {
      const atMs = Number(tick?.atMs);
      const condition = String(tick?.condition || '');
      const stacks = Number(tick?.stacks);
      const duration = Number(tick?.duration);
      if (!(atMs >= 0) || !Number.isFinite(atMs)) {
        throw new TypeError(`Condition application ${index + 1} requires a valid atMs.`);
      }

      if (atMs < previousAtMs) {
        throw new TypeError('Condition tick timelines must be chronological.');
      }

      if (!condition) {
        throw new TypeError(`Condition application ${index + 1} requires a condition id.`);
      }

      if (!(stacks > 0) || !Number.isFinite(stacks)) {
        throw new TypeError(`Condition application ${index + 1} requires positive stacks.`);
      }

      if (!(duration > 0) || !Number.isFinite(duration)) {
        throw new TypeError(`Condition application ${index + 1} requires a positive duration.`);
      }

      previousAtMs = atMs;
      return Object.freeze({
        ...tick,
        atMs,
        condition,
        stacks,
        duration
      });
    })
  );
}

/**
 * Validates one declarative effect and normalizes any embedded timelines.
 *
 * @param {unknown} effect
 * @returns {SkillEffect}
 */
function normalizeEffect(effect: unknown): SkillEffect {
  const candidate = effect && typeof effect === 'object' && !Array.isArray(effect) ? (effect as SchedulerRecord) : null;
  if (!candidate || typeof candidate.type !== 'string' || !EFFECT_TYPES.has(candidate.type)) {
    throw new TypeError(`Invalid skill effect type: ${candidate?.type}`);
  }

  const normalizedEffect = candidate as unknown as SkillEffect;
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

  if (
    normalizedEffect.metadata != null &&
    (typeof normalizedEffect.metadata !== 'object' || Array.isArray(normalizedEffect.metadata))
  ) {
    throw new TypeError('Skill effect metadata must be an object.');
  }

  const unknownMetadata = Object.keys(normalizedEffect.metadata || {}).filter(
    (field) => !EFFECT_METADATA_FIELDS.has(field)
  );
  if (unknownMetadata.length) {
    throw new TypeError(
      'Skill effect metadata has unsupported field' +
        `${unknownMetadata.length === 1 ? '' : 's'}: ` +
        unknownMetadata.join(', ')
    );
  }

  if (
    normalizedEffect.weaponStrengthSource != null &&
    (normalizedEffect.type !== 'strike' || normalizedEffect.weaponStrengthSource !== 'equipped')
  ) {
    throw new TypeError('Effect weaponStrengthSource must be "equipped" on a strike effect.');
  }

  if (normalizedEffect.atMsList != null) {
    throw new TypeError('Exact effect packets must use ticks; atMsList is not canonical.');
  }

  if (normalizedEffect.atCastEndOffsetMs != null) {
    throw new TypeError('Cast-end offsets must use atMs with timingAnchor "castEnd".');
  }

  if (normalizedEffect.at != null) {
    throw new TypeError('Effect offsets must use millisecond fields; legacy at is not canonical.');
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

  // Tick timelines own the full schedule; aggregate fields would be ambiguous or redundant.
  if (
    strikeTicks &&
    (normalizedEffect.coefficient != null ||
      normalizedEffect.hits != null ||
      normalizedEffect.atMs != null ||
      normalizedEffect.intervalMs != null ||
      normalizedEffect.flatDamage != null ||
      normalizedEffect.flatStrikeBase != null ||
      normalizedEffect.flatStrikePowerCoeff != null)
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
    if (!conditionTicks && !String(normalizedEffect.condition || '')) {
      throw new TypeError('Condition effects require a condition id.');
    }

    if (!conditionTicks && (!(Number(normalizedEffect.stacks) > 0) || !(Number(normalizedEffect.duration) > 0))) {
      throw new TypeError('Condition effects require positive stacks and duration.');
    }
  }

  if (normalizedEffect.type === 'boon' || normalizedEffect.type === 'buff') {
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
    ...(hasAtMs ? { atMs: Number(normalizedEffect.atMs) } : {}),
    ...(hasInterval ? { intervalMs: Number(normalizedEffect.intervalMs) } : {}),
    ...(interruptCommitMs == null ? {} : { interruptCommitMs }),
    ...(applications ? { applications } : {}),
    ...(strikeTicks ? { ticks: strikeTicks } : {}),
    ...(conditionTicks ? { ticks: conditionTicks } : {}),
    ...(coefficientModifiers ? { coefficientModifiers } : {})
  }) as SkillEffect;
}

/**
 * Validates the skill-family lockouts applied when a skill activates.
 *
 * @param {unknown} lockouts
 * @param {import("#gw2/platform/engine/skills/types.d.ts").SkillId} skillId
 * @returns {readonly SkillLockout[]}
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

      const candidate = lockout as SchedulerRecord;
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
 * Builds the immutable catalog consumed by the shared scheduler, resolver, and
 * app adapters.
 *
 * @param {CanonicalCatalogOptions} [options]
 * @returns {Readonly<CanonicalCatalog>}
 */
export function createCanonicalCatalog({
  generated = [],
  mechanics = {},
  overrides = {},
  extraSkills = [],
  balanceProfiles = [],
  autoattackChains = {},
  skillHandlers = {},
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
    if (merged.activation != null || merged.castTime != null) {
      throw new TypeError(`Skill ${id} uses legacy cast timing; use castTimeMs.`);
    }

    const quicknessCastTimeMs = merged.quicknessCastTimeMs == null ? null : Number(merged.quicknessCastTimeMs);
    if (quicknessCastTimeMs != null && (!(quicknessCastTimeMs >= 0) || !Number.isFinite(quicknessCastTimeMs))) {
      throw new TypeError(`Skill ${id} has an invalid quicknessCastTimeMs.`);
    }

    // If only quicknessCastTimeMs is provided, derive the unquickened cast time by
    // applying QUICKNESS_ACTION_RATE so both paths share a single source of truth.
    const castTimeMs = Number(
      merged.castTimeMs ?? (quicknessCastTimeMs == null ? 0 : quicknessCastTimeMs * QUICKNESS_ACTION_RATE)
    );
    if (!(castTimeMs >= 0) || !Number.isFinite(castTimeMs)) {
      throw new TypeError(`Skill ${id} requires a non-negative finite castTimeMs.`);
    }

    if (merged.unaffectedByQuickness != null && typeof merged.unaffectedByQuickness !== 'boolean') {
      throw new TypeError(`Skill ${id} has an invalid unaffectedByQuickness.`);
    }

    if (merged.unaffectedByQuickness && quicknessCastTimeMs != null) {
      throw new TypeError(`Skill ${id} cannot specify quicknessCastTimeMs when unaffectedByQuickness is true.`);
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

    const effects = Object.freeze((merged.effects || []).map(normalizeEffect));
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

  const profiles = balanceProfiles.map((profile) =>
    Object.freeze({
      ...profile,
      effects: Object.freeze((profile.effects || []).map(normalizeEffect))
    })
  );
  const profileIds = new Set<SkillId>();
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
    skillHandlers: normalizeSkillHandlers(skillHandlers),
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
 *
 * @param {CanonicalCatalog} catalog
 * @returns {CanonicalCatalog}
 */
export function validateCanonicalCatalog(catalog: CanonicalCatalog): CanonicalCatalog {
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
    if (skill.handlerId && !catalog.skillHandlers?.has(String(skill.handlerId))) {
      throw new Error(`Skill ${skill.id} references missing handler ${skill.handlerId}.`);
    }

    const handler = catalog.skillHandlers?.get(String(skill.handlerId || ''));
    // REPLACE handlers own the entire skill execution; declarative effects would be
    // silently ignored at runtime. Require an empty list to surface authoring mistakes.
    // Exception: handlers with resolveMode still process effects in the resolve phase.
    if (handler?.mode === SKILL_HANDLER_MODES.REPLACE && !handler.resolveMode && (skill.effects || []).length > 0) {
      throw new Error(
        `Skill ${skill.id} uses replacing handler ${skill.handlerId} ` + 'and must declare an empty effects list.'
      );
    }

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

  return catalog;
}
