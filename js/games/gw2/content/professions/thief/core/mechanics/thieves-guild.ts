import { emitThiefStateSnapshot } from '#gw2/content/professions/thief/state.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import type {
  ThiefCastContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  ThiefSkill,
  ThiefSummonAttack,
  ThiefSummonDefinition,
  ThiefSummonStrike
} from '#gw2/content/professions/thief/types.js';
import { thiefSpecializationGuildSummon } from '#gw2/content/professions/thief/thieves-guild.js';

interface ThievesGuildTaskPayload extends Record<string, unknown> {
  readonly attack: ThiefSummonStrike;
  readonly expiresAt: number;
  readonly profile: ThiefSummonAttack;
  readonly summon: ThiefSummonDefinition;
}

function thievesGuildSummons(context: ThiefSchedulerContext, profile: ThiefSummonAttack): ThiefSummonDefinition[] {
  const specializationSummon = thiefSpecializationGuildSummon(context.state.profession.specialization.kind);
  const coreSummon = profile.summons.find((summon) => summon.variant === 'Core Thief');
  const thirdSummon = specializationSummon || coreSummon;
  // Shared thieves come from the core elite profile; only the specialization-owned third summon is swapped.
  return [...profile.summons.filter((summon) => summon.variant == null), ...(thirdSummon ? [thirdSummon] : [])];
}

/** Starts the summoned thieves' rotations only after the player has entered combat. */
function startThievesGuildAttacks(context: ThiefSchedulerContext, at: number): void {
  const state = professionCoreState(context);
  const active = state.activeThievesGuild;
  if (!active || at >= active.expiresAt) return;
  const skill = context.catalog.skillsById.get(ID.THIEVES_GUILD) as ThiefSkill | undefined;
  const profile = skill?.summonAttack;
  if (!profile) return;
  for (const summon of thievesGuildSummons(context, profile)) {
    const attacks = summon.attacks?.length ? summon.attacks : profile.fallbackAttacks || [];
    for (const attack of attacks) {
      const attackAt = at + Number(attack.initialDelay || 0);
      if (attackAt >= active.expiresAt) continue;
      context.tasks.schedule({
        type: 'thief.thieves-guild-attack',
        at: attackAt,
        ownerId: 'thief.thieves-guild',
        payload: { attack, expiresAt: active.expiresAt, profile, summon }
      });
    }
  }
}

export function summonThievesGuild(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const profile = skill.summonAttack;
  if (!profile) return;
  const summons = thievesGuildSummons(context, profile);
  const expiresAt = context.start + Number(profile.duration || 0);
  state.activeThievesGuild = {
    variant: summons.at(-1)?.name || 'Core Thief',
    expiresAt
  };
  context.tasks.cancelOwner('thief.thieves-guild');
  context.tasks.schedule({
    type: 'thief.thieves-guild-expire',
    at: expiresAt,
    ownerId: 'thief.thieves-guild',
    payload: { expiresAt }
  });
  if (context.combatStartTime != null) startThievesGuildAttacks(context, at);

  emitThiefStateSnapshot(context, at, 'thieves-guild');
}

/** Wakes a precast Thieves Guild when the scheduler publishes its combat-start boundary. */
export function observeThievesGuildCombatEvent(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  if (event.type === 'combat_start') startThievesGuildAttacks(context, context.combatStartTime ?? event.at);
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
    emitThiefStateSnapshot(context, task.at, 'thieves-guild-expired');
  }
}
