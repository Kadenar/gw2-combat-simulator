/** Owns imperative Core Engineer Explosives trait effects without registering their reactions. */
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/engineer/core/profiles.js';
import {
  applyEngineerDerivedCondition,
  procState,
  queueBuff,
  queueDamage,
  recordTrait,
  resolverSkill
} from '#gw2/content/professions/engineer/core/mechanics/state-helpers.js';
import type {
  EngineerCastContext,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

/** Schedules Grenadier's lesser barrage from an eligible healing cast after its internal cooldown. */
export function applyGrenadier(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context.config, TRAIT.GRENADIER) ||
    !isInternalCooldownReady(at, Number(state.traitProcReadyAt.grenadier || 0))
  )
    return;
  state.traitProcReadyAt.grenadier =
    at + balanceProfileValueFromContext(context, PROFILE.grenadier, 'internalCooldown', 20);
  const grenadier = balanceProfileEffectFromContext(context, PROFILE.grenadier, 'strike');
  const hits = balanceProfileValue(grenadier, 'hits', 6);
  const coefficient = balanceProfileValue(grenadier, 'coefficient', 0.5);
  // Emit distinct packets so per-hit reactions and attribution retain the barrage sequence.
  for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
    emitSkillDamage(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.GRENADIER,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: skill.id,
      skillName: 'Lesser Grenade Barrage',
      parentSkillName: skill.name,
      name: 'Lesser Grenade Barrage',
      coefficient,
      hits: 1,
      hitIndex,
      totalHits: hits,
      skillWeapon: 'Unequipped',
      explosion: true,
      triggeredBy: skill.name
    });
  }
}

/** Rearms Explosive Entrance after a resolved Engineer dodge. */
export function resetExplosiveEntrance(context: EngineerResolverContext): void {
  procState(context).explosiveEntranceFired = false;
}

/** Queues Explosive Entrance once for the next eligible player strike. */
export function applyExplosiveEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const state = procState(context);
  if (event.actorType !== 'player' || !hasTrait(context, TRAIT.EXPLOSIVE_ENTRANCE) || state.explosiveEntranceFired) {
    return;
  }

  // Fires once per attack sequence; dodge resets the flag for the next sequence.
  state.explosiveEntranceFired = true;
  queueDamage(context, event, {
    name: 'Explosive Entrance',
    coefficient: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.explosiveEntrance, 'strike'),
      'coefficient',
      1.25
    ),
    sourceId: TRAIT.EXPLOSIVE_ENTRANCE,
    actorType: 'effect',
    ownerActorType: 'player',
    explosion: true
  });
  recordTrait(context, 'Explosive Entrance', event);
}

/** Applies Steel-Packed Powder to a hit already classified as an explosion. */
export function applySteelPackedPowder(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  if (!explosion || !hasTrait(context, TRAIT.STEEL_PACKED_POWDER)) return;
  applyEngineerDerivedCondition(context, event, {
    name: 'Steel-Packed Powder',
    condition: 'Vulnerability',
    stacks: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.steelPackedPowder, 'condition'),
      'stacks',
      1
    ),
    duration: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.steelPackedPowder, 'condition'),
      'duration',
      5
    ),
    sourceId: TRAIT.STEEL_PACKED_POWDER,
    actorType: 'effect'
  });
}

/** Grants Short Fuse fury from an explosion when its internal cooldown is ready. */
export function applyShortFuse(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  const state = procState(context);
  if (
    !explosion ||
    !hasTrait(context, TRAIT.SHORT_FUSE) ||
    !isInternalCooldownReady(event.at, Number(state.shortFuse || 0))
  ) {
    return;
  }

  state.shortFuse = event.at + balanceProfileValueFromContext(context, PROFILE.shortFuse, 'internalCooldown', 3);
  queueBuff(context, event, {
    name: 'Short Fuse',
    kind: 'fury',
    stacks: 1,
    duration: balanceProfileValue(balanceProfileEffectFromContext(context, PROFILE.shortFuse, 'boon'), 'duration', 4),
    sourceId: TRAIT.SHORT_FUSE,
    actorType: 'effect'
  });
  recordTrait(context, 'Short Fuse', event);
}

/** Adds an Explosive Temper stack for each explosion hit. */
export function applyExplosiveTemper(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  if (!explosion || !hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) return;
  queueBuff(context, event, {
    name: 'Explosive Temper',
    kind: 'explosive-temper',
    stacks: 1,
    duration: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.explosiveTemper, 'buff'),
      'duration',
      10
    ),
    sourceId: TRAIT.EXPLOSIVE_TEMPER,
    actorType: 'effect'
  });
  recordTrait(context, 'Explosive Temper', event);
}

/** Grants Grand Entrance's resistance and critical-chance window from its trait strike. */
export function applyGrandEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.name !== 'Explosive Entrance' || !hasTrait(context, TRAIT.GRAND_ENTRANCE)) return;
  queueBuff(context, event, {
    name: 'Grand Entrance — resistance',
    kind: 'resistance',
    stacks: 1,
    duration: 3,
    sourceId: TRAIT.GRAND_ENTRANCE,
    actorType: 'effect'
  });
  queueBuff(context, event, {
    name: 'Grand Entrance',
    kind: 'grand-entrance',
    stacks: 1,
    duration: 3,
    sourceId: TRAIT.GRAND_ENTRANCE,
    actorType: 'effect'
  });
  recordTrait(context, 'Grand Entrance', event);
}

/** Resolves Shrapnel's random or accumulated proc for an eligible explosion. */
export function applyShrapnel(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  if (!explosion || event.name === 'Aim-Assisted Rocket' || !hasTrait(context, TRAIT.SHRAPNEL)) return;
  const state = procState(context);
  let triggered = false;
  if (context.random?.stochastic === true) {
    triggered = context.random.roll(
      balanceProfileValueFromContext(context, PROFILE.shrapnel, 'procChance', 0.33),
      'engineer.shrapnel'
    );
  } else {
    // Deterministic mode accumulates proc chance and spends one full proc at the threshold.
    state.shrapnelProgress =
      Number(state.shrapnelProgress || 0) +
      balanceProfileValueFromContext(context, PROFILE.shrapnel, 'procChance', 0.33);
    triggered = state.shrapnelProgress >= 1;
  }

  if (!triggered) return;
  if (!context.random?.stochastic === true) {
    state.shrapnelProgress = Number(state.shrapnelProgress || 0) - 1;
  }

  applyEngineerDerivedCondition(context, event, {
    name: 'Shrapnel',
    condition: 'Bleeding',
    stacks: balanceProfileValue(balanceProfileEffectFromContext(context, PROFILE.shrapnel, 'condition'), 'stacks', 1),
    duration: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.shrapnel, 'condition'),
      'duration',
      6
    ),
    sourceId: TRAIT.SHRAPNEL,
    actorType: 'effect',
    ownerActorType: 'player'
  });
  queueBuff(context, event, {
    name: 'Shrapnel',
    kind: 'target-crippled',
    stacks: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.shrapnel, 'condition', 1),
      'stacks',
      1
    ),
    duration: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.shrapnel, 'condition', 1),
      'duration',
      1
    ),
    sourceId: TRAIT.SHRAPNEL,
    actorType: 'effect'
  });
  recordTrait(context, 'Shrapnel', event);
}

// Mech attacks do not trigger Aim-Assisted Rocket; player projectiles and Grenade Kit packets do.
function isAimAssistedProjectile(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.actorType !== 'player') return false;
  if (event.projectile === true) return true;
  const skill = resolverSkill(context, event.skillId);
  return Boolean(
    skill?.kit === 'Grenade Kit' ||
    skill?.categories?.some((category) => String(category).toLowerCase() === 'projectile')
  );
}

/** Queues Aim-Assisted Rocket, upgrading every fifth eligible proc to Orbital Command Strike. */
export function applyAimAssistedRocket(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const state = procState(context);
  if (
    !hasTrait(context, TRAIT.AIM_ASSISTED_ROCKET) ||
    !isAimAssistedProjectile(context, event) ||
    !isInternalCooldownReady(event.at, Number(state.aimAssistedRocket || 0))
  ) {
    return;
  }

  state.aimAssistedRocket =
    event.at + balanceProfileValueFromContext(context, PROFILE.aimAssistedRocket, 'internalCooldown', 3);
  state.aimAssistedRocketCount = Number(state.aimAssistedRocketCount || 0) + 1;
  // Every fifth projectile upgrades to Orbital Command Strike with its two-second call-down delay.
  const alternateEvery = balanceProfileValueFromContext(context, PROFILE.aimAssistedRocket, 'maximumStacks', 5);
  const orbital = state.aimAssistedRocketCount % alternateEvery === 0;
  const rocket = balanceProfileEffectFromContext(context, PROFILE.aimAssistedRocket, 'strike', orbital ? 1 : 0);
  queueDamage(context, event, {
    name: orbital ? 'Orbital Command Strike' : 'Aim-Assisted Rocket',
    coefficient: balanceProfileValue(rocket, 'coefficient', orbital ? 1.92 : 1),
    sourceId: orbital ? ID.ORBITAL_COMMAND_STRIKE : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL,
    actorType: 'effect',
    ownerActorType: 'player',
    at: event.at + balanceProfileValue(rocket, 'atMs', orbital ? 2000 : 40) / 1000,
    explosion: !orbital,
    ...(orbital
      ? {
          comboFinisher: {
            ownerId: 'engineer',
            attemptId: `${event.activationId || event.sourceId}:orbital-command-strike:blast`,
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        }
      : {}),
    weaponStrengthProfileId: 'nonweapon.unequipped'
  });
  recordTrait(context, orbital ? 'Orbital Command Strike' : 'Aim-Assisted Rocket', event);
}
