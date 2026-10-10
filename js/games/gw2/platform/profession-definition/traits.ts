import type {
  Gw2AttributeEffect,
  Gw2BuildAttributeContributions,
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult
} from '#gw2/platform/builds/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { BalanceProfile, Skill, SkillId } from '#gw2/platform/skills/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { NativeModuleHooks } from '#gw2/platform/profession-definition/module-types.js';
import {
  assertTraitTrigger,
  type RechargeRule,
  type TraitTrigger
} from '#gw2/platform/profession-definition/trigger-rules.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';

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

/** One authoring owner; value hooks such as boon duration retain eligibility while lifetime handlers retain ownership. */
export interface TraitDefinition<TSkill extends Skill = Skill> {
  readonly id: SkillId;
  readonly name: string;
  /** Omit for behavior-only traits; id overrides preserve existing non-trait profile identities. */
  readonly balance?: Readonly<Record<string, unknown>> & {
    readonly id?: SkillId;
    readonly cooldownPolicy?: BalanceProfile['cooldownPolicy'];
    readonly effects?: BalanceProfile['effects'];
  };
  readonly profiles?: readonly BalanceProfile[];
  readonly modifierRules?: readonly (Gw2ModifierRule & {
    /** Applied effects may outlive selection; their predicate owns eligibility instead. */
    readonly requiresSelection?: boolean;
  })[];
  readonly triggers?: readonly OwnedTrigger<TraitTrigger<never, TSkill>>[];
  readonly rechargeRules?: readonly Omit<RechargeRule<never, TSkill>, 'trait'>[];
  readonly hooks?: TraitHooks<TSkill>;
  readonly lifetime?: TraitLifetimeHooks<TSkill>;
  readonly buildAttributes?: (
    common: Gw2CommonAttributeResult,
    context: Gw2BuildAttributeRuleContext & { readonly balanceContext: ProfessionBalanceContext }
  ) => Gw2BuildAttributeContributions;
}

type FlatAttributeEffect = Extract<Gw2AttributeEffect, { kind: 'flat' }>;
type ConversionAttributeEffect = Extract<Gw2AttributeEffect, { kind: 'conversion' }>;

type TraitAttributeDeclaration =
  | (Omit<FlatAttributeEffect, 'amount' | 'enabled'> & { readonly field: string })
  | (Omit<ConversionAttributeEffect, 'multiplier' | 'enabled'> & { readonly field: string });

/** Resolve unconditional trait contributions from the active patch when attributes are evaluated. */
export function traitAttributeEffects(
  profileId: SkillId,
  declarations: readonly TraitAttributeDeclaration[]
): NonNullable<TraitDefinition['buildAttributes']> {
  return (_common, { balanceContext }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, profileId);
    return {
      attributeEffects: declarations.map(({ field, ...effect }) => {
        const value = balanceProfileNumber(profile, field);
        return effect.kind === 'flat' ? { ...effect, amount: value } : { ...effect, multiplier: value };
      })
    };
  };
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
    typeof candidate.name !== 'string' ||
    !candidate.name.trim()
  )
    throw new TypeError('Trait definition requires an id and name.');
  for (const key of Object.keys(definition))
    if (
      ![
        'id',
        'name',
        'balance',
        'profiles',
        'modifierRules',
        'triggers',
        'rechargeRules',
        'hooks',
        'lifetime',
        'buildAttributes'
      ].includes(key)
    )
      throw new TypeError(`Unsupported trait definition field: ${key}.`);
  for (const key of ['profiles', 'modifierRules', 'triggers', 'rechargeRules'] as const)
    if (definition[key] != null && !Array.isArray(definition[key]))
      throw new TypeError(`Trait ${definition.id}.${key} must be an array.`);
  for (const rule of [...(definition.triggers ?? []), ...(definition.rechargeRules ?? [])])
    if ('trait' in rule) throw new TypeError(`Trait ${definition.id} owns its rule selection gate.`);
  for (const rule of definition.triggers ?? []) assertTraitTrigger(rule, `Trait ${definition.id}`);
  for (const rule of definition.modifierRules ?? [])
    if (rule.requiresSelection !== undefined && typeof rule.requiresSelection !== 'boolean')
      throw new TypeError(`Trait ${definition.id} modifier requiresSelection must be boolean.`);
  if (definition.balance != null) {
    if (typeof definition.balance !== 'object' || Array.isArray(definition.balance))
      throw new TypeError(`Trait ${definition.id}.balance must be an object.`);
    for (const key of ['name', 'profileKind'])
      if (key in definition.balance) throw new TypeError(`Trait ${definition.id}.balance cannot override ${key}.`);
  }

  for (const surface of ['hooks', 'lifetime'] as const) {
    const hooks = definition[surface];
    if (hooks == null) continue;
    if (typeof hooks !== 'object' || Array.isArray(hooks))
      throw new TypeError(`Trait ${definition.id}.${surface} must be an object.`);
    const allowed: readonly string[] = surface === 'hooks' ? VALUE_HOOKS : LIFETIME_HOOKS;
    for (const [key, value] of Object.entries(hooks)) {
      if (!allowed.includes(key))
        throw new TypeError(`Unsupported trait ${surface === 'hooks' ? 'hook' : 'lifetime hook'}: ${key}.`);
      // Task lifetime declarations accompany handlers; they never replace or disable execution.
      if (key === 'backgroundTasks') {
        if (!Array.isArray(value) || value.some((name) => typeof name !== 'string' || !name))
          throw new TypeError(`Trait ${definition.id}.backgroundTasks must contain task names.`);
      } else if (['reactions', 'tasks', 'eventHandlers'].includes(key)) {
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          Object.values(value).some((handler) => typeof handler !== 'function')
        )
          throw new TypeError(`Trait ${definition.id}.${key} must contain handlers.`);
        if (key === 'reactions')
          for (const stage of Object.keys(value))
            if (!(LIFETIME_STAGES as readonly string[]).includes(stage))
              throw new TypeError(
                `Unsupported trait lifetime reaction: ${stage}. Use a compiled trigger for new activation.`
              );
      } else if (typeof value !== 'function') throw new TypeError(`Trait ${definition.id}.${key} must be a function.`);
    }
  }

  if (definition.buildAttributes != null && typeof definition.buildAttributes !== 'function')
    throw new TypeError(`Trait ${definition.id}.buildAttributes must be a function.`);
  return Object.freeze({ ...definition });
}
