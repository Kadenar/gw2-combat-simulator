import type {
  BalanceProfile,
  BlindEffect,
  ConditionEffect,
  ControlEffect,
  CustomEffect,
  SkillEffect,
  Skill,
  SkillId,
  StatusEffect,
  StrikeEffect
} from '#gw2/platform/engine/skills/types.js';
import {
  normalizeEffect,
  requireBalanceNumber,
  skillEffectKey
} from '#gw2/platform/engine/skills/canonical-skill-catalog.js';

export type SkillEffectByType<TType extends SkillEffect['type']> = TType extends StrikeEffect['type']
  ? StrikeEffect
  : TType extends ConditionEffect['type']
    ? ConditionEffect
    : TType extends ControlEffect['type']
      ? ControlEffect
      : TType extends BlindEffect['type']
        ? BlindEffect
        : TType extends StatusEffect['type']
          ? StatusEffect
          : TType extends CustomEffect['type']
            ? CustomEffect
            : never;

interface BalanceProfileCatalogLike {
  readonly balanceProfilesById?: ReadonlyMap<SkillId, BalanceProfile>;
  readonly skillsById?: ReadonlyMap<SkillId, Skill>;
  readonly balanceDataContext?: { readonly professionId: string; readonly patchId: string };
}

type BalanceProfileLookup = (id: SkillId) => BalanceProfile | undefined;

export interface BalanceProfileLookupContext {
  readonly config?: { readonly patchId?: string; readonly profession?: string };
  readonly balanceProfile?: BalanceProfileLookup;
  readonly catalog?: BalanceProfileCatalogLike;
  readonly helpers?: BalanceProfileCatalogLike;
  readonly profession?: {
    readonly id?: string;
    readonly catalog?: BalanceProfileCatalogLike;
  };
  readonly runtime?: {
    readonly profession?: {
      readonly catalog?: BalanceProfileCatalogLike;
    };
  };
}

/** Select the authoritative source before looking up IDs; a miss must never search another patch. */
function catalogFromContext(context: unknown): BalanceProfileCatalogLike | undefined {
  if (!context || typeof context !== 'object') return undefined;
  const source = context as BalanceProfileLookupContext;
  return source.catalog ?? source.helpers ?? source.profession?.catalog ?? source.runtime?.profession?.catalog;
}

function balanceDataLabel(context: unknown, owner: string, profile?: BalanceProfile): string {
  const source = context as BalanceProfileLookupContext | null | undefined;
  // Callbacks retain source metadata on their profile; an opaque source must never be called the current patch.
  const metadata = catalogFromContext(context)?.balanceDataContext ?? profile?.balanceDataContext;
  return `profession=${metadata?.professionId ?? source?.profession?.id ?? source?.config?.profession ?? '<unknown>'} patch=${metadata?.patchId ?? source?.config?.patchId ?? '<unknown>'} ${owner}`;
}

/** Resolves patched balance data across scheduler, resolver, profession, and application context shapes. */
export function balanceProfileFromContext(context: unknown, id: SkillId): BalanceProfile | undefined {
  if (typeof context === 'function') return (context as BalanceProfileLookup)(id);
  if (!context || typeof context !== 'object') return undefined;

  const source = context as BalanceProfileLookupContext;
  const catalog = catalogFromContext(context);
  return catalog ? catalog.balanceProfilesById?.get(id) : source.balanceProfile?.(id);
}

/** Required profiles fail in the selected source; optional discovery continues to use balanceProfileFromContext. */
export function requireBalanceProfileFromContext(context: unknown, id: SkillId): BalanceProfile {
  const profile = balanceProfileFromContext(context, id);
  if (!profile)
    throw new Error(
      `Invalid balance data: ${balanceDataLabel(context, `profile=${id}`)} missing required profile/catalog`
    );
  return profile;
}

/** Owners carry their selected source, so diagnostics never need the runtime context that resolved them. */
function ownerDataLabel(owner: Skill | BalanceProfile, subject: string): string {
  const metadata = owner.balanceDataContext as BalanceProfile['balanceDataContext'];
  return `profession=${metadata?.professionId ?? '<unknown>'} patch=${metadata?.patchId ?? '<unknown>'} ${subject}`;
}

function effectOwnerLabel(owner: Skill | BalanceProfile): string {
  return ownerDataLabel(owner, `${'profileKind' in owner ? 'balance-profile' : 'skill'}=${owner.id}`);
}

/** Query an already selected owner; only recorded removals may omit a named effect. */
export function requireEffect<TType extends SkillEffect['type']>(
  owner: Skill | BalanceProfile,
  type: TType,
  name: string
): SkillEffectByType<TType> | undefined {
  const key = skillEffectKey(type, name);
  const label = `${effectOwnerLabel(owner)} effect=${type}/${name}`;
  const matches = (owner.effects || []).filter((effect) => effect.type === type && effect.name === name);
  if (matches.length > 1) throw new Error(`Invalid balance data: ${label} duplicate effect key`);
  if (matches.length === 1) return normalizeEffect(matches[0], label) as SkillEffectByType<TType>;
  if (owner.removedEffectKeys?.includes(key)) return undefined;
  throw new Error(`Invalid balance data: ${label} unknown effect key`);
}

/** Validate a surviving effect's field without looking up its owner again; the owner supplies diagnostics. */
export function effectNumber(owner: Skill | BalanceProfile, effect: SkillEffect, field: string): number {
  return requireBalanceNumber(
    effect[field],
    `${effectOwnerLabel(owner)} effect=${effect.type}/${effect.name ?? '<unnamed>'} field=${field}`
  );
}

/** Returns the requested matching effect in declaration order without allocating or scanning past it. */
export function balanceProfileEffect<TType extends SkillEffect['type']>(
  profile: { readonly effects?: readonly SkillEffect[] } | null | undefined,
  type: TType,
  index = 0,
  name?: string
): SkillEffectByType<TType> | undefined {
  if (!Number.isInteger(index) || index < 0) return undefined;
  for (const effect of profile?.effects || []) {
    if (effect.type !== type || (name != null && effect.name !== name)) continue;
    if (index-- === 0) return effect as SkillEffectByType<TType>;
  }

  return undefined;
}

/** Resolves a profile and selects one authored effect without profession-local lookup wrappers. */
export function balanceProfileEffectFromContext<TType extends SkillEffect['type']>(
  context: unknown,
  id: SkillId,
  type: TType,
  index = 0,
  name?: string
): SkillEffectByType<TType> | undefined {
  return balanceProfileEffect(balanceProfileFromContext(context, id), type, index, name);
}

/** Reads a finite numeric profile field and otherwise returns the caller's domain-specific fallback. */
export function balanceProfileValue(
  profile: Readonly<Record<string, unknown>> | null | undefined,
  field: string,
  fallback: number
): number {
  const value = profile?.[field];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

/** Resolves a profile and reads one numeric field without profession-local lookup wrappers. */
export function balanceProfileValueFromContext(context: unknown, id: SkillId, field: string, fallback: number): number {
  return balanceProfileValue(balanceProfileFromContext(context, id), field, fallback);
}

/** Required balance inputs fail visibly instead of silently using unpatched values or producing NaN. */
export function balanceProfileNumber(profile: BalanceProfile, field: string): number {
  return requireBalanceNumber(profile[field], ownerDataLabel(profile, `profile=${profile.id} field=${field}`));
}

/** Read one opt-in proc chance for scheduler and resolver paths while retaining profession-owned eligibility and ICDs. */
export function procChanceFromContext(
  context: { readonly config?: { readonly procRateOverrides?: Readonly<Record<string, number>> } },
  id: SkillId
): number {
  const profile = requireBalanceProfileFromContext(context, id);
  const declaration = profile.procRate;
  const label = balanceDataLabel(context, `profile=${id} field=procRate`, profile);
  if (!declaration?.id || !declaration.field) throw new Error(`Invalid balance data: ${label} missing declaration`);
  // Overrides tune a valid declaration; they must not conceal missing or invalid baseline data.
  const baseline = balanceProfileNumber(profile, declaration.field);
  const override = context.config?.procRateOverrides?.[declaration.id];
  const chance = override === undefined ? baseline : requireBalanceNumber(override, label);
  if (baseline < 0 || baseline > 1 || chance < 0 || chance > 1)
    throw new Error(`Invalid balance data: ${label} expected=number in [0, 1]`);
  return chance;
}
