import { emitSkillCondition, emitSkillDamage } from '../../../platform/gw2/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { snapshotThiefState } from './state.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { gainThiefInitiative } from './shared.js';
import type {
  ThiefCastContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSkill,
  ThiefSummonAttack,
  ThiefSummonDefinition,
  ThiefSummonStrike
} from '../types.js';
import { thiefBalanceProfile, THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { thiefSpecializationGuildSummon } from '../thieves-guild.js';

interface ThievesGuildTaskPayload extends Record<string, unknown> {
  readonly attack: ThiefSummonStrike;
  readonly expiresAt: number;
  readonly profile: ThiefSummonAttack;
  readonly summon: ThiefSummonDefinition;
}

export function summonThievesGuild(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const profile = skill.summonAttack;
  if (!profile) return;
  const specializationSummon = thiefSpecializationGuildSummon(context.state.profession.specialization.kind);
  const coreSummon = profile.summons.find((summon) => summon.variant === 'Core Thief');
  const thirdSummon = specializationSummon || coreSummon;
  // Shared thieves come from the core elite profile; only the specialization-owned third summon is swapped.
  const summons = [
    ...profile.summons.filter((summon) => summon.variant == null),
    ...(thirdSummon ? [thirdSummon] : [])
  ];
  const expiresAt = context.start + Number(profile.duration || 0);
  state.activeThievesGuild = {
    variant: thirdSummon?.name || 'Core Thief',
    expiresAt
  };
  context.tasks.cancelOwner('thief.thieves-guild');
  context.tasks.schedule({
    type: 'thief.thieves-guild-expire',
    at: expiresAt,
    ownerId: 'thief.thieves-guild',
    payload: { expiresAt }
  });
  for (const summon of summons) {
    const attacks = summon.attacks?.length ? summon.attacks : profile.fallbackAttacks || [];
    for (const attack of attacks) {
      const attackAt = at + Number(attack.initialDelay || 0);
      if (attackAt >= expiresAt) continue;
      context.tasks.schedule({
        type: 'thief.thieves-guild-attack',
        at: attackAt,
        ownerId: 'thief.thieves-guild',
        payload: { attack, expiresAt, profile, summon }
      });
    }
  }

  emitStateSnapshot(context, 'thief', at, 'thieves-guild', snapshotThiefState(context.state.profession));
}

export function handleThievesGuildAttack(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<ThievesGuildTaskPayload>
): void {
  if (task.at > Number(task.payload.expiresAt || 0)) return;
  const { attack, profile, summon } = task.payload;
  const hits = Math.max(1, Number(attack.hits || 1));
  const summonName = `Thieves Guild \u2014 ${summon.name}`;
  const attackName = `${summonName} \u2014 ${attack.name}`;
  const damageBreakdownName = `${summon.displayName || summon.name} \u2014 ${attack.name}`;
  // Recurring summon attacks are separate activations; only the packets from
  // this attack share its sampled weapon strength and causal ownership.
  const activationId = context.createActivationId('summon-attack');
  emitSkillDamage(context, {
    at: task.at,
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
  for (const condition of attack.conditions || []) {
    emitSkillCondition(context, {
      at: task.at,
      source: 'thief',
      sourceId: 'thief.thieves-guild',
      actorType: 'summon',
      skillId: attack.skillId ?? ID.THIEVES_GUILD,
      skillName: summonName,
      parentSkillName: 'Thieves Guild',
      damageBreakdownName,
      name: `${attackName} \u2014 ${condition.condition}`,
      condition: condition.condition,
      stacks: Number(condition.stacks || 1),
      duration: Number(condition.duration || 0),
      summonInheritsAttributes: true,
      summonIgnoresBoons: true,
      summonUsesEquipmentModifiers: false,
      activationId
    });
  }

  const interval = Number(attack.interval || 0);
  const nextAt = task.at + interval;
  if (interval > 0 && nextAt < Number(task.payload.expiresAt || 0)) {
    context.tasks.schedule({ ...task, at: nextAt });
  }
}

export function expireThievesGuild(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<Record<string, unknown>>
): void {
  const state = professionCoreState(context);
  if (state.activeThievesGuild && Number(state.activeThievesGuild.expiresAt) <= task.at) {
    state.activeThievesGuild = null;
    emitStateSnapshot(context, 'thief', task.at, 'thieves-guild-expired', snapshotThiefState(context.state.profession));
  }
}

/** Applies Thief-only stance cleanup and Quick Pockets after the shared swap. */
export function applyThiefWeaponSwapEffects(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.kneeling = false;
  emitStateSnapshot(context, 'thief', at, 'stand', snapshotThiefState(context.state.profession));
  const inCombat =
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null && at + Number(context.epsilon || 0.0001) >= Number(context.combatStartTime));
  if (
    inCombat &&
    hasTrait(context.config, TRAIT.QUICK_POCKETS) &&
    at + Number(context.epsilon || 0.0001) >= Number(state.quickPocketsReadyAt || 0)
  ) {
    const profile = thiefBalanceProfile(context, PROFILE.quickPockets);
    state.quickPocketsReadyAt = at + Number(profile?.internalCooldown || 8);
    gainThiefInitiative(context, Number(profile?.resourceGain || 3), at, 'quick-pockets');
  }
}

export function kneel(context: ThiefCastContext): void {
  professionCoreState(context).kneeling = true;
  emitStateSnapshot(context, 'thief', context.effectiveEnd, 'kneel', snapshotThiefState(context.state.profession));
}

export function stand(context: ThiefCastContext): void {
  professionCoreState(context).kneeling = false;
  emitStateSnapshot(context, 'thief', context.effectiveEnd, 'stand', snapshotThiefState(context.state.profession));
}

export function activateAssassinsSignet(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.assassinsSignetActiveUntil =
    at + Number(thiefBalanceProfile(context, PROFILE.assassinsSignet)?.durationMultiplier || 5);
  state.assassinsSignetPassiveDisabledUntil = Number(
    context.rechargeReadyAt || context.state.cooldowns.get(ID.ASSASSINS_SIGNET) || at
  );
  emitStateSnapshot(context, 'thief', at, 'assassins-signet', snapshotThiefState(context.state.profession));
}
