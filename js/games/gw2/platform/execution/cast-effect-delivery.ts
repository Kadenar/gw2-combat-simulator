/** Player casts and pet commands share effect checks, cast timing, and targeting. */
import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Callers supply delivery options. The cast supplies activation IDs and targeting. */
export type CastEffectDelivery = Omit<ProfileEmission, 'kind' | 'effects' | 'cast'> & {
  readonly cast?: Pick<NonNullable<ProfileEmission['cast']>, 'independentSourceStrike'>;
};

/** Callers choose effect ownership and cancellation. Each emitted effect uses the cast's timing and targeting. */
export function emitCastEffects<TState extends object, TSkill extends Skill>(
  context: Pick<MechanicContext<TState, TSkill>, 'queries' | 'effects'>,
  cast: RuntimeCast<TSkill>,
  effects: readonly SkillEffect[],
  deliveryForEffect: (effect: SkillEffect) => CastEffectDelivery | null
): void {
  for (const effect of effects) {
    if (effect.when && !effect.when(context.queries, cast)) continue;

    const delivery = deliveryForEffect(effect);

    if (!delivery) continue;

    context.effects.emit({
      ...delivery,
      kind: 'profile',
      effects: [scaleCastBoundTiming(cast, cast.skill, effect)],
      at: delivery.at ?? cast.start,
      fullEnd: delivery.fullEnd ?? cast.fullEnd,
      // Pass targeting to packet admission so it applies the impact delay once, after caller transforms.
      cast: {
        ...delivery.cast,
        activationId: cast.id,
        skillId: cast.skill.id,
        offTarget: cast.command.offTarget,
        impactDelayMs: cast.command.impactDelayMs
      }
    });
  }
}
