import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { emitSkillCondition, emitSkillControl, emitSkillDamage } from '../../../platform/gw2/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { snapshotNecromancerState } from '../state.js';
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
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  NECROMANCER_MINION_PROFILE_BY_SKILL_ID,
  necromancerBalanceProfile
} from './profiles.js';
import { runCreatureSummonReactions, gainNecromancerLifeForce, necromancerCreatureStrikeMultiplier } from './shared.js';
import type { ScheduledTask, SchedulerRecord, SkillEffect, SkillId } from '../../../platform/engine/types.js';
import type { NecromancerCastContext, NecromancerSkill } from '../types.js';

interface MinionAttack {
  readonly name: string;
  readonly coefficient?: number;
  readonly offset?: number;
  readonly skillId?: SkillId;
  readonly icon?: string;
  readonly weaponStrength?: number;
  readonly damagePerCoefficient?: number;
  readonly comboFinishers?: readonly SchedulerRecord[];
  readonly condition?: readonly (string | number)[];
  readonly controlKind?: string;
  readonly controlDuration?: number;
}

interface MinionDefinition {
  readonly key: string;
  readonly count: number;
  readonly interval: number;
  readonly initialDelay?: number;
  readonly coefficient: number;
  readonly commandId?: SkillId;
  readonly rechargeOnMinionDeath?: boolean;
  readonly weaponStrength?: number;
  readonly basePower?: number;
  readonly damagePerCoefficient?: number;
  readonly criticalChance?: number;
  readonly criticalDamage?: number;
  readonly commandRecoveryDelay?: number;
  readonly attacks?: readonly MinionAttack[];
  readonly alternateEvery?: number;
  readonly alternateAttacks?: readonly MinionAttack[];
}

interface MinionCommandDefinition {
  readonly minion: string;
  readonly coefficient?: number;
  readonly condition?: readonly (string | number)[];
  readonly conditions?: readonly (readonly (string | number)[])[];
  readonly control?: string;
  readonly controlDuration?: number;
  readonly controlWindow?: number;
  readonly blindDuration?: number;
  readonly impactDelay?: number;
  readonly consumes?: number;
  readonly lifeForceGain?: number;
  readonly attacks?: readonly MinionAttack[];
}

const MINION_COMMAND_IMPACT_TASK = 'necromancer.minion-command-impact';
const MINION_ATTACK_TASK = 'necromancer.minion-attack';
const MINION_ATTACK_STOP_TASK = 'necromancer.minion-attack-stop';

interface MinionAttackTaskPayload extends SchedulerRecord {
  readonly skillId: SkillId;
  readonly minionKey: string;
  readonly generation: number;
  readonly attackGeneration: number;
  readonly cycleIndex: number;
  readonly controlUntil: number;
  readonly controlKind?: string;
  readonly controlDuration: number;
}

interface MinionAttackStopTaskPayload extends SchedulerRecord {
  readonly ownerId: string;
}

function minionAttackOwner(key: string, attackGeneration: number): string {
  return `minion:${key}:${attackGeneration}`;
}

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

function minionAttackFromEffect(effect: SkillEffect, fallbackName: string): MinionAttack {
  return {
    name: String(effect.name || fallbackName),
    coefficient: Number(effect.coefficient || 0),
    offset: Number(effect.atMs || 0) / 1000,
    skillId: effect.sourceId,
    icon: effect.icon == null ? undefined : String(effect.icon),
    damagePerCoefficient: effect.damagePerCoefficient == null ? undefined : Number(effect.damagePerCoefficient),
    comboFinishers: effect.comboFinishers
  };
}

// Translate a summon balance profile into the runtime attack model, including
// alternating packets and any condition carried by the alternate attack.
function minionDefinitionForSkill(context: NecromancerCastContext, skillId: SkillId): MinionDefinition | undefined {
  const profileId = NECROMANCER_MINION_PROFILE_BY_SKILL_ID[Number(skillId)];
  const profile = necromancerBalanceProfile(context, profileId);
  if (!profile) return undefined;
  const strikes = (profile.effects || []).filter((effect) => effect.type === 'strike');
  const ordinary = strikes.filter((effect) => effect.packetLabel !== 'alternate');
  const alternate = strikes.filter((effect) => effect.packetLabel === 'alternate');
  const alternateCondition = (profile.effects || []).find(
    (effect) => effect.type === 'condition' && effect.packetLabel === 'alternate'
  );
  const toAttack = (effect: SkillEffect): MinionAttack => ({
    ...minionAttackFromEffect(effect, profile.name),
    ...(alternateCondition
      ? {
          condition: [
            String(alternateCondition.condition || ''),
            Number(alternateCondition.stacks || 1),
            Number(alternateCondition.duration || 0)
          ]
        }
      : {})
  });
  return {
    key: String(profile.minionKey || ''),
    count: Number(profile.minionCount || 1),
    interval: Number(profile.pulseInterval || 0),
    initialDelay: profile.initialDelay == null ? undefined : Number(profile.initialDelay),
    coefficient: Number(ordinary[0]?.coefficient || 0),
    commandId: profile.commandId as SkillId | undefined,
    weaponStrength: profile.weaponStrength == null ? undefined : Number(profile.weaponStrength),
    basePower: Number(profile.basePower || 0),
    damagePerCoefficient: Number(profile.damagePerCoefficient || 0),
    criticalChance: Number(profile.criticalChance || 0),
    criticalDamage: Number(profile.criticalDamage || 0),
    commandRecoveryDelay: profile.rechargeOffsetMs == null ? undefined : Number(profile.rechargeOffsetMs) / 1000,
    attacks: ordinary.map(toAttack),
    alternateEvery: Number(profile.alternateEvery || 0),
    alternateAttacks: alternate.map(toAttack)
  };
}

function minionDefinitionFor(context: NecromancerCastContext, key: string): MinionDefinition | undefined {
  for (const skillId of Object.keys(NECROMANCER_MINION_PROFILE_BY_SKILL_ID)) {
    const definition = minionDefinitionForSkill(context, Number(skillId));
    if (definition?.key === key) return definition;
  }

  return undefined;
}

function summonWeaponStrength(context: NecromancerCastContext): number {
  return Number(necromancerBalanceProfile(context, PROFILE.summonAttributes)?.weaponStrength || 1048);
}

// Compile a command skill's declarative strikes, ticks, conditions, control, and
// consumption fields into the shape used by minion command scheduling.
function commandDefinitionFor(skill: NecromancerSkill): MinionCommandDefinition {
  const effects = skill.effects || [];
  const strike = effects.find((effect) => effect.type === 'strike' && !Array.isArray(effect.ticks));
  const tickStrike = effects.find((effect) => effect.type === 'strike' && Array.isArray(effect.ticks));
  const ticks = Array.isArray(tickStrike?.ticks) ? tickStrike.ticks : [];
  const attacks: MinionAttack[] = ticks.map((tick) => ({
    name: String(tick.name || skill.name),
    coefficient: Number(tick.coefficient || 0),
    offset: Number(tick.atMs || 0) / 1000,
    skillId: tick.sourceId as SkillId | undefined,
    comboFinishers: Array.isArray(tick.comboFinishers) ? tick.comboFinishers : undefined,
    controlKind: String(tick.controlKind || ''),
    controlDuration: Number(tick.controlDuration || 0)
  }));
  const conditions = effects
    .filter((effect) => effect.type === 'condition')
    .map((effect) =>
      Object.freeze([String(effect.condition || ''), Number(effect.stacks || 1), Number(effect.duration || 0)])
    );
  const controlEffect = effects.find((effect) => effect.type === 'control' || effect.type === 'blind');
  const controlMetadata = controlEffect?.metadata || {};
  return {
    minion: String(skill.minionKey || ''),
    coefficient: Number(strike?.coefficient || 0),
    conditions,
    control: String(
      controlEffect?.type === 'blind' ? 'blind' : controlMetadata.controlKind || attacks[0]?.controlKind || ''
    ),
    controlDuration: Number(controlMetadata.duration || attacks[0]?.controlDuration || 0),
    controlWindow: Number(skill.controlWindow || 0),
    blindDuration: Number(controlMetadata.duration || 0),
    impactDelay: Number(skill.impactDelay || 0),
    consumes: Number(skill.consumes || 0),
    lifeForceGain: Number(skill.lifeForceOnHit || 0),
    attacks
  };
}

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
    controlDuration = 0,
    initialCycleIndex = 0
  }: {
    readonly initialDelay?: number;
    readonly controlUntil?: number;
    readonly controlKind?: string;
    readonly controlDuration?: number;
    readonly initialCycleIndex?: number;
  } = {}
): void {
  const generation = Number(professionCoreState(context).minionGenerations[definition.key] || 0);
  const attackGeneration = Number(professionCoreState(context).minionAttackGenerations[definition.key] || 0);
  queueMinionAttackStop(context, definition.key, attackGeneration - 1, at);
  context.tasks.schedule({
    type: MINION_ATTACK_TASK,
    at: at + Number(initialDelay),
    ownerId: minionAttackOwner(definition.key, attackGeneration),
    payload: {
      skillId: skill.id,
      minionKey: definition.key,
      generation,
      attackGeneration,
      cycleIndex: initialCycleIndex + 1,
      controlUntil,
      controlKind,
      controlDuration
    }
  });
}

// Emit one generation-gated attack cycle for every active copy of a minion, then
// keep its cadence alive only while the observation window can include another cycle.
function handleMinionAttack(context: NecromancerCastContext, task: ScheduledTask<MinionAttackTaskPayload>): void {
  const payload = task.payload;
  if (!payload) return;
  const skill = context.catalog.skillsById.get(payload.skillId);
  const definition = skill ? minionDefinitionForSkill(context, skill.id) : undefined;
  if (!skill || !definition || definition.key !== payload.minionKey) return;

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
  for (const attack of attacks) {
    const damagePerCoefficient = attack.damagePerCoefficient ?? definition.damagePerCoefficient;
    for (let index = 0; index < definition.count; index += 1) {
      context.emit({
        type: 'necromancer.summon-attack',
        at: task.at + Number(attack.offset || 0),
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
        controlKind:
          attack.controlKind || (task.at <= payload.controlUntil + context.epsilon ? payload.controlKind : undefined),
        controlDuration:
          attack.controlDuration ||
          (task.at <= payload.controlUntil + context.epsilon ? payload.controlDuration : undefined),
        ...(Number.isFinite(Number(damagePerCoefficient))
          ? {}
          : {
              weaponStrength: attack.weaponStrength ?? definition.weaponStrength ?? summonWeaponStrength(context)
            }),
        requiresMinion: definition.key,
        requiresMinionIndex: index,
        requiresMinionGeneration: payload.generation,
        requiresMinionAttackGeneration: payload.attackGeneration,
        summonKind: 'minion',
        summonCount: 1,
        summonOwner: `minion:${definition.key}:${index}`,
        summonOwnerBase: `minion:${definition.key}`,
        ...summonStrikeMetadata(context, definition, damagePerCoefficient)
      });
    }
  }

  const nextAt = task.at + definition.interval;
  if (context.observationEndTime == null || nextAt <= context.observationEndTime + context.epsilon) {
    context.tasks.schedule({
      type: MINION_ATTACK_TASK,
      at: nextAt,
      ownerId: task.ownerId,
      payload: {
        ...payload,
        cycleIndex: payload.cycleIndex + 1
      }
    });
  }
}

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
        controlDuration: attack.controlDuration,
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

function summonMinion(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const definition = minionDefinitionForSkill(context, skill.id);
  if (!definition) return false;
  const state = professionCoreState(context);
  state.activeMinions[definition.key] = definition.count;
  state.minionGenerations[definition.key] = Number(state.minionGenerations[definition.key] || 0) + 1;
  state.minionAttackGenerations[definition.key] = Number(state.minionAttackGenerations[definition.key] || 0) + 1;
  state.minionAttackAnchors[definition.key] =
    context.effectiveEnd + Number(definition.initialDelay ?? definition.interval);
  state.minionAttackCycleOffsets[definition.key] = 0;
  if (definition.commandId) {
    state.availableFlips[definition.commandId] = Number.POSITIVE_INFINITY;
  }

  if (skill.rechargeOnMinionDeath) {
    context.state.cooldowns.delete(skill.id);
  }

  emitStateSnapshot(
    context,
    'necromancer',
    context.effectiveEnd,
    'minion-summoned',
    snapshotNecromancerState(context.state.profession),
    { dedupeAcrossSourceIds: true }
  );
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
  if (Number(definition.coefficient || 0) > 0) {
    emitSkillDamage(context, skill, {
      at,
      source: 'Minion',
      actorType: 'summon',
      coefficient: Number(definition.coefficient),
      metadata: {
        summonKind: 'minion',
        ...summonStrikeMetadata(context, minion)
      }
    });
  }

  if (definition.condition) {
    emitSkillCondition(context, skill, {
      at,
      source: 'Minion',
      actorType: 'summon',
      condition: String(definition.condition[0]),
      stacks: Number(definition.condition[1]),
      duration: Number(definition.condition[2])
    });
  }

  for (const condition of definition.conditions || []) {
    emitSkillCondition(context, skill, {
      at,
      source: 'Minion',
      actorType: 'summon',
      condition: String(condition[0]),
      stacks: Number(condition[1]),
      duration: Number(condition[2])
    });
  }

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
  const previousAnchor = Number(state.minionAttackAnchors[minion.key] || context.effectiveEnd);
  const previousOffset = Number(state.minionAttackCycleOffsets[minion.key] || 0);
  const completedSinceAnchor =
    context.effectiveEnd + context.epsilon >= previousAnchor
      ? Math.floor((context.effectiveEnd - previousAnchor + context.epsilon) / minion.interval) + 1
      : 0;
  const nextCycleIndex = previousOffset + completedSinceAnchor;
  state.minionAttackGenerations[minion.key] = Number(state.minionAttackGenerations[minion.key] || 0) + 1;
  if (skill.flipParentId == null) return;
  const summonSkill = context.catalog.skillsById.get(skill.flipParentId);
  if (!summonSkill) return;
  state.minionAttackAnchors[minion.key] = context.effectiveEnd + Number(minion.commandRecoveryDelay);
  state.minionAttackCycleOffsets[minion.key] = nextCycleIndex;
  queueSummonAttacks(context, summonSkill, minion, context.effectiveEnd, {
    initialDelay: minion.commandRecoveryDelay,
    controlUntil: context.effectiveEnd + Number(definition.controlWindow || 0),
    controlKind: definition.control,
    controlDuration: Number(definition.controlDuration || 0),
    initialCycleIndex: nextCycleIndex
  });
}

// Dispatch a command's timed or immediate effects, then reconcile minion counts,
// flip availability, autonomous attacks, and death-triggered summon recharge.
function minionCommand(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const definition = commandDefinitionFor(skill);
  if (!definition.minion) return false;
  restartMinionAttacks(context, skill, definition);
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
        const recharge = context.rechargeDurationFor(summon, context.effectiveEnd, { minionDeathRecharge: true });
        if (recharge > 0) {
          context.state.cooldowns.set(summon.id, context.effectiveEnd + recharge);
        }
      }
    }
  } else if (Number(professionCoreState(context).activeMinions[definition.minion] || 0) > 0) {
    professionCoreState(context).availableFlips[skill.id] = Number.POSITIVE_INFINITY;
  }

  emitStateSnapshot(
    context,
    'necromancer',
    context.effectiveEnd,
    'minion-command',
    snapshotNecromancerState(context.state.profession),
    { dedupeAcrossSourceIds: true }
  );
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
  const attack = skill.effects?.find((effect) => effect.type === 'strike' && effect.packetLabel === 'attack');
  const explosion = skill.effects?.find((effect) => effect.type === 'strike' && effect.packetLabel === 'explosion');
  for (let index = 0; index < Number(skill.summons || 0); index += 1) {
    const summonAt = start + index * Number(skill.summonInterval || 0);
    runCreatureSummonReactions(context, skill, summonAt);
    emitSkillDamage(context, skill, {
      at: summonAt + Number(attack?.atMs || 0) / 1000,
      name: String(attack?.name || 'Unstable Horror - Attack'),
      source: 'Minion',
      sourceId: `unstable-horror.${index}`,
      actorType: 'summon',
      coefficient: Number(attack?.coefficient || 0),
      metadata: { summonKind: 'minion' }
    });
    emitSkillDamage(context, skill, {
      at: summonAt + Number(explosion?.atMs || 0) / 1000,
      name: String(explosion?.name || 'Unstable Horror - Explosion'),
      source: 'Minion',
      sourceId: `unstable-horror.${index}`,
      actorType: 'summon',
      coefficient: Number(explosion?.coefficient || 0),
      metadata: { summonKind: 'minion' }
    });
  }

  return true;
}

export const necromancerMinionSkillHandlers = Object.freeze({
  'necromancer.minion': summonMinion,
  'necromancer.minion-command': minionCommand,
  'necromancer.summon-madness': summonMadness
});

export const necromancerMinionTaskHandlers = Object.freeze({
  [MINION_ATTACK_TASK]: handleMinionAttack,
  [MINION_ATTACK_STOP_TASK]: handleMinionAttackStop,
  [MINION_COMMAND_IMPACT_TASK]: handleMinionCommandImpact
});
