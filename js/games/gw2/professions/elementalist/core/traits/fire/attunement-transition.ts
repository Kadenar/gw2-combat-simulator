// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import {
  elementalistAnnouncement,
  elementalistEventSkill
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

const SUNSPOT_ICON = 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png';

const FLAME_EXPULSION_ICON = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';

/** Shared per-occurrence payload; the caller owns activation eligibility. */
export function emitSunspot(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  applyAura: ElementalistAuraApplier,
  emissionCast?: EffectDelivery['cast']
): void {
  // Keep strike and Burning attribution aligned with the actual attunement or overload that triggered Sunspot.
  const sourceSkill = context.helpers.skillsById.get(sourceId)?.name || '';
  const sunspotProfile = requireBalanceProfileFromContext(context, TRAIT.SUNSPOT);
  const sunspotAura = requireEffect(sunspotProfile, 'buff', 'Sunspot Aura');
  if (sunspotAura) {
    applyAura(context, {
      at,
      aura: String(sunspotAura.kind),
      duration: sunspotAura.duration,
      skillName: 'Sunspot',
      sourceId
    });
  }

  const sunspotStrike = requireEffect(sunspotProfile, 'strike', 'Sunspot');
  if (sunspotStrike) {
    emitTraitProfile(context, TRAIT.SUNSPOT, TRAIT.SUNSPOT, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'strike', name: 'Sunspot' },
      cast: emissionCast,
      skillWeaponFallback: 'Unequipped',
      attribution: {
        source: 'Sunspot',
        sourceId: sourceId,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Sunspot',
        icon: SUNSPOT_ICON,
        triggeredBy: sourceSkill,
        skillId: sourceId,
        name: 'Sunspot',
        activationId: context.combat.allocateEffectActivation('elementalist.effect:')
      }
    });
  }

  const burningEmitted =
    hasTrait(context, TRAIT.BURNING_RAGE) &&
    emitTraitProfile(context, TRAIT.BURNING_RAGE, TRAIT.BURNING_RAGE, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Sunspot Burning' },
      skillId: sourceId,
      skillName: 'Sunspot',
      cast: emissionCast,
      attribution: { source: 'Sunspot', sourceId: sourceId, actorType: 'player', triggeredBy: sourceSkill },
      transform: (event) => ({ ...event, name: 'Sunspot' + ' \u2014 ' + event.condition }),
      receipt: true
    }).length > 0;
  if (sunspotAura || sunspotStrike || burningEmitted)
    context.effects.emit(
      elementalistAnnouncement({
        at,
        name: 'Sunspot',
        procType: 'trait',
        sourceId,
        sourceSkill,
        icon: SUNSPOT_ICON
      })
    );
}

/** Shared per-occurrence payload; the caller owns activation eligibility. */
export function emitFlameExpulsion(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  const pyromancersPuissanceProfile = requireBalanceProfileFromContext(context, TRAIT.PYROMANCERS_PUISSANCE);
  const impactAt = at + balanceProfileNumber(pyromancersPuissanceProfile, 'initialDelay');
  const cappedMight = Math.min(
    balanceProfileNumber(pyromancersPuissanceProfile, 'maximumStacks'),
    context.config.boons?.might
      ? Number(context.config.boons.might)
      : buffApplicationStacks(context.combat.boonApplications('might'), 'might', at, 25, {
          includes: (application) => application.resolvedAudience.includesSelf
        })
  );
  const flameExpulsionStrike = requireEffect(pyromancersPuissanceProfile, 'strike', 'Flame Expulsion');
  const flameExpulsionCondition = requireEffect(pyromancersPuissanceProfile, 'condition', 'Flame Expulsion');
  if (flameExpulsionStrike) {
    // Capture Might once for the delayed payout; each authored hit retains its share of the bonus.
    const coefficientPerMight = balanceProfileNumber(pyromancersPuissanceProfile, 'damageIncreasePerStack');
    emitTraitProfile(context, TRAIT.PYROMANCERS_PUISSANCE, TRAIT.PYROMANCERS_PUISSANCE, undefined, {
      at: impactAt,
      fullEnd: impactAt,
      effect: { type: 'strike', name: 'Flame Expulsion' },
      cast: emissionCast,
      activationId: context.combat.allocateEffectActivation('elementalist.effect:'),
      skillWeaponFallback: 'Unequipped',
      attribution: {
        source: 'Flame Expulsion',
        sourceId,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: sourceId,
        skillName: 'Flame Expulsion',
        name: "Pyromancer's Puissance — Flame Expulsion",
        icon: FLAME_EXPULSION_ICON
      },
      transform: (packet) => ({
        ...packet,
        coefficient: Number(packet.coefficient) + (coefficientPerMight * cappedMight) / Number(packet.totalHits)
      })
    });
  }

  if (flameExpulsionCondition) {
    const baseBurningDuration = Number(flameExpulsionCondition.duration);
    const burningDurationPerMight = balanceProfileNumber(pyromancersPuissanceProfile, 'durationPerTier');
    emitTraitProfile(context, TRAIT.PYROMANCERS_PUISSANCE, TRAIT.PYROMANCERS_PUISSANCE, undefined, {
      at: impactAt,
      fullEnd: impactAt,
      effect: { type: 'condition', name: 'Flame Expulsion' },
      cast: emissionCast,
      attribution: {
        source: 'Flame Expulsion',
        name: "Pyromancer's Puissance — Burning",
        sourceId: sourceId,
        skillName: 'Flame Expulsion',
        skillId: elementalistEventSkill(context, 'Flame Expulsion', sourceId).id,
        actorType: 'player'
      },
      transform: (packet) => ({
        ...packet,
        duration: Math.min(
          baseBurningDuration + burningDurationPerMight * cappedMight,
          baseBurningDuration +
            burningDurationPerMight * balanceProfileNumber(pyromancersPuissanceProfile, 'maximumStacks')
        )
      })
    });
  }

  const pyromancersPuissanceFlameExpulsionMight = requireEffect(
    pyromancersPuissanceProfile,
    'boon',
    'Flame Expulsion Might'
  );
  if (cappedMight > 0) {
    if (pyromancersPuissanceFlameExpulsionMight) {
      emitTraitProfile(context, TRAIT.PYROMANCERS_PUISSANCE, TRAIT.PYROMANCERS_PUISSANCE, undefined, {
        at: impactAt,
        fullEnd: impactAt,
        effect: { type: 'boon', name: 'Flame Expulsion Might' },
        cast: emissionCast,
        attribution: {
          source: 'Trait',
          sourceId: TRAIT.PYROMANCERS_PUISSANCE,
          skillName: 'Flame Expulsion',
          audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 5 },
          skillId: elementalistEventSkill(context, 'Flame Expulsion', sourceId).id,
          actorType: 'player',
          name: 'Flame Expulsion'
        },
        transform: (packet) => ({ ...packet, stacks: cappedMight })
      });
    }
  }

  if (flameExpulsionStrike || flameExpulsionCondition || (cappedMight > 0 && pyromancersPuissanceFlameExpulsionMight))
    context.effects.emit(
      elementalistAnnouncement({
        at: impactAt,
        name: 'Flame Expulsion',
        procType: 'trait',
        sourceId,
        sourceSkill: context.helpers.skillsById.get(sourceId)?.name,
        icon: FLAME_EXPULSION_ICON
      })
    );
}
