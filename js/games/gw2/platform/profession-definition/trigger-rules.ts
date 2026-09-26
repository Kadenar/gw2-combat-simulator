import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { sideEffectAmount, type ProfileAmount } from '#gw2/platform/simulation/side-effects.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { castCompleted } from '#gw2/platform/skills/timing.js';
import type { Skill, SkillId, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { EffectEventBase } from '#gw2/platform/engine/effects/materializer.js';

export interface RechargeRule<T extends object> {
  readonly trait?: SkillId;
  readonly when: (runtime: Gw2Runtime<T>, skill: Skill) => boolean;
  readonly multiplier: ProfileAmount;
  readonly order?: number;
}

type TraitTriggerBase = {
  readonly trait: SkillId;
  readonly emit: SkillId;
  readonly icd?: 'profile';
  readonly order?: number;
  readonly attribution?: Partial<EffectEventBase & Pick<SimulationEventBase, 'name' | 'priority'>>;
  readonly effects?: (effect: SkillEffect) => boolean;
};
export type TraitTrigger<T extends object> = TraitTriggerBase &
  (
    | { readonly on: 'castStart'; readonly when: (runtime: Gw2Runtime<T>, cast: RuntimeCast) => boolean }
    | { readonly on: 'castComplete'; readonly when: (runtime: Gw2Runtime<T>, cast: RuntimeCast) => boolean }
    | { readonly on: Gw2ResolverStage; readonly when: (runtime: Gw2Runtime<T>, event: Gw2ResolverEvent) => boolean }
  );

/** Compile once; declaration order breaks equal-order ties and live profile lookups keep patches authoritative. */
export function compileRechargeRules<T extends object>(
  rules: readonly RechargeRule<T>[]
): (runtime: Gw2Runtime<T>, skill: Skill, work: number) => number {
  const ordered = [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (runtime, skill, work) => {
    for (const rule of ordered)
      if ((rule.trait == null || hasTrait(runtime, rule.trait)) && rule.when(runtime, skill))
        work *= sideEffectAmount(runtime, rule.multiplier);
    return work;
  };
}

/** Each module's rules run at its existing hook position; completion triggers require a fully completed cast. */
export function compileProfessionRules<T extends object>(
  hooks: Partial<RuntimeProfession<T>>
): Partial<RuntimeProfession<T>> {
  const compiled = { ...hooks };
  if (hooks.rechargeRules?.length) {
    const recharge = compileRechargeRules(hooks.rechargeRules);
    compiled.rechargeWork = (runtime, skill, work) => {
      const adjusted = recharge(runtime, skill, work);
      return hooks.rechargeWork?.(runtime, skill, adjusted) ?? adjusted;
    };
  }

  for (const rule of [...(hooks.traitTriggers ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).reverse()) {
    // Wrapping in reverse declaration order keeps emissions in declaration order before the imperative owner.
    const emit = (
      runtime: Gw2Runtime<T>,
      skillId: SkillId | null | undefined,
      skillName: string | undefined,
      activationId?: string,
      cause?: Gw2ResolverEvent
    ) => {
      if (rule.icd && !runtime.procs.claim(rule.emit)) return;
      const profile = requireBalanceProfileFromContext(runtime, rule.emit);
      emitEffects(runtime, {
        owner: profile,
        effects: rule.effects ? profile.effects?.filter(rule.effects) : profile.effects,
        cause,
        transform: (event) => ({ ...event, name: profile.name, ...rule.attribution }),
        baseEvent: {
          source: 'Trait',
          sourceId: rule.trait,
          actorType: 'effect',
          skillId,
          skillName,
          activationId,
          ...rule.attribution
        }
      });
    };

    if (rule.on === 'castStart' || rule.on === 'castComplete') {
      const key = rule.on === 'castStart' ? 'onCastStart' : 'onCastComplete';
      const prior = compiled[key];
      compiled[key] = (runtime, cast) => {
        if (
          (rule.on !== 'castComplete' || castCompleted(cast)) &&
          hasTrait(runtime, rule.trait) &&
          rule.when(runtime, cast)
        )
          emit(runtime, cast.skill.id, cast.skill.name, cast.id);
        prior?.(runtime, cast);
      };
    } else {
      const prior = compiled.reactions?.[rule.on];
      compiled.reactions = {
        ...compiled.reactions,
        [rule.on]: (runtime: Gw2Runtime<T>, event: Gw2ResolverEvent, details: Record<string, unknown>) => {
          if (hasTrait(runtime, rule.trait) && rule.when(runtime, event))
            emit(runtime, event.skillId, event.skillName, event.activationId, event);
          return prior?.(runtime, event, details);
        }
      };
    }
  }

  return compiled;
}
