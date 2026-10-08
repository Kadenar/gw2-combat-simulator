import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  elementalistBuffRequest,
  elementalistConditionRequest,
  elementalistStrikeRequest
} from '#gw2/professions/elementalist/core/events.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import {
  combatStarted,
  elementalistAnnouncement,
  elementalistEventSkill,
  elementalistProfiledConditionRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import type { ElementalistAttunementTraitDispatch } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

const SUNSPOT_ICON = 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png';

const FLAME_EXPULSION_ICON = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';

// Materialize Sunspot's aura, strike, Burning, and proc at the entry timestamp.
export function triggerSunspot(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  applyAura: ElementalistAuraApplier,
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.SUNSPOT)) return;
  emitSunspot(context, at, sourceId, applyAura, emissionCast);
}

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
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          at,
          source: 'Sunspot',
          sourceId,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: 'Sunspot',
          icon: SUNSPOT_ICON,
          triggeredBy: sourceSkill,
          coefficient: effectNumber(sunspotProfile, sunspotStrike, 'coefficient'),
          skillWeapon: 'Unequipped',
          canCrit: false
        },
        emissionCast
      )
    );
  }

  const burningEmitted =
    hasTrait(context, TRAIT.BURNING_RAGE) &&
    context.effects.emit({
      ...elementalistProfiledConditionRequest(
        context,
        at,
        TRAIT.BURNING_RAGE,
        'Sunspot Burning',
        'Sunspot',
        sourceId,
        sourceSkill,
        emissionCast
      ),
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

// Snapshot capped Might on Fire exit; the delayed blast damages enemies and grants that Might to other allies.
export function triggerFlameExpulsion(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.PYROMANCERS_PUISSANCE)) return;
  emitFlameExpulsion(context, at, sourceId, emissionCast);
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
    const baseCoefficient = effectNumber(pyromancersPuissanceProfile, flameExpulsionStrike, 'coefficient');
    const coefficientPerMight = balanceProfileNumber(pyromancersPuissanceProfile, 'damageIncreasePerStack');
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          at: impactAt,
          source: 'Flame Expulsion',
          // Preserve combat identity while exposing the selected trait that owns this delayed packet.
          name: "Pyromancer's Puissance — Flame Expulsion",
          sourceId,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: 'Flame Expulsion',
          icon: FLAME_EXPULSION_ICON,
          coefficient: baseCoefficient + coefficientPerMight * cappedMight,
          skillWeapon: 'Unequipped'
        },
        emissionCast
      )
    );
  }

  if (flameExpulsionCondition) {
    const baseBurningDuration = Number(flameExpulsionCondition.duration);
    const burningDurationPerMight = balanceProfileNumber(pyromancersPuissanceProfile, 'durationPerTier');
    context.effects.emit(
      elementalistConditionRequest(
        {
          skill: elementalistEventSkill(context, 'Flame Expulsion', sourceId),
          at: impactAt,
          source: 'Flame Expulsion',
          name: "Pyromancer's Puissance — Burning",
          sourceId,
          condition: String(flameExpulsionCondition.condition),
          stacks: Number(flameExpulsionCondition.stacks),
          duration: Math.min(
            baseBurningDuration + burningDurationPerMight * cappedMight,
            baseBurningDuration +
              burningDurationPerMight * balanceProfileNumber(pyromancersPuissanceProfile, 'maximumStacks')
          ),
          skillName: 'Flame Expulsion'
        },
        emissionCast
      )
    );
  }

  const pyromancersPuissanceFlameExpulsionMight = requireEffect(
    pyromancersPuissanceProfile,
    'boon',
    'Flame Expulsion Might'
  );
  if (cappedMight > 0) {
    if (pyromancersPuissanceFlameExpulsionMight) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: elementalistEventSkill(context, 'Flame Expulsion', sourceId),
            at: impactAt,
            source: 'Trait',
            sourceId: TRAIT.PYROMANCERS_PUISSANCE,
            skillName: 'Flame Expulsion',
            kind: String(pyromancersPuissanceFlameExpulsionMight.boon).toLowerCase(),
            stacks: cappedMight,
            duration: pyromancersPuissanceFlameExpulsionMight.duration,
            audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 5 }
          },
          emissionCast
        )
      );
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

/** Apply Fire transition traits at the dispatcher's original phase, honoring elite entry vetoes. */
export function applyFireAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch,
  applyAura: ElementalistAuraApplier,
  emissionCast?: EffectDelivery['cast']
): void {
  const { at, skill, previous, target, shouldTrigger } = dispatch;
  if (previous === 'Fire' && target !== 'Fire' && shouldTrigger('Fire', TRAIT.PYROMANCERS_PUISSANCE)) {
    triggerFlameExpulsion(context, at, skill.id, emissionCast);
  }

  if (target === 'Fire' && shouldTrigger('Fire', TRAIT.SUNSPOT))
    triggerSunspot(context, at, skill.id, applyAura, emissionCast);
}
