import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { sideEffectAmount, type ProfileAmount } from '#gw2/platform/simulation/side-effects.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill, SkillId, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Runtime, RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { EffectEventBase } from '#gw2/platform/engine/effects/materializer.js';

export interface RechargeRule<T extends object, TSkill extends Skill = Skill> {
  readonly trait?: SkillId;
  readonly when: (runtime: Gw2Runtime<T, TSkill>, skill: TSkill) => boolean;
  readonly multiplier: ProfileAmount;
  readonly order?: number;
}

// Attribution may depend on the accepted cast or event, while profiles keep ownership of effect payloads.
type TriggerAttribution = Partial<
  EffectEventBase &
    Pick<
      SimulationEventBase,
      'name' | 'priority' | 'offTarget' | 'parentSkillName' | 'icon' | 'skillWeapon' | 'audience'
    >
>;
type TriggerAttributionSource<T extends object, Trigger, TSkill extends Skill = Skill> =
  TriggerAttribution | ((runtime: Gw2Runtime<T, TSkill>, trigger: Trigger) => TriggerAttribution);

type TraitTriggerBase = {
  readonly trait: SkillId;
  readonly emit: SkillId;
  readonly icd?: 'profile';
  readonly order?: number;
  readonly effects?: (effect: SkillEffect) => boolean;
};
export type TraitTrigger<T extends object, TSkill extends Skill = Skill> = TraitTriggerBase &
  (
    | {
        readonly on: 'castStart';
        readonly when: (runtime: Gw2Runtime<T, TSkill>, cast: RuntimeCast<TSkill>) => boolean;
        readonly attribution?: TriggerAttributionSource<T, RuntimeCast<TSkill>, TSkill>;
      }
    | {
        readonly on: 'castCommit';
        readonly when: (runtime: Gw2Runtime<T, TSkill>, cast: RuntimeCast<TSkill>) => boolean;
        readonly attribution?: TriggerAttributionSource<T, RuntimeCast<TSkill>, TSkill>;
      }
    | {
        readonly on: 'damage.resolved';
        readonly when: (
          runtime: Gw2Runtime<T, TSkill>,
          event: Gw2ResolverEvent,
          details: NativeResolvedDamageDetails
        ) => boolean;
        readonly attribution?: TriggerAttributionSource<T, Gw2ResolverEvent, TSkill>;
      }
    | {
        readonly on: Exclude<Gw2ResolverStage, 'damage.resolved'>;
        readonly when: (runtime: Gw2Runtime<T, TSkill>, event: Gw2ResolverEvent) => boolean;
        readonly attribution?: TriggerAttributionSource<T, Gw2ResolverEvent, TSkill>;
      }
  );

/** Compile once; declaration order breaks equal-order ties and live profile lookups keep patches authoritative. */
export function compileRechargeRules<T extends object, TSkill extends Skill = Skill>(
  rules: readonly RechargeRule<T, TSkill>[]
): (runtime: Gw2Runtime<T, TSkill>, skill: TSkill, work: number) => number {
  const ordered = [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (runtime, skill, work) => {
    for (const rule of ordered)
      if ((rule.trait == null || hasTrait(runtime, rule.trait)) && rule.when(runtime, skill))
        work *= sideEffectAmount(runtime, rule.multiplier);
    return work;
  };
}

/** Each module's rules run at its hook position; committed interruptions receive the same cast rewards. */
export function compileProfessionRules<T extends object, TSkill extends Skill = Skill>(
  hooks: Partial<RuntimeProfession<T, TSkill>>
): Partial<RuntimeProfession<T, TSkill>> {
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
      runtime: Gw2Runtime<T, TSkill>,
      skillId: SkillId | null | undefined,
      skillName: string | undefined,
      resolveAttribution: () => TriggerAttribution | undefined,
      activationId?: string,
      cause?: Gw2ResolverEvent
    ) => {
      if (rule.icd && !runtime.procs.claim(rule.emit)) return;
      // Resolve once, after eligibility and the ICD claim, so every sibling packet shares the same identity.
      const attribution = resolveAttribution();
      const profile = requireBalanceProfileFromContext(runtime, rule.emit);
      emitEffects(runtime, {
        owner: profile,
        effects: rule.effects ? profile.effects?.filter(rule.effects) : profile.effects,
        cause,
        transform: (event) => ({ ...event, name: profile.name, ...attribution }),
        baseEvent: {
          source: 'Trait',
          sourceId: rule.trait,
          actorType: 'effect',
          skillId,
          skillName,
          activationId,
          ...attribution
        }
      });
    };

    if (rule.on === 'castStart' || rule.on === 'castCommit') {
      const key = rule.on === 'castStart' ? 'onCastStart' : 'onCastCommit';
      const prior = compiled[key];
      compiled[key] = (runtime, cast) => {
        // The runtime dispatches commit hooks only for successful casts, including shortened animations.
        if (hasTrait(runtime, rule.trait) && rule.when(runtime, cast))
          emit(
            runtime,
            cast.skill.id,
            cast.skill.name,
            () => (typeof rule.attribution === 'function' ? rule.attribution(runtime, cast) : rule.attribution),
            cast.id
          );
        prior?.(runtime, cast);
      };
    } else {
      const prior = compiled.reactions?.[rule.on];
      compiled.reactions = {
        ...compiled.reactions,
        [rule.on]: (runtime: Gw2Runtime<T, TSkill>, event: Gw2ResolverEvent, details: Record<string, unknown>) => {
          // Hit predicates consume the resolved outcome, never a prediction from the packet.
          if (
            hasTrait(runtime, rule.trait) &&
            (rule.on === 'damage.resolved' ? rule.when(runtime, event, details) : rule.when(runtime, event))
          )
            emit(
              runtime,
              event.skillId,
              event.skillName,
              () => (typeof rule.attribution === 'function' ? rule.attribution(runtime, event) : rule.attribution),
              event.activationId,
              event
            );
          return prior?.(runtime, event, details);
        }
      };
    }
  }

  return compiled;
}
