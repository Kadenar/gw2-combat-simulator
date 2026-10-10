// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

import { elementalistAnnouncement } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

const EARTHEN_BLAST_ICON = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';

/** Shared per-occurrence payload; the caller owns activation eligibility. */
export function emitEarthenBlast(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  // Use the same attunement or overload trigger for the damage packet and its proc record.
  const sourceSkill = context.helpers.skillsById.get(sourceId)?.name || '';
  const earthenBlastProfile = requireBalanceProfileFromContext(context, TRAIT.EARTHEN_BLAST);
  const earthenBlastStrike = requireEffect(earthenBlastProfile, 'strike', 'Earthen Blast');
  if (earthenBlastStrike) {
    emitTraitProfile(context, TRAIT.EARTHEN_BLAST, TRAIT.EARTHEN_BLAST, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'strike', name: 'Earthen Blast' },
      cast: emissionCast,
      skillWeaponFallback: 'Unequipped',
      attribution: {
        source: 'Earthen Blast',
        sourceId: sourceId,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Earthen Blast',
        triggeredBy: sourceSkill,
        icon: EARTHEN_BLAST_ICON,
        skillId: sourceId,
        name: 'Earthen Blast',
        activationId: context.combat.allocateEffectActivation('elementalist.effect:')
      }
    });
    context.effects.emit(
      elementalistAnnouncement({
        at,
        name: 'Earthen Blast',
        procType: 'trait',
        sourceId,
        sourceSkill,
        icon: EARTHEN_BLAST_ICON
      })
    );
  }
}
