/** Owns imperative Core Engineer Explosives trait effects without registering their reactions. */
import {
  procChanceFromContext,
  requireEffectFromContext,
  balanceProfileNumberFromContext,
  effectNumberFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import {
  applyEngineerDerivedCondition,
  procState,
  queueBuff,
  queueDamage,
  recordTrait,
  resolverSkill
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import type {
  EngineerCastContext,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';

/** Schedules Grenadier's lesser barrage from an eligible healing cast after its internal cooldown. */
export function applyGrenadier(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context.config, TRAIT.GRENADIER) ||
    !isInternalCooldownReady(at, Number(state.traitProcReadyAt.grenadier || 0))
  )
    return;
  const grenadier = requireEffectFromContext(context, 'balance-profile', PROFILE.grenadier, 'strike', 'Grenadier');
  if (!grenadier) return;
  state.traitProcReadyAt.grenadier =
    at + balanceProfileNumberFromContext(context, PROFILE.grenadier, 'internalCooldown');
  const hits = Number(grenadier.hits);
  const coefficient = effectNumberFromContext(context, 'balance-profile', PROFILE.grenadier, grenadier, 'coefficient');
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

  const explosiveEntranceStrike = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.explosiveEntrance,
    'strike',
    'Explosive Entrance'
  );
  if (explosiveEntranceStrike) {
    // Only a surviving packet consumes this once-per-dodge proc.
    state.explosiveEntranceFired = true;
    queueDamage(context, event, {
      name: 'Explosive Entrance',
      coefficient: effectNumberFromContext(
        context,
        'balance-profile',
        PROFILE.explosiveEntrance,
        explosiveEntranceStrike,
        'coefficient'
      ),
      sourceId: TRAIT.EXPLOSIVE_ENTRANCE,
      actorType: 'effect',
      ownerActorType: 'player',
      explosion: true
    });

    recordTrait(context, 'Explosive Entrance', event);
  }
}

/** Applies Steel-Packed Powder to a hit already classified as an explosion. */
export function applySteelPackedPowder(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  if (!explosion || !hasTrait(context, TRAIT.STEEL_PACKED_POWDER)) return;
  const steelPackedPowderVulnerability = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.steelPackedPowder,
    'condition',
    'Vulnerability'
  );
  if (steelPackedPowderVulnerability) {
    applyEngineerDerivedCondition(context, event, {
      name: 'Steel-Packed Powder',
      condition: String(steelPackedPowderVulnerability.condition),
      stacks: Number(steelPackedPowderVulnerability.stacks),
      duration: Number(steelPackedPowderVulnerability.duration),
      sourceId: TRAIT.STEEL_PACKED_POWDER,
      actorType: 'effect'
    });
  }
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

  state.shortFuse = event.at + balanceProfileNumberFromContext(context, PROFILE.shortFuse, 'internalCooldown');
  const shortFuseFury = requireEffectFromContext(context, 'balance-profile', PROFILE.shortFuse, 'boon', 'fury');
  if (shortFuseFury) {
    queueBuff(context, event, {
      name: 'Short Fuse',
      kind: String(shortFuseFury.boon).toLowerCase(),
      stacks: Number(shortFuseFury.stacks),
      duration: Number(shortFuseFury.duration),
      sourceId: TRAIT.SHORT_FUSE,
      actorType: 'effect'
    });

    recordTrait(context, 'Short Fuse', event);
  }
}

/** Adds an Explosive Temper stack for each explosion hit. */
export function applyExplosiveTemper(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  explosion: boolean
): void {
  if (!explosion || !hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) return;
  const explosiveTemperBuff = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.explosiveTemper,
    'buff',
    'explosive-temper'
  );
  if (explosiveTemperBuff) {
    queueBuff(context, event, {
      name: 'Explosive Temper',
      kind: 'explosive-temper',
      stacks: Number(explosiveTemperBuff.stacks),
      duration: Number(explosiveTemperBuff.duration),
      sourceId: TRAIT.EXPLOSIVE_TEMPER,
      actorType: 'effect'
    });

    recordTrait(context, 'Explosive Temper', event);
  }
}

/** Grants Grand Entrance's resistance and critical-chance window from its trait strike. */
export function applyGrandEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.EXPLOSIVE_ENTRANCE || !hasTrait(context, TRAIT.GRAND_ENTRANCE)) return;
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
  // Generated rocket explosions also roll Shrapnel; effect ownership must not discard their opportunity.
  if (!explosion || !hasTrait(context, TRAIT.SHRAPNEL)) return;
  const state = procState(context);
  let triggered = false;
  const chance = procChanceFromContext(context, PROFILE.shrapnel);
  if (context.random?.stochastic === true) {
    triggered = context.random.roll(chance, 'engineer.shrapnel');
  } else {
    // Deterministic mode accumulates proc chance and spends one full proc at the threshold.
    state.shrapnelProgress = Number(state.shrapnelProgress || 0) + chance;
    triggered = state.shrapnelProgress >= 1;
  }

  if (!triggered) return;
  if (!context.random?.stochastic === true) {
    state.shrapnelProgress = Number(state.shrapnelProgress || 0) - 1;
  }

  const shrapnelBleeding = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.shrapnel,
    'condition',
    'Bleeding'
  );
  if (shrapnelBleeding) {
    applyEngineerDerivedCondition(context, event, {
      name: 'Shrapnel',
      condition: String(shrapnelBleeding.condition),
      // Count the activation on its primary effect only; the Crippled effect is part of the same proc.
      procCount: 1,
      stacks: Number(shrapnelBleeding.stacks),
      duration: Number(shrapnelBleeding.duration),
      sourceId: TRAIT.SHRAPNEL,
      actorType: 'effect',
      ownerActorType: 'player'
    });
  }

  const shrapnelCrippled = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.shrapnel,
    'condition',
    'Crippled'
  );
  if (shrapnelCrippled) {
    queueBuff(context, event, {
      name: 'Shrapnel',
      kind: 'target-crippled',
      stacks: Number(shrapnelCrippled.stacks),
      duration: Number(shrapnelCrippled.duration),
      sourceId: TRAIT.SHRAPNEL,
      actorType: 'effect'
    });
  }

  if (shrapnelBleeding || shrapnelCrippled) recordTrait(context, 'Shrapnel', event);
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
    event.at + balanceProfileNumberFromContext(context, PROFILE.aimAssistedRocket, 'internalCooldown');
  state.aimAssistedRocketCount = Number(state.aimAssistedRocketCount || 0) + 1;
  // Every fifth projectile upgrades to Orbital Command Strike with its two-second call-down delay.
  const alternateEvery = balanceProfileNumberFromContext(context, PROFILE.aimAssistedRocket, 'maximumStacks');
  const orbital = state.aimAssistedRocketCount % alternateEvery === 0;
  const rocket = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.aimAssistedRocket,
    'strike',
    orbital ? 'Orbital Strike' : 'Rocket'
  );
  if (rocket) {
    queueDamage(context, event, {
      name: orbital ? 'Orbital Command Strike' : 'Aim-Assisted Rocket',
      coefficient: effectNumberFromContext(
        context,
        'balance-profile',
        PROFILE.aimAssistedRocket,
        rocket,
        'coefficient'
      ),
      sourceId: orbital ? ID.ORBITAL_COMMAND_STRIKE : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL,
      actorType: 'effect',
      ownerActorType: 'player',
      at:
        event.at +
        effectNumberFromContext(context, 'balance-profile', PROFILE.aimAssistedRocket, rocket, 'atMs') / 1000,
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
}
