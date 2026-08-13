import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import { emitThiefState, gainThiefInitiative } from "./shared.js";
import type {
  ThiefCastContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSkill,
  ThiefSummonAttack,
  ThiefSummonDefinition,
  ThiefSummonStrike,
} from "../types.js";

interface ThievesGuildTaskPayload extends Record<string, unknown> {
  readonly attack: ThiefSummonStrike;
  readonly expiresAt: number;
  readonly profile: ThiefSummonAttack;
  readonly summon: ThiefSummonDefinition;
}

function thievesGuildSummons(
  profile: ThiefSummonAttack,
  variant: string,
): readonly ThiefSummonDefinition[] {
  return profile.summons.filter(
    (summon) => summon.variant == null || summon.variant === variant,
  );
}

export function summonThievesGuild(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const variant = state.thievesGuildVariant || "Core Thief";
  const profile = skill.summonAttack;
  if (!profile) return;
  const summons = thievesGuildSummons(profile, variant);
  const expiresAt = context.start + Number(profile.duration || 0);
  state.activeThievesGuild = {
    variant: summons.find((summon) => summon.variant != null)?.name || variant,
    expiresAt,
  };
  context.tasks.cancelOwner("thief.thieves-guild");
  context.tasks.schedule({
    type: "thief.thieves-guild-expire",
    at: expiresAt,
    ownerId: "thief.thieves-guild",
    payload: { expiresAt },
  });
  for (const summon of summons) {
    const attacks = summon.attacks?.length
      ? summon.attacks
      : profile.fallbackAttacks || [];
    for (const attack of attacks) {
      const attackAt = at + Number(attack.initialDelay || 0);
      if (attackAt >= expiresAt) continue;
      context.tasks.schedule({
        type: "thief.thieves-guild-attack",
        at: attackAt,
        ownerId: "thief.thieves-guild",
        payload: { attack, expiresAt, profile, summon },
      });
    }
  }
  emitThiefState(context, at, "thieves-guild");
}

export function handleThievesGuildAttack(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<ThievesGuildTaskPayload>,
): void {
  if (task.at > Number(task.payload.expiresAt || 0)) return;
  const { attack, profile, summon } = task.payload;
  const hits = Math.max(1, Number(attack.hits || 1));
  const summonName = `Thieves Guild \u2014 ${summon.name}`;
  const attackName = `${summonName} \u2014 ${attack.name}`;
  const damageBreakdownName = `${summon.displayName || summon.name} \u2014 ${attack.name}`;
  context.emit({
    type: "damage",
    at: task.at,
    source: "thief",
    sourceId: "thief.thieves-guild",
    actorType: "summon",
    skillId: attack.skillId ?? ID.THIEVES_GUILD,
    skillName: summonName,
    parentSkillName: "Thieves Guild",
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
  });
  for (const condition of attack.conditions || []) {
    context.emit({
      type: "condition",
      at: task.at,
      source: "thief",
      sourceId: "thief.thieves-guild",
      actorType: "summon",
      skillId: attack.skillId ?? ID.THIEVES_GUILD,
      skillName: summonName,
      parentSkillName: "Thieves Guild",
      damageBreakdownName,
      name: `${attackName} \u2014 ${condition.condition}`,
      condition: condition.condition,
      stacks: Number(condition.stacks || 1),
      duration: Number(condition.duration || 0),
      summonInheritsAttributes: true,
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
  task: ThiefScheduledTask<Record<string, unknown>>,
): void {
  const state = professionCoreState(context);
  if (
    state.activeThievesGuild &&
    Number(state.activeThievesGuild.expiresAt) <= task.at
  ) {
    state.activeThievesGuild = null;
    emitThiefState(context, task.at, "thieves-guild-expired");
  }
}

export function swapThiefWeapons(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  context.state.activeWeaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.emit({
    type: "weapon_set",
    at,
    source: "thief",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
  state.kneeling = false;
  state.autoattackChains = {};
  emitThiefState(context, at, "stand");
  const inCombat =
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null &&
      at + Number(context.epsilon || 0.0001) >=
        Number(context.combatStartTime));
  if (
    inCombat &&
    hasThiefTrait(context.config, TRAIT.QUICK_POCKETS) &&
    at + Number(context.epsilon || 0.0001) >=
      Number(state.quickPocketsReadyAt || 0)
  ) {
    state.quickPocketsReadyAt = at + 8;
    gainThiefInitiative(context, 3, at, "quick-pockets");
  }
}

export function kneel(context: ThiefCastContext): void {
  professionCoreState(context).kneeling = true;
  emitThiefState(context, context.effectiveEnd, "kneel");
}

export function stand(context: ThiefCastContext): void {
  professionCoreState(context).kneeling = false;
  emitThiefState(context, context.effectiveEnd, "stand");
}

export function activateAssassinsSignet(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.assassinsSignetActiveUntil = at + 5;
  state.assassinsSignetPassiveDisabledUntil = Number(
    context.rechargeReadyAt ||
      context.state.cooldowns.get(ID.ASSASSINS_SIGNET) ||
      at,
  );
  emitThiefState(context, at, "assassins-signet");
}
