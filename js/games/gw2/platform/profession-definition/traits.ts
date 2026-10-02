import type {
  Gw2BuildAttributeContributions,
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult
} from '#gw2/platform/builds/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { BalanceProfile, Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { NativeModuleHooks } from '#gw2/platform/profession-definition/module-types.js';
import type { RechargeRule, TraitTrigger } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-presentation/balance-context.js';

// Keep the existing discriminated trigger signatures while supplying selection ownership once.
type OwnedTrigger<T> = T extends { readonly trait: SkillId } ? Omit<T, 'trait'> : never;
export type TraitHooks<TSkill extends Skill = Skill> = Pick<
  NativeModuleHooks<TSkill>,
  | 'initialize'
  | 'onCombatStart'
  | 'prepareEvent'
  | 'modifySkillId'
  | 'modifyComboFields'
  | 'modifyEffects'
  | 'onCastStart'
  | 'onCastCommit'
  | 'onCastCancel'
  | 'onCooldownReset'
  | 'onAutoattackChainTransition'
  | 'availability'
  | 'castDurationMs'
  | 'castDetail'
  | 'rechargeWork'
  | 'rechargeStart'
  | 'maximumAmmo'
  | 'reserveRecharge'
  | 'reactions'
  | 'tasks'
  | 'eventHandlers'
  | 'sideEffectHandlers'
>;

/** One authoring owner; callbacks retain explicit eligibility and lifetime at their existing execution phase. */
export interface TraitDefinition<TSkill extends Skill = Skill> {
  readonly id: SkillId;
  readonly name: string;
  /** Omit for behavior-only traits; id overrides preserve existing non-trait profile identities. */
  readonly balance?: Readonly<Record<string, unknown>> & {
    readonly id?: SkillId;
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
  readonly buildAttributes?: (
    common: Gw2CommonAttributeResult,
    context: Gw2BuildAttributeRuleContext & { readonly balanceContext: ProfessionBalanceContext }
  ) => Gw2BuildAttributeContributions;
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
        'buildAttributes'
      ].includes(key)
    )
      throw new TypeError(`Unsupported trait definition field: ${key}.`);
  for (const key of ['profiles', 'modifierRules', 'triggers', 'rechargeRules'] as const)
    if (definition[key] != null && !Array.isArray(definition[key]))
      throw new TypeError(`Trait ${definition.id}.${key} must be an array.`);
  for (const rule of [...(definition.triggers ?? []), ...(definition.rechargeRules ?? [])])
    if ('trait' in rule) throw new TypeError(`Trait ${definition.id} owns its rule selection gate.`);
  for (const rule of definition.modifierRules ?? [])
    if (rule.requiresSelection !== undefined && typeof rule.requiresSelection !== 'boolean')
      throw new TypeError(`Trait ${definition.id} modifier requiresSelection must be boolean.`);
  if (definition.balance != null) {
    if (typeof definition.balance !== 'object' || Array.isArray(definition.balance))
      throw new TypeError(`Trait ${definition.id}.balance must be an object.`);
    for (const key of ['name', 'profileKind'])
      if (key in definition.balance) throw new TypeError(`Trait ${definition.id}.balance cannot override ${key}.`);
  }

  if (definition.hooks != null) {
    if (typeof definition.hooks !== 'object' || Array.isArray(definition.hooks))
      throw new TypeError(`Trait ${definition.id}.hooks must be an object.`);
    for (const [key, value] of Object.entries(definition.hooks as Record<string, unknown>)) {
      if (
        ![
          'initialize',
          'onCombatStart',
          'prepareEvent',
          'modifySkillId',
          'modifyComboFields',
          'modifyEffects',
          'onCastStart',
          'onCastCommit',
          'onCastCancel',
          'onCooldownReset',
          'onAutoattackChainTransition',
          'availability',
          'castDurationMs',
          'castDetail',
          'rechargeWork',
          'rechargeStart',
          'maximumAmmo',
          'reserveRecharge',
          'reactions',
          'tasks',
          'eventHandlers',
          'sideEffectHandlers'
        ].includes(key)
      )
        throw new TypeError(`Unsupported trait hook: ${key}.`);
      if (['reactions', 'tasks', 'eventHandlers', 'sideEffectHandlers'].includes(key)) {
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          Object.values(value).some((handler) => typeof handler !== 'function')
        )
          throw new TypeError(`Trait ${definition.id}.${key} must contain handlers.`);
      } else if (typeof value !== 'function') throw new TypeError(`Trait ${definition.id}.${key} must be a function.`);
    }
  }

  if (definition.buildAttributes != null && typeof definition.buildAttributes !== 'function')
    throw new TypeError(`Trait ${definition.id}.buildAttributes must be a function.`);
  return Object.freeze({ ...definition });
}
