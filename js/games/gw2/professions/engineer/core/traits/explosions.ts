import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceCyclicCounter } from '#gw2/platform/combat/resources/counters.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber,
  procChanceFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT, ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type {
  EngineerRuntime,
  EngineerSkill,
  EngineerResolverContext,
  EngineerResolverEvent
} from '#gw2/professions/engineer/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  buildEngineerStrike,
  buildEngineerCondition,
  buildEngineerBuff,
  resolverSkill
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';

/** Owns imperative Core Engineer Explosives trait effects without registering their reactions. */

/** Schedules Grenadier's lesser barrage from an eligible healing cast after its internal cooldown. */
export function applyGrenadier(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if ((skill.type !== 'Heal' && skill.slot !== 'Heal') || !hasTrait(context.traits, TRAIT.GRENADIER)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.GRENADIER);
  const effect = requireEffect(profile, 'strike', 'Grenadier');
  // A removed barrage leaves the trait ready; claim before emitting any surviving strikes.
  if (!effect || !context.procs.claim(TRAIT.GRENADIER, 'grenadier', at)) return;
  emitGrenadier(context, skill, at);
}

/** Build one lesser barrage independently of its triggering heal and cooldown. */
export function emitGrenadier(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.GRENADIER);
  const effect = requireEffect(profile, 'strike', 'Grenadier');
  if (!effect) return;
  context.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: [effect],
    at,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.GRENADIER,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: skill.id,
      skillName: 'Lesser Grenade Barrage',
      triggeredBy: skill.name
    },
    transform: (event) => ({
      ...event,
      parentSkillName: skill.name,
      name: 'Lesser Grenade Barrage',
      skillWeapon: 'Unequipped',
      explosion: true
    })
  });
}

/** Rearms Explosive Entrance after a resolved Engineer dodge. */
export function resetExplosiveEntrance(context: EngineerResolverContext): void {
  professionCoreState(context).explosiveEntranceFired = false;
}

/** Queues Explosive Entrance once for the next eligible player strike. */
export function applyExplosiveEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !hasTrait(context, TRAIT.EXPLOSIVE_ENTRANCE) ||
    professionCoreState(context).explosiveEntranceFired
  ) {
    return;
  }

  const explosiveEntranceProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_ENTRANCE);
  const explosiveEntranceStrike = requireEffect(explosiveEntranceProfile, 'strike', 'Explosive Entrance');
  if (explosiveEntranceStrike) {
    // Only a surviving packet consumes this once-per-dodge proc.
    professionCoreState(context).explosiveEntranceFired = true;
    emitExplosiveEntrance(context, event);
  }
}

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

/** Applies Steel-Packed Powder to a hit already classified as an explosion. */
export function applySteelPackedPowder(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  if (!explosion || !hasTrait(context, TRAIT.STEEL_PACKED_POWDER)) return;
  const steelPackedPowderProfile = requireBalanceProfileFromContext(context, TRAIT.STEEL_PACKED_POWDER);
  const steelPackedPowderVulnerability = requireEffect(steelPackedPowderProfile, 'condition', 'Vulnerability');
  if (steelPackedPowderVulnerability) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Steel-Packed Powder',
        condition: String(steelPackedPowderVulnerability.condition),
        stacks: Number(steelPackedPowderVulnerability.stacks),
        duration: Number(steelPackedPowderVulnerability.duration),
        sourceId: TRAIT.STEEL_PACKED_POWDER,
        actorType: 'effect'
      }),
      settlement: 'reaction'
    });
  }
}

/** Grants Short Fuse fury from an explosion when its internal cooldown is ready. */
export function applyShortFuse(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  const state = context.procs;
  if (
    !explosion ||
    !hasTrait(context, TRAIT.SHORT_FUSE) ||
    !isInternalCooldownReady(event.at, state.deadline('shortFuse') || 0)
  ) {
    return;
  }

  const shortFuseProfile = requireBalanceProfileFromContext(context, TRAIT.SHORT_FUSE);
  state.setDeadline('shortFuse', event.at + balanceProfileNumber(shortFuseProfile, 'internalCooldown'));
  const shortFuseFury = requireEffect(shortFuseProfile, 'boon', 'fury');
  if (shortFuseFury) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Short Fuse',
        kind: String(shortFuseFury.boon).toLowerCase(),
        stacks: Number(shortFuseFury.stacks),
        duration: shortFuseFury.duration,
        sourceId: TRAIT.SHORT_FUSE,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.SHORT_FUSE, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Short Fuse', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Adds an Explosive Temper stack for each explosion hit. */
export function applyExplosiveTemper(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  if (!explosion || !hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) return;
  const explosiveTemperProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_TEMPER);
  const explosiveTemperBuff = requireEffect(explosiveTemperProfile, 'buff', 'explosive-temper');
  if (explosiveTemperBuff) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Explosive Temper',
        kind: 'explosive-temper',
        stacks: Number(explosiveTemperBuff.stacks),
        duration: explosiveTemperBuff.duration,
        sourceId: TRAIT.EXPLOSIVE_TEMPER,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.EXPLOSIVE_TEMPER, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Explosive Temper', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Grants Grand Entrance's resistance and critical-chance window from its trait strike. */
export function applyGrandEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.EXPLOSIVE_ENTRANCE || !hasTrait(context, TRAIT.GRAND_ENTRANCE)) return;
  context.effects.emit({
    kind: 'packet',
    event: buildEngineerBuff(event, {
      name: 'Grand Entrance — resistance',
      kind: 'resistance',
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.GRAND_ENTRANCE,
      actorType: 'effect'
    }),
    durationContext: event
  });
  context.effects.emit({
    kind: 'packet',
    event: buildEngineerBuff(event, {
      name: 'Grand Entrance',
      kind: 'grand-entrance',
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.GRAND_ENTRANCE,
      actorType: 'effect'
    }),
    durationContext: event
  });
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.GRAND_ENTRANCE, actorType: 'effect' },
    kind: 'announcement',
    cause: event,
    announcement: { type: 'trait', name: 'Grand Entrance', at: event.at, sourceSkill: event.skillName, icon: '' }
  });
}

/** Rolls Shrapnel against the simulation seed in both modes for each eligible explosion. */
export function applyShrapnel(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  // Generated rocket explosions also roll Shrapnel; effect ownership must not discard their opportunity.
  if (!explosion || !hasTrait(context, TRAIT.SHRAPNEL)) return;
  const chance = procChanceFromContext(context, TRAIT.SHRAPNEL);
  if (!context.random.roll(chance, 'engineer.shrapnel')) return;

  const shrapnelProfile = requireBalanceProfileFromContext(context, TRAIT.SHRAPNEL);
  const shrapnelBleeding = requireEffect(shrapnelProfile, 'condition', 'Bleeding');
  if (shrapnelBleeding) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Shrapnel',
        condition: String(shrapnelBleeding.condition),
        // Count the activation on its primary effect only; the Crippled effect is part of the same proc.
        procCount: 1,
        stacks: Number(shrapnelBleeding.stacks),
        duration: Number(shrapnelBleeding.duration),
        sourceId: TRAIT.SHRAPNEL,
        actorType: 'effect',
        ownerActorType: 'player'
      }),
      settlement: 'reaction'
    });
  }

  const shrapnelCrippled = requireEffect(shrapnelProfile, 'condition', 'Crippled');
  if (shrapnelCrippled) {
    // Resolve Crippled as a target condition so duration bonuses and condition queries include it.
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Shrapnel',
        condition: String(shrapnelCrippled.condition),
        stacks: Number(shrapnelCrippled.stacks),
        duration: Number(shrapnelCrippled.duration),
        sourceId: TRAIT.SHRAPNEL,
        actorType: 'effect',
        ownerActorType: 'player'
      }),
      settlement: 'reaction'
    });
  }

  if (shrapnelBleeding || shrapnelCrippled)
    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.SHRAPNEL, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Shrapnel', at: event.at, sourceSkill: event.skillName, icon: '' }
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
      activeBoonStacks(context, 'explosive-temper', balanceProfileNumber(explosiveTemperProfile, 'maximumStacks')) *
        balanceProfileNumber(explosiveTemperProfile, 'attributePerStack');
  }
}
