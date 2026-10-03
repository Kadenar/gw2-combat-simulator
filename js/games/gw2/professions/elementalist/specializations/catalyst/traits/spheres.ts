import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
/** Sphere traits observe the deployment after its intrinsic start action and before ordinary packet emission. */
export function applySphereStartTraits(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  // Spectacular Sphere pays party quickness plus the attunement's boon on deployment.
  // Sphere Specialist scales these procedural payouts once, separately from authored sphere packets.
  if (hasTrait(context, TRAIT.SPECTACULAR_SPHERE)) {
    const durationMultiplier = sphereSpecialistDuration(context);
    const spectacularSphereProfile = requireBalanceProfileFromContext(context, TRAIT.SPECTACULAR_SPHERE);
    const quickness = requireEffect(spectacularSphereProfile, 'boon', 'Quickness');
    if (quickness) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            at: cast.start,
            source: skill.name,
            sourceId: skill.id,
            actorType: 'player',
            skillName: skill.name,
            kind: String(quickness.boon).toLowerCase(),
            stacks: Number(quickness.stacks),
            duration: quickness.duration * durationMultiplier,
            audience: { recipients: 'party' as const, maximumRecipients: 5 }
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }

    const profiledBoon = requireEffect(spectacularSphereProfile, 'boon', String(skill.attunement));
    if (profiledBoon) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            at: cast.start,
            source: skill.name,
            sourceId: skill.id,
            actorType: 'player',
            skillName: skill.name,
            kind: String(profiledBoon.boon),
            stacks: Number(profiledBoon.stacks),
            duration: profiledBoon.duration * durationMultiplier,
            audience: { recipients: 'party' as const, maximumRecipients: 5 }
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }
}

export function applyEnergizedElements(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): boolean {
  // Energized Elements refunds energy and grants fury on every attunement swap.
  if (event.type === 'elementalist.attunement' && hasTrait(context, TRAIT.ENERGIZED_ELEMENTS)) {
    const state = catalystState.from(context);
    const before = state.energy;
    const energizedElementsProfile = requireBalanceProfileFromContext(context, TRAIT.ENERGIZED_ELEMENTS);
    const energyGain = balanceProfileNumber(energizedElementsProfile, 'resourceGain');
    state.energy = Math.min(
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks'),
      state.energy + energyGain
    );
    const fury = requireEffect(energizedElementsProfile, 'boon', 'Fury');
    if (fury) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: elementalistEventSkill(context, 'Energized Elements', event.sourceId),
            at: event.at,
            source: 'Energized Elements',
            sourceId: event.sourceId,
            actorType: 'player',
            kind: String(fury.boon).toLowerCase(),
            stacks: Number(fury.stacks),
            duration: fury.duration,
            skillName: 'Energized Elements'
          },
          emissionCast
        )
      );
    }

    if (state.energy !== before) {
      context.effects.emit({
        kind: 'packet',
        cause: event,
        event: {
          type: 'resource',
          at: event.at,
          source: 'Energized Elements',
          sourceId: event.sourceId,
          actorType: 'player',
          skillName: 'Energized Elements',
          kind: 'catalyst-energy',
          value: state.energy,
          maximum: balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks'),
          change: state.energy - before
        }
      });
    }

    return true;
  }

  return false;
}

/** Sphere Specialist permits accepted hits to restore energy while a sphere remains active. */
export function sphereSpecialistAllowsEnergy(context: ElementalistRuntime): boolean {
  return hasTrait(context, TRAIT.SPHERE_SPECIALIST);
}

/** Read the active duration tuning at deployment for both sphere packets and Spectacular Sphere payouts. */
function sphereSpecialistDuration(context: ElementalistRuntime): number {
  return hasTrait(context, TRAIT.SPHERE_SPECIALIST)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SPHERE_SPECIALIST), 'durationMultiplier')
    : 1;
}

/** Extend only authored boons and buffs, leaving damage and field windows unchanged. */
export function applySphereSpecialistDurations(
  context: ElementalistRuntime,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (!hasTrait(context, TRAIT.SPHERE_SPECIALIST)) return effects;
  const multiplier = sphereSpecialistDuration(context);
  return effects.map((effect) =>
    effect.type === 'boon' || effect.type === 'buff' ? { ...effect, duration: effect.duration * multiplier } : effect
  );
}
