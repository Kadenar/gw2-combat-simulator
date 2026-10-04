import { validateEffectReactions } from '#gw2/platform/effects/action-validation.js';
import type { ActionContext, SideEffectAction } from '#gw2/platform/effects/actions.js';
import type { EffectReaction, EffectReactionStage, ResolvedEffectTrigger } from '#gw2/platform/effects/reactions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { CanonicalCatalog, Skill } from '#gw2/platform/skills/types.js';

/** Resolution selects reactions; the composition root supplies action validation and mutation capabilities. */
export interface EffectReactionActions<T extends object> {
  hasHandler(type: string): boolean;
  apply(runtime: MechanicContext<T>, context: ActionContext, action: SideEffectAction): void;
}

/** Shared groups are interned by skill and declaration identity, independent of ordinary packet count. */
export function createEffectReactions<T extends object>(catalog: CanonicalCatalog, actions: EffectReactionActions<T>) {
  const groups: { skill: Skill; rules: readonly EffectReaction[] }[] = [];
  const identities = new WeakMap<Skill, WeakMap<readonly EffectReaction[], number>>();
  return {
    register(skill: Skill, effect: SkillEffect): number | undefined {
      if (effect.reactions === undefined) return undefined;
      validateEffectReactions(catalog, skill, effect);
      if (!effect.reactions.length) return undefined;
      let byRules = identities.get(skill);
      const existing = byRules?.get(effect.reactions);
      if (existing !== undefined) return existing;
      for (const rule of effect.reactions)
        for (const action of Array.isArray(rule.do) ? rule.do : [rule.do])
          if (action.type.includes('.') && !actions.hasHandler(action.type))
            throw new TypeError(`Skill ${skill.id} has no side-effect handler registered for ${action.type}.`);
      if (!byRules) identities.set(skill, (byRules = new WeakMap()));
      const group = groups.push({ skill, rules: effect.reactions }) - 1;
      byRules.set(effect.reactions, group);
      return group;
    },
    dispatch(
      runtime: { readonly mechanics: MechanicContext<T>; readonly mechanicQueries: MechanicQueryContext<T> },
      on: EffectReactionStage,
      event: Gw2ResolverEvent,
      details: NativeResolvedDamageDetails & { readonly conditionStackIndex?: number }
    ) {
      const ref = event.effectReaction;
      if (!ref) return;
      const group = groups[ref.group];
      if (!group || !Number.isSafeInteger(ref.packet) || ref.packet < 1)
        throw new TypeError('Invalid resolved-effect reaction reference.');
      const { skill, rules } = group;
      for (const rule of rules) {
        // Splitting the first authored condition packet must not repeat a first-packet action for every stack.
        if (
          rule.on !== on ||
          rule.actor !== event.actorType ||
          (rule.packets === 'first' && (ref.packet !== 1 || (details.conditionStackIndex ?? 1) !== 1))
        )
          continue;
        const eligible =
          rule.on === 'damage.resolved'
            ? !rule.when || rule.when(runtime.mechanicQueries, { on: rule.on, skill, event, details })
            : rule.on === 'condition.applied'
              ? !rule.when || rule.when(runtime.mechanicQueries, { on: rule.on, skill, event })
              : rule.on === 'control.resolved'
                ? !rule.when || rule.when(runtime.mechanicQueries, { on: rule.on, skill, event })
                : !rule.when || rule.when(runtime.mechanicQueries, { on: rule.on, skill, event });
        if (!eligible) continue;
        const trigger: ResolvedEffectTrigger =
          on === 'damage.resolved' ? { on, skill, event, details } : { on, skill, event };
        for (const action of Array.isArray(rule.do) ? rule.do : [rule.do])
          actions.apply(runtime.mechanics, { kind: 'effect', skill, trigger }, action);
      }
    }
  };
}
