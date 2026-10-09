import { type EngineerResolverContext, type EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { buildEngineerStrike, resolverSkill } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { type Gw2MutableStats } from '#gw2/platform/combat/stats.js';
import { advanceCyclicCounter } from '#gw2/platform/combat/resources/counters.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';

/** Emit one entrance strike without consuming dodge or attack history. */
export function emitExplosiveEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const explosiveEntranceProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_ENTRANCE);
  const explosiveEntranceStrike = requireEffect(explosiveEntranceProfile, 'strike', 'Explosive Entrance');
  if (!explosiveEntranceStrike) return;
  context.effects.emit({
    kind: 'packet',
    event: buildEngineerStrike(event, {
      skillWeapon: 'Unequipped',
      name: 'Explosive Entrance',
      coefficient: effectNumber(explosiveEntranceProfile, explosiveEntranceStrike, 'coefficient'),
      sourceId: TRAIT.EXPLOSIVE_ENTRANCE,
      actorType: 'effect',
      ownerActorType: 'player',
      explosion: true
    })
  });

  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.EXPLOSIVE_ENTRANCE, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: { type: 'trait', name: 'Explosive Entrance', at: event.at, sourceSkill: event.skillName, icon: '' }
  });
}

// Only player packets with authored projectile identity can trigger Aim-Assisted Rocket.
function isAimAssistedProjectile(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.actorType !== 'player') return false;
  if (event.projectile === true) return true;
  const skill = resolverSkill(context, event.skillId);
  return Boolean(skill?.categories?.some((category) => category.toLowerCase() === 'projectile'));
}

/** Queues Aim-Assisted Rocket, upgrading every fifth eligible proc to Orbital Command Strike. */
export function applyAimAssistedRocket(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const state = context.procs;
  if (
    !hasTrait(context, TRAIT.AIM_ASSISTED_ROCKET) ||
    !isAimAssistedProjectile(context, event) ||
    !isInternalCooldownReady(event.at, state.deadline('aimAssistedRocket') || 0)
  ) {
    return;
  }

  const aimAssistedRocketProfile = requireBalanceProfileFromContext(context, TRAIT.AIM_ASSISTED_ROCKET);
  state.setDeadline('aimAssistedRocket', event.at + balanceProfileNumber(aimAssistedRocketProfile, 'internalCooldown'));
  const core = professionCoreState(context);
  const alternateEvery = balanceProfileNumber(aimAssistedRocketProfile, 'maximumStacks');
  // Count only accepted procs and preserve the cumulative total used to select each orbital strike.
  const progress = advanceCyclicCounter(core.aimAssistedRocketCount, 1, alternateEvery);
  core.aimAssistedRocketCount = progress.value;
  emitAimAssistedRocket(context, event, progress.reached);
}

/** Rocket and orbital strike are independently meaningful occurrence variants. */
export function emitAimAssistedRocket(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  orbital: boolean
): void {
  const aimAssistedRocketProfile = requireBalanceProfileFromContext(context, TRAIT.AIM_ASSISTED_ROCKET);
  const rocket = requireEffect(aimAssistedRocketProfile, 'strike', orbital ? 'Orbital Strike' : 'Rocket');
  if (rocket) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        skillWeapon: 'Unequipped',
        // The trait owns both variants; retain their distinct skill identities and display names.
        name: orbital ? 'Orbital Command Strike' : 'Aim-Assisted Rocket',
        coefficient: effectNumber(aimAssistedRocketProfile, rocket, 'coefficient'),
        sourceId: orbital ? ID.ORBITAL_COMMAND_STRIKE : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL,
        actorType: 'effect',
        ownerActorType: 'player',
        at: event.at + effectNumber(aimAssistedRocketProfile, rocket, 'atMs') / 1000,
        explosion: !orbital,
        ...(orbital
          ? {
              comboFinisher: {
                ownerId: 'engineer',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            }
          : {}),
        weaponStrengthProfileId: 'nonweapon.unequipped'
      })
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.AIM_ASSISTED_ROCKET, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: {
        type: 'trait',
        name: orbital ? 'Orbital Command Strike' : 'Aim-Assisted Rocket',
        at: event.at,
        sourceSkill: event.skillName,
        icon: ''
      }
    });
  }
}

/** Applies Explosive Temper at the live attribute boundary while preserving build provenance. */
export function applyExplosiveTemperAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    const explosiveTemperProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_TEMPER);
    modified.ferocity =
      (modified.ferocity || 0) +
      activeBuffStacks(context, 'explosive-temper', balanceProfileNumber(explosiveTemperProfile, 'maximumStacks')) *
        balanceProfileNumber(explosiveTemperProfile, 'attributePerStack');
  }
}
