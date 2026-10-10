import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { advanceCyclicCounter } from '#gw2/platform/combat/resources/counters.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { playerHealthFraction, targetHealthFraction } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { airBlastImpacted, type AirBlastImpact } from '#gw2/professions/engineer/core/skills/kits/flamethrower.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  procChanceFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { activeBuffStacks, skillForEvent, vulnerabilityStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isExplosion, resolverSkill } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import {
  type EngineerResolverContext,
  type EngineerResolverEvent,
  type EngineerRuntime,
  type EngineerRuntimeState,
  type EngineerSkill
} from '#gw2/professions/engineer/types.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
/** Grenadier owns its heal trigger and explosion modifier; the barrage owns its skill balance. */
export const grenadier = defineTrait({
  id: TRAIT.GRENADIER,
  name: 'Grenadier',
  // The trait balance owns tuning consumed by damage rules and presentation.
  balance: { damageMultiplier: 1 },
  // Completed heals request the skill-owned barrage, which shares its recharge with direct casts. The barrage follows
  // Core elixir rewards and precedes the remaining imperative commit hooks.
  triggers: [
    {
      on: 'castCommit',
      order: 1,
      when: (_runtime, cast) => cast.skill.type === 'Heal' || cast.skill.slot === 'Heal',
      invoke: ID.LESSER_GRENADE_BARRAGE,
      cooldown: 'skill'
    }
  ],
  modifierRules: [
    {
      id: 'engineer.grenadier-explosion-damage',
      order: -17,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // Live remains neutral; preview tuning increases only player-owned explosion strikes with Grenadier selected.
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GRENADIER), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        isExplosion(
          context.event,
          skillForEvent(context.profession?.catalog, context.event, context.event?.sourceId ?? context.skillId)
        )
    }
  ]
});

/** Arms the next player strike after a dodge; the triggered skill owns its damage and recharge. */
export const explosiveEntrance = defineTrait({
  id: TRAIT.EXPLOSIVE_ENTRANCE,
  name: 'Explosive Entrance',
  triggers: [
    {
      on: 'damage.resolved',
      when: strikesWhileArmed,
      run: fireExplosiveEntrance
    }
  ],
  // The queued dodge event rearms after the dodge's immediate rewards; rearming outlives selection checks.
  lifetime: { eventHandlers: { 'engineer.dodge': resetExplosiveEntrance } }
});

/** Owns Steel-Packed Powder tuning and behavior at its established runtime and build boundaries. */
export const steelPackedPowder = defineTrait({
  triggers: [{ on: 'damage.resolved', run: applySteelPackedPowder }],
  id: TRAIT.STEEL_PACKED_POWDER,
  name: 'Steel-Packed Powder',
  balance: {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5 }]
  }
});

/** Owns Short Fuse tuning and behavior at its established runtime and build boundaries. */
export const shortFuse = defineTrait({
  triggers: [{ on: 'damage.resolved', run: applyShortFuse }],
  id: TRAIT.SHORT_FUSE,
  name: 'Short Fuse',
  balance: {
    internalCooldown: 3,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  }
});

/** Owns Explosive Temper tuning and behavior at its established runtime and build boundaries. */
export const explosiveTemper = defineTrait({
  triggers: [{ on: 'damage.resolved', run: applyExplosiveTemper }],
  id: TRAIT.EXPLOSIVE_TEMPER,
  name: 'Explosive Temper',
  balance: {
    maximumStacks: 10,
    attributePerStack: 20,
    effects: [{ name: 'explosive-temper', type: 'buff', kind: 'explosive-temper', stacks: 1, duration: 10 }]
  }
});

/** Owns Shrapnel tuning and behavior at its established runtime and build boundaries. */
export const shrapnel = defineTrait({
  triggers: [{ on: 'damage.resolved', run: applyShrapnel }],
  id: TRAIT.SHRAPNEL,
  name: 'Shrapnel',
  balance: {
    procRate: {
      id: 'engineer.shrapnel',
      traitId: TRAIT.SHRAPNEL,
      field: 'procChance',
      opportunity: 'eligible explosion hit'
    },
    procChance: 0.33,
    effects: [
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6 },
      { name: 'Crippled', type: 'condition', condition: 'Crippled', stacks: 1, duration: 1 }
    ]
  }
});

/** Owns Aim-Assisted Rocket tuning and behavior at its established runtime and build boundaries. */
export const aimAssistedRocket = defineTrait({
  // Damage reactions require a strike; Air Blast separately supplies its accepted projectile opportunity. Accepted
  // projectile procs consume recharge and advance the cycle even if their payload is removed.
  triggers: [
    {
      on: 'damage.resolved',
      when: (runtime, event) => Number(event.coefficient) > 0 && isAimAssistedProjectile(runtime, event),
      cooldown: 'profile',
      run: fireAimAssistedRocket
    },
    onTriggerPoint(airBlastImpacted, {
      when: (runtime, { cause }: AirBlastImpact) => isAimAssistedProjectile(runtime, cause),
      cooldown: 'profile',
      run: (runtime, { cause }: AirBlastImpact) => fireAimAssistedRocket(runtime, cause)
    })
  ],
  id: TRAIT.AIM_ASSISTED_ROCKET,
  name: 'Aim-Assisted Rocket',
  balance: {
    internalCooldown: 3,
    maximumStacks: 5
  }
});

/** Owns Grand Entrance tuning and behavior at its established runtime and build boundaries. */
export const grandEntrance = defineTrait({
  triggers: [{ on: 'damage.resolved', run: applyGrandEntrance }],
  id: TRAIT.GRAND_ENTRANCE,
  name: 'Grand Entrance',
  balance: {
    criticalChance: 0.1,
    // Each ordinary window is independently editable and removable through its profile.
    effects: [
      { type: 'boon', name: 'Resistance', boon: 'resistance', stacks: 1, duration: 3 },
      { type: 'buff', name: 'Grand Entrance', kind: 'grand-entrance', stacks: 1, duration: 3 }
    ]
  },
  modifierRules: [
    {
      order: -12,
      id: 'engineer.grand-entrance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GRAND_ENTRANCE), 'criticalChance'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && activeBuffStacks(context, 'grand-entrance', 1) > 0
    }
  ]
});

/** Owns Blast Shield tuning and behavior at its established runtime and build boundaries. */
export const blastShield = defineTrait({
  id: TRAIT.BLAST_SHIELD,
  name: 'Blast Shield',
  balance: { attributeConversion: 0.1 },
  buildAttributes: traitAttributeEffects(TRAIT.BLAST_SHIELD, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Vitality',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Glass Cannon tuning and behavior at its established runtime and build boundaries. */
export const glassCannon = defineTrait({
  id: TRAIT.GLASS_CANNON,
  name: 'Glass Cannon',
  // The trait balance owns tuning consumed by damage rules and presentation.
  balance: { damageMultiplier: 1.07, threshold: 0.75 },
  modifierRules: [
    {
      order: -20,
      id: 'engineer.glass-cannon',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GLASS_CANNON), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        playerHealthFraction(context) >
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GLASS_CANNON), 'threshold')
    }
  ]
});

/** Owns Big Boomer tuning and behavior at its established runtime and build boundaries. */
export const bigBoomer = defineTrait({
  id: TRAIT.BIG_BOOMER,
  name: 'Big Boomer',
  // The trait balance owns tuning consumed by damage rules and presentation.
  balance: { damageMultiplier: 1.15 },
  modifierRules: [
    {
      order: -19,
      id: 'engineer.big-boomer',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BIG_BOOMER), 'damageMultiplier'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && playerHealthFraction(context) > targetHealthFraction(context)
    }
  ]
});

/** Owns Shaped Charge tuning and behavior at its established runtime and build boundaries. */
export const shapedCharge = defineTrait({
  id: TRAIT.SHAPED_CHARGE,
  name: 'Shaped Charge',
  // The trait balance owns tuning consumed by damage rules and presentation.
  balance: { maximumStacks: 25, damageIncreasePerStack: 0.005 },
  modifierRules: [
    {
      order: -18,
      // caps at 25 stacks to match the in-game vulnerability stack cap
      id: 'engineer.shaped-charge',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',

      factor: (context) =>
        1 +
        Math.min(
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SHAPED_CHARGE), 'maximumStacks'),
          vulnerabilityStacks(context)
        ) *
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, TRAIT.SHAPED_CHARGE),
            'damageIncreasePerStack'
          ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Applies Steel-Packed Powder to a hit already classified as an explosion. */
function applySteelPackedPowder(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only positive strike packets create explosion proc opportunities.
  const explosion =
    Number(event.coefficient) > 0 && isExplosion(event, resolverSkill(context, event.skillId ?? event.sourceId));
  if (!explosion) return;
  const steelPackedPowderProfile = requireBalanceProfileFromContext(context, TRAIT.STEEL_PACKED_POWDER);
  const steelPackedPowderVulnerability = requireEffect(steelPackedPowderProfile, 'condition', 'Vulnerability');
  if (steelPackedPowderVulnerability) {
    emitTraitProfile(context, TRAIT.STEEL_PACKED_POWDER, TRAIT.STEEL_PACKED_POWDER, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Vulnerability' },
      settlement: 'reaction',
      attribution: {
        sourceId: TRAIT.STEEL_PACKED_POWDER,
        actorType: 'effect',
        skillName: 'Steel-Packed Powder',
        source: 'Trait',
        triggeredBy: event.skillName,
        offTarget: event.offTarget,
        metadata: {}
      },
      transform: (packet) => ({ ...packet, name: 'Steel-Packed Powder' + ' — ' + packet.condition })
    });
  }
}

/** Grants Short Fuse fury from an explosion when its internal cooldown is ready. */
function applyShortFuse(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only positive strike packets create explosion proc opportunities.
  const explosion =
    Number(event.coefficient) > 0 && isExplosion(event, resolverSkill(context, event.skillId ?? event.sourceId));
  // Eligible explosions consume the interval even when the Fury packet is removed.
  if (!explosion || !context.procs.claim(TRAIT.SHORT_FUSE, 'shortFuse', event.at)) return;

  const shortFuseProfile = requireBalanceProfileFromContext(context, TRAIT.SHORT_FUSE);
  const shortFuseFury = requireEffect(shortFuseProfile, 'boon', 'fury');
  if (shortFuseFury) {
    emitTraitProfile(context, TRAIT.SHORT_FUSE, TRAIT.SHORT_FUSE, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'boon', name: 'fury' },
      durationContext: event,
      attribution: {
        name: 'Short Fuse',
        sourceId: TRAIT.SHORT_FUSE,
        actorType: 'effect',
        skillName: 'Short Fuse',
        source: 'Trait',
        triggeredBy: event.skillName
      }
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
function applyExplosiveTemper(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only positive strike packets create explosion proc opportunities.
  const explosion =
    Number(event.coefficient) > 0 && isExplosion(event, resolverSkill(context, event.skillId ?? event.sourceId));
  if (!explosion) return;
  const explosiveTemperProfile = requireBalanceProfileFromContext(context, TRAIT.EXPLOSIVE_TEMPER);
  const explosiveTemperBuff = requireEffect(explosiveTemperProfile, 'buff', 'explosive-temper');
  if (explosiveTemperBuff) {
    emitTraitProfile(context, TRAIT.EXPLOSIVE_TEMPER, TRAIT.EXPLOSIVE_TEMPER, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'buff', name: 'explosive-temper' },
      durationContext: event,
      attribution: {
        name: 'Explosive Temper',
        sourceId: TRAIT.EXPLOSIVE_TEMPER,
        actorType: 'effect',
        skillName: 'Explosive Temper',
        source: 'Trait',
        triggeredBy: event.skillName
      }
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
function applyGrandEntrance(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only the accepted trait strike grants the surviving profiled windows.
  if (!(Number(event.coefficient) > 0) || event.skillId !== ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL) return;
  const emitted = emitTraitProfile(context, TRAIT.GRAND_ENTRANCE, TRAIT.GRAND_ENTRANCE, undefined, {
    at: event.at,
    durationContext: event,
    receipt: true,
    attribution: (effect) => ({
      source: 'Trait',
      actorType: 'effect',
      skillName: effect.type === 'boon' ? 'Grand Entrance — resistance' : 'Grand Entrance',
      triggeredBy: event.skillName
    }),
    transform: (packet) => ({ ...packet, name: packet.skillName })
  });
  if (emitted.length)
    context.effects.emit({
      kind: 'announcement',
      attribution: { source: 'Trait', sourceId: TRAIT.GRAND_ENTRANCE, actorType: 'effect' },
      cause: event,
      announcement: { type: 'trait', name: 'Grand Entrance', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
}

/** Rolls Shrapnel against the simulation seed in both modes for each eligible explosion. */
function applyShrapnel(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only positive strike packets create explosion proc opportunities.
  const explosion =
    Number(event.coefficient) > 0 && isExplosion(event, resolverSkill(context, event.skillId ?? event.sourceId));
  // Generated rocket explosions also roll Shrapnel; effect ownership must not discard their opportunity.
  if (!explosion) return;
  const chance = procChanceFromContext(context, TRAIT.SHRAPNEL);
  if (!context.random.roll(chance, 'engineer.shrapnel')) return;

  const shrapnelProfile = requireBalanceProfileFromContext(context, TRAIT.SHRAPNEL);
  const shrapnelBleeding = requireEffect(shrapnelProfile, 'condition', 'Bleeding');
  if (shrapnelBleeding) {
    emitTraitProfile(context, TRAIT.SHRAPNEL, TRAIT.SHRAPNEL, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Bleeding' },
      settlement: 'reaction',
      attribution: {
        sourceId: TRAIT.SHRAPNEL,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Shrapnel',
        source: 'Trait',
        triggeredBy: event.skillName,
        offTarget: event.offTarget,
        metadata: { procCount: 1 }
      },
      transform: (packet) => ({ ...packet, name: 'Shrapnel' + ' — ' + packet.condition })
    });
  }

  const shrapnelCrippled = requireEffect(shrapnelProfile, 'condition', 'Crippled');
  if (shrapnelCrippled) {
    // Resolve Crippled as a target condition so duration bonuses and condition queries include it.
    emitTraitProfile(context, TRAIT.SHRAPNEL, TRAIT.SHRAPNEL, undefined, {
      at: event.at,
      fullEnd: event.at,
      effect: { type: 'condition', name: 'Crippled' },
      settlement: 'reaction',
      attribution: {
        sourceId: TRAIT.SHRAPNEL,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: 'Shrapnel',
        source: 'Trait',
        triggeredBy: event.skillName,
        offTarget: event.offTarget,
        metadata: {}
      },
      transform: (packet) => ({ ...packet, name: 'Shrapnel' + ' — ' + packet.condition })
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

/** Non-strike notifications and other actors must not consume the dodge-armed opportunity. */
function strikesWhileArmed(
  runtime: MechanicQueryContext<EngineerRuntimeState, EngineerSkill>,
  event: EngineerResolverEvent
): boolean {
  return (
    Number(event.coefficient) > 0 && event.actorType === 'player' && !runtime.profession.core.explosiveEntranceFired
  );
}

/** Rearms Explosive Entrance after a resolved Engineer dodge. */
function resetExplosiveEntrance(context: EngineerResolverContext): void {
  professionCoreState(context).explosiveEntranceFired = false;
}

/**
 * Fires the dodge-armed attack on the next eligible player strike. The skill keeps an exclusive recharge deadline; a hit
 * during recharge, or a patch that removed the payload, leaves the attack armed. Consumption commits before emission.
 */
function fireExplosiveEntrance(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const skill = context.helpers.skillsById.get(ID.EXPLOSIVE_ENTRANCE_TRAIT_SKILL)!;
  if (!skill.effects?.length || !isInternalCooldownReady(event.at, context.cooldownController.readyAt(skill.id)))
    return;
  // Dodge rearming never resets the skill's recharge.
  context.cooldownController.startRecharge(skill, event.at);
  professionCoreState(context).explosiveEntranceFired = true;
  invokeTraitSkill(context, TRAIT.EXPLOSIVE_ENTRANCE, skill.id, event, { announce: true });
}

// Only player packets with authored projectile identity can trigger Aim-Assisted Rocket.
function isAimAssistedProjectile(
  context: Pick<EngineerResolverContext, 'helpers'>,
  event: EngineerResolverEvent
): boolean {
  if (event.actorType !== 'player') return false;
  if (event.projectile === true) return true;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  return Boolean(skill?.categories?.some((category) => category.toLowerCase() === 'projectile'));
}

/** Every fifth accepted rocket becomes an Orbital Command Strike; the counter advances only on accepted procs. */
function fireAimAssistedRocket(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.AIM_ASSISTED_ROCKET);
  const core = professionCoreState(context);
  // Preserve the cumulative total used to select each orbital strike.
  const progress = advanceCyclicCounter(core.aimAssistedRocketCount, 1, balanceProfileNumber(profile, 'maximumStacks'));
  core.aimAssistedRocketCount = progress.value;
  const variant = progress.reached ? ID.ORBITAL_COMMAND_STRIKE : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL;
  invokeTraitSkill(context, TRAIT.AIM_ASSISTED_ROCKET, variant, event, { announce: true });
}
