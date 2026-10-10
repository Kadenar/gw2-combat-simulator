import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistAnnouncement } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Shared per-occurrence payload; the caller owns activation eligibility. */
export function emitElectricDischarge(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  const electricDischargeProfile = requireBalanceProfileFromContext(context, TRAIT.ELECTRIC_DISCHARGE);
  const electricDischargeStrike = requireEffect(electricDischargeProfile, 'strike', 'Electric Discharge');
  if (electricDischargeStrike) {
    // The profile owns strike rules; this independent proc retains its activation identity and the cast's targeting.
    emitTraitProfile(context, TRAIT.ELECTRIC_DISCHARGE, TRAIT.ELECTRIC_DISCHARGE, undefined, {
      at,
      fullEnd: at,
      effect: { type: 'strike', name: 'Electric Discharge' },
      skillId: sourceId,
      skillName: 'Electric Discharge',
      activationId: context.combat.allocateEffectActivation('elementalist.effect:'),
      cast: emissionCast,
      skillWeaponFallback: 'Unequipped',
      attribution: { source: 'Electric Discharge', sourceId, actorType: 'effect', ownerActorType: 'player' }
    });
  }

  const conditionEmitted =
    emitTraitProfile(context, TRAIT.ELECTRIC_DISCHARGE, TRAIT.ELECTRIC_DISCHARGE, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Electric Discharge' },
      skillId: sourceId,
      skillName: 'Electric Discharge',
      cast: emissionCast,
      attribution: { source: 'Electric Discharge', sourceId: sourceId, actorType: 'player', triggeredBy: '' },
      transform: (event) => ({ ...event, name: 'Electric Discharge' + ' \u2014 ' + event.condition }),
      receipt: true
    }).length > 0;
  if (electricDischargeStrike || conditionEmitted)
    context.effects.emit(
      elementalistAnnouncement({
        at,
        name: 'Electric Discharge',
        procType: 'trait',
        sourceId,
        sourceSkill: context.helpers.skillsById.get(sourceId)?.name
      })
    );
}
