import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../state.js";
import {
  emitThiefShroudSwap,
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";

export function summonThievesGuild(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const variant = {
    Daredevil: "Daredevil",
    Deadeye: "Deadeye",
    Specter: "Specter",
    Antiquary: "Skritt",
  }[context.config.specialization] || "Core Thief";
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
  const state = context.state.profession;
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
  if (hasThiefTrait(context.config, TRAIT.QUICK_POCKETS)) {
    gainThiefInitiative(context, 3, at, "quick-pockets");
  }
}

export function kneel(context) {
  context.state.profession.kneeling = true;
  emitThiefState(context, context.effectiveEnd, "kneel");
}

export function stand(context) {
  context.state.profession.kneeling = false;
  emitThiefState(context, context.effectiveEnd, "stand");
}

export function enterShadowShroud(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.shadowShroudActive = true;
  state.shadowForceUpdatedAt = at;
  emitThiefShroudSwap(context, skill, at);
  emitThiefState(context, at, "enter-shadow-shroud");
}

export function exitShadowShroud(context, skill) {
  const at = context.effectiveEnd;
  context.state.profession.shadowShroudActive = false;
  emitThiefShroudSwap(context, skill, at);
  emitThiefState(context, at, "exit-shadow-shroud");
}
