import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  combatStarted,
  elementalistAnnouncement,
  elementalistProfiledBuffRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import type { ElementalistAttunementTraitDispatch } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

const EARTHEN_BLAST_ICON = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';

/** Emits Earthen Blast's uncritable strike after entering Earth in combat. */
export function triggerEarthenBlast(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.EARTHEN_BLAST)) return;
  emitEarthenBlast(context, at, sourceId, emissionCast);
}

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
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          at,
          source: 'Earthen Blast',
          sourceId,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: 'Earthen Blast',
          triggeredBy: sourceSkill,
          icon: EARTHEN_BLAST_ICON,
          coefficient: effectNumber(earthenBlastProfile, earthenBlastStrike, 'coefficient'),
          skillWeapon: 'Unequipped',
          canCrit: false
        },
        emissionCast
      )
    );
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

/** Grants Rock Solid's Stability after entering Earth in combat. */
export function grantElementalistRockSolid(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.ROCK_SOLID)) return;
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.ROCK_SOLID,
      'Stability',
      'Rock Solid',
      sourceId,
      undefined,
      undefined,
      emissionCast
    )
  );
}

/** Apply Earth transition traits at the dispatcher's original phase, honoring elite entry vetoes. */
export function applyEarthAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch,
  emissionCast?: EffectDelivery['cast']
): void {
  const { at, skill, target, shouldTrigger } = dispatch;
  if (target === 'Earth') {
    if (shouldTrigger('Earth', TRAIT.EARTHEN_BLAST)) triggerEarthenBlast(context, at, skill.id, emissionCast);
    if (shouldTrigger('Earth', TRAIT.ROCK_SOLID)) grantElementalistRockSolid(context, at, skill.id, emissionCast);
  }
}
