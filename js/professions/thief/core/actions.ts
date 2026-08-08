import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import {
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";
import type {
  ThiefCastContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSkill,
  ThiefSummonAttack,
} from "../types.js";

interface ThievesGuildTaskPayload extends Record<string, unknown> {
  readonly attack: ThiefSummonAttack;
  readonly expiresAt: number;
  readonly summons: readonly ThievesGuildSummon[];
}

interface ThievesGuildSummon extends Record<string, unknown> {
  readonly name: string;
  readonly weapon: string;
}

function thievesGuildSummons(variant: string): readonly ThievesGuildSummon[] {
  const specialized = variant === "Daredevil"
    ? { name: "Staff Daredevil", weapon: "Staff" }
    : variant === "Deadeye"
      ? { name: "Rifle Deadeye", weapon: "Rifle" }
      : variant === "Specter"
        ? { name: "Scepter Specter", weapon: "Scepter" }
        : variant === "Skritt"
          ? { name: "Sword/Dagger Skritt", weapon: "Sword" }
          : { name: "Sword Thief", weapon: "Sword" };
  return [
    { name: "Male Dual-Pistol Thief", weapon: "Pistol" },
    { name: "Female Dual-Dagger Thief", weapon: "Dagger" },
    specialized,
  ];
}

export function summonThievesGuild(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const variant = state.thievesGuildVariant || "Core Thief";
  const summons = thievesGuildSummons(variant);
  const attack = skill.summonAttack || {};
  state.activeThievesGuild = {
    variant: summons[2].name,
    expiresAt: at + Number(attack.duration || 0),
  };
  context.tasks.cancelOwner("thief.thieves-guild");
  context.tasks.schedule({
    type: "thief.thieves-guild-attack",
    at: at + Number(attack.interval || 1),
    ownerId: "thief.thieves-guild",
    payload: {
      attack,
      expiresAt: at + Number(attack.duration || 0),
      summons,
    },
  });
  emitThiefState(context, at, "thieves-guild");
}

export function handleThievesGuildAttack(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<ThievesGuildTaskPayload>,
): void {
  if (task.at > Number(task.payload.expiresAt || 0)) return;
  const attack = task.payload.attack || {};
  for (const summon of task.payload.summons) {
    context.emit({
      type: "damage",
      at: task.at,
      source: "thief",
      sourceId: "thief.thieves-guild",
      actorType: "summon",
      skillName: `Thieves Guild — ${summon.name}`,
      name: `Thieves Guild — ${summon.name}`,
      coefficient: Number(attack.coefficient || 0),
      hits: Number(attack.hits || 1),
      hitIndex: 1,
      totalHits: Number(attack.hits || 1),
      skillWeapon: summon.weapon,
    });
  }
  const nextAt = task.at + Number(attack.interval || 1);
  if (nextAt > Number(task.payload.expiresAt || 0)) {
    professionCoreState(context).activeThievesGuild = null;
    emitThiefState(context, task.at, "thieves-guild-expired");
    return;
  }
  context.tasks.schedule({
    ...task,
    at: nextAt,
  });
}

export function swapThiefWeapons(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  context.state.activeWeaponSet =
    context.state.activeWeaponSet === 1 ? 2 : 1;
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
  emitThiefState(context, at, "stand");
  const inCombat =
    !context.hasExplicitCombatStart
    || (
      context.combatStartTime != null
      && at + Number(context.epsilon || 0.0001)
        >= Number(context.combatStartTime)
    );
  if (
    inCombat
    && hasThiefTrait(context.config, TRAIT.QUICK_POCKETS)
    && at + Number(context.epsilon || 0.0001)
      >= Number(state.quickPocketsReadyAt || 0)
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
    context.rechargeReadyAt
    || context.state.cooldowns.get(ID.ASSASSINS_SIGNET)
    || at,
  );
  emitThiefState(context, at, "assassins-signet");
}

