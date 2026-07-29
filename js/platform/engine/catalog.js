/**
 * Canonical catalog assembly for profession-neutral skill metadata. This is the
 * boundary where generated API data, hand-authored mechanics, explicit
 * overrides, and resolver handlers become one validated immutable lookup.
 */
import {
  normalizeSkillHandler,
  SKILL_HANDLER_MODES,
} from "./skill-handlers.js";
import {
  deriveAutoattackChains,
  indexAutoattackChains,
} from "./autoattack-chains.js";

const EFFECT_TYPES = new Set([
  "strike",
  "condition",
  "control",
  "blind",
  "boon",
  "buff",
  "custom",
]);
const TIMING_ANCHORS = new Set(["castStart", "castEnd"]);
const TIMING_SCALES = new Set(["cast", "fixed"]);
const RECHARGE_ANCHORS = new Set(["castStart", "castEnd"]);
const EFFECT_FIELDS = new Set([
  "type",
  "coefficient",
  "coefficientModifiers",
  "hits",
  "applications",
  "ticks",
  "condition",
  "stacks",
  "duration",
  "boon",
  "kind",
  "name",
  "atMs",
  "intervalMs",
  "intervalTimingScale",
  "timingAnchor",
  "timingScale",
  "castProgress",
  "packetLabel",
  "requiredTrait",
  "source",
  "sourceId",
  "actorType",
  "weapon",
  "weaponStrength",
  "skillWeapon",
  "canCrit",
  "flatDamage",
  "flatStrikeBase",
  "flatStrikePowerCoeff",
  "persistsAfterInterrupt",
  "metadata",
  "eventType",
  "event",
]);
const EFFECT_METADATA_FIELDS = new Set([
  "controlKind",
  "duration",
  "breakbar",
  "bonusDefianceBreak",
  "damageKind",
  "extendsResolutionHorizon",
  "flatDamage",
  "flatStrikeBase",
  "flatStrikePowerCoeff",
  "flatStrikeMultiplier",
  "flatStrikeHealthThreshold",
  "flatStrikeThresholdMultiplier",
  "noCrit",
  "summonKind",
]);

/**
 * Normalizes handler maps so catalog lookup is always string-keyed regardless
 * of whether the source used a plain object or Map.
 */
function normalizeSkillHandlers(value) {
  const entries = value instanceof Map
    ? [...value.entries()]
    : Object.entries(value || {});
  return new Map(entries.map(([id, handler]) => {
    const normalizedId = String(id);
    return [
      normalizedId,
      normalizeSkillHandler(normalizedId, handler),
    ];
  }));
}

/**
 * Discovers the catalog's normal weapon chains, applies the small number of
 * API-data corrections supplied by a profession, and creates the shared
 * per-skill position index used by runtime rules.
 */
function normalizeAutoattackChains(skills, options = {}) {
  if (
    options == null
    || typeof options !== "object"
    || Array.isArray(options)
  ) {
    throw new TypeError("Autoattack-chain options must be an object.");
  }
  const additional = options.additional ?? [];
  const excluded = options.excludeSkillIds ?? [];
  if (!Array.isArray(additional) || !Array.isArray(excluded)) {
    throw new TypeError(
      "Autoattack-chain additions and exclusions must be arrays.",
    );
  }

  const excludedIds = new Set(excluded.map(Number));
  const chains = Object.freeze([
    ...deriveAutoattackChains(skills),
    ...additional,
  ]
    .filter(chain =>
      !chain.some(skillId => excludedIds.has(Number(skillId))))
    .map(chain => Object.freeze(chain.map(Number))));
  const skillIds = new Set(skills.map(skill => skill.id));
  for (const chain of chains) {
    for (const skillId of chain) {
      if (!skillIds.has(skillId)) {
        throw new TypeError(
          `Autoattack chain references missing skill ${skillId}.`,
        );
      }
    }
  }
  return {
    chains,
    positions: indexAutoattackChains(chains),
  };
}

/**
 * Validates explicit strike timelines and freezes each hit descriptor.
 */
function normalizeStrikeTicks(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("Strike tick timelines require at least one hit.");
  }
  let previousAtMs = -Infinity;
  return Object.freeze(value.map((tick, index) => {
    const atMs = Number(tick?.atMs);
    const coefficient = Number(tick?.coefficient);
    if (!(atMs >= 0) || !Number.isFinite(atMs)) {
      throw new TypeError(`Strike tick ${index + 1} requires a valid atMs.`);
    }
    if (!(coefficient >= 0) || !Number.isFinite(coefficient)) {
      throw new TypeError(
        `Strike tick ${index + 1} requires a non-negative coefficient.`,
      );
    }
    if (atMs < previousAtMs) {
      throw new TypeError("Strike tick timelines must be chronological.");
    }
    previousAtMs = atMs;
    return Object.freeze({ ...tick, atMs, coefficient });
  }));
}

/**
 * Validates explicit condition-application timelines and freezes each entry.
 */
function normalizeConditionTicks(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(
      "Condition tick timelines require at least one application.",
    );
  }
  let previousAtMs = -Infinity;
  return Object.freeze(value.map((tick, index) => {
    const atMs = Number(tick?.atMs);
    const condition = String(tick?.condition || "");
    const stacks = Number(tick?.stacks);
    const duration = Number(tick?.duration);
    if (!(atMs >= 0) || !Number.isFinite(atMs)) {
      throw new TypeError(
        `Condition application ${index + 1} requires a valid atMs.`,
      );
    }
    if (atMs < previousAtMs) {
      throw new TypeError("Condition tick timelines must be chronological.");
    }
    if (!condition) {
      throw new TypeError(
        `Condition application ${index + 1} requires a condition id.`,
      );
    }
    if (!(stacks > 0) || !Number.isFinite(stacks)) {
      throw new TypeError(
        `Condition application ${index + 1} requires positive stacks.`,
      );
    }
    if (!(duration > 0) || !Number.isFinite(duration)) {
      throw new TypeError(
        `Condition application ${index + 1} requires a positive duration.`,
      );
    }
    previousAtMs = atMs;
    return Object.freeze({
      ...tick,
      atMs,
      condition,
      stacks,
      duration,
    });
  }));
}

/**
 * Validates one declarative effect and normalizes any embedded timelines.
 */
function normalizeEffect(effect) {
  if (!effect || typeof effect !== "object" || !EFFECT_TYPES.has(effect.type)) {
    throw new TypeError(`Invalid skill effect type: ${effect?.type}`);
  }
  const unknownFields = Object.keys(effect)
    .filter(field => !EFFECT_FIELDS.has(field));
  if (unknownFields.length) {
    throw new TypeError(
      `Skill effect has unsupported field${unknownFields.length === 1 ? "" : "s"}: `
      + unknownFields.join(", "),
    );
  }
  if (
    effect.metadata != null
    && (
      typeof effect.metadata !== "object"
      || Array.isArray(effect.metadata)
    )
  ) {
    throw new TypeError("Skill effect metadata must be an object.");
  }
  const unknownMetadata = Object.keys(effect.metadata || {})
    .filter(field => !EFFECT_METADATA_FIELDS.has(field));
  if (unknownMetadata.length) {
    throw new TypeError(
      "Skill effect metadata has unsupported field"
      + `${unknownMetadata.length === 1 ? "" : "s"}: `
      + unknownMetadata.join(", "),
    );
  }
  if (effect.atMsList != null) {
    throw new TypeError(
      "Exact effect packets must use ticks; atMsList is not canonical.",
    );
  }
  if (effect.atCastEndOffsetMs != null) {
    throw new TypeError(
      "Cast-end offsets must use atMs with timingAnchor \"castEnd\".",
    );
  }
  if (effect.at != null) {
    throw new TypeError(
      "Effect offsets must use millisecond fields; legacy at is not canonical.",
    );
  }
  if (
    effect.ticks != null
    && effect.type !== "strike"
    && effect.type !== "condition"
  ) {
    throw new TypeError(
      `Effect type ${effect.type} does not support tick timelines.`,
    );
  }
  const strikeTicks = effect.type === "strike" && effect.ticks != null
    ? normalizeStrikeTicks(effect.ticks)
    : null;
  const conditionTicks = effect.type === "condition" && effect.ticks != null
    ? normalizeConditionTicks(effect.ticks)
    : null;
  const hasTicks = Boolean(strikeTicks || conditionTicks);
  const hasAtMs = effect.atMs != null;
  const hasInterval = effect.intervalMs != null;
  const hasExplicitTiming = hasTicks || hasAtMs || hasInterval;
  let applications = null;
  if (effect.applications != null) {
    if (
      effect.type !== "condition"
      && effect.type !== "control"
      && effect.type !== "blind"
    ) {
      throw new TypeError(
        `Effect type ${effect.type} does not support repeated applications.`,
      );
    }
    applications = Number(effect.applications);
    if (!Number.isInteger(applications) || !(applications > 0)) {
      throw new TypeError(
        "Repeated effects require a positive integer application count.",
      );
    }
    if (hasTicks) {
      throw new TypeError(
        "Repeated applications cannot be combined with a tick timeline.",
      );
    }
    if (applications > 1 && !hasInterval) {
      throw new TypeError(
        "Repeated effects require an intervalMs value.",
      );
    }
  }
  let coefficientModifiers = null;
  if (effect.coefficientModifiers != null) {
    if (effect.type !== "strike" || !Array.isArray(effect.coefficientModifiers)) {
      throw new TypeError(
        "Coefficient modifiers are only valid on strike effects.",
      );
    }
    coefficientModifiers = Object.freeze(
      effect.coefficientModifiers.map((modifier, index) => {
        if (
          !modifier
          || modifier.kind !== "target-health-below"
          || !(Number(modifier.threshold) > 0)
          || !(Number(modifier.threshold) < 1)
          || !(Number(modifier.multiplier) > 0)
        ) {
          throw new TypeError(
            `Invalid strike coefficient modifier ${index + 1}.`,
          );
        }
        return Object.freeze({
          kind: modifier.kind,
          threshold: Number(modifier.threshold),
          multiplier: Number(modifier.multiplier),
        });
      }),
    );
  }
  if (hasExplicitTiming) {
    if (!TIMING_ANCHORS.has(effect.timingAnchor)) {
      throw new TypeError(
        "Explicit effect timing requires timingAnchor castStart or castEnd.",
      );
    }
    if (!TIMING_SCALES.has(effect.timingScale)) {
      throw new TypeError(
        "Explicit effect timing requires timingScale cast or fixed.",
      );
    }
    if (effect.timingScale === "cast" && effect.timingAnchor !== "castStart") {
      throw new TypeError(
        "Cast-scaled effect timing must be anchored to castStart.",
      );
    }
    if (
      !hasTicks
      && !hasAtMs
      && effect.timingAnchor !== "castEnd"
    ) {
      throw new TypeError(
        "An interval without atMs must be anchored to castEnd.",
      );
    }
    if (hasAtMs) {
      const atMs = Number(effect.atMs);
      if (!(atMs >= 0) || !Number.isFinite(atMs)) {
        throw new TypeError("Effect atMs must be a non-negative finite number.");
      }
    }
    if (hasInterval) {
      const intervalMs = Number(effect.intervalMs);
      if (!(intervalMs >= 0) || !Number.isFinite(intervalMs)) {
        throw new TypeError(
          "Effect intervalMs must be a non-negative finite number.",
        );
      }
    }
  } else if (effect.timingAnchor != null || effect.timingScale != null) {
    throw new TypeError(
      "Timing metadata is only valid for explicitly timed effects.",
    );
  }
  if (
    strikeTicks
    && (
      effect.coefficient != null
      || effect.hits != null
      || effect.atMs != null
      || effect.intervalMs != null
      || effect.flatDamage != null
      || effect.flatStrikeBase != null
      || effect.flatStrikePowerCoeff != null
    )
  ) {
    throw new TypeError(
      "Strike tick timelines cannot use aggregate coefficient or timing fields.",
    );
  }
  if (
    conditionTicks
    && (
      effect.condition != null
      || effect.stacks != null
      || effect.duration != null
      || effect.atMs != null
      || effect.intervalMs != null
    )
  ) {
    throw new TypeError(
      "Condition tick timelines cannot use aggregate application or timing fields.",
    );
  }
  if (
    effect.type === "strike"
    && !strikeTicks
    && !(Number(effect.coefficient) >= 0)
    && !Number.isFinite(Number(effect.flatDamage))
    && !Number.isFinite(Number(effect.flatStrikeBase))
    && !Number.isFinite(Number(effect.flatStrikePowerCoeff))
  ) {
    throw new TypeError(
      "Strike effects require a non-negative coefficient or flat strike data.",
    );
  }
  if (
    effect.type === "strike"
    && !strikeTicks
    && (
      !Number.isInteger(Number(effect.hits ?? 1))
      || !(Number(effect.hits ?? 1) > 0)
    )
  ) {
    throw new TypeError("Strike effects require a positive integer hit count.");
  }
  if (effect.type === "condition") {
    if (!conditionTicks && !String(effect.condition || "")) {
      throw new TypeError("Condition effects require a condition id.");
    }
    if (
      !conditionTicks
      && (!(Number(effect.stacks) > 0) || !(Number(effect.duration) > 0))
    ) {
      throw new TypeError("Condition effects require positive stacks and duration.");
    }
  }
  if (effect.type === "boon" || effect.type === "buff") {
    if (!String(effect.boon || effect.kind || effect.name || "")) {
      throw new TypeError("Boon and buff effects require a name.");
    }
    if (!(Number(effect.duration) > 0)) {
      throw new TypeError("Boon and buff effects require a positive duration.");
    }
  }
  return Object.freeze({
    ...effect,
    ...(hasAtMs ? { atMs: Number(effect.atMs) } : {}),
    ...(hasInterval ? { intervalMs: Number(effect.intervalMs) } : {}),
    ...(applications ? { applications } : {}),
    ...(strikeTicks ? { ticks: strikeTicks } : {}),
    ...(conditionTicks ? { ticks: conditionTicks } : {}),
    ...(coefficientModifiers ? { coefficientModifiers } : {}),
  });
}

/**
 * Validates the skill-family lockouts applied when a skill activates.
 */
function normalizeLockouts(lockouts, skillId) {
  if (lockouts == null) return Object.freeze([]);
  if (!Array.isArray(lockouts)) {
    throw new TypeError(`Skill ${skillId} lockouts must be an array.`);
  }
  const groups = new Set();
  return Object.freeze(lockouts.map((lockout, index) => {
    if (!lockout || typeof lockout !== "object" || Array.isArray(lockout)) {
      throw new TypeError(
        `Skill ${skillId} lockout ${index + 1} must be an object.`,
      );
    }
    const group = String(lockout.group || "").trim();
    const durationMs = Number(lockout.durationMs);
    if (!group) {
      throw new TypeError(
        `Skill ${skillId} lockout ${index + 1} requires a group.`,
      );
    }
    if (!(durationMs > 0) || !Number.isFinite(durationMs)) {
      throw new TypeError(
        `Skill ${skillId} lockout ${group} requires a positive durationMs.`,
      );
    }
    if (groups.has(group)) {
      throw new TypeError(
        `Skill ${skillId} declares duplicate lockout group ${group}.`,
      );
    }
    groups.add(group);
    return Object.freeze({ group, durationMs });
  }));
}

/**
 * Builds the immutable catalog consumed by the shared scheduler, resolver, and
 * app adapters.
 */
export function createCanonicalCatalog({
  generated = [],
  mechanics = {},
  overrides = {},
  extraSkills = [],
  autoattackChains = {},
  skillHandlers = {},
  traits = [],
  specializations = [],
  weapons = [],
  weaponHands = {},
  skillNameCollision = "first",
} = {}) {
  if (!["first", "last"].includes(skillNameCollision)) {
    throw new TypeError(
      `Invalid skill name collision policy: ${skillNameCollision}`,
    );
  }
  const declared = [...generated, ...extraSkills];
  const declaredIds = new Set();
  for (const skill of declared) {
    if (declaredIds.has(skill.id)) {
      throw new Error(`Duplicate skill id: ${skill.id}`);
    }
    declaredIds.add(skill.id);
  }
  const generatedById = new Map(generated.map(skill => [skill.id, skill]));
  const allIds = new Set([
    ...generatedById.keys(),
    ...Object.keys(mechanics).map(Number),
    ...Object.keys(overrides).map(Number),
    ...extraSkills.map(skill => skill.id),
  ]);
  const normalizedSkills = [...allIds].map(id => {
    const merged = {
      ...(generatedById.get(id) || {}),
      ...(mechanics[id] || {}),
      ...(overrides[id] || {}),
      ...(extraSkills.find(candidate => candidate.id === id) || {}),
    };
    if (merged.activation != null || merged.castTime != null) {
      throw new TypeError(
        `Skill ${id} uses legacy cast timing; use castTimeMs.`,
      );
    }
    const castTimeMs = Number(merged.castTimeMs ?? 0);
    if (!(castTimeMs >= 0) || !Number.isFinite(castTimeMs)) {
      throw new TypeError(
        `Skill ${id} requires a non-negative finite castTimeMs.`,
      );
    }
    const quicknessCastTimeMs = merged.quicknessCastTimeMs == null
      ? null
      : Number(merged.quicknessCastTimeMs);
    if (
      quicknessCastTimeMs != null
      && (!(quicknessCastTimeMs >= 0) || !Number.isFinite(quicknessCastTimeMs))
    ) {
      throw new TypeError(
        `Skill ${id} has an invalid quicknessCastTimeMs.`,
      );
    }
    if (
      merged.rechargeAnchor != null
      && !RECHARGE_ANCHORS.has(merged.rechargeAnchor)
    ) {
      throw new TypeError(
        `Skill ${id} has invalid rechargeAnchor `
        + `"${merged.rechargeAnchor}".`,
      );
    }
    const rechargeOffsetMs = Number(merged.rechargeOffsetMs ?? 0);
    if (!(rechargeOffsetMs >= 0) || !Number.isFinite(rechargeOffsetMs)) {
      throw new TypeError(
        `Skill ${id} requires a non-negative finite rechargeOffsetMs.`,
      );
    }
    const skill = {
      ...merged,
      castTimeMs,
      ...(rechargeOffsetMs ? { rechargeOffsetMs } : {}),
      ...(quicknessCastTimeMs == null ? {} : { quicknessCastTimeMs }),
      lockouts: normalizeLockouts(merged.lockouts, id),
    };
    skill.effects = Object.freeze((skill.effects || []).map(normalizeEffect));
    skill.tags = Object.freeze([...(skill.tags || [])]);
    return skill;
  });
  const normalizedAutoattacks = normalizeAutoattackChains(
    normalizedSkills,
    autoattackChains,
  );
  const skills = normalizedSkills.map((skill) => {
    const position = normalizedAutoattacks.positions.get(skill.id);
    return Object.freeze({
      ...skill,
      chainRoot: position?.root ?? null,
      chainStep: position?.step ?? null,
    });
  });
  const skillsByName = new Map();
  for (const skill of skills) {
    if (
      skillNameCollision === "last"
      || !skillsByName.has(skill.name)
    ) {
      skillsByName.set(skill.name, skill);
    }
  }
  const catalog = {
    skills: Object.freeze(skills),
    skillsById: new Map(skills.map(skill => [skill.id, skill])),
    skillsByName,
    autoattackChains: normalizedAutoattacks.chains,
    autoattackChainPositions: normalizedAutoattacks.positions,
    skillHandlers: normalizeSkillHandlers(skillHandlers),
    traits: Object.freeze(traits.map(trait => Object.freeze({ ...trait }))),
    specializations: Object.freeze(
      specializations.map(specialization =>
        Object.freeze({ ...specialization })),
    ),
    weapons: new Set(weapons),
    weaponHands: new Map(
      weaponHands instanceof Map
        ? weaponHands
        : Object.entries(weaponHands || {}),
    ),
  };
  validateCanonicalCatalog(catalog);
  return Object.freeze(catalog);
}

/**
 * Enforces referential integrity and shape rules for a canonical catalog.
 */
export function validateCanonicalCatalog(catalog) {
  const validWeaponHands = new Set(["mh", "oh", "mh+oh", "2h", "-"]);
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
    if (!String(skill.name || "")) throw new Error(`Skill ${skill.id} has no name.`);
    if (
      skill.handlerId
      && !catalog.skillHandlers?.has(String(skill.handlerId))
    ) {
      throw new Error(`Skill ${skill.id} references missing handler ${skill.handlerId}.`);
    }
    const handler = catalog.skillHandlers?.get(String(skill.handlerId || ""));
    if (
      handler?.mode === SKILL_HANDLER_MODES.REPLACE
      && !handler.resolveMode
      && skill.effects.length > 0
    ) {
      throw new Error(
        `Skill ${skill.id} uses replacing handler ${skill.handlerId} `
        + "and must declare an empty effects list.",
      );
    }
    for (const reference of [skill.parentId, skill.flipParentId]) {
      if (reference != null && !catalog.skillsById.has(reference)) {
        throw new Error(`Skill ${skill.id} references missing parent ${reference}.`);
      }
    }
    if (skill.weapon && catalog.weapons.size && !catalog.weapons.has(skill.weapon)) {
      throw new Error(`Skill ${skill.id} uses invalid weapon ${skill.weapon}.`);
    }
    if (
      skill.slot != null
      && !Number.isInteger(Number(skill.slot))
      && !/^(?:Weapon_[1-5]|Profession_[1-5]|Heal|Utility|Elite|Action)$/
        .test(String(skill.slot))
    ) {
      throw new Error(`Skill ${skill.id} has invalid slot metadata.`);
    }
  }
  const traitIds = new Set();
  for (const trait of catalog?.traits || []) {
    if (trait.id === undefined || trait.id === null || traitIds.has(trait.id)) {
      throw new Error(`Duplicate or missing trait id: ${trait.id}`);
    }
    if (!String(trait.name || "")) {
      throw new Error(`Trait ${trait.id} has no name.`);
    }
    traitIds.add(trait.id);
  }
  const specializationIds = new Set();
  for (const specialization of catalog?.specializations || []) {
    if (
      specialization.id === undefined
      || specialization.id === null
      || specializationIds.has(specialization.id)
    ) {
      throw new Error(
        `Duplicate or missing specialization id: ${specialization.id}`,
      );
    }
    if (!String(specialization.name || "")) {
      throw new Error(`Specialization ${specialization.id} has no name.`);
    }
    specializationIds.add(specialization.id);
  }
  return catalog;
}
