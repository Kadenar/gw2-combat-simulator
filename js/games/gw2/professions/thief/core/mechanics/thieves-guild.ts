import { actorLoop, timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { emitThiefStateSnapshot, thiefSpecializationGuildSummon } from '#gw2/professions/thief/family-state.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { permanentTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type {
  ThiefCastContext,
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  ThiefSkill,
  ThiefSummonAttack,
  ThiefSummonDefinition,
  ThiefSummonStrike
} from '#gw2/professions/thief/types.js';

interface ThievesGuildAttackState {
  readonly attack: ThiefSummonStrike;
  readonly expiresAt: number;
  readonly profile: ThiefSummonAttack;
  readonly summon: ThiefSummonDefinition;
  readonly wellOfSorrowConditionsArePermanent: boolean;
}

const SPECTER_WELL_OF_SORROW = 67795;
const WELL_OF_SORROW_PRIORITY = Object.freeze(['Poisoned', 'Bleeding', 'Torment']);
const WELL_OF_SORROW_CONDITIONS = Object.freeze([
  Object.freeze({ condition: 'Poisoned', stacks: 1, duration: 3 }),
  Object.freeze({ condition: 'Bleeding', stacks: 2, duration: 4 }),
  Object.freeze({ condition: 'Torment', stacks: 2, duration: 4 }),
  Object.freeze({ condition: 'Torment', stacks: 1, duration: 4 })
]);

function thievesGuildSummons(context: ThiefSchedulerContext, profile: ThiefSummonAttack): ThiefSummonDefinition[] {
  const specializationSummon = thiefSpecializationGuildSummon(context.state.profession.specialization.kind);
  const coreSummon = profile.summons.find((summon) => summon.variant === 'Core Thief');
  const thirdSummon = specializationSummon || coreSummon;
  // Shared thieves come from the core elite profile; only the specialization-owned third summon is swapped.
  return [...profile.summons.filter((summon) => summon.variant == null), ...(thirdSummon ? [thirdSummon] : [])];
}

/** Starts the summoned thieves' rotations only after the player has entered combat. */
function activateThievesGuild(context: ThiefSchedulerContext, at: number): void {
  const state = professionCoreState(context);
  const active = state.activeThievesGuild;
  if (!active || active.started || at >= active.expiresAt) return;
  const skill = context.catalog.skillsById.get(ID.THIEVES_GUILD) as ThiefSkill | undefined;
  const profile = skill?.summonAttack;
  if (!profile) return;
  active.started = true;
  const wellOfSorrowConditionsArePermanent = WELL_OF_SORROW_PRIORITY.every(
    (condition) => permanentTargetConditionStacks(context.config, condition) > 0
  );
  for (const [summonIndex, summon] of thievesGuildSummons(context, profile).entries()) {
    const attacks = summon.attacks?.length ? summon.attacks : profile.fallbackAttacks || [];
    for (const [attackIndex, attack] of attacks.entries()) {
      const attackAt = at + Number(attack.initialDelay || 0);
      if (attackAt >= active.expiresAt) continue;
      // Every authored attack has its own stream; one thief's recovery never serializes the guild.
      guildActions.start(context, at, {
        key: `thief.thieves-guild:${summonIndex}:${attackIndex}`,
        firstAt: attackAt,
        ownerId: active.ownerId,
        state: { attack, expiresAt: active.expiresAt, profile, summon, wellOfSorrowConditionsArePermanent }
      });
    }
  }
}

/** Chooses each Well pulse from the target state at impact, skipping live lookups when all choices are permanent. */
function attackConditions(context: ThiefSchedulerContext, at: number, payload: ThievesGuildAttackState) {
  const { attack, wellOfSorrowConditionsArePermanent } = payload;
  if (attack.skillId !== SPECTER_WELL_OF_SORROW) return attack.conditions || [];
  if (wellOfSorrowConditionsArePermanent) return [WELL_OF_SORROW_CONDITIONS[3]];

  const policy = context.schedulerPolicy as Gw2SchedulerPolicy;
  const missingIndex = WELL_OF_SORROW_PRIORITY.findIndex((condition) => !policy.targetHasCondition(condition, at));
  return [WELL_OF_SORROW_CONDITIONS[missingIndex < 0 ? 3 : missingIndex]];
}

export function summonThievesGuild(context: ThiefCastContext, skill: ThiefSkill): void {
  // Cancelled summons must not create persistent allies or their scheduled attacks.
  if (context.action?.cancelled === true) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const profile = skill.summonAttack;
  if (!profile) return;
  const summons = thievesGuildSummons(context, profile);
  const expiresAt = context.start + Number(profile.duration || 0);
  if (state.activeThievesGuild) guildActions.stop(context, at, state.activeThievesGuild.ownerId);
  const ownerId = context.createActivationId('summon-attack');
  state.activeThievesGuild = {
    ownerId,
    variant: summons.at(-1)?.name || 'Core Thief',
    expiresAt,
    started: false
  };
  guildLifetime.start(context, {
    key: 'thief.thieves-guild',
    times: [expiresAt],
    captured: { ownerId }
  });
  if (context.combatStartTime != null) activateThievesGuild(context, at);

  emitThiefStateSnapshot(context, at, 'thieves-guild');
}

/** Wakes a precast Thieves Guild when the scheduler publishes its combat-start boundary. */
export function observeThievesGuildCombatEvent(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  if (event.type === 'combat_start') activateThievesGuild(context, context.combatStartTime ?? event.at);
}

function stepGuildAttack(
  context: ThiefSchedulerContext,
  at: number,
  payload: ThievesGuildAttackState
): { at: number; state: ThievesGuildAttackState } | null {
  if (at >= payload.expiresAt) return null;
  const { attack, profile, summon } = payload;
  const hits = Math.max(1, Number(attack.hits ?? 1));
  const summonName = `Thieves Guild \u2014 ${summon.name}`;
  const attackName = `${summonName} \u2014 ${attack.name}`;
  const damageBreakdownName = `${summon.displayName || summon.name} \u2014 ${attack.name}`;
  // Recurring summon attacks are separate activations; only the packets from
  // this attack share its sampled weapon strength and causal ownership.
  const activationId = context.createActivationId('summon-attack');
  emitSkillDamage(context, {
    at: at,
    source: 'thief',
    sourceId: 'thief.thieves-guild',
    actorType: 'summon',
    skillId: attack.skillId ?? ID.THIEVES_GUILD,
    skillName: summonName,
    parentSkillName: 'Thieves Guild',
    damageBreakdownName,
    name: attackName,
    coefficient: Number(attack.coefficientPerHit || 0) * hits,
    hits,
    hitIndex: 1,
    totalHits: hits,
    skillWeapon: summon.weapon,
    weaponStrengthProfileId: summon.weaponStrengthProfileId,
    independentSummonStrike: true,
    summonBasePower: Number(profile.basePower),
    summonCriticalChance: Number(profile.criticalChance),
    summonCriticalDamage: Number(profile.criticalDamage),
    summonIgnoresBoons: true,
    summonUsesEquipmentModifiers: false,
    activationId
  });
  for (const condition of attackConditions(context, at, payload)) {
    emitSkillCondition(context, {
      at: at,
      sourceId: 'thief.thieves-guild',
      actorType: 'summon',
      skillId: attack.skillId ?? ID.THIEVES_GUILD,
      skillName: summonName,
      parentSkillName: 'Thieves Guild',
      damageBreakdownName,
      name: `${attackName} \u2014 ${condition.condition}`,
      condition: condition.condition,
      stacks: Number(condition.stacks ?? 1),
      duration: Number(condition.duration || 0),
      summonInheritsAttributes: true,
      summonIgnoresBoons: true,
      summonUsesEquipmentModifiers: false,
      activationId
    });
  }

  const interval = Number(attack.interval || 0);
  const nextAt = at + interval;
  return interval > 0 && nextAt < payload.expiresAt ? { at: nextAt, state: payload } : null;
}

// Shared lifetimes retire every parallel stream and publish the guild's expiry together.
const guildActions = actorLoop({ id: 'thief.thieves-guild-actions', step: stepGuildAttack });
const guildLifetime = timedEffect({
  id: 'thief.thieves-guild-lifetime',
  effectsAt(context: ThiefSchedulerContext, at: number, captured: { ownerId: string }) {
    guildActions.stop(context, at, captured.ownerId);
    const state = professionCoreState(context);
    if (state.activeThievesGuild && state.activeThievesGuild.expiresAt <= at) {
      state.activeThievesGuild = null;
      emitThiefStateSnapshot(context, at, 'thieves-guild-expired');
    }
  }
});

export const thievesGuildTaskHandlers = Object.freeze({
  ...guildActions.taskHandlers,
  ...guildLifetime.taskHandlers
});
