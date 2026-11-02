import { ATTRIBUTE_NAMES } from '#gw2/platform/attributes/inputs.js';
import type {
  Gw2AttributeContext,
  Gw2AttributeContributions,
  Gw2AttributeEffect
} from '#gw2/platform/attributes/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeModuleHooks } from '#gw2/platform/profession-definition/module-types.js';
import {
  assertTraitTrigger,
  type RechargeRule,
  type TraitTrigger
} from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  attributeBonusNumber,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, Skill, SkillId } from '#gw2/platform/skills/types.js';

// Keep the existing discriminated trigger signatures while supplying selection ownership once.
type OwnedTrigger<T> = T extends { readonly trait: SkillId } ? Omit<T, 'trait'> : never;

/** Value policies transform existing work; startup can only import supplied state, not schedule producers. */
export type TraitHooks<TSkill extends Skill = Skill> = Pick<
  NativeModuleHooks<TSkill>,
  'modifySkillId' | 'modifyComboFields' | 'boonDuration' | 'availability' | 'castDurationMs' | 'maximumAmmo'
> & {
  readonly prepareEvent?: (
    runtime: MechanicQueryContext<never, TSkill>,
    event: SimulationEventBase
  ) => SimulationEventBase | null;
  readonly modifyEffects?: (
    runtime: MechanicQueryContext<never, TSkill>,
    cast: RuntimeCast<TSkill>,
    effects: readonly SkillEffect[]
  ) => readonly SkillEffect[];
  readonly initialize?: (
    context: Pick<MechanicContext<never, TSkill>, 'profession' | 'config' | 'helpers' | 'traits' | 'time'>
  ) => void;
};

/**
 * Builds a `modifySkillId` hook for skills a trait swaps in place. Either saved identity resolves to the variant the
 * current selection picks, so rotations survive trait edits and the inactive variant can never be cast.
 */
export function traitSkillReplacement(
  traitId: SkillId,
  pairs: readonly (readonly [base: SkillId, replacement: SkillId])[]
): NonNullable<TraitHooks['modifySkillId']> {
  const pairBySkillId = new Map(pairs.flatMap((pair) => [[pair[0], pair] as const, [pair[1], pair] as const]));
  return (context, skillId) => {
    const pair = pairBySkillId.get(skillId);
    return pair ? pair[context.hasTrait(traitId) ? 1 : 0] : skillId;
  };
}

/** Explicitly retained handlers finish admitted work; new activation belongs in triggers, including loop startup. */
export type TraitLifetimeHooks<TSkill extends Skill = Skill> = Pick<
  NativeModuleHooks<TSkill>,
  'onCastStart' | 'onCastCommit' | 'reserveRecharge' | 'tasks' | 'backgroundTasks' | 'eventHandlers'
> & {
  readonly reactions?: Pick<
    NonNullable<NativeModuleHooks<TSkill>['reactions']>,
    'aura.applied' | 'buff.applied' | 'damage.resolving' | 'damage.resolved'
  >;
};

// One list drives runtime acceptance; `satisfies` prevents adding hooks outside the typed contract.
const VALUE_HOOKS = [
  'initialize',
  'prepareEvent',
  'modifySkillId',
  'modifyComboFields',
  'modifyEffects',
  'boonDuration',
  'availability',
  'castDurationMs',
  'maximumAmmo'
] as const satisfies readonly (keyof TraitHooks)[];
const LIFETIME_HOOKS = [
  'onCastStart',
  'onCastCommit',
  'reserveRecharge',
  'reactions',
  'tasks',
  'backgroundTasks',
  'eventHandlers'
] as const satisfies readonly (keyof TraitLifetimeHooks)[];
const LIFETIME_STAGES = [
  'aura.applied',
  'buff.applied',
  'damage.resolving',
  'damage.resolved'
] as const satisfies readonly (keyof NonNullable<TraitLifetimeHooks['reactions']>)[];

/** Author identity and tuning before behavior so every profession's traits share one readable layout. */
export interface TraitDefinition<TSkill extends Skill = Skill> {
  /** Only intentional proc labels override the name from the module's trait records. */
  readonly name?: string;
  readonly id: SkillId;
  /** Omit for behavior-only traits; id overrides preserve existing non-trait profile identities. */
  readonly balance?: Readonly<Record<string, unknown>> & {
    readonly id?: SkillId;
    readonly cooldownPolicy?: BalanceProfile['cooldownPolicy'];
    readonly effects?: BalanceProfile['effects'];
  };
  readonly attributes?: (context: Gw2AttributeContext) => Gw2AttributeContributions;
  /** Accepted grants belong to the recipient until expiry, independently of the recipient's selected traits. */
  readonly grantedAttributes?: (context: Gw2AttributeContext) => Gw2AttributeContributions;
  readonly modifierRules?: readonly (Gw2ModifierRule & {
    /** Applied effects may outlive selection; their predicate owns eligibility instead. */
    readonly requiresSelection?: boolean;
  })[];
  readonly rechargeRules?: readonly Omit<RechargeRule<never, TSkill>, 'trait'>[];
  readonly triggers?: readonly OwnedTrigger<TraitTrigger<never, TSkill>>[];
  readonly hooks?: TraitHooks<TSkill>;
  readonly lifetime?: TraitLifetimeHooks<TSkill>;
}

/** Catalog assembly and trigger validation derive the same trait-owned tuning without module profile inputs. */
export function traitBalanceProfiles<TSkill extends Skill>(
  traits: readonly TraitDefinition<TSkill>[],
  metadata: readonly { readonly id: SkillId; readonly name: string }[]
): readonly BalanceProfile[] {
  const names = new Map(metadata.map((record) => [record.id, record.name]));
  return traits.flatMap((trait) => {
    if (!trait.balance) return [];

    const name = trait.name ?? names.get(trait.id);

    if (!name) throw new TypeError(`Trait ${trait.id} has no owned trait metadata for its profile label.`);

    return [
      {
        id: trait.balance.id ?? trait.id,
        name,
        skillFamily: 'Trait',
        effects: [],
        ...trait.balance
      }
    ];
  });
}

type FlatAttributeEffect = Extract<Gw2AttributeEffect, { kind: 'flat' }>;
type ConversionAttributeEffect = Extract<Gw2AttributeEffect, { kind: 'conversion' }>;

type TraitAttributeDeclaration =
  | (Omit<FlatAttributeEffect, 'amount' | 'enabled'> & { readonly group?: string })
  | (Omit<ConversionAttributeEffect, 'multiplier' | 'enabled'> & { readonly field: string });

const attributeDeclarations = new WeakMap<
  NonNullable<TraitDefinition['attributes']>,
  readonly TraitAttributeDeclaration[]
>();

/** Static trait declarations can name a generic amount's attribute without executing runtime predicates. */
export function traitAttributeFieldLabels(trait: TraitDefinition): Readonly<Record<string, string>> {
  const targets = new Map<string, Set<string>>();
  for (const declaration of trait.attributes ? (attributeDeclarations.get(trait.attributes) ?? []) : []) {
    if (declaration.kind === 'flat') continue;

    const names = targets.get(declaration.field) ?? new Set<string>();
    names.add(declaration.to);
    targets.set(declaration.field, names);
  }

  return Object.fromEntries(
    [...targets].flatMap(([field, names]) => {
      if (names.size !== 1) return [];

      const suffix = field === 'attributeConversion' ? 'conversion' : null;
      return suffix ? [[field, `${[...names][0]} ${suffix}`]] : [];
    })
  );
}

const profileOnlyAttributes = new WeakSet<NonNullable<TraitDefinition['attributes']>>();

/** Resolve profile-only declarations once per query; live declarations keep their original evaluator. */
export function prepareTraitAttributes(
  contribute: NonNullable<TraitDefinition['attributes']>,
  context: Gw2AttributeContext
): NonNullable<TraitDefinition['attributes']> | Gw2AttributeContributions {
  if (!context.query || !profileOnlyAttributes.has(contribute)) return contribute;

  return contribute(context);
}

/** Resolve constant declarations once per immutable balance profile; a different patch owns a different profile. */
export function traitAttributeEffects(
  profileId: SkillId,
  declarations: readonly TraitAttributeDeclaration[]
): NonNullable<TraitDefinition['attributes']> {
  const contribute = traitAttributeBonuses(profileId, (profile) => ({
    attributeEffects: declarations.map((declaration) => {
      if (declaration.kind === 'flat') {
        const attribute = (Object.keys(ATTRIBUTE_NAMES) as (keyof typeof ATTRIBUTE_NAMES)[]).find(
          (key) => ATTRIBUTE_NAMES[key] === declaration.to
        )!;
        const { group, ...effect } = declaration;
        return { ...effect, amount: attributeBonusNumber(profile, attribute, group) };
      }

      const { field, ...effect } = declaration;
      return { ...effect, multiplier: balanceProfileNumber(profile, field) };
    })
  }));
  attributeDeclarations.set(contribute, declarations);
  return contribute;
}

/** Share immutable profile-only bonuses; live selection and combat conditions stay in the caller. */
export function traitAttributeBonuses(
  profileId: SkillId,
  resolve: (
    profile: BalanceProfile
  ) => Pick<Gw2AttributeContributions, 'attributeEffects' | 'traitDurations' | 'traitCriticalChance'>
): NonNullable<TraitDefinition['attributes']> {
  const resolved = new WeakMap<BalanceProfile, Gw2AttributeContributions>();
  const contribute: NonNullable<TraitDefinition['attributes']> = ({ balanceContext }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, profileId);
    const cached = resolved.get(profile);

    if (cached) return cached;

    const contributions = resolve(profile);

    if (contributions.attributeEffects) {
      for (const effect of contributions.attributeEffects) Object.freeze(effect);
      Object.freeze(contributions.attributeEffects);
    }

    if (contributions.traitDurations) Object.freeze(contributions.traitDurations);

    Object.freeze(contributions);
    resolved.set(profile, contributions);
    return contributions;
  };

  profileOnlyAttributes.add(contribute);
  return contribute;
}

/** Reject misspelled behavior fields before they can silently disappear during module expansion. */
export function defineTrait(definition: TraitDefinition): Readonly<TraitDefinition>;

export function defineTrait<TSkill extends Skill>(
  definition: TraitDefinition<TSkill>
): Readonly<TraitDefinition<TSkill>>;

export function defineTrait<TSkill extends Skill>(
  definition: TraitDefinition<TSkill>
): Readonly<TraitDefinition<TSkill>> {
  const candidate = definition as Partial<TraitDefinition<TSkill>> | null | undefined;

  if (
    !candidate ||
    !['string', 'number'].includes(typeof candidate.id) ||
    !String(candidate.id).trim() ||
    (typeof candidate.id === 'number' && !Number.isFinite(candidate.id)) ||
    (candidate.name !== undefined && (typeof candidate.name !== 'string' || !candidate.name.trim()))
  )
    throw new TypeError('Trait definition requires an id and an optional non-empty name.');

  for (const key of Object.keys(definition))
    if (
      ![
        'name',
        'id',
        'balance',
        'attributes',
        'grantedAttributes',
        'modifierRules',
        'rechargeRules',
        'triggers',
        'hooks',
        'lifetime'
      ].includes(key)
    )
      throw new TypeError(`Unsupported trait definition field: ${key}.`);
  for (const rule of [...(definition.triggers ?? []), ...(definition.rechargeRules ?? [])])
    if ('trait' in rule) throw new TypeError(`Trait ${definition.id} owns its rule selection gate.`);
  for (const rule of definition.triggers ?? []) assertTraitTrigger(rule, `Trait ${definition.id}`);

  if (definition.balance && 'name' in definition.balance)
    throw new TypeError(`Trait ${definition.id}.balance cannot override name.`);

  for (const surface of ['hooks', 'lifetime'] as const) {
    const hooks = definition[surface];

    if (hooks == null) continue;

    const allowed: readonly string[] = surface === 'hooks' ? VALUE_HOOKS : LIFETIME_HOOKS;
    for (const [key, value] of Object.entries(hooks)) {
      if (!allowed.includes(key))
        throw new TypeError(`Unsupported trait ${surface === 'hooks' ? 'hook' : 'lifetime hook'}: ${key}.`);

      // Lifetime reactions only observe existing work; new activation belongs to compiled triggers.
      if (key === 'reactions')
        for (const stage of Object.keys(value as object))
          if (!(LIFETIME_STAGES as readonly string[]).includes(stage))
            throw new TypeError(
              `Unsupported trait lifetime reaction: ${stage}. Use a compiled trigger for new activation.`
            );
    }
  }

  return Object.freeze({ ...definition });
}
