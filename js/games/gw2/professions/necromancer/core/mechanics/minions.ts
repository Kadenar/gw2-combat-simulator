import { NECROMANCER_MINION_PROFILE_BY_SKILL_ID } from '#gw2/professions/necromancer/core/profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { buildResolverStrike, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { quantizeGw2ActionDurationUp, summonQuicknessCastTimeMs } from '#gw2/platform/skills/timing.js';
import { denySkillCast } from '#gw2/professions/shared/availability.js';
import {
  runCreatureSummonReactions,
  necromancerCreatureStrikeMultiplier
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  commandDefinitionFor,
  minionDefinitionFor,
  minionDefinitionForSkill,
  summonWeaponStrength,
  type MinionAttack,
  type MinionDefinition
} from '#gw2/professions/necromancer/core/mechanics/minion-profiles.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

const ATTACK = 'necromancer.minion-attack';
const COMMAND = 'necromancer.minion-command-impact';
const HORROR_SPAWN = 'necromancer.horror-spawn';
const HORROR_EXPIRE = 'necromancer.horror-expire';
const owner = (key: string, generation: number) => ({ id: `minion:${key}`, generation });
const companion = (key: string, index: number) => `minion:${key}:${index}`;
const actionTime = (at: number) => quantizeGw2ActionDurationUp(at * 1000) / 1000;

interface MinionWork {
  skillId: SkillId;
  key: string;
  generation: number;
  attackGeneration: number;
  index: number;
  activationId: string;
  controlUntil?: number;
  controlKind?: string;
  attack?: MinionAttack;
  offTarget?: boolean;
  consumed?: boolean;
}

export function ownsNecromancerMinionSkill(skill: NecromancerSkill): boolean {
  return Boolean(
    NECROMANCER_MINION_PROFILE_BY_SKILL_ID[Number(skill.id)] || skill.minionKey || skill.id === ID.SUMMON_MADNESS
  );
}

interface HorrorWork {
  skillId: SkillId;
  activationId: string;
  index: number;
}

/** Each staggered horror has a unique lifetime; leaving Lich or casting again does not replace already-created creatures. */
function spawnHorror(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as HorrorWork;
  const skill = runtime.helpers.skillsById.get(work.skillId) as NecromancerSkill;
  const key = `unstable-horror:${work.activationId}:${work.index}`;
  const expiresAt = canonicalTime(runtime.time + Number(skill.summonDuration));
  runtime.profession.core.activeMinions[key] = 1;
  runCreatureSummonReactions(runtime, skill, runtime.time, 1, `${work.activationId}:horror:${work.index}`);
  runtime.schedule(HORROR_EXPIRE, expiresAt, key, undefined, -20);
  for (const effect of skill.effects ?? []) {
    if (effect.type !== 'strike') continue;
    const attribution = {
      source: 'Minion',
      sourceId: `unstable-horror.${work.index}`,
      actorType: 'summon' as const,
      skillId: skill.id,
      skillName: String(effect.name ?? `Unstable Horror - ${effect.packetLabel}`),
      parentSkillName: skill.name,
      activationId: `${work.activationId}:horror:${work.index}`,
      summonKind: 'minion',
      summonCount: 1,
      summonOwner: companion(key, 0),
      summonOwnerBase: `minion:${key}`
    };
    for (const { event } of materializeSkillEffectApplications({
      skill,
      effect,
      start: runtime.time,
      fullEnd: runtime.time,
      baseEvent: attribution
    })) {
      // The terminal explosion is allowed at expiry; profile ticks beyond this creature's lifetime cannot attack.
      if (canonicalTime(event.at) <= expiresAt) runtime.emit(event);
    }
  }
}

/** Active creatures own their commands and prevent death-gated summons from bypassing recharge. */
export function necromancerMinionAvailability(runtime: NecromancerRuntime, skill: NecromancerSkill) {
  const definition = Boolean(NECROMANCER_MINION_PROFILE_BY_SKILL_ID[Number(skill.id)])
    ? minionDefinitionForSkill(runtime, skill.id)
    : undefined;
  const active = runtime.profession.core.activeMinions;
  if (definition && skill.rechargeOnMinionDeath && active[definition.key] > 0)
    return denySkillCast(skill, 'necromancer.minion-active', 'its summoned minion is still alive.');
  if (Boolean(skill.minionKey) && !(active[String(skill.minionKey)] > 0))
    return denySkillCast(skill, 'necromancer.minion-inactive', 'its summoned minion is not alive.');
  return null;
}

function active(runtime: NecromancerRuntime, work: MinionWork): boolean {
  const state = runtime.profession.core;
  return (
    state.activeMinions[work.key] > work.index &&
    state.minionGenerations[work.key] === work.generation &&
    state.minionAttackGenerations[work.key] === work.attackGeneration
  );
}

/** Lifetime validation happens before packets enter the shared strike, condition, control, and combo paths. */
function emitAttack(
  runtime: NecromancerRuntime,
  work: MinionWork,
  skill: NecromancerSkill,
  definition: MinionDefinition,
  attack: MinionAttack
): void {
  const sourceId = attack.skillId ?? skill.id;
  const attribution = {
    at: runtime.time,
    source: 'Minion',
    sourceId,
    actorType: 'summon' as const,
    skillId: sourceId,
    skillName: attack.name,
    parentSkillName: attack.skillId ? skill.name : '',
    activationId: work.activationId,
    offTarget: work.offTarget,
    summonKind: 'minion',
    summonCount: 1,
    summonOwner: companion(work.key, work.index),
    summonOwnerBase: `minion:${work.key}`
  };
  if (Number(attack.coefficient) > 0)
    runtime.emit(
      buildResolverStrike({
        ...attribution,
        coefficient: Number(attack.coefficient),
        icon: attack.icon || skill.icon,
        comboFinishers: attack.comboFinishers,
        skillWeapon: 'Unequipped',
        canCrit: true,
        weaponStrength: attack.weaponStrength ?? definition.weaponStrength ?? summonWeaponStrength(runtime),
        summonBasePower: definition.basePower,
        summonDamagePerCoefficient: attack.damagePerCoefficient ?? definition.damagePerCoefficient,
        summonCriticalChance: definition.criticalChance,
        summonCriticalDamage: definition.criticalDamage,
        summonStrikeMultiplier:
          (hasTrait(runtime, TRAIT.NECROMANTIC_CORRUPTION) ? 1.25 : 1) * necromancerCreatureStrikeMultiplier(runtime),
        independentSummonStrike: true
      })
    );
  if (attack.condition)
    runtime.emit(
      buildResolverCondition({
        ...attribution,
        condition: String(attack.condition[0]),
        stacks: Number(attack.condition[1]),
        duration: Number(attack.condition[2])
      })
    );
  const controlKind =
    attack.controlKind || (runtime.time <= Number(work.controlUntil ?? -1) ? work.controlKind : undefined);
  if (controlKind) runtime.emit({ ...attribution, type: 'control', controlKind });
}

function replaceAttacks(runtime: NecromancerRuntime, key: string): void {
  const state = runtime.profession.core;
  runtime.cancelOwner(owner(key, state.minionAttackGenerations[key] ?? 0));
  state.minionAttackGenerations[key] = (state.minionAttackGenerations[key] ?? 0) + 1;
}

function scheduleAttack(runtime: NecromancerRuntime, at: number, work: MinionWork): void {
  runtime.schedule(ATTACK, actionTime(at), work, owner(work.key, work.attackGeneration));
}

/** Each creature advances only its executed cursor, so command pauses preserve the actual attack chain. */
function attack(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as MinionWork;
  if (!active(runtime, work) || runtime.deathTime != null) return;
  const skill = runtime.helpers.skillsById?.get(work.skillId) as NecromancerSkill | undefined;
  const definition = skill && minionDefinitionForSkill(runtime, skill.id);
  if (!skill || !definition) return;
  const cursor = runtime.profession.core.minionAttackCursors[companion(work.key, work.index)];
  const attacks =
    definition.alternateAttacks?.length &&
    Number(definition.alternateEvery) > 0 &&
    cursor.cycleIndex % Number(definition.alternateEvery) === 0
      ? definition.alternateAttacks
      : definition.attacks;
  const packet = attacks?.[cursor.attackIndex];
  if (!packet || !attacks) return;
  emitAttack(
    runtime,
    { ...work, activationId: `${work.activationId}:${cursor.cycleIndex}:${cursor.attackIndex}` },
    skill,
    definition,
    packet
  );
  cursor.attackIndex = (cursor.attackIndex + 1) % attacks.length;
  const interval =
    cursor.attackIndex === 0
      ? definition.interval - Number(packet.offset ?? 0)
      : Number(attacks[cursor.attackIndex].offset ?? 0) - Number(packet.offset ?? 0);
  cursor.cycleIndex += Number(cursor.attackIndex === 0);
  const quickness =
    runtime.config.sharePlayerBoonsWithSummons !== false &&
    runtime.query.timeline.buffStacksAt('quickness', runtime.time, 0, 1, 'summon', companion(work.key, work.index)) > 0;
  const castTimeMs = Number(packet.castTimeMs ?? 0);
  const saved = quickness ? castTimeMs - summonQuicknessCastTimeMs(null, castTimeMs) : 0;
  const next = actionTime(runtime.time + Math.max(0, interval - saved / 1000));
  if (next > runtime.time) scheduleAttack(runtime, next, work);
}

function commandImpact(runtime: NecromancerRuntime, data: unknown): void {
  const work = data as MinionWork;
  // Consuming commands commit their explosion before removing the creature; other delayed commands retain ownership.
  if (!work.consumed && !active(runtime, work)) return;
  const skill = runtime.helpers.skillsById?.get(work.skillId) as NecromancerSkill | undefined;
  const minion = skill && minionDefinitionFor(runtime, work.key);
  if (!skill || !minion) return;
  if (work.attack) return emitAttack(runtime, work, skill, minion, work.attack);
  const command = commandDefinitionFor(skill);
  emitAttack(runtime, work, skill, minion, {
    name: skill.name,
    coefficient: command.coefficient,
    controlKind: command.control === 'blind' ? undefined : command.control
  });
  const attribution = {
    at: runtime.time,
    source: 'Minion',
    sourceId: skill.id,
    actorType: 'summon' as const,
    skillId: skill.id,
    skillName: skill.name,
    activationId: work.activationId,
    offTarget: work.offTarget,
    summonKind: 'minion',
    summonCount: 1,
    summonOwner: companion(work.key, work.index),
    summonOwnerBase: `minion:${work.key}`
  };
  for (const condition of command.conditions ?? [])
    runtime.emit(
      buildResolverCondition({
        ...attribution,
        condition: String(condition[0]),
        stacks: Number(condition[1]),
        duration: Number(condition[2])
      })
    );
  if (command.control === 'blind') runtime.emit({ ...attribution, type: 'blind', duration: command.blindDuration });
}

/** Successful completion creates or commands the current generation; interrupted casts never acquire a creature. */
export function completeNecromancerMinion(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as NecromancerSkill;
  if (!ownsNecromancerMinionSkill(skill)) return;
  if (skill.id === ID.SUMMON_MADNESS) {
    for (let index = 0; index < Number(skill.summons); index++)
      runtime.schedule(HORROR_SPAWN, runtime.time + index * Number(skill.summonInterval), {
        skillId: skill.id,
        activationId: cast.id,
        index
      });
    return;
  }

  const state = runtime.profession.core;
  const definition = Boolean(NECROMANCER_MINION_PROFILE_BY_SKILL_ID[Number(skill.id)])
    ? minionDefinitionForSkill(runtime, skill.id)
    : minionDefinitionFor(runtime, String(skill.minionKey));
  if (!definition) return;
  const key = definition.key;
  if (Boolean(NECROMANCER_MINION_PROFILE_BY_SKILL_ID[Number(skill.id)])) {
    replaceAttacks(runtime, key);
    state.activeMinions[key] = definition.count;
    state.minionGenerations[key] = (state.minionGenerations[key] ?? 0) + 1;
    // Traits observe the concrete completed summon once, including each member of a multi-creature grant.
    runCreatureSummonReactions(runtime, skill, runtime.time, definition.count, cast.id);
    if (definition.commandId != null) armSkillFlip(state.availableFlips, definition.commandId, runtime.time);
    if (skill.rechargeOnMinionDeath) runtime.cooldownController.clear(skill.id);
    for (let index = 0; index < definition.count; index++) {
      state.minionAttackCursors[companion(key, index)] = { cycleIndex: 1, attackIndex: 0 };
      scheduleAttack(runtime, runtime.time + (definition.initialDelay ?? definition.interval), {
        skillId: skill.id,
        key,
        index,
        generation: state.minionGenerations[key],
        attackGeneration: state.minionAttackGenerations[key],
        activationId: `${cast.id}:${index}`
      });
    }

    return;
  }

  if (!(state.activeMinions[key] > 0)) return;
  const command = commandDefinitionFor(skill);
  const summon = skill.flipParentId == null ? undefined : runtime.helpers.skillsById?.get(skill.flipParentId);
  if (definition.commandRecoveryDelay != null && summon) {
    replaceAttacks(runtime, key);
    for (let index = 0; index < state.activeMinions[key]; index++)
      scheduleAttack(runtime, runtime.time + definition.commandRecoveryDelay, {
        skillId: summon.id,
        key,
        index,
        generation: state.minionGenerations[key],
        attackGeneration: state.minionAttackGenerations[key],
        activationId: `${cast.id}:resume:${index}`,
        controlUntil: runtime.time + Number(command.controlWindow ?? 0),
        controlKind: command.control
      });
  }

  const work: MinionWork = {
    skillId: skill.id,
    key,
    index: Number(command.consumes) > 0 ? state.activeMinions[key] - 1 : 0,
    generation: state.minionGenerations[key],
    attackGeneration: state.minionAttackGenerations[key],
    activationId: cast.id,
    offTarget: cast.command.offTarget,
    consumed: Number(command.consumes) > 0
  };
  const delay = Math.max(0, Number(cast.command.impactDelayMs ?? 0) / 1000);
  const queueCommand = (at: number, payload: MinionWork) =>
    runtime.schedule(COMMAND, at, payload, payload.consumed ? undefined : owner(key, payload.attackGeneration));
  if (command.attacks?.length) {
    for (const packet of command.attacks)
      for (let index = 0; index < state.activeMinions[key]; index++)
        queueCommand(runtime.time + Number(packet.offset ?? 0) + delay, { ...work, index, attack: packet });
  } else queueCommand(runtime.time + Number(command.impactDelay ?? 0) + delay, work);
  if (Number(command.consumes) > 0) {
    state.activeMinions[key] = Math.max(0, state.activeMinions[key] - Number(command.consumes));
    if (!state.activeMinions[key]) {
      delete state.activeMinions[key];
      consumeSkillFlip(state.availableFlips, skill.id);
      replaceAttacks(runtime, key);
      if (summon?.rechargeOnMinionDeath)
        runtime.cooldownController.startRecharge(summon, runtime.time, gw2BaseRecharge(summon));
    }
  }
}

export const necromancerMinionTasks = {
  [ATTACK]: attack,
  [COMMAND]: commandImpact,
  [HORROR_SPAWN]: spawnHorror,
  [HORROR_EXPIRE](runtime: NecromancerRuntime, key: unknown) {
    delete runtime.profession.core.activeMinions[String(key)];
  }
};
