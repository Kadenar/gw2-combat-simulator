/**
 * Strikes, effect applications, condition damage, and health.
 *
 * Ports `dispatch_strikes_and_effects.cpp`, `apply_strikes_and_effects.cpp`,
 * `effects.cpp`, `hooks.cpp` (on-strike), and `actor.cpp`. Outgoing work is
 * dispatched to targets on other teams (or the caster's team for TEAM
 * applications), then applied with the source's relative attributes. Condition
 * damage accrues from each stack's elapsed lifetime whenever the condition
 * clock ticks or a stack expires, and health changes are committed once per tick.
 */
import { roundDown, roundHalfEven, truncateToInt } from '#gw2/platform/combat-engine/numeric.js';
import { conditionDamagePerSecond, effectiveEffectDuration } from '#gw2/platform/combat-engine/effect-rules.js';
import { addEffectStacks, addUniqueEffectStacks, applySideEffects } from '#gw2/platform/combat-engine/mutations.js';
import {
  independentConditionsSatisfied,
  onEffectApplicationConditionsSatisfied,
  onStrikeConditionsSatisfied
} from '#gw2/platform/combat-engine/queries.js';
import { markAttributesDirty, ownerOf, view } from '#gw2/platform/combat-engine/registry.js';
import { calculateRelativeAttributes, relativeAttribute } from '#gw2/platform/combat-engine/systems/attributes.js';
import { pendingApplications } from '#gw2/platform/combat-engine/systems/skills.js';
import type { Entity, Registry } from '#gw2/platform/combat-engine/registry.js';

export function setupCombatStats(registry: Registry): void {
  view([registry.isActor, registry.staticAttributes], [registry.owner, registry.combatStats]).forEach((entity) => {
    registry.combatStats.emplace(entity, { health: registry.staticAttributes.get(entity).get('max_health') ?? 0 });
    registry.combatStatsUpdated.emplaceOrReplace(entity, true);
  });
}

/**
 * Rolls criticals at dispatch. The inclusive 0..100 integer roll means a
 * chance below 100% succeeds with probability floor(100 * chance) / 101, a
 * reference quirk kept intact; a capped 100% chance skips the draw.
 */
export function dispatchStrikes(registry: Registry): void {
  view([registry.team, registry.outgoingStrikes]).forEach((sourceEntity) => {
    const sourceTeam = registry.team.get(sourceEntity);
    for (const configured of registry.outgoingStrikes.get(sourceEntity)) {
      const strike = { ...configured };
      view([registry.team], [registry.owner]).forEach((otherEntity) => {
        if (strike.numTargets <= 0 || sourceTeam === registry.team.get(otherEntity)) return;
        const incoming = registry.incomingStrikes.getOrEmplace(otherEntity, () => []);
        const strikeSource = ownerOf(registry, sourceEntity);
        const criticalChance = Math.min(
          relativeAttribute(registry, strikeSource, otherEntity, 'critical_chance_multiplier'),
          1
        );
        const isCritical =
          strike.canCriticalStrike &&
          (criticalChance === 1 || registry.random.integer(0, 100) < roundDown(100 * criticalChance));
        incoming.push({ sourceEntity: strikeSource, strike: { ...strike }, isCritical });
        strike.numTargets -= 1;
      });
    }
  });
}

/** Strike damage: expected-value criticals in MEAN mode, the rolled outcome in RANDOM mode; floored once. */
export function strikeDamage(
  registry: Registry,
  strike: {
    readonly flatDamage: number;
    readonly weaponStrength: number;
    readonly damageCoefficient: number;
    readonly canCriticalStrike: boolean;
  },
  isCritical: boolean,
  sourceEntity: Entity,
  targetEntity: Entity
): number {
  const source = (attribute: Parameters<typeof relativeAttribute>[3]) =>
    relativeAttribute(registry, sourceEntity, targetEntity, attribute);
  const target = (attribute: Parameters<typeof relativeAttribute>[3]) =>
    relativeAttribute(registry, targetEntity, sourceEntity, attribute);

  const criticalChance = Math.min(source('critical_chance_multiplier'), 1);
  const criticalDamage = Math.max(source('critical_damage_multiplier'), 1.5);
  let criticalMultiplier: number;
  if (registry.encounter.criticalStrikeMode === 'MEAN') {
    criticalMultiplier = strike.canCriticalStrike ? 1 + criticalChance * (criticalDamage - 1) : 1;
  } else {
    criticalMultiplier = isCritical ? criticalDamage : 1;
  }

  const damageMultiplier =
    source('outgoing_strike_damage_multiplier') *
    (1 + source('outgoing_strike_damage_multiplier_add_group')) *
    target('incoming_strike_damage_multiplier') *
    (1 + target('incoming_strike_damage_multiplier_add_group'));
  const value =
    strike.flatDamage +
    (strike.weaponStrength * strike.damageCoefficient * source('power') * criticalMultiplier * damageMultiplier) /
      target('armor');
  return roundDown(value);
}

export function applyStrikes(registry: Registry): void {
  view([registry.relativeAttributes, registry.incomingStrikes], [registry.owner]).forEach((targetEntity) => {
    for (const incoming of registry.incomingStrikes.get(targetEntity)) {
      const strikeSource = ownerOf(registry, incoming.sourceEntity);
      const damage = strikeDamage(registry, incoming.strike, incoming.isCritical, strikeSource, targetEntity);
      registry.incomingDamage
        .getOrEmplace(targetEntity, () => [])
        .push({
          tick: registry.tick,
          sourceEntity: strikeSource,
          effect: null,
          skill: registry.isSkill.get(incoming.strike.skillEntity).skillKey,
          value: damage
        });
    }
  });
}

/** On-strike side effects and the strike's own on-strike applications. */
export function onStrikeHooks(registry: Registry): void {
  view([registry.incomingStrikes], [registry.owner]).forEach((targetEntity) => {
    for (const incoming of registry.incomingStrikes.get(targetEntity)) {
      const skill = registry.isSkill.get(incoming.strike.skillEntity);
      if (skill.skipOnStrikeHooks) continue;
      const strikeSource = ownerOf(registry, incoming.sourceEntity);
      applySideEffects(registry, strikeSource, (condition) =>
        onStrikeConditionsSatisfied(
          registry,
          condition,
          strikeSource,
          targetEntity,
          incoming.isCritical,
          incoming.strike,
          skill
        )
      );
      registry.outgoingEffects
        .getOrEmplace(strikeSource, () => [])
        .push(...pendingApplications(incoming.strike.onStrikeEffectApplications, skill.skillKey));
    }
  });
}

/**
 * Routes each pending application. Effects and unique effects emitting work
 * attribute it to the actor that applied them; everything else to its root owner.
 */
export function dispatchEffects(registry: Registry): void {
  view([registry.team, registry.outgoingEffects]).forEach((sourceEntity) => {
    const sourceTeam = registry.team.get(sourceEntity);
    const actualSource =
      registry.isEffect.has(sourceEntity) || registry.isUniqueEffect.has(sourceEntity)
        ? registry.sourceActor.get(sourceEntity)
        : ownerOf(registry, sourceEntity);

    for (const configured of registry.outgoingEffects.get(sourceEntity)) {
      const application = { ...configured };
      const deliver = (recipient: Entity) =>
        registry.incomingEffects
          .getOrEmplace(recipient, () => [])
          .push({ sourceEntity, application: { ...application } });

      if (application.direction === 'SELF') {
        if (!independentConditionsSatisfied(registry, application.condition, actualSource, actualSource).satisfied) {
          continue;
        }

        deliver(actualSource);
      } else if (application.direction === 'TEAM') {
        // The caster always receives a TEAM application and consumes one target without a condition check.
        deliver(actualSource);
        application.numTargets -= 1;
        view([registry.team], [registry.owner]).forEach((otherEntity) => {
          if (
            application.numTargets <= 0 ||
            otherEntity === sourceEntity ||
            registry.team.get(otherEntity) !== sourceTeam ||
            !independentConditionsSatisfied(registry, application.condition, actualSource, otherEntity).satisfied
          ) {
            return;
          }

          deliver(otherEntity);
          application.numTargets -= 1;
        });
      } else if (application.direction === 'OUTGOING') {
        view([registry.team], [registry.owner]).forEach((otherEntity) => {
          if (
            application.numTargets <= 0 ||
            registry.team.get(otherEntity) === sourceTeam ||
            !independentConditionsSatisfied(registry, application.condition, actualSource, otherEntity).satisfied
          ) {
            return;
          }

          deliver(otherEntity);
          application.numTargets -= 1;
        });
      }
    }
  });
  // Each pass consumes only newly emitted work; the post-strike pass must not replay pre-strike applications.
  registry.outgoingEffects.clear();
}

export function applyEffects(registry: Registry): void {
  view([registry.incomingEffects], [registry.owner]).forEach((targetEntity) => {
    for (const incoming of registry.incomingEffects.get(targetEntity)) {
      if (incoming.durationMs !== undefined) continue;
      calculateRelativeAttributes(registry);
      const { application } = incoming;
      const applicationSource = ownerOf(registry, incoming.sourceEntity);
      incoming.durationMs =
        application.effect == null
          ? application.baseDurationMs
          : effectiveEffectDuration(application.baseDurationMs, application.effect, (attribute) =>
              relativeAttribute(registry, applicationSource, targetEntity, attribute)
            );
      if (application.uniqueEffect.uniqueEffectKey !== '') {
        addUniqueEffectStacks(
          registry,
          application.uniqueEffect,
          application.numStacks,
          application.baseDurationMs,
          application.sourceSkill,
          applicationSource,
          targetEntity
        );
      }

      if (application.effect != null) {
        const effect = application.effect;
        addEffectStacks(
          registry,
          effect,
          application.numStacks,
          incoming.durationMs,
          application.sourceSkill,
          applicationSource,
          targetEntity
        );
        applySideEffects(registry, applicationSource, (condition) =>
          onEffectApplicationConditionsSatisfied(registry, condition, applicationSource, targetEntity, effect)
        );
      }
    }
  });
}

/**
 * Accrues the damage a stack has earned since it was last paid. Stacks applied
 * together share rounding: the group total is banker's-rounded, then divided
 * back per stack. Paying resets the stack's lifetime origin.
 */
function bufferStackDamage(registry: Registry, targetEntity: Entity, effectEntity: Entity, sourceEntity: Entity): void {
  const source = (attribute: Parameters<typeof relativeAttribute>[3]) =>
    relativeAttribute(registry, sourceEntity, targetEntity, attribute);
  const target = (attribute: Parameters<typeof relativeAttribute>[3]) =>
    relativeAttribute(registry, targetEntity, sourceEntity, attribute);

  const baseMultiplier =
    source('outgoing_condition_damage_multiplier') *
    (1 + source('outgoing_condition_damage_multiplier_add_group')) *
    target('incoming_condition_damage_multiplier') *
    (1 + target('incoming_condition_damage_multiplier_add_group'));

  const duration = registry.duration.get(effectEntity);
  const progressMultiplier = duration.progress / 1000;
  duration.duration -= duration.progress;
  duration.progress = 0;

  const { effect, groupedWithNumStacks } = registry.isEffect.get(effectEntity);
  const perSecond = conditionDamagePerSecond(effect, source, baseMultiplier);
  const damage = roundHalfEven(perSecond * progressMultiplier * groupedWithNumStacks) / groupedWithNumStacks;
  registry.bufferedConditionDamage
    .getOrEmplace(targetEntity, () => [])
    .push({
      effectSourceEntity: sourceEntity,
      effect,
      sourceSkill: registry.sourceSkill.get(effectEntity),
      damage
    });
}

/** Buffers every damaging stack, or one specific stack when it expires between condition ticks. */
export function bufferConditionDamage(registry: Registry, specificEffect: Entity | null = null): void {
  calculateRelativeAttributes(registry);
  if (specificEffect != null) {
    if (!registry.isDamagingEffect.has(specificEffect)) return;
    bufferStackDamage(
      registry,
      registry.owner.get(specificEffect),
      specificEffect,
      registry.sourceActor.get(specificEffect)
    );
    return;
  }

  view([registry.isDamagingEffect, registry.owner, registry.sourceActor]).forEach((effectEntity) => {
    bufferStackDamage(registry, registry.owner.get(effectEntity), effectEntity, registry.sourceActor.get(effectEntity));
  });
}

export function bufferDamageForExpiredEffects(registry: Registry): void {
  view([registry.durationExpired, registry.isDamagingEffect]).forEach((effectEntity) => {
    bufferConditionDamage(registry, effectEntity);
  });
}

export function applyConditionDamage(registry: Registry): void {
  registry.bufferedConditionDamage.forEach((entity, buffered) => {
    const incoming = registry.incomingDamage.getOrEmplace(entity, () => []);
    for (const entry of buffered) {
      incoming.push({
        tick: registry.tick,
        sourceEntity: entry.effectSourceEntity,
        effect: entry.effect,
        skill: entry.sourceSkill,
        value: entry.damage
      });
    }

    registry.bufferedConditionDamage.remove(entity);
  });
}

/** Commits the tick's damage to health; reaching zero marks the actor downed. */
export function updateCombatStats(registry: Registry): void {
  view([registry.combatStats, registry.incomingDamage], [registry.isDownstate]).forEach((entity) => {
    const stats = registry.combatStats.get(entity);
    let total = 0;
    for (const event of registry.incomingDamage.get(entity)) total += event.value;
    stats.health -= total;
    // Damage only dirties attributes when a modifier or conversion reads a health threshold.
    if (total !== 0 && registry.attributeDependencies.has('health')) {
      markAttributesDirty(registry, entity);
    }

    if (stats.health <= 0) registry.isDownstate.emplace(entity, true);
    registry.combatStatsUpdated.emplaceOrReplace(entity, true);
  });
}

/** Damage-threshold termination compares integer health, truncating like the reference's `int` conversion. */
export function damageTaken(registry: Registry, entity: Entity): number {
  const maximum = roundHalfEven(registry.staticAttributes.get(entity).get('max_health') ?? 0);
  return maximum - truncateToInt(registry.combatStats.get(entity).health);
}
