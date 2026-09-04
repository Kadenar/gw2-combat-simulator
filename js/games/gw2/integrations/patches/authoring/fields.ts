/** Owns editable-field metadata and sanitized authoring references without applying patches. */
import type { BalanceProfile, Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { deepFreeze } from '#gw2/integrations/patches/authoring/immutable.js';
type MutableRecord = Record<string, unknown>;

/** Numeric balance fields accepted by both the authoring API and sparse patch validation. */
export const PATCHABLE_SKILL_NUMERIC_FIELDS = Object.freeze([
  // Recharge and ammo.
  'cooldown',
  'recharge',
  'rechargeMultiplier', // fraction of recharge duration retained
  'rechargeReduction', // flat seconds removed from recharge
  'rechargePenalty',
  'ammo',
  'ammoRecharge',

  // Resource costs, gains, regeneration, and upkeep.
  'resourceCost',
  'resourceGain',
  'energyCost',
  'initiativeCost',
  'upkeepCost',
  'upkeepPulse.duration',
  'upkeepPulse.stacks',
  'energyRegenerationPerSecond',
  'enduranceRegenerationPerSecond',
  'kneelingInitiativeRegenerationBonus',
  'astralForceRetentionMultiplier',
  'vigorRegenerationMultiplier',

  // Strike, condition, and general damage scaling.
  'activeDamageIncrease',
  'basePower',
  'coefficientMultiplier',
  'damageMultiplier',
  'damageIncrease',
  'damageIncreasePerStack',
  'damagePerCoefficient',
  'highStrikeFactor',
  'enhancedStrikeFactor',
  'enhancedConditionBaseDurationFactor',
  'lifeSiphonDamagePerStack',
  'weaponStrength',

  // Attributes and critical-hit scaling.
  'attributeBonus',
  'attributeConversion',
  'attributePerStack',
  'conditionDamageBonus',
  'concentrationBonus',
  'expertiseBonus',
  'ferocityBonus',
  'vitalityConversion',
  'criticalChance',
  'criticalDamage',
  'weaponAttributeBonus',

  // Stacks, durations, targeting, and proc gates.
  'maximumStacks',
  'minimumStacks',
  'playerStacks',
  'allyStacks',
  'threshold',
  'durationPerTier',
  'durationMultiplier',
  'baseDuration',
  'highDuration',
  'enhancedDuration',
  'internalCooldown',
  'maximumTargets',
  'procChance',

  // Recurring and spawned effects.
  'pulseInterval',
  'packetInterval',
  'basePacketCount',
  'highPacketCount',
  'packetCount',
  'baseExtraBlades',
  'highExtraBlades',
  'enhancedExtraBlades',
  'summons',
  'summonInterval',
  'minionCount',

  // Profession-specific resources and state transitions.
  'arrowCost',
  'arrowsRestored',
  'blightCost',
  'blightGain',
  'bladeswornResourceGain',
  'lifeForceDrain',
  'lifeForceGain',
  'lifeForceOnHit',
  'heatLoss',
  'windForceApplyMs',
  'windForceGain'
]);

const AUTHORING_RUNTIME_ONLY_NUMERIC_FIELDS = new Set([
  'alternateEvery',
  'ammoCastLockout',
  'atMs',
  'castTimeMs',
  'commitAtMs',
  'firstPacketRatio',
  'initialDelay',
  'interruptCommitMs',
  'packetIntervalRatio',
  'quicknessCastMultiplier',
  'quicknessCastTimeMs',
  'rechargeOffsetMs',
  'selfStunMs'
]);

/** Balance profiles use the same reduced root-field boundary as authored skills. */
export const PATCHABLE_BALANCE_PROFILE_NUMERIC_FIELDS = PATCHABLE_SKILL_NUMERIC_FIELDS;

export const ADVANCED_BALANCE_PROFILE_NUMERIC_FIELDS = Object.freeze([
  'baseExtraBlades',
  'basePacketCount',
  'basePower',
  'damagePerCoefficient',
  'highExtraBlades',
  'highPacketCount',
  'maximumTargets',
  'minionCount',
  'packetCount',
  'packetInterval',
  'pulseInterval',
  'summonInterval',
  'summons',
  'weaponStrength'
]);

export const PATCHABLE_EFFECT_NUMERIC_FIELDS = Object.freeze([
  'allyStacks',
  'coefficient',
  'hits',
  'stacks',
  'duration',
  'applications',
  'intervalMs',
  'flatDamage',
  'flatStrikeBase',
  'flatStrikePowerCoeff',
  'durationPerAffinity',
  'durationReductionPerAffinity',
  'damageIncreasePerStack',
  'damagePerCoefficient'
] as const);

export const PATCHABLE_BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS = PATCHABLE_EFFECT_NUMERIC_FIELDS;

const BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS = new Set<string>(PATCHABLE_BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS);
const ADVANCED_BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS = new Set([
  'applications',
  'damagePerCoefficient',
  'flatDamage',
  'flatStrikeBase',
  'flatStrikePowerCoeff',
  'intervalMs'
]);

export type BalanceProfileAuthoringTier = 'primary' | 'advanced';

/** Separates common patch-note values from specialist calibration controls in the profile editor. */
export function balanceProfileNumericFieldTier(field: string): BalanceProfileAuthoringTier | null {
  if (!PATCHABLE_BALANCE_PROFILE_NUMERIC_FIELDS.includes(field)) return null;
  return ADVANCED_BALANCE_PROFILE_NUMERIC_FIELDS.includes(field) ? 'advanced' : 'primary';
}

/** Treats one-hit declarations as structural while keeping changed hit counts visible as primary balance values. */
export function balanceProfileEffectNumericFieldTier(field: string, value: number): BalanceProfileAuthoringTier | null {
  if (!BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS.has(field)) return null;
  return ADVANCED_BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS.has(field) || (field === 'hits' && value === 1)
    ? 'advanced'
    : 'primary';
}

/** Detects whether an effect or nested tick exposes at least one approved profile control. */
function effectHasAuthorableProfileValue(effect: Readonly<SkillEffect>): boolean {
  for (const [field, value] of Object.entries(effect)) {
    if (typeof value === 'number' && balanceProfileEffectNumericFieldTier(field, value)) return true;
  }

  return Array.isArray(effect.ticks) && effect.ticks.some(effectHasAuthorableProfileValue);
}

/** Reads a nested numeric candidate without treating missing path segments as errors. */
function valueAtPath(root: unknown, path: string): unknown {
  let value = root;
  for (const segment of path.split('.')) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const record = value as Readonly<Record<string, unknown>>;
    if (!Object.hasOwn(record, segment)) return undefined;
    value = record[segment];
  }

  return value;
}

/** Returns only the numeric skill fields deliberately exposed by the authoring API. */
export function skillPatchableNumericFields(skill: Readonly<Skill | BalanceProfile>): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(
      PATCHABLE_SKILL_NUMERIC_FIELDS.flatMap((field) => {
        const value = valueAtPath(skill, field);
        return typeof value === 'number' ? [[field, value]] : [];
      })
    )
  );
}

/** Recursively removes runtime-only timing fields before catalog data crosses the authoring API boundary. */
function withoutRuntimeOnlyAuthoringFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutRuntimeOnlyAuthoringFields);
  if (!value || typeof value !== 'object') return structuredClone(value);
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>).flatMap(([field, nested]) =>
      AUTHORING_RUNTIME_ONLY_NUMERIC_FIELDS.has(field) ? [] : [[field, withoutRuntimeOnlyAuthoringFields(nested)]]
    )
  );
}

/** Builds a skill reference for the editor while retaining complete timing data in the runtime catalog. */
export function skillAuthoringReference(skill: Readonly<Skill>): Readonly<Skill> {
  return deepFreeze(withoutRuntimeOnlyAuthoringFields(skill) as Skill);
}

/** Returns the numeric balance-profile fields supported by patch authoring. */
export function balanceProfilePatchableNumericFields(
  profile: Readonly<BalanceProfile>
): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(
      PATCHABLE_BALANCE_PROFILE_NUMERIC_FIELDS.flatMap((field) => {
        const value = valueAtPath(profile, field);
        return typeof value === 'number' ? [[field, value]] : [];
      })
    )
  );
}

/** Keeps runtime-only or empty profiles out of the authoring payload without removing them from the catalog. */
export function balanceProfileHasAuthorableControls(profile: Readonly<BalanceProfile>): boolean {
  return (
    Object.keys(balanceProfilePatchableNumericFields(profile)).length > 0 ||
    (profile.effects || []).some(effectHasAuthorableProfileValue)
  );
}

/** Copies effect identity and approved numeric controls while dropping runtime-only timing metadata. */
function balanceProfileEffectAuthoringReference(record: Readonly<Record<string, unknown>>): MutableRecord {
  return Object.fromEntries(
    Object.entries(record).flatMap(([field, value]) => {
      if (field === 'ticks' && Array.isArray(value)) {
        return [[field, value.map((tick) => balanceProfileEffectAuthoringReference(tick as Readonly<MutableRecord>))]];
      }

      if (typeof value === 'number' && !balanceProfileEffectNumericFieldTier(field, value)) return [];
      return [[field, structuredClone(value)]];
    })
  );
}

/** Builds the sanitized profile reference sent to authoring without leaking simulator-only fields. */
export function balanceProfileAuthoringReference(profile: Readonly<BalanceProfile>): Readonly<BalanceProfile> {
  return deepFreeze({
    id: profile.id,
    name: profile.name,
    profileKind: profile.profileKind,
    ...(profile.parentId == null ? {} : { parentId: profile.parentId }),
    ...balanceProfilePatchableNumericFields(profile),
    effects: (profile.effects || []).map((effect) =>
      balanceProfileEffectAuthoringReference(effect as unknown as Readonly<MutableRecord>)
    )
  } as unknown as BalanceProfile);
}
