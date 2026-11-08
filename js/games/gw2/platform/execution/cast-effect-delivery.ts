/** Share cast eligibility, timing projection and targeting while each producer owns its delivery policy. */
import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { scaleCastBoundTiming } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Cast identity and targeting come from the accepted command; producers supply only their delivery differences. */
export type CastEffectDelivery = Omit<ProfileEmission, 'kind' | 'effects' | 'cast'> & {
  readonly cast?: Pick<NonNullable<ProfileEmission['cast']>, 'independentSourceStrike'>;
};

/** Producers choose ownership and cancellation before shared delivery applies the command's targeting once. */
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
      // Admission stamps targeting and travel onto every packet; producer transforms never author either field.
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
