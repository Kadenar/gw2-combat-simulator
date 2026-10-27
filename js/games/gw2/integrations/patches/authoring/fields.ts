import { hasActionEffects } from '#gw2/platform/effects/actions.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import { patchableSkillFields, type SkillFieldSpecs } from '#gw2/platform/skills/field-specs.js';
import { SHARED_SKILL_FIELDS } from '#gw2/platform/skills/shared-fields.js';
/** Owns editable-field metadata and sanitized authoring references without applying patches. */
import type { BalanceProfile, Skill } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { deepFreeze } from '#gw2/integrations/patches/authoring/immutable.js';

// Effect and profile timing internals stay out of authoring references; skill fields declare their own visibility.
const EFFECT_RUNTIME_ONLY_NUMERIC_FIELDS = [
  'alternateEvery',
  'atMs',
  'firstPacketRatio',
  'initialDelay',
  'interruptCommitMs',
  'packetIntervalRatio',
  'quicknessCastMultiplier'
];

/** Names hidden at every nesting level of an authoring reference, including the skill fields declared runtime-only. */
function runtimeOnlyAuthoringFields(fields: SkillFieldSpecs): ReadonlySet<string> {
  return new Set([
    ...EFFECT_RUNTIME_ONLY_NUMERIC_FIELDS,
    ...Object.entries(fields).flatMap(([field, spec]) => (spec.kind === 'number' && spec.runtimeOnly ? [field] : []))
  ]);
}

const PROFILE_RUNTIME_ONLY_NUMERIC_FIELDS = runtimeOnlyAuthoringFields(SHARED_SKILL_FIELDS);

/**
 * Numeric fields that trait and shared mechanic profiles may patch. Skill fields are declared by the platform or
 * the owning profession and read from the selected catalog instead.
 */
export const PATCHABLE_BALANCE_PROFILE_NUMERIC_FIELDS = Object.freeze([
  // Recharge, ammo, resource costs, and regeneration.
  'cooldown',
  'recharge',
  'rechargeMultiplier',
  'rechargeReduction',
  'rechargePenalty',
  'empoweredRechargeMultiplier',
  'maximumAmmo',
  'resourceCost',
  'resourceCostMultiplier',
  'resourceGain',
  'entryResourceGain',
  'energyRegenerationPerSecond',
  'enduranceRegenerationMultiplier',
  'astralForceRetentionMultiplier',
  'vigorRegenerationMultiplier',

  // Strike, condition, and general damage scaling.
  'coefficientMultiplier',
  'damageMultiplier',
  'damageIncrease',
  'damageIncreasePerStack',
  'lifeSiphonDamagePerStack',
  'weaponStrength',
  'conditionDamageMultiplier',
  'conditionDamageIncrease',
  'conditionDamageIncreasePerStack',
  'conditionBaseDamage',
  'conditionDamageScaling',
  'playerDamageMultiplier',
  'damagePerBoon',
  'damagePerCondition',
  'maximumDamageIncrease',
  'bonusPerHeat',
  'activatingFactor',
  'idleFactor',
  'offhandDamageIncrease',
  'offhandConditionDamageIncrease',
  'upkeepDamageIncrease',
  'baseBonus',
  'activeBonus',
  'strikeBonus',
  'conditionBonus',
  'waterFactor',
  'otherFactor',
  'highHealthFactor',
  'lowHealthOrDisabledFactor',

  // Tiered damage curves and their activation thresholds.
  'lowerThreshold',
  'middleThreshold',
  'upperThreshold',
  'highThreshold',
  'lowerBonus',
  'middleBonus',
  'upperBonus',
  'strikeLow',
  'strikeMiddle',
  'strikeHigh',
  'conditionLow',
  'conditionMiddle',
  'conditionHigh',

  // Attributes, summon inheritance, and critical-hit scaling.
  'attributeBonus',
  'attributeMultiplier',
  'attributeConversion',
  'attributePerStack',
  'concentrationBonus',
  'expertiseBonus',
  'vitalityConversion',
  'weaponAttributeBonus',
  'baseAttribute',
  'inheritanceRatio',
  'secondaryAttributeCap',
  'powerCap',
  'precisionCap',
  'basePrecision',
  'criticalChance',
  'criticalDamage',
  'criticalChanceBonus',
  'phantasmCriticalChance',
  'lowHealthCriticalDamage',
  'lowHealthCriticalChance',
  'criticalChancePerCondition',
  'criticalChancePerStack',
  'fullEnduranceCriticalChance',
  'assassinAttributeBonus',
  'centaurAttributeBonus',
  'demonAttributeBonus',
  'dwarfAttributeBonus',
  'entityAttributeBonus',

  // Stacks, durations, targeting, and proc gates.
  'internalCooldown',
  'stackMultiplier', // scales authored boon stacks without changing their duration
  'maximumStacks',
  'minimumStacks',
  'playerStacks',
  'allyStacks',
  'threshold',
  'maximumDamageStacks',
  'maximumBoons',
  'maximumConditions',
  'duration',
  'durationPerTier',
  'durationMultiplier',
  'durationExtension',
  'immobilizeDurationExtension',
  'baseDuration',
  'boonDurationBonus',
  'sharedDurationMultiplier',
  'conditionDurationMultiplier',
  'conditionDurationBonus',
  'maximumTargets',
  'procChance',
  'weaponProcChanceMultiplier',

  // Recurring, spawned, and trait-specific pulse effects.
  'pulseInterval',
  'auraPulseInterval',
  'interval',
  RECIPIENT.SUMMONS,

  // Profession-specific resource grants and capacity.
  'blightGain',
  'bladeswornResourceGain',
  'lifeForceDrain',
  'fervorStacks',
  'lifeForceGain',
  'lifeForcePerStack',
  'lifeForceGainMultiplier',
  'lifeForceCapacityMultiplier',

  // Antiquary artifact damage and condition-duration scaling.
  'guitarFactor',
  'guitarFinalFactor',
  'mortarFactor',
  'chakFactor',
  'kryptisFactor',
  'holoFactor',
  'mortarBurningDurationMultiplier',
  'sunCrystalBurningDurationMultiplier',
  'kryptisTormentDurationMultiplier',
  'kryptisDuration'
]);

const ADVANCED_BALANCE_PROFILE_NUMERIC_FIELDS = Object.freeze([
  'maximumTargets',
  'pulseInterval',
  RECIPIENT.SUMMONS,
  'weaponStrength'
]);

export const PATCHABLE_EFFECT_NUMERIC_FIELDS = Object.freeze([
  'allyStacks',
  'coefficient',
  'hits',
  'stacks',
  'duration',
  'maximumDuration',
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

/** Flat packets use their own formula, including defaults inherited by ticks; ordinary coefficients cannot tune it. */
export function effectNumericFieldIsPatchable(
  field: string,
  effect: Readonly<Record<string, unknown>>,
  parent?: Readonly<Record<string, unknown>>
): boolean {
  return (
    PATCHABLE_EFFECT_NUMERIC_FIELDS.some((candidate) => candidate === field) &&
    !(
      field === 'coefficient' &&
      [effect, parent].some(
        (source) =>
          source && ['flatDamage', 'flatStrikeBase', 'flatStrikePowerCoeff'].some((key) => Number.isFinite(source[key]))
      )
    )
  );
}

const BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS = new Set<string>(PATCHABLE_EFFECT_NUMERIC_FIELDS);
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
function effectHasAuthorableProfileValue(effect: Readonly<SkillEffect>, parent?: Readonly<SkillEffect>): boolean {
  for (const [field, value] of Object.entries(effect)) {
    if (typeof value === 'number' && effectNumericFieldIsPatchable(field, effect, parent)) return true;
  }

  return Array.isArray(effect.ticks) && effect.ticks.some((tick) => effectHasAuthorableProfileValue(tick, effect));
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

/** Returns the skill's numeric values whose declarations in the selected catalog permit patch edits. */
export function skillPatchableNumericFields(
  skill: Readonly<Skill>,
  fields: SkillFieldSpecs
): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(
      patchableSkillFields(fields).flatMap(([field]) => {
        const value = valueAtPath(skill, field);
        return typeof value === 'number' ? [[field, value]] : [];
      })
    )
  );
}

/** Runtime predicates and activation declarations stay in the executable catalog, never in editor JSON. */
function withoutRuntimeOnlyAuthoringFields(
  value: unknown,
  runtimeOnly: ReadonlySet<string>,
  parent?: Readonly<Record<string, unknown>>
): unknown {
  if (Array.isArray(value)) return value.map((entry) => withoutRuntimeOnlyAuthoringFields(entry, runtimeOnly, parent));

  if (typeof value === 'function') return undefined;

  if (!value || typeof value !== 'object') return structuredClone(value);

  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>).flatMap(([field, nested]) =>
      // Cast grants and inline payloads remain editable; executable predicates stay private.
      field === 'sideEffects' && Array.isArray(nested)
        ? nested.some((rule) => (rule.do?.type === 'resourceGrant' && rule.do?.id) || hasActionEffects(rule.do))
          ? [
              [
                field,
                nested
                  .filter((rule) => (rule.do?.type === 'resourceGrant' && rule.do?.id) || hasActionEffects(rule.do))
                  .map((rule) => withoutRuntimeOnlyAuthoringFields(rule, runtimeOnly))
              ]
            ]
          : []
        : (field === 'coefficient' &&
              !effectNumericFieldIsPatchable(field, value as Record<string, unknown>, parent)) ||
            typeof nested === 'function' ||
            runtimeOnly.has(field) ||
            ['effectVariants', 'when'].includes(field)
          ? []
          : [
              [
                field,
                withoutRuntimeOnlyAuthoringFields(
                  nested,
                  runtimeOnly,
                  field === 'ticks' ? (value as Record<string, unknown>) : undefined
                )
              ]
            ]
    )
  );
}

/**
 * Builds a skill reference for the editor while retaining complete timing data in the runtime catalog. The selected
 * catalog's field table decides which skill fields are runtime-only.
 */
export function skillAuthoringReference(skill: Readonly<Skill>, fields: SkillFieldSpecs): Readonly<Skill> {
  return deepFreeze(withoutRuntimeOnlyAuthoringFields(skill, runtimeOnlyAuthoringFields(fields)) as Skill);
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
    (profile.effects || []).some((effect) => effectHasAuthorableProfileValue(effect))
  );
}

/** Copies effect identity and approved numeric controls while dropping runtime-only timing metadata. */
function balanceProfileEffectAuthoringReference(
  record: Readonly<Record<string, unknown>>,
  parent?: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).flatMap(([field, value]) => {
      if (field === 'when') return [];

      if (field === 'ticks' && Array.isArray(value)) {
        return [
          [
            field,
            value.map((tick) =>
              balanceProfileEffectAuthoringReference(tick as Readonly<Record<string, unknown>>, record)
            )
          ]
        ];
      }

      if (typeof value === 'number' && !effectNumericFieldIsPatchable(field, record, parent)) return [];

      return [[field, withoutRuntimeOnlyAuthoringFields(value, PROFILE_RUNTIME_ONLY_NUMERIC_FIELDS)]];
    })
  );
}

/** Builds the sanitized profile reference sent to authoring without leaking simulator-only fields. */
export function balanceProfileAuthoringReference(profile: Readonly<BalanceProfile>): Readonly<BalanceProfile> {
  return deepFreeze({
    id: profile.id,
    name: profile.name,
    profileKind: profile.profileKind,
    ...balanceProfilePatchableNumericFields(profile),
    effects: (profile.effects || []).map((effect) =>
      balanceProfileEffectAuthoringReference(effect as unknown as Readonly<Record<string, unknown>>)
    )
  } as unknown as BalanceProfile);
}
