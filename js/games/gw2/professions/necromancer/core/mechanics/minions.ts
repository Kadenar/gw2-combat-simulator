import { EPSILON } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { strikeEffectTicks } from '#gw2/platform/engine/effects/timelines.js';
import { emitSkillCondition, emitSkillControl, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';
/**
 * Minion summon and command handlers.
 *
 * `summonMinion` records the minion in `state.activeMinions`, arms its command
 * flip skill, and queues recurring `necromancer.summon-attack` events for the
 * minion's autoattack. `minionCommand` fires the active (damage/condition/
 * control), optionally consuming the minion. `summonMadness` spawns the timed
 * Unstable Horrors (attack + explosion per summon). Exports
 * `necromancerMinionSkillHandlers`.
 */
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  runCreatureSummonReactions,
  gainNecromancerLifeForce,
  necromancerCreatureStrikeMultiplier
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type { ScheduledTask } from '#gw2/platform/engine/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  NecromancerCastContext,
  NecromancerRechargeQuery,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import {
  commandDefinitionFor,
  minionDefinitionFor,
  minionDefinitionForSkill,
  summonWeaponStrength,
  type MinionCommandDefinition,
  type MinionDefinition
} from '#gw2/professions/necromancer/core/mechanics/minion-profiles.js';
import {
  castWasInterrupted,
  quantizeGw2ActionDurationUp,
  summonQuicknessCastTimeMs
} from '#gw2/platform/skills/timing.js';
import { gw2BuffActiveForAudience } from '#gw2/platform/scheduler/policy.js';

const MINION_COMMAND_IMPACT_TASK = 'necromancer.minion-command-impact';
const MINION_ATTACK_TASK = 'necromancer.minion-attack';
const MINION_ATTACK_STOP_TASK = 'necromancer.minion-attack-stop';

interface MinionAttackTaskPayload {
  readonly skillId: SkillId;
  readonly minionKey: string;
  readonly generation: number;
  readonly attackGeneration: number;
  readonly cycleIndex: number;
  readonly minionIndex: number;
  readonly attackIndex: number;
  readonly controlUntil: number;
  readonly controlKind?: string;
}

interface MinionAttackStopTaskPayload {
  readonly ownerId: string;
}

function minionAttackOwner(key: string, attackGeneration: number): string {
  return `minion:${key}:${attackGeneration}`;
}

// Queue cancellation at the command timestamp so an old autonomous attack generation cannot fire afterward.
function queueMinionAttackStop(
  context: NecromancerCastContext,
  key: string,
  attackGeneration: number,
  at: number
): void {
  if (attackGeneration <= 0) return;
  context.tasks.schedule({
    type: MINION_ATTACK_STOP_TASK,
    at,
    payload: { ownerId: minionAttackOwner(key, attackGeneration) }
  });
}

// Stamp summon-specific damage attributes only when the active profile supplies a complete independent formula.
function summonStrikeMetadata(
  context: NecromancerCastContext,
  definition?: MinionDefinition,
  damagePerCoefficient = definition?.damagePerCoefficient
): Readonly<Record<string, number | boolean>> {
  if (!definition || !Number.isFinite(Number(definition.basePower)) || !Number.isFinite(Number(damagePerCoefficient))) {
    return {};
  }

  return {
    summonBasePower: Number(definition.basePower),
    summonDamagePerCoefficient: Number(damagePerCoefficient),
    summonCriticalChance: Number(definition.criticalChance ?? 0.05),
    summonCriticalDamage: Number(definition.criticalDamage ?? 1.5),
    summonStrikeMultiplier:
      (hasTrait(context, TRAIT.NECROMANTIC_CORRUPTION) ? 1.25 : 1) * necromancerCreatureStrikeMultiplier(context),
    independentSummonStrike: true
  };
}

// Start a summon's autonomous attack generation at its declared delay, cancelling
// the prior generation before the replacement loop begins.
function queueSummonAttacks(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  definition: MinionDefinition,
  at: number,
  {
    initialDelay = definition.initialDelay ?? definition.interval,
    controlUntil = 0,
    controlKind,

    initialCycleIndex = 0
  }: {
    readonly initialDelay?: number;
    readonly controlUntil?: number;
    readonly controlKind?: string;

    readonly initialCycleIndex?: number;
  } = {}
): void {
  // A generation change cancels the prior owner's loop without touching newly queued attacks.
  const generation = Number(professionCoreState(context).minionGenerations[definition.key] || 0);
  const attackGeneration = Number(professionCoreState(context).minionAttackGenerations[definition.key] || 0);
  queueMinionAttackStop(context, definition.key, attackGeneration - 1, at);
  // Each creature owns a clock because capped party boons can reach only one copy of a minion.
  for (let minionIndex = 0; minionIndex < definition.count; minionIndex += 1) {
    context.tasks.schedule({
      type: MINION_ATTACK_TASK,
      at: quantizeGw2ActionDurationUp((at + Number(initialDelay)) * 1000) / 1000,
      ownerId: minionAttackOwner(definition.key, attackGeneration),
      payload: {
        skillId: skill.id,
        minionKey: definition.key,
        generation,
        attackGeneration,
        cycleIndex: initialCycleIndex + 1,
        minionIndex,
        attackIndex: 0,
        controlUntil,
        controlKind
      }
    });
  }
}

// Advance one creature's attack chain, sampling its own Quickness between attacks while retaining fixed idle gaps.
function handleMinionAttack(context: NecromancerCastContext, task: ScheduledTask<MinionAttackTaskPayload>): void {
  const payload = task.payload;
  if (!payload) return;
  const skill = context.catalog.skillsById.get(payload.skillId);
  const definition = skill ? minionDefinitionForSkill(context, skill.id) : undefined;
  if (!skill || !definition || definition.key !== payload.minionKey) return;

  // Keep the same ordinary or alternating packet set for every attack in this cycle.
  const defaultAttacks = definition.attacks || [
    {
      name: `${skill.name} - Minion Attack`,
      coefficient: definition.coefficient,
      offset: 0
    }
  ];
  const alternateEvery = Number(definition.alternateEvery || 0);
  const attacks =
    definition.alternateAttacks?.length && alternateEvery > 0 && payload.cycleIndex % alternateEvery === 0
      ? definition.alternateAttacks
      : defaultAttacks;
  const attack = attacks[payload.attackIndex];
  if (!attack) return;
  const summonOwner = `minion:${definition.key}:${payload.minionIndex}`;
  const damagePerCoefficient = attack.damagePerCoefficient ?? definition.damagePerCoefficient;
  context.emit({
    type: 'necromancer.summon-attack',
    at: task.at,
    source: 'Minion',
    sourceId: attack.skillId ?? skill.id,
    actorType: 'summon',
    skillId: attack.skillId ?? skill.id,
    skillName: attack.name,
    parentSkillName: attack.skillId ? skill.name : '',
    name: attack.name,
    icon: attack.icon || skill.icon || '',
    coefficient: attack.coefficient,
    deferredComboFinishers: attack.comboFinishers,
    onHitCondition: attack.condition,
    controlKind: attack.controlKind || (task.at <= payload.controlUntil + EPSILON ? payload.controlKind : undefined),

    ...(Number.isFinite(Number(damagePerCoefficient))
      ? {}
      : {
          weaponStrength: attack.weaponStrength ?? definition.weaponStrength ?? summonWeaponStrength(context)
        }),
    requiresMinion: definition.key,
    requiresMinionIndex: payload.minionIndex,
    requiresMinionGeneration: payload.generation,
    requiresMinionAttackGeneration: payload.attackGeneration,
    summonKind: 'minion',
    summonCount: 1,
    summonOwner,
    summonOwnerBase: `minion:${definition.key}`,
    ...summonStrikeMetadata(context, definition, damagePerCoefficient)
  });
  const nextAttackIndex = (payload.attackIndex + 1) % attacks.length;
  const interval =
    nextAttackIndex === 0
      ? definition.interval - Number(attack.offset || 0)
      : Number(attacks[nextAttackIndex].offset || 0) - Number(attack.offset || 0);
  const castTimeMs = Number(attack.castTimeMs || 0);
  const quickness =
    context.config.sharePlayerBoonsWithSummons !== false &&
    gw2BuffActiveForAudience(context, 'quickness', task.at, 'summon', summonOwner);
  // Fist and unmeasured attacks declare no accelerable duration; never divide their entire repeat interval.
  const savedMs = quickness ? castTimeMs - summonQuicknessCastTimeMs(null, castTimeMs) : 0;
  const nextAt = quantizeGw2ActionDurationUp(task.at * 1000 + Math.max(0, interval * 1000 - savedMs)) / 1000;
  if (nextAt > task.at && (context.observationEndTime == null || nextAt <= context.observationEndTime + EPSILON)) {
    context.tasks.schedule({
      type: MINION_ATTACK_TASK,
      at: nextAt,
      ownerId: task.ownerId,
      payload: {
        ...payload,
        attackIndex: nextAttackIndex,
        cycleIndex: payload.cycleIndex + Number(nextAttackIndex === 0)
      }
    });
  }
}

// Cancel the scheduled task owner recorded by a prior attack generation.
function handleMinionAttackStop(
  context: NecromancerCastContext,
  task: ScheduledTask<MinionAttackStopTaskPayload>
): void {
  if (task.payload) context.tasks.cancelOwner(task.payload.ownerId);
}

// Materialize explicitly timed command packets once per summoned minion while
// binding them to the current summon and attack generations.
function queueMinionCommandAttacks(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  definition: MinionCommandDefinition
): void {
  const minion = minionDefinitionFor(context, definition.minion);
  if (!minion || !definition.attacks?.length) return;
  const state = professionCoreState(context);
  const generation = Number(state.minionGenerations[minion.key] || 0);
  const attackGeneration = Number(state.minionAttackGenerations[minion.key] || 0);
  // Expand each command packet across active copies while retaining the current generation guards.
  for (const attack of definition.attacks) {
    const damagePerCoefficient = attack.damagePerCoefficient ?? minion.damagePerCoefficient;
    for (let index = 0; index < minion.count; index += 1) {
      context.emit({
        type: 'necromancer.summon-attack',
        at: context.effectiveEnd + Number(attack.offset || 0),
        source: 'Minion',
        sourceId: attack.skillId ?? skill.id,
        actorType: 'summon',
        skillId: attack.skillId ?? skill.id,
        skillName: attack.name,
        parentSkillName: skill.name,
        name: attack.name,
        icon: attack.icon || skill.icon || '',
        coefficient: attack.coefficient,
        deferredComboFinishers: attack.comboFinishers,
        onHitCondition: attack.condition,
        controlKind: attack.controlKind,

        ...(Number.isFinite(Number(damagePerCoefficient))
          ? {}
          : {
              weaponStrength: attack.weaponStrength ?? minion.weaponStrength ?? summonWeaponStrength(context)
            }),
        requiresMinion: minion.key,
        requiresMinionIndex: index,
        requiresMinionGeneration: generation,
        requiresMinionAttackGeneration: attackGeneration,
        summonKind: 'minion',
        summonCount: 1,
        summonOwner: `minion:${minion.key}:${index}`,
        summonOwnerBase: `minion:${minion.key}`,
        ...summonStrikeMetadata(context, minion, damagePerCoefficient)
      });
    }
  }
}

// Establish a fresh minion generation, arm its command, publish state, and start autonomous attacks.
function summonMinion(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  // Interrupted summons never create a creature, arm its command, or start its attack clock.
  if (castWasInterrupted(context)) return true;
  const definition = minionDefinitionForSkill(context, skill.id);
  if (!definition) return false;
  const state = professionCoreState(context);
  // Replace the active generation and arm its command flip before scheduling attacks.
  state.activeMinions[definition.key] = definition.count;
  state.minionGenerations[definition.key] = Number(state.minionGenerations[definition.key] || 0) + 1;
  state.minionAttackGenerations[definition.key] = Number(state.minionAttackGenerations[definition.key] || 0) + 1;
  state.minionAttackAnchors[definition.key] =
    quantizeGw2ActionDurationUp(
      (context.effectiveEnd + Number(definition.initialDelay ?? definition.interval)) * 1000
    ) / 1000;
  state.minionAttackCycleOffsets[definition.key] = 0;
  if (definition.commandId) {
    state.availableFlips[definition.commandId] = Number.POSITIVE_INFINITY;
  }

  if (skill.rechargeOnMinionDeath) {
    context.state.cooldowns.delete(skill.id);
  }

  // Publish the summon before reactions and autonomous attack scheduling consume the new state.
  emitNecromancerStateSnapshot(context, context.effectiveEnd, 'minion-summoned', { dedupeAcrossSourceIds: true });
  runCreatureSummonReactions(context, skill, context.effectiveEnd, definition.count);
  queueSummonAttacks(context, skill, definition, context.effectiveEnd);
  return true;
}

// Emit the immediate, non-ticked portion of a minion command through canonical
// damage, condition, control, and blind event paths.
function emitMinionCommandEffects(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  definition: MinionCommandDefinition,
  at: number
): void {
  const minion = minionDefinitionFor(context, definition.minion);
  // Immediate damage and conditions use canonical emission helpers for normal resolver handling.
  if (Number(definition.coefficient || 0) > 0) {
    emitSkillDamage(context, skill, {
      at,
      source: 'Minion',
      actorType: 'summon',
      coefficient: Number(definition.coefficient),
      summonKind: 'minion',
      ...summonStrikeMetadata(context, minion)
    });
  }

  if (definition.condition) {
    emitSkillCondition(context, {
      skill,
      at,
      source: 'Minion',
      actorType: 'summon',
      condition: String(definition.condition[0]),
      stacks: Number(definition.condition[1]),
      duration: Number(definition.condition[2])
    });
  }

  for (const condition of definition.conditions || []) {
    emitSkillCondition(context, {
      skill,
      at,
      source: 'Minion',
      actorType: 'summon',
      condition: String(condition[0]),
      stacks: Number(condition[1]),
      duration: Number(condition[2])
    });
  }

  // Control and blind remain separate event types because their downstream reactions differ.
  if (definition.control && definition.control !== 'blind') {
    emitSkillControl(context, skill, {
      at: context.effectiveEnd,
      controlKind: definition.control
    });
  }

  if (definition.control === 'blind') {
    context.emit({
      type: 'blind',
      at,
      source: 'Minion',
      sourceId: skill.id,
      actorType: 'summon',
      skillId: skill.id,
      skillName: skill.name,
      duration: Number(definition.blindDuration || 0)
    });
  }
}

// Pause a commanded minion's autonomous loop, preserve its cycle position, and
// resume after recovery without allowing stale scheduled generations to fire.
function restartMinionAttacks(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  definition: MinionCommandDefinition
): void {
  const minion = minionDefinitionFor(context, definition.minion);
  if (!minion || !Number.isFinite(Number(minion.commandRecoveryDelay))) return;
  const state = professionCoreState(context);
  // Derive the next cycle index from the prior cadence so a command pause cannot reset alternation.
  const previousAnchor = Number(state.minionAttackAnchors[minion.key] || context.effectiveEnd);
  const previousOffset = Number(state.minionAttackCycleOffsets[minion.key] || 0);
  const completedSinceAnchor =
    context.effectiveEnd + EPSILON >= previousAnchor
      ? Math.floor((context.effectiveEnd - previousAnchor + EPSILON) / minion.interval) + 1
      : 0;
  const nextCycleIndex = previousOffset + completedSinceAnchor;
  state.minionAttackGenerations[minion.key] = Number(state.minionAttackGenerations[minion.key] || 0) + 1;
  if (skill.flipParentId == null) return;
  const summonSkill = context.catalog.skillsById.get(skill.flipParentId);
  if (!summonSkill) return;
  // A fresh attack generation invalidates the old loop and resumes after command recovery.
  state.minionAttackAnchors[minion.key] =
    quantizeGw2ActionDurationUp((context.effectiveEnd + Number(minion.commandRecoveryDelay)) * 1000) / 1000;
  state.minionAttackCycleOffsets[minion.key] = nextCycleIndex;
  queueSummonAttacks(context, summonSkill, minion, context.effectiveEnd, {
    initialDelay: minion.commandRecoveryDelay,
    controlUntil: context.effectiveEnd + Number(definition.controlWindow || 0),
    controlKind: definition.control,

    initialCycleIndex: nextCycleIndex
  });
}

// Dispatch a command's timed or immediate effects, then reconcile minion counts,
// flip availability, autonomous attacks, and death-triggered summon recharge.
function minionCommand(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const definition = commandDefinitionFor(skill);
  if (!definition.minion) return false;
  restartMinionAttacks(context, skill, definition);
  // Dispatch explicitly timed attacks, one delayed impact, or immediate effects as declared.
  const impactDelay = Math.max(0, Number(definition.impactDelay || 0));
  if (definition.attacks?.length) {
    queueMinionCommandAttacks(context, skill, definition);
  } else if (impactDelay > 0) {
    context.tasks.schedule({
      id: `${context.reservationId}:minion-command-impact`,
      type: MINION_COMMAND_IMPACT_TASK,
      at: context.effectiveEnd + impactDelay,
      ownerId: context.reservationId,
      payload: { skillId: skill.id }
    });
  } else {
    emitMinionCommandEffects(context, skill, definition, context.effectiveEnd);
  }

  // Reconcile consumed minions, command flips, attack ownership, and summon-skill recharge together.
  if (definition.consumes) {
    const remaining = Math.max(
      0,
      Number(professionCoreState(context).activeMinions[definition.minion] || 0) - definition.consumes
    );
    if (remaining) {
      professionCoreState(context).activeMinions[definition.minion] = remaining;
      professionCoreState(context).availableFlips[skill.id] = Number.POSITIVE_INFINITY;
    } else {
      delete professionCoreState(context).activeMinions[definition.minion];
      delete professionCoreState(context).availableFlips[skill.id];
      queueMinionAttackStop(
        context,
        definition.minion,
        Number(professionCoreState(context).minionAttackGenerations[definition.minion] || 0),
        context.effectiveEnd
      );
      const summon = skill.flipParentId == null ? undefined : context.catalog.skillsById.get(skill.flipParentId);
      if (summon?.rechargeOnMinionDeath) {
        const deathQuery: NecromancerRechargeQuery = { minionDeathRecharge: true };
        const recharge = context.rechargeDurationFor(summon, context.effectiveEnd, deathQuery);
        if (recharge > 0) {
          context.state.cooldowns.set(summon.id, context.effectiveEnd + recharge);
        }
      }
    }
  } else if (Number(professionCoreState(context).activeMinions[definition.minion] || 0) > 0) {
    professionCoreState(context).availableFlips[skill.id] = Number.POSITIVE_INFINITY;
  }

  emitNecromancerStateSnapshot(context, context.effectiveEnd, 'minion-command', { dedupeAcrossSourceIds: true });
  return true;
}

// Resolve a delayed command impact only if its owning minion is still active,
// then award hit-confirmed life force.
function handleMinionCommandImpact(
  context: NecromancerCastContext,
  task: ScheduledTask<{ readonly skillId: SkillId }>
): void {
  if (!task.payload) return;
  const skill = context.catalog.skillsById.get(task.payload.skillId);
  const definition = skill ? commandDefinitionFor(skill) : undefined;
  if (!skill || !definition || !(Number(professionCoreState(context).activeMinions[definition.minion] || 0) > 0))
    return;
  emitMinionCommandEffects(context, skill, definition, task.at);
  gainNecromancerLifeForce(context, Number(definition.lifeForceGain || 0), task.at, 'minion-command-hit');
}

// Stagger each temporary horror summon and give its attack and explosion unique
// ownership so simultaneous creatures remain independently attributable.
function summonMadness(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const start = context.effectiveEnd;
  // Give each staggered horror independent attribution for its attack and terminal explosion.
  for (let index = 0; index < Number(skill.summons || 0); index += 1) {
    const summonAt = start + index * Number(skill.summonInterval || 0);
    runCreatureSummonReactions(context, skill, summonAt);
    // Preserve every authored strike tick relative to this horror's summon time.
    for (const effect of skill.effects || []) {
      if (effect.type !== 'strike') continue;
      for (const tick of strikeEffectTicks(effect)) {
        emitSkillDamage(context, skill, {
          at: summonAt + Number(tick.atMs) / 1000,
          name: String(effect.name || `Unstable Horror - ${effect.packetLabel}`),
          source: 'Minion',
          sourceId: `unstable-horror.${index}`,
          actorType: 'summon',
          coefficient: Number(tick.coefficient),
          summonKind: 'minion'
        });
      }
    }
  }

  return true;
}

/** Maps minion summon and command handler keys to their cast implementations. */
export const necromancerMinionSkillHandlers = Object.freeze({
  'necromancer.minion': summonMinion,
  'necromancer.minion-command': minionCommand,
  'necromancer.summon-madness': summonMadness
});

/** Maps minion scheduler task types to autonomous attack and delayed-command handlers. */
export const necromancerMinionTaskHandlers = Object.freeze({
  [MINION_ATTACK_TASK]: handleMinionAttack,
  [MINION_ATTACK_STOP_TASK]: handleMinionAttackStop,
  [MINION_COMMAND_IMPACT_TASK]: handleMinionCommandImpact
});
