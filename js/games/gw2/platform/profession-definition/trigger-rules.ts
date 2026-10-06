import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { EffectEventBase } from '#gw2/platform/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent, Gw2ResolverStage } from '#gw2/platform/resolver/types.js';
import type { ProfessionRuntimeOptions } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { sideEffectAmount } from '#gw2/platform/effects/action-dispatch.js';
import { type ProfileAmount } from '#gw2/platform/effects/actions.js';

export interface RechargeRule<T extends object, TSkill extends Skill = Skill> {
  readonly trait?: SkillId;
  readonly when: (runtime: MechanicQueryContext<T, TSkill>, skill: TSkill) => boolean;
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
  TriggerAttribution | ((runtime: MechanicQueryContext<T, TSkill>, trigger: Trigger) => TriggerAttribution);

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
        readonly when: (runtime: MechanicQueryContext<T, TSkill>, cast: RuntimeCast<TSkill>) => boolean;
        readonly attribution?: TriggerAttributionSource<T, RuntimeCast<TSkill>, TSkill>;
      }
    | {
        readonly on: 'castCommit';
        readonly when: (runtime: MechanicQueryContext<T, TSkill>, cast: RuntimeCast<TSkill>) => boolean;
        readonly attribution?: TriggerAttributionSource<T, RuntimeCast<TSkill>, TSkill>;
      }
    | {
        readonly on: 'damage.resolved';
        readonly when: (
          runtime: MechanicQueryContext<T, TSkill>,
          event: Gw2ResolverEvent,
          details: NativeResolvedDamageDetails
        ) => boolean;
        readonly attribution?: TriggerAttributionSource<T, Gw2ResolverEvent, TSkill>;
      }
    | {
        readonly on: Exclude<Gw2ResolverStage, 'damage.resolved'>;
        readonly when: (runtime: MechanicQueryContext<T, TSkill>, event: Gw2ResolverEvent) => boolean;
        readonly attribution?: TriggerAttributionSource<T, Gw2ResolverEvent, TSkill>;
      }
  );

/** Compile once; declaration order breaks equal-order ties and live profile lookups keep patches authoritative. */
export function compileRechargeRules<T extends object, TSkill extends Skill = Skill>(
  rules: readonly RechargeRule<T, TSkill>[]
): (runtime: MechanicQueryContext<T, TSkill>, skill: TSkill, work: number) => number {
  const ordered = [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (runtime, skill, work) => {
    for (const rule of ordered)
      if ((rule.trait == null || hasTrait(runtime, rule.trait)) && rule.when(runtime, skill))
        work *= sideEffectAmount(runtime, rule.multiplier);
    return work;
  };
}

/** Compile only hook contributions at their module position; committed interruptions receive the same cast rewards. */
export function compileProfessionRules<T extends object, TSkill extends Skill = Skill>(
  hooks: RuntimeHooks<T, TSkill>,
  { traitTriggers = true }: ProfessionRuntimeOptions = {}
): RuntimeHooks<T, TSkill> {
  const compiled = { ...hooks };
  if (hooks.rechargeRules?.length) {
    const recharge = compileRechargeRules(hooks.rechargeRules);
    compiled.rechargeWork = (runtime, skill, work) => {
      const adjusted = recharge(runtime, skill, work);
      return hooks.rechargeWork?.(runtime, skill, adjusted) ?? adjusted;
    };
  }

  // Omit activation producers at composition time while keeping recharge and authored payload hooks intact.
  for (const rule of [...(traitTriggers ? (hooks.traitTriggers ?? []) : [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .reverse()) {
    // Wrapping in reverse declaration order keeps emissions in declaration order before the imperative owner.
    const emit = (
      runtime: MechanicContext<T, TSkill>,
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
      runtime.effects.emit({
        kind: 'profile',
        profile: profile,
        effects: rule.effects ? profile.effects?.filter(rule.effects) : profile.effects,
        cause,
        transform: (event) => ({ ...event, name: profile.name, ...attribution }),
        attribution: {
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
        if (hasTrait(runtime, rule.trait) && rule.when(runtime.queries, cast))
          emit(
            runtime,
            cast.skill.id,
            cast.skill.name,
            () => (typeof rule.attribution === 'function' ? rule.attribution(runtime.queries, cast) : rule.attribution),
            cast.id
          );
        prior?.(runtime, cast);
      };
    } else {
      const prior = compiled.reactions?.[rule.on];
      compiled.reactions = {
        ...compiled.reactions,
        [rule.on]: (runtime: MechanicContext<T, TSkill>, event: Gw2ResolverEvent, details: Record<string, unknown>) => {
          // Hit predicates consume the resolved outcome, never a prediction from the packet.
          if (
            hasTrait(runtime, rule.trait) &&
            (rule.on === 'damage.resolved'
              ? rule.when(runtime.queries, event, details)
              : rule.when(runtime.queries, event))
          )
            emit(
              runtime,
              event.skillId,
              event.skillName,
              () =>
                typeof rule.attribution === 'function' ? rule.attribution(runtime.queries, event) : rule.attribution,
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
