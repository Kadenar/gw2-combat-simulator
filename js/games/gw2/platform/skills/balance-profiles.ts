import type { CustomSideEffectAction } from '#gw2/platform/effects/actions.js';
import type {
  AuraEffect,
  ConditionEffect,
  ControlEffect,
  CustomEffect,
  SkillEffect,
  StatusEffect,
  StrikeEffect
} from '#gw2/platform/effects/types.js';
import {
  requireBalanceNumber,
  requireCanonicalSkillEffects,
  skillEffectKey
} from '#gw2/platform/effects/validation.js';
import { fieldValue } from '#gw2/platform/skills/field-specs.js';
import type {
  BalanceProfile,
  CanonicalCatalog,
  Skill,
  SkillAttributeKey,
  SkillId
} from '#gw2/platform/skills/types.js';

type SkillEffectByType<TType extends SkillEffect['type']> = TType extends StrikeEffect['type']
  ? StrikeEffect
  : TType extends ConditionEffect['type']
    ? ConditionEffect
    : TType extends ControlEffect['type']
      ? ControlEffect
      : TType extends StatusEffect['type']
        ? Extract<StatusEffect, { type: TType }>
        : TType extends AuraEffect['type']
          ? AuraEffect
          : TType extends CustomEffect['type']
            ? CustomEffect
            : never;

/** Readers accept only the selected catalog capabilities, preserving its maps and owner types. */
export type BalanceSource<TSkill extends Skill = Skill> = Pick<
  CanonicalCatalog<TSkill>,
  'skillsById' | 'balanceProfilesById' | 'balanceDataContext'
>;

export type BalanceProfileSource = Pick<BalanceSource, 'balanceProfilesById' | 'balanceDataContext'>;

export type SkillSource<TSkill extends Skill = Skill> = Pick<
  BalanceSource<TSkill>,
  'skillsById' | 'balanceDataContext'
>;

/** Diagnostics describe the supplied source without borrowing identity from enclosing runtime state. */
function balanceDataLabel(source: Pick<BalanceSource, 'balanceDataContext'>, owner: string): string {
  const metadata = source.balanceDataContext;
  return `profession=${metadata?.professionId ?? '<unknown>'} patch=${metadata?.patchId ?? '<unknown>'} ${owner}`;
}

/**
 * Owners carry their selected source, so diagnostics never need the runtime context that resolved them. Patched
 * catalogs stamp the source on profiles; skills never carry it.
 */
function ownerDataLabel(owner: Skill | BalanceProfile, subject: string): string {
  const metadata = 'balanceDataContext' in owner ? owner.balanceDataContext : undefined;
  return `profession=${metadata?.professionId ?? '<unknown>'} patch=${metadata?.patchId ?? '<unknown>'} ${subject}`;
}

/** Shared effect diagnostics identify the owner without requiring a stored skill/profile discriminator. */
function effectOwnerLabel(owner: Skill | BalanceProfile): string {
  return ownerDataLabel(owner, `owner=${owner.id}`);
}

/** Optional reads stay in the selected source, including when an ID is absent. */
export function balanceProfile(source: BalanceProfileSource, id: SkillId): BalanceProfile | undefined {
  return source.balanceProfilesById.get(id);
}

/** Required reads fail in the selected source instead of falling through to another patch. */
export function requireBalanceProfile(source: BalanceProfileSource, id: SkillId): BalanceProfile {
  const profile = balanceProfile(source, id);

  if (!profile)
    throw new Error(`Invalid balance data: ${balanceDataLabel(source, `profile=${id}`)} missing required profile`);

  return profile;
}

/** Required balance inputs fail visibly instead of silently using unpatched values or producing NaN. */
export function balanceProfileNumber(profile: BalanceProfile, field: string): number {
  // Scalar tuning is read directly on combat paths; attribute maps have their own typed reader.
  const value = profile[field];

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  return requireBalanceNumber(value, ownerDataLabel(profile, `profile=${profile.id} field=${field}`));
}

/** Read a named fixed grant without parsing authoring paths during combat. */
export function ownerAttributeBonusNumber(
  owner: Skill | BalanceProfile,
  attribute: SkillAttributeKey,
  group = 'attributeBonuses'
): number {
  const grants = fieldValue(owner, group) as Skill['attributeBonuses'];
  const value = grants?.[attribute];

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  return requireBalanceNumber(value, ownerDataLabel(owner, `owner=${owner.id} field=${group}.${attribute}`));
}

/** Read a required attribute grant from the caller's selected profile catalog. */
export function attributeBonusNumber(
  source: BalanceProfileSource,
  profileId: SkillId,
  attribute: SkillAttributeKey,
  group = 'attributeBonuses'
): number {
  return ownerAttributeBonusNumber(requireBalanceProfile(source, profileId), attribute, group);
}

/** Read one required numeric field from a profile in the caller's selected catalog. */
export function balanceNumber(source: BalanceProfileSource, id: SkillId, field: string): number {
  return balanceProfileNumber(requireBalanceProfile(source, id), field);
}

/** Read one opt-in proc chance for scheduler and resolver paths while retaining profession-owned eligibility and ICDs. */
export function procChance(
  source: BalanceProfileSource,
  id: SkillId,
  overrides?: Readonly<Record<string, number>>
): number {
  const profile = requireBalanceProfile(source, id);
  const declaration = profile.procRate;
  const label = balanceDataLabel(source, `profile=${id} field=procRate`);

  if (!declaration?.id || !declaration.field) throw new Error(`Invalid balance data: ${label} missing declaration`);

  // Overrides tune a valid declaration; they must not conceal missing or invalid baseline data.
  const baseline = balanceProfileNumber(profile, declaration.field);
  const override = overrides?.[declaration.id];
  const chance = override === undefined ? baseline : requireBalanceNumber(override, label);

  if (baseline < 0 || baseline > 1 || chance < 0 || chance > 1)
    throw new Error(`Invalid balance data: ${label} expected=number in [0, 1]`);

  return chance;
}

/** The selected skill map retains the owning profession's skill subtype. */
export function requireSkill<TSkill extends Skill>(source: SkillSource<TSkill>, id: SkillId): TSkill {
  const skill = source.skillsById.get(id);

  if (!skill)
    throw new Error(`Invalid balance data: ${balanceDataLabel(source, `skill=${id}`)} missing required skill`);

  return skill;
}

/** Read direct or grouped skill tuning while retaining the selected owner and full path in diagnostics. */
export function skillNumber(skill: Skill, field: string): number {
  let value: unknown = skill;
  for (const segment of field.split('.')) {
    value =
      value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, segment)
        ? (value as Readonly<Record<string, unknown>>)[segment]
        : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  return requireBalanceNumber(value, ownerDataLabel(skill, `skill=${skill.id} field=${field}`));
}

/** Share an owner's canonical effect; construction rejects duplicates and only recorded removals may omit a key. */
export function requireEffect<TType extends SkillEffect['type']>(
  owner: Skill | BalanceProfile,
  type: TType,
  name: string,
  action?: CustomSideEffectAction
): SkillEffectByType<TType> | undefined {
  const effect = requireCanonicalSkillEffects(owner, action).find(
    (effect) => effect.type === type && effect.name === name
  );

  if (effect) return effect as SkillEffectByType<TType>;

  const key = skillEffectKey(type, name);

  if ((action ?? owner).removedEffectKeys?.includes(key)) return undefined;

  throw new Error(
    `Invalid balance data: ${effectOwnerLabel(owner)}${action ? ` action=${action.id ?? action.type}` : ''} effect=${type}/${name} unknown effect key`
  );
}

/** Validate a surviving effect's field without looking up its owner again; the owner supplies diagnostics. */
export function effectNumber(owner: Skill | BalanceProfile, effect: SkillEffect, field: string): number {
  // Valid hot-path reads need no diagnostic strings; retain the full owner context when validation fails.
  const value = (effect as unknown as Readonly<Record<string, unknown>>)[field];

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  return requireBalanceNumber(
    value,
    `${effectOwnerLabel(owner)} effect=${effect.type}/${effect.name ?? '<unnamed>'} field=${field}`
  );
}
