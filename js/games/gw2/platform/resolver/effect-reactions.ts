import { hasImmutableLiteralReactions } from '#gw2/platform/effects/action-declarations.js';
import { validateEffectReactions } from '#gw2/platform/effects/action-validation.js';
import type { ActionContext, SideEffectAction } from '#gw2/platform/effects/actions.js';
import type { EffectReaction, EffectReactionStage, ResolvedEffectTrigger } from '#gw2/platform/effects/reactions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2ResolverReactionArgs } from '#gw2/platform/resolver/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';

/** Resolution selects reactions; the composition root supplies action validation and mutation capabilities. */
export interface EffectReactionActions<T extends object> {
  hasHandler(type: string): boolean;
  validate(skill: Skill, action: SideEffectAction): void;
  apply(runtime: MechanicContext<T>, context: ActionContext, action: SideEffectAction): void;
}

/** Interned reaction groups for authored effects; packets carry only their serializable group reference. */
export interface EffectReactionRegistry<T extends object> {
  /** Validates and interns an effect's reactions, returning its group or undefined when it declares none. */
  register(skill: Skill, effect: SkillEffect): number | undefined;
  dispatch(
    runtime: { readonly mechanics: MechanicContext<T>; readonly mechanicQueries: MechanicQueryContext<T> },
    ...args: Gw2ResolverReactionArgs<EffectReactionStage>
  ): void;
}

/** Shared groups are interned by skill and declaration identity, independent of ordinary packet count. */
export function createEffectReactions<T extends object>(
  catalog: CanonicalCatalog,
  actions: EffectReactionActions<T>
): EffectReactionRegistry<T> {
  const groups: { skill: Skill; rules: readonly EffectReaction[]; literalType?: SkillEffect['type'] }[] = [];
  const identities = new WeakMap<Skill, WeakMap<readonly EffectReaction[], number>>();
  return {
    register(skill: Skill, effect: SkillEffect): number | undefined {
      if (effect.reactions === undefined) return undefined;

      let byRules = identities.get(skill);
      const existing = byRules?.get(effect.reactions);

      // Literal grants depend only on the effect stage: timing copies reuse validation, transformed stages do not.
      if (
        existing !== undefined &&
        groups[existing].literalType !== undefined &&
        groups[existing].literalType === effect.type
      )
        return existing;

      validateEffectReactions(catalog, skill, effect);

      if (!effect.reactions.length) return undefined;

      for (const rule of effect.reactions)
        for (const action of rule.do) {
          // Mutable and transformed declarations must still support their grants even when their group was interned.
          actions.validate(skill, action);

          if (action.type.includes('.') && !actions.hasHandler(action.type))
            throw new TypeError(`Skill ${skill.id} has no side-effect handler registered for ${action.type}.`);
        }

      if (!byRules) identities.set(skill, (byRules = new WeakMap()));

      const group =
        existing ??
        groups.push({
          skill,
          rules: effect.reactions,
          ...(hasImmutableLiteralReactions(effect.reactions) ? { literalType: effect.type } : {})
        }) - 1;
      byRules.set(effect.reactions, group);
      return group;
    },
    dispatch(
      runtime: { readonly mechanics: MechanicContext<T>; readonly mechanicQueries: MechanicQueryContext<T> },
      ...[on, event, details]: Gw2ResolverReactionArgs<EffectReactionStage>
    ) {
      const ref = event.effectReaction;

      if (!ref) return;

      const group = groups[ref.group];

      if (!group || !Number.isSafeInteger(ref.packet) || ref.packet < 1)
        throw new TypeError('Invalid resolved-effect reaction reference.');

      const { skill, rules } = group;
      // Construct one discriminated trigger for both the predicate and its ordered actions.
      const trigger: ResolvedEffectTrigger =
        on === 'damage.resolved' ? { on, skill, event, details } : { on, skill, event };
      const conditionStackIndex = on === 'condition.applied' ? details.conditionStackIndex : 1;
      for (const rule of rules) {
        // Splitting the first authored condition packet must not repeat a first-packet action for every stack.
        if (
          rule.on !== on ||
          rule.actor !== event.actorType ||
          (rule.packets === 'first' && (ref.packet !== 1 || conditionStackIndex !== 1))
        )
          continue;

        if (!eligibleReaction(rule, runtime.mechanicQueries, trigger)) continue;

        // Preserve authored action order after the reaction's packet and predicate gates pass.
        for (const action of rule.do) actions.apply(runtime.mechanics, { kind: 'effect', skill, trigger }, action);
      }
    }
  };
}

/** Match discriminants before invoking a stage-specific predicate, without manufacturing damage details. */
function eligibleReaction<T extends object>(
  rule: EffectReaction,
  runtime: MechanicQueryContext<T>,
  trigger: ResolvedEffectTrigger
): boolean {
  switch (rule.on) {
    case 'damage.resolved':
      return trigger.on === rule.on && (!rule.when || rule.when(runtime, trigger));
    case 'condition.applied':
      return trigger.on === rule.on && (!rule.when || rule.when(runtime, trigger));
    case 'control.resolved':
      return trigger.on === rule.on && (!rule.when || rule.when(runtime, trigger));
    case 'buff.applied':
      return trigger.on === rule.on && (!rule.when || rule.when(runtime, trigger));
    case 'combo.resolved':
      return trigger.on === rule.on && (!rule.when || rule.when(runtime, trigger));
  }
}
