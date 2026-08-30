import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { snapshotEngineerState } from '#gw2/content/professions/engineer/state.js';
import {
  ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  engineerBalanceEffectValue,
  engineerBalanceValue
} from '#gw2/content/professions/engineer/core/profiles.js';
import {
  applyEngineerDerivedCondition,
  procState,
  queueBuff,
  queueDamage,
  recordTrait,
  resolverSkill
} from '#gw2/content/professions/engineer/core/mechanics/state-helpers.js';
import type { SimulationEvent, SkillId } from '#gw2/platform/engine/types.js';
import type { ResolvedCriticalHitOptions } from '#gw2/integrations/patches/authoring/mechanics.js';
import type {
  EngineerCastContext,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails,
  EngineerSchedulerContext,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

/** Detects explicit specialization toolbelt skills and ordinary parent-linked toolbelt skills. */
export function isEngineerToolbeltSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.countsAsToolbeltSkill ?? Boolean(skill?.toolbeltParentName);
}

function isHealingSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.type === 'Heal' || skill?.slot === 'Heal';
}

function isElixirSkill(skill: EngineerSkill | undefined): boolean {
  return Boolean(skill?.categories?.some((category) => String(category).toLowerCase() === 'elixir'));
}

/** Applies HGH cast boons and Acid Bomb's extended final pulse to eligible elixirs. */
function applyHgh(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  if (
    !hasTrait(context.config, TRAIT.HGH) ||
    !isElixirSkill(skill) ||
    context.effectiveEnd < context.fullEnd - context.epsilon
  )
    return;

  // HGH grants fixed-duration boons and extends Acid Bomb far enough for one additional pulse.
  emitSkillBuff(context, skill, {
    at,
    source: 'Trait',
    sourceId: TRAIT.HGH,
    actorType: 'player',
    name: 'HGH — might',
    kind: 'might',
    duration: 12,
    stacks: 2
  });
  emitSkillBuff(context, skill, {
    at,
    source: 'Trait',
    sourceId: TRAIT.HGH,
    actorType: 'player',
    name: 'HGH — fury',
    kind: 'fury',
    duration: 4,
    stacks: 1
  });
  if (skill.id === ID.ACID_BOMB) {
    emitSkillDamage(context, skill, {
      at: context.fullEnd + 6,
      activationId: context.action.activationId,
      coefficient: 0.85,
      hits: 1,
      name: 'Acid Bomb',
      actorType: 'player'
    });
  }
}

/** Extends scheduled elixir fields, boons, and conditions while HGH is selected. */
export function observeEngineerHghEvent(context: EngineerSchedulerContext, event: SimulationEvent): void {
  if (!hasTrait(context.config, TRAIT.HGH) || event.sourceId === TRAIT.HGH) return;
  const skill = context.catalog.skillsById.get(event.skillId ?? event.sourceId) as EngineerSkill | undefined;
  if (!isElixirSkill(skill)) return;

  if (event.type === 'combo_field') {
    const duration = Number(event.expiresAt) - event.at;
    if (duration > 0) context.replaceEvent(event, { expiresAt: event.at + duration * 1.2 });
  } else if ((event.type === 'buff' || event.type === 'condition') && Number(event.duration) > 0) {
    context.replaceEvent(event, { duration: Number(event.duration) * 1.2 });
  }
}

/** Schedules Grenadier's lesser barrage from eligible healing casts after its internal cooldown. */
function applyGrenadier(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context.config, TRAIT.GRENADIER) ||
    !isInternalCooldownReady(at, Number(state.traitProcReadyAt.grenadier || 0))
  )
    return;
  state.traitProcReadyAt.grenadier = at + engineerBalanceValue(context, PROFILE.grenadier, 'internalCooldown', 20);
  const hits = engineerBalanceEffectValue(context, PROFILE.grenadier, 'strike', 'hits', 6);
  const coefficient = engineerBalanceEffectValue(context, PROFILE.grenadier, 'strike', 'coefficient', 0.5);
  // Emit distinct packets so per-hit reactions and attribution retain the barrage sequence.
  for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
    emitSkillDamage(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.GRENADIER,
      actorType: 'effect',
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

/** Applies Streamlined Kits on kit entry and adds Grenade Kit's mine strike when appropriate. */
function applyStreamlinedKits(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  const state = professionCoreState(context);
  if (
    skill.handlerId !== 'engineer.kit-equip' ||
    !hasTrait(context.config, TRAIT.STREAMLINED_KITS) ||
    !isInternalCooldownReady(at, Number(state.traitProcReadyAt.streamlinedKits || 0))
  )
    return;
  state.traitProcReadyAt.streamlinedKits =
    at + engineerBalanceValue(context, PROFILE.streamlinedKits, 'internalCooldown', 20);
  // Every eligible kit entry grants the shared swiftness effect.
  emitSkillBuff(context, skill, {
    at,
    source: 'Trait',
    sourceId: TRAIT.STREAMLINED_KITS,
    actorType: 'player',
    name: 'Streamlined Kits — swiftness',
    kind: 'swiftness',
    duration: engineerBalanceEffectValue(context, PROFILE.streamlinedKits, 'boon', 'duration', 20),
    stacks: 1
  });
  // Grenade Kit additionally drops the trait's mine strike on entry.
  if ((skill.kitName || skill.name) === 'Grenade Kit') {
    emitSkillDamage(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.STREAMLINED_KITS,
      actorType: 'effect',
      skillId: skill.id,
      skillName: 'Drop Mine',
      parentSkillName: skill.name,
      name: 'Drop Mine',
      coefficient: engineerBalanceEffectValue(context, PROFILE.streamlinedKits, 'strike', 'coefficient', 1.75),
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: 'Unequipped',
      explosion: true,
      triggeredBy: skill.name
    });
  }
}

/** Applies all Core traits triggered by a completed toolbelt cast. */
export function applyEngineerToolbeltTraits(context: EngineerSchedulerContext, skill: EngineerSkill, at: number): void {
  if (!isEngineerToolbeltSkill(skill)) return;
  const state = professionCoreState(context);

  if (hasTrait(context.config, TRAIT.OPTIMIZED_ACTIVATION)) {
    emitSkillBuff(context, skill, {
      at,
      source: 'Trait',
      sourceId: TRAIT.OPTIMIZED_ACTIVATION,
      actorType: 'player',
      name: 'Optimized Activation — vigor',
      kind: 'vigor',
      duration: engineerBalanceEffectValue(context, PROFILE.optimizedActivation, 'boon', 'duration', 4),
      stacks: 1
    });
  }

  if (hasTrait(context.config, TRAIT.STATIC_DISCHARGE)) {
    emitSkillDamage(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.STATIC_DISCHARGE,
      actorType: 'effect',
      skillId: ID.STATIC_DISCHARGE_TRAIT_SKILL,
      skillName: 'Static Discharge',
      parentSkillName: skill.name,
      icon: context.catalog.skillsById.get(ID.STATIC_DISCHARGE_TRAIT_SKILL)?.icon || '',
      name: 'Static Discharge',
      coefficient: engineerBalanceEffectValue(context, PROFILE.staticDischarge, 'strike', 'coefficient', 0.33),
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      // Static Discharge's actual strike uses the unequipped 690.5 weapon-strength profile, not its tooltip weapon.
      skillWeapon: 'Unequipped',
      staticDischarge: true,
      triggeredBy: skill.name
    });
  }

  if (hasTrait(context.config, TRAIT.KINETIC_BATTERY)) {
    const maximumCharges = engineerBalanceValue(context, PROFILE.kineticBattery, 'maximumStacks', 5);
    state.kineticCharges = Math.min(maximumCharges, Number(state.kineticCharges || 0) + 1);
    // proc quickness and reset charges every 5th toolbelt cast
    if (state.kineticCharges >= maximumCharges) {
      state.kineticCharges = 0;
      const buffDuration = engineerBalanceEffectValue(context, PROFILE.kineticBattery, 'buff', 'duration', 5);
      emitSkillBuff(context, skill, {
        at,
        source: 'Trait',
        sourceId: TRAIT.KINETIC_BATTERY,
        actorType: 'player',
        name: 'Kinetic Battery',
        kind: 'kinetic-battery',
        duration: buffDuration,
        stacks: 1
      });
      emitSkillBuff(context, skill, {
        at,
        source: 'Trait',
        sourceId: TRAIT.KINETIC_BATTERY,
        actorType: 'player',
        name: 'Kinetic Battery — quickness',
        kind: 'quickness',
        duration: engineerBalanceEffectValue(context, PROFILE.kineticBattery, 'boon', 'duration', 5),
        stacks: 1
      });
    }

    emitStateSnapshot(context, 'engineer', at, 'kinetic-battery', snapshotEngineerState(context.state.profession));
  }
}

/** Dispatches Core Engineer cast-completion traits for the finished skill. */
export function applyEngineerCastTraits(context: EngineerCastContext, skill: EngineerSkill): void {
  const at = context.effectiveEnd;
  if (isHealingSkill(skill)) applyGrenadier(context, skill, at);
  applyStreamlinedKits(context, skill, at);
  applyEngineerToolbeltTraits(context, skill, at);
  applyHgh(context, skill, at);
}

// checks both the event flag and skill category — some skills lack the explosion category in the API
function isExplosion(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.explosion || event.damageKind === 'explosion') return true;
  const skill = resolverSkill(context, event.skillId ?? event.sourceId);
  return Boolean(
    skill?.categories?.some((category) => String(category).toLowerCase() === 'explosion') ||
    skill?.kit === 'Grenade Kit' ||
    skill?.name === 'Devastator'
  );
}

// mech attacks (summon actorType) don't trigger Aim-Assisted Rocket
function isAimAssistedProjectile(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.actorType !== 'player') return false;
  if (event.projectile === true) return true;
  const skill = resolverSkill(context, event.skillId);
  return Boolean(
    skill?.kit === 'Grenade Kit' ||
    skill?.categories?.some((category) => String(category).toLowerCase() === 'projectile')
  );
}

function usesRandomTraitProcs(context: EngineerResolverContext): boolean {
  return context.random?.stochastic === true;
}

/** Rearms Explosive Entrance after a resolved Engineer dodge. */
export function handleEngineerDodge(context: EngineerResolverContext): void {
  procState(context).explosiveEntranceFired = false;
}

type EngineerCriticalHitDefinition = ResolvedCriticalHitOptions<
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails
>;

// Critical-hit declarations keep Engineer eligibility, state keys, and effects
// local while delegating shared crit sampling, progress, and ICD behavior.
export const engineerCoreCriticalHitDefinitions = Object.freeze([
  {
    id: 'engineer.core.serrated-steel',
    actorTypes: ['player', 'effect', 'unknown'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.SERRATED_STEEL),
    chanceOnCriticalHit: (context) => engineerBalanceValue(context, PROFILE.serratedSteel, 'procChance', 0.33),
    expectedProgress: {
      get: (context) => Number(procState(context).serratedSteelProgress || 0),
      set: (context, progress) => {
        procState(context).serratedSteelProgress = progress;
      }
    },
    randomStream: 'engineer.serrated-steel',
    attribution: { kind: 'trait', id: TRAIT.SERRATED_STEEL },
    handler(context, event, _details, application) {
      applyEngineerDerivedCondition(context, event, {
        name: 'Serrated Steel',
        condition: 'Bleeding',
        stacks:
          engineerBalanceEffectValue(context, PROFILE.serratedSteel, 'condition', 'stacks', 1) * application.quantity,
        duration: engineerBalanceEffectValue(context, PROFILE.serratedSteel, 'condition', 'duration', 3),
        sourceId: TRAIT.SERRATED_STEEL,
        actorType: 'effect'
      });
      recordTrait(context, 'Serrated Steel', event);
    }
  },
  {
    id: 'engineer.core.no-scope',
    actorTypes: ['player'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.NO_SCOPE),
    expectedProgress: {
      get: (context) => Number(procState(context).noScopeProgress || 0),
      set: (context, progress) => {
        procState(context).noScopeProgress = progress;
      }
    },
    internalCooldown: {
      duration: (context) => engineerBalanceValue(context, PROFILE.noScope, 'internalCooldown', 8),
      readyAt: (context) => Number(procState(context).noScope || 0),
      setReadyAt: (context, readyAt) => {
        procState(context).noScope = readyAt;
      }
    },
    attribution: { kind: 'trait', id: TRAIT.NO_SCOPE },
    handler(context, event) {
      queueBuff(context, event, {
        name: 'No Scope',
        kind: 'fury',
        stacks: 1,
        duration: engineerBalanceEffectValue(context, PROFILE.noScope, 'boon', 'duration', 4),
        sourceId: TRAIT.NO_SCOPE,
        actorType: 'effect'
      });
      recordTrait(context, 'No Scope', event);
    }
  },
  {
    id: 'engineer.core.incendiary-powder-player',
    actorTypes: ['player'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.INCENDIARY_POWDER),
    expectedProgress: {
      get: (context) => Number(procState(context)['incendiaryProgress.player'] || 0),
      set: (context, progress) => {
        procState(context)['incendiaryProgress.player'] = progress;
      }
    },
    internalCooldown: {
      duration: (context) => engineerBalanceValue(context, PROFILE.incendiaryPowder, 'internalCooldown', 10),
      readyAt: (context) => Number(procState(context)['incendiaryPowder.player'] || 0),
      setReadyAt: (context, readyAt) => {
        procState(context)['incendiaryPowder.player'] = readyAt;
      }
    },
    // Preserve the existing deterministic behavior, which banks expected crits
    // during Incendiary Powder's cooldown for the next eligible hit.
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.INCENDIARY_POWDER },
    handler(context, event) {
      applyEngineerDerivedCondition(context, event, {
        name: 'Incendiary Powder',
        condition: 'Burning',
        stacks: engineerBalanceEffectValue(context, PROFILE.incendiaryPowder, 'condition', 'stacks', 1),
        duration: engineerBalanceEffectValue(context, PROFILE.incendiaryPowder, 'condition', 'duration', 8),
        sourceId: TRAIT.INCENDIARY_POWDER,
        actorType: 'effect'
      });
      recordTrait(context, 'Incendiary Powder', event);
    }
  }
] satisfies readonly EngineerCriticalHitDefinition[]);

/** Applies Core Engineer damage-triggered traits to one resolved strike packet. */
export function reactToEngineerDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  _details: EngineerResolverReactionDetails = {}
): void {
  if (!(Number(event.coefficient) > 0)) return;
  if (event.staticDischarge === true) {
    // Scheduled trait damage is not a rotation step, so expose each discharge with its tool-belt trigger in Procs.
    context.recordProc?.(
      'trait',
      'Static Discharge',
      event.at,
      event.parentSkillName || event.triggeredBy || event.skillName,
      '',
      resolverSkill(context, ID.STATIC_DISCHARGE_TRAIT_SKILL)?.icon || ''
    );
  }

  const state = procState(context);
  if (event.actorType === 'player' && hasTrait(context, TRAIT.EXPLOSIVE_ENTRANCE) && !state.explosiveEntranceFired) {
    // fires once per attack sequence; dodge resets the flag for the next sequence
    state.explosiveEntranceFired = true;
    queueDamage(context, event, {
      name: 'Explosive Entrance',
      coefficient: engineerBalanceEffectValue(context, PROFILE.explosiveEntrance, 'strike', 'coefficient', 1.25),
      sourceId: TRAIT.EXPLOSIVE_ENTRANCE,
      actorType: 'effect',
      explosion: true
    });
    recordTrait(context, 'Explosive Entrance', event);
  }

  // Explosion-triggered traits share the same permissive event classification.
  const explosion = isExplosion(context, event);
  if (explosion && hasTrait(context, TRAIT.STEEL_PACKED_POWDER)) {
    applyEngineerDerivedCondition(context, event, {
      name: 'Steel-Packed Powder',
      condition: 'Vulnerability',
      stacks: engineerBalanceEffectValue(context, PROFILE.steelPackedPowder, 'condition', 'stacks', 1),
      duration: engineerBalanceEffectValue(context, PROFILE.steelPackedPowder, 'condition', 'duration', 5),
      sourceId: TRAIT.STEEL_PACKED_POWDER,
      actorType: 'effect'
    });
  }

  if (
    explosion &&
    hasTrait(context, TRAIT.SHORT_FUSE) &&
    isInternalCooldownReady(event.at, Number(state.shortFuse || 0))
  ) {
    state.shortFuse = event.at + engineerBalanceValue(context, PROFILE.shortFuse, 'internalCooldown', 3);
    queueBuff(context, event, {
      name: 'Short Fuse',
      kind: 'fury',
      stacks: 1,
      duration: engineerBalanceEffectValue(context, PROFILE.shortFuse, 'boon', 'duration', 4),
      sourceId: TRAIT.SHORT_FUSE,
      actorType: 'effect'
    });
    recordTrait(context, 'Short Fuse', event);
  }

  if (explosion && hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    queueBuff(context, event, {
      name: 'Explosive Temper',
      kind: 'explosive-temper',
      stacks: 1,
      duration: engineerBalanceEffectValue(context, PROFILE.explosiveTemper, 'buff', 'duration', 10),
      sourceId: TRAIT.EXPLOSIVE_TEMPER,
      actorType: 'effect'
    });
    recordTrait(context, 'Explosive Temper', event);
  }

  if (event.name === 'Explosive Entrance' && hasTrait(context, TRAIT.GRAND_ENTRANCE)) {
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

  if (explosion && event.name !== 'Aim-Assisted Rocket' && hasTrait(context, TRAIT.SHRAPNEL)) {
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered = context.random.roll(
        engineerBalanceValue(context, PROFILE.shrapnel, 'procChance', 0.33),
        'engineer.shrapnel'
      );
    } else {
      // deterministic: accumulate 0.33 per explosion; trigger and subtract 1 when threshold reached
      state.shrapnelProgress =
        Number(state.shrapnelProgress || 0) + engineerBalanceValue(context, PROFILE.shrapnel, 'procChance', 0.33);
      triggered = state.shrapnelProgress >= 1;
    }

    if (triggered) {
      if (!usesRandomTraitProcs(context)) {
        state.shrapnelProgress = Number(state.shrapnelProgress || 0) - 1;
      }

      applyEngineerDerivedCondition(context, event, {
        name: 'Shrapnel',
        condition: 'Bleeding',
        stacks: engineerBalanceEffectValue(context, PROFILE.shrapnel, 'condition', 'stacks', 1),
        duration: engineerBalanceEffectValue(context, PROFILE.shrapnel, 'condition', 'duration', 6),
        sourceId: TRAIT.SHRAPNEL,
        actorType: 'effect'
      });
      queueBuff(context, event, {
        name: 'Shrapnel',
        kind: 'target-crippled',
        stacks: engineerBalanceEffectValue(context, PROFILE.shrapnel, 'condition', 'stacks', 1, 1),
        duration: engineerBalanceEffectValue(context, PROFILE.shrapnel, 'condition', 'duration', 1, 1),
        sourceId: TRAIT.SHRAPNEL,
        actorType: 'effect'
      });
      recordTrait(context, 'Shrapnel', event);
    }
  }

  // Projectile-triggered rockets use their own cooldown and upgrade every fifth eligible proc.
  if (
    hasTrait(context, TRAIT.AIM_ASSISTED_ROCKET) &&
    isAimAssistedProjectile(context, event) &&
    isInternalCooldownReady(event.at, Number(state.aimAssistedRocket || 0))
  ) {
    state.aimAssistedRocket =
      event.at + engineerBalanceValue(context, PROFILE.aimAssistedRocket, 'internalCooldown', 3);
    state.aimAssistedRocketCount = Number(state.aimAssistedRocketCount || 0) + 1;
    // every 5th projectile upgrades to Orbital Command Strike (2s delay for call-down)
    const alternateEvery = engineerBalanceValue(context, PROFILE.aimAssistedRocket, 'maximumStacks', 5);
    const orbital = state.aimAssistedRocketCount % alternateEvery === 0;
    queueDamage(context, event, {
      name: orbital ? 'Orbital Command Strike' : 'Aim-Assisted Rocket',
      coefficient: engineerBalanceEffectValue(
        context,
        PROFILE.aimAssistedRocket,
        'strike',
        'coefficient',
        orbital ? 1.92 : 1,
        orbital ? 1 : 0
      ),
      sourceId: orbital ? ID.ORBITAL_COMMAND_STRIKE : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL,
      actorType: 'effect',
      at:
        event.at +
        engineerBalanceEffectValue(
          context,
          PROFILE.aimAssistedRocket,
          'strike',
          'atMs',
          orbital ? 2000 : 40,
          orbital ? 1 : 0
        ) /
          1000,
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

/** Applies Core Engineer traits triggered by one resolved condition application. */
export function reactToEngineerCondition(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition === 'Burning' && event.actorType !== 'summon' && hasTrait(context, TRAIT.THERMAL_VISION)) {
    const state = professionCoreState(context);
    // Math.max extends the window — multiple Burning applications stack the active duration
    state.traitProcReadyAt.thermalVisionUntil = Math.max(
      Number(state.traitProcReadyAt.thermalVisionUntil || 0),
      event.at + engineerBalanceEffectValue(context, PROFILE.thermalVision, 'buff', 'duration', 4)
    );
  }

  if (event.condition === 'Bleeding' && event.actorType !== 'summon' && hasTrait(context, TRAIT.SANGUINE_ARRAY)) {
    queueBuff(context, event, {
      name: 'Sanguine Array',
      kind: 'might',
      stacks: Math.max(1, Number(event.stacks || 1)),
      duration: engineerBalanceEffectValue(context, PROFILE.sanguineArray, 'boon', 'duration', 4),
      sourceId: TRAIT.SANGUINE_ARRAY,
      actorType: 'effect'
    });
    recordTrait(context, 'Sanguine Array', event);
  }

  if (event.condition === 'Bleeding' && event.actorType !== 'summon' && hasTrait(context, TRAIT.HEMATIC_FOCUS)) {
    const state = procState(context);
    if (isInternalCooldownReady(event.at, Number(state.hematicFocus || 0))) {
      state.hematicFocus = event.at + engineerBalanceValue(context, PROFILE.hematicFocus, 'internalCooldown', 8);
      queueBuff(context, event, {
        name: 'Hematic Focus',
        kind: 'fury',
        stacks: 1,
        duration: engineerBalanceEffectValue(context, PROFILE.hematicFocus, 'boon', 'duration', 8),
        sourceId: TRAIT.HEMATIC_FOCUS,
        actorType: 'effect'
      });
      recordTrait(context, 'Hematic Focus', event);
    }
  }
}
