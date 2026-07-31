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

export function summonThievesGuild(context, skill) {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const variant = state.thievesGuildVariant || "Core Thief";
  const attack = skill.summonAttack;
  state.activeThievesGuild = {
    variant,
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
      variant,
    },
  });
  emitThiefState(context, at, "thieves-guild");
}

export function handleThievesGuildAttack(context, task) {
  if (task.at > Number(task.payload.expiresAt || 0)) return;
  const attack = task.payload.attack || {};
  context.emit({
    type: "damage",
    at: task.at,
    source: "thief",
    sourceId: "thief.thieves-guild",
    actorType: "summon",
    skillName: `Thieves Guild — ${task.payload.variant}`,
    name: `Thieves Guild — ${task.payload.variant}`,
    coefficient: Number(attack.coefficient || 0),
    hits: Number(attack.hits || 1),
    hitIndex: 1,
    totalHits: Number(attack.hits || 1),
    skillWeapon: "Unequipped",
  });
  context.tasks.schedule({
    ...task,
    at: task.at + Number(attack.interval || 1),
  });
}

export function swapThiefWeapons(context, skill) {
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

export function kneel(context) {
  professionCoreState(context).kneeling = true;
  emitThiefState(context, context.effectiveEnd, "kneel");
}

export function stand(context) {
  professionCoreState(context).kneeling = false;
  emitThiefState(context, context.effectiveEnd, "stand");
}

export function activateAssassinsSignet(context) {
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

