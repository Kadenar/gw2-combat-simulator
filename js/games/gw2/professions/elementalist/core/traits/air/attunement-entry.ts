import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  combatStarted,
  elementalistAnnouncement,
  elementalistProfiledBuffRequest,
  elementalistProfiledConditionRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import type { ElementalistAttunementTraitDispatch } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Emits Electric Discharge from a qualifying Air-attunement transition. */
export function triggerElectricDischarge(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!combatStarted(context, at) || !hasTrait(context, TRAIT.ELECTRIC_DISCHARGE)) return;
  emitElectricDischarge(context, at, sourceId, emissionCast);
}

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
    context.effects.emit(
      elementalistStrikeRequest(
        context,
        {
          at,
          source: 'Electric Discharge',
          sourceId,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: 'Electric Discharge',
          coefficient: effectNumber(electricDischargeProfile, electricDischargeStrike, 'coefficient'),
          skillWeapon: 'Unequipped'
        },
        emissionCast
      )
    );
  }

  const conditionEmitted =
    context.effects.emit({
      ...elementalistProfiledConditionRequest(
        context,
        at,
        TRAIT.ELECTRIC_DISCHARGE,
        'Electric Discharge',
        'Electric Discharge',
        sourceId,
        undefined,
        emissionCast
      ),
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

/** Opens Fresh Air's ferocity window when an attunement transition newly enters Air. */
function applyFreshAirAttunementEntry(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  previous: string,
  emissionCast?: EffectDelivery['cast']
): void {
  if (previous === 'Air' || !hasTrait(context, TRAIT.FRESH_AIR)) return;
  const freshAirProfile = requireBalanceProfileFromContext(context, TRAIT.FRESH_AIR);
  const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
  if (freshAir) {
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: skill,
          at,
          source: 'Trait',
          sourceId: TRAIT.FRESH_AIR,
          actorType: 'player',
          kind: 'fresh-air',
          stacks: Number(freshAir.stacks),
          duration: freshAir.duration,
          skillName: skill.name,
          priority: -10
        },
        emissionCast
      )
    );
  }
}

/** Reads Superspeed as a buff so profile overrides apply without boon-duration scaling. */
export function applyOneWithAir(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  emissionCast?: EffectDelivery['cast']
): void {
  if (!hasTrait(context, TRAIT.ONE_WITH_AIR)) return;
  const oneWithAirProfile = requireBalanceProfileFromContext(context, TRAIT.ONE_WITH_AIR);
  const superspeed = requireEffect(oneWithAirProfile, 'buff', 'Superspeed');
  if (superspeed) {
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: skill,
          at,
          source: 'Trait',
          sourceId: TRAIT.ONE_WITH_AIR,
          actorType: 'player',
          kind: String(superspeed.kind).toLowerCase(),
          stacks: Number(superspeed.stacks),
          duration: superspeed.duration,
          skillName: skill.name
        },
        emissionCast
      )
    );
  }
}

/** Grants Inscription's dedicated Resistance effect after entering Air. */
export function applyInscriptionAirEntry(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  emissionCast?: EffectDelivery['cast']
): void {
  if (hasTrait(context, TRAIT.INSCRIPTION)) {
    context.effects.emit(
      elementalistProfiledBuffRequest(
        context,
        at,
        TRAIT.INSCRIPTION,
        'Air Entry',
        skill.name,
        skill.id,
        undefined,
        undefined,
        emissionCast
      )
    );
  }
}

/** Apply Air transition traits at the dispatcher's original phase, honoring elite entry vetoes. */
export function applyAirAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch,
  emissionCast?: EffectDelivery['cast']
): void {
  const { at, skill, previous, target, shouldTrigger } = dispatch;
  if (target === 'Air') {
    if (shouldTrigger('Air', TRAIT.ELECTRIC_DISCHARGE)) triggerElectricDischarge(context, at, skill.id, emissionCast);
    applyFreshAirAttunementEntry(context, at, skill, previous, emissionCast);
    applyOneWithAir(context, at, skill, emissionCast);
    applyInscriptionAirEntry(context, at, skill, emissionCast);
  }
}

/** A familiar-triggered Air entry refreshes Fresh Air without requiring a preceding different element. */
export function applyFreshAirSyntheticEntry(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  emissionCast?: EffectDelivery['cast']
): void {
  if (hasTrait(context, TRAIT.FRESH_AIR)) {
    const freshAirProfile = requireBalanceProfileFromContext(context, TRAIT.FRESH_AIR);
    const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
    if (freshAir) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: skill,
            at,
            source: 'Trait',
            sourceId: TRAIT.FRESH_AIR,
            actorType: 'player',
            kind: String(freshAir.kind).toLowerCase(),
            stacks: Number(freshAir.stacks),
            duration: freshAir.duration,
            skillName: skill.name
          },
          emissionCast
        )
      );
    }
  }
}
