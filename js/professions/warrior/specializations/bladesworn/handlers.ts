import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../../platform/engine/skill-handlers.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  DRAGON_CHARGE_INTERVAL_SECONDS,
  DRAGON_TRIGGER_CHANNEL_SECONDS,
  dragonFlowPerInterval,
  maximumDragonCharges,
} from "./dragon-trigger.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import { bladeswornState } from "./state.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../../types.js";

function emitGunsaberSwapTrait(context: WarriorCastContext, at: number): void {
  const state = bladeswornState.from(context);
  if (at + context.epsilon < state.gunsaberSwapTraitReadyAt) return;
  let traitId = 0;
  if (hasTrait(context, TRAIT.UNSEEN_SWORD)) {
    traitId = TRAIT.UNSEEN_SWORD;
    context.emit({
      type: "damage",
      at,
      source: "Trait",
      sourceId: traitId,
      actorType: "player",
      skillId: ID.UNSHEATHE_GUNSABER,
      skillName: "Unsheathe Gunsaber",
      name: "Unseen Sword",
      coefficient: 1.2,
    });
  } else if (hasTrait(context, TRAIT.SHARP_AS_THE_WIND)) {
    traitId = TRAIT.SHARP_AS_THE_WIND;
    context.emit({
      type: "condition",
      at,
      source: "Trait",
      sourceId: traitId,
      actorType: "effect",
      skillId: ID.UNSHEATHE_GUNSABER,
      skillName: "Unsheathe Gunsaber",
      name: "Sharp as the Wind — Burning",
      condition: "Burning",
      stacks: 1,
      duration: 3,
    });
  } else if (hasTrait(context, TRAIT.RIVERS_FLOW)) {
    traitId = TRAIT.RIVERS_FLOW;
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: traitId,
      actorType: "effect",
      skillId: ID.UNSHEATHE_GUNSABER,
      skillName: "Unsheathe Gunsaber",
      name: "River's Flow — Might",
      kind: "might",
      boon: "might",
      stacks: 2,
      duration: 8,
      recipients: "party",
    });
  }
  if (!traitId) return;
  state.gunsaberSwapTraitReadyAt = at + 4;
  state.traitPositiveFlowUntil = at + 5;
  context.emit({
    type: "buff",
    at,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillId: ID.UNSHEATHE_GUNSABER,
    skillName: "Unsheathe Gunsaber",
    name: "Positive Flow",
    kind: "positive-flow",
    stacks: 1,
    duration: 5,
  });
}

function enterGunsaber(context: WarriorCastContext): void {
  bladeswornState.from(context).gunsaberActive = true;
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
    professionCoreState(context).soldierFocusReadyAt = context.effectiveEnd;
  }
  emitGunsaberSwapTrait(context, context.effectiveEnd);
}

function exitGunsaber(context: WarriorCastContext): void {
  bladeswornState.from(context).gunsaberActive = false;
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
    professionCoreState(context).soldierFocusReadyAt = context.effectiveEnd;
  }
}

function enterDragonTrigger(context: WarriorCastContext): void {
  const state = bladeswornState.from(context);
  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = context.effectiveEnd;
  state.dragonTriggerChargeDeadline =
    context.effectiveEnd + DRAGON_TRIGGER_CHANNEL_SECONDS;
  state.flowUpdatedAt = context.start;
  state.nextDragonChargeAt =
    context.effectiveEnd + DRAGON_CHARGE_INTERVAL_SECONDS;
  state.dragonCharges = 0;
  state.dragonChargesPerInterval =
    state.tacticalReloadUntil + context.epsilon >= context.effectiveEnd ? 2 : 1;
  if (state.dragonChargesPerInterval > 1) state.tacticalReloadUntil = 0;
  if (hasTrait(context, TRAIT.DRAGONSCALE_DEFENSE)) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.DRAGONSCALE_DEFENSE,
      actorType: "effect",
      skillId: ID.DRAGON_TRIGGER,
      skillName: "Dragon Trigger",
      name: "Dragonscale Defense",
      kind: "stability",
      boon: "stability",
      stacks: 1,
      duration: 3,
    });
  }
}

function useDragonSlash(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = bladeswornState.from(context);
  const maximumCharges = maximumDragonCharges(context);
  const charges = Math.max(1, Math.min(maximumCharges, state.dragonCharges));
  const minimum = Number(skill.dragonSlashMinimumCoefficient || 0);
  const maximum = Number(skill.dragonSlashMaximumCoefficient || minimum);
  const coefficient =
    maximumCharges <= 1
      ? maximum
      : minimum + (maximum - minimum) * ((charges - 1) / (maximumCharges - 1));
  state.dragonChargesSpentByActivation[context.reservationId] = charges;
  context.emit({
    type: "damage",
    at: context.effectiveEnd,
    skillId: skill.id,
    sourceId: skill.id,
    skillName: skill.name,
    source: "Warrior",
    actorType: "player",
    coefficient,
    skillWeapon: "Gunsaber",
    damageKind: "explosion",
    dragonChargesSpent: charges,
  });
  if (hasTrait(context, TRAIT.UNYIELDING_DRAGON)) {
    context.emit({
      type: "control",
      at: context.effectiveEnd,
      skillId: skill.id,
      sourceId: TRAIT.UNYIELDING_DRAGON,
      skillName: skill.name,
      source: "Trait",
      actorType: "player",
      controlKind: "stun",
      duration: 1,
    });
  }
  if (hasTrait(context, TRAIT.DARING_DRAGON)) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.DARING_DRAGON,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Daring Dragon — Alacrity",
      kind: "alacrity",
      boon: "alacrity",
      stacks: 1,
      duration: 10,
      recipients: "party",
    });
  }
  state.dragonTriggerActive = false;
  state.dragonTriggerStartedAt = 0;
  state.dragonTriggerChargeDeadline = 0;
  state.nextDragonChargeAt = 0;
  state.dragonCharges = 0;
  state.dragonChargesPerInterval = 1;
}

function useArtillerySlash(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const charges = Math.max(1, Number(context.ammo?.charges || 1));
  const state = bladeswornState.from(context);
  state.ammoRoundsSpentByActivation[context.reservationId] = charges;
  state.ammoStartedFullByActivation[context.reservationId] =
    charges >= Number(context.ammo?.maximum || skill.ammo || 0);
  if (context.ammo && context.ammo.charges > 1) context.ammo.charges = 1;
  context.replaceEvent(context.action, {
    rechargeReadyAt:
      context.rechargeStart +
      Math.max(context.rechargeDuration, context.ammoLockoutDuration),
  });
  context.emit({
    type: "damage",
    at: context.effectiveEnd,
    skillId: skill.id,
    sourceId: skill.id,
    skillName: skill.name,
    source: "Warrior",
    actorType: "player",
    coefficient: charges >= 2 ? 3 : 2,
    skillWeapon: "Gunsaber",
    damageKind: "explosion",
  });
  context.emit({
    type: "control",
    at: context.effectiveEnd,
    skillId: skill.id,
    sourceId: skill.id,
    skillName: skill.name,
    source: "Warrior",
    actorType: "player",
    controlKind: "daze",
  });
}

export const bladeswornSkillHandlers = Object.freeze({
  "warrior.gunsaber-enter": augmentSkillHandler(enterGunsaber),
  "warrior.gunsaber-exit": augmentSkillHandler(exitGunsaber),
  "warrior.dragon-trigger": augmentSkillHandler(enterDragonTrigger),
  "warrior.dragon-slash": replaceSkillHandler(useDragonSlash),
  "warrior.artillery-slash": replaceSkillHandler(useArtillerySlash),
});

const BASE_FLOW_PER_SECOND = 2;
const FLOW_STABILIZER_BONUS_PER_SECOND = 4;
const TRAIT_POSITIVE_FLOW_BONUS_PER_SECOND = 2;

function combatActiveDuration(
  context: WarriorSchedulerContext,
  from: number,
  to: number,
): number {
  if (!(to > from)) return 0;
  if (!context.hasExplicitCombatStart) return to - from;
  if (context.combatStartTime == null) return 0;
  return Math.max(0, to - Math.max(from, Number(context.combatStartTime)));
}

function gainPassiveFlow(
  context: WarriorSchedulerContext,
  from: number,
  to: number,
): void {
  const state = bladeswornState.from(context);
  const combatDuration = combatActiveDuration(context, from, to);
  if (!(combatDuration > 0)) return;
  const combatStart = context.hasExplicitCombatStart
    ? Number(context.combatStartTime)
    : from;
  const bonusFrom = Math.max(from, combatStart);
  const bonusDuration = Math.max(
    0,
    Math.min(to, state.flowStabilizerUntil) - bonusFrom,
  );
  const traitBonusDuration = Math.max(
    0,
    Math.min(to, state.traitPositiveFlowUntil) - bonusFrom,
  );
  state.flow = Math.min(
    state.maximumFlow,
    state.flow +
      combatDuration * BASE_FLOW_PER_SECOND +
      bonusDuration * FLOW_STABILIZER_BONUS_PER_SECOND +
      traitBonusDuration * TRAIT_POSITIVE_FLOW_BONUS_PER_SECOND,
  );
}

export function advanceBladesworn(
  context: WarriorSchedulerContext,
  target: number,
): void {
  const state = bladeswornState.from(context);
  if (target <= state.flowUpdatedAt) return;
  if (!state.dragonTriggerActive) {
    gainPassiveFlow(context, state.flowUpdatedAt, target);
    state.flowUpdatedAt = target;
    return;
  }
  const maximumCharges = maximumDragonCharges(context);
  const flowPerInterval = dragonFlowPerInterval(context);
  const chargeThrough = Math.min(target, state.dragonTriggerChargeDeadline);
  while (
    state.nextDragonChargeAt <= chargeThrough + context.epsilon &&
    state.nextDragonChargeAt > 0
  ) {
    gainPassiveFlow(context, state.flowUpdatedAt, state.nextDragonChargeAt);
    state.flowUpdatedAt = state.nextDragonChargeAt;
    if (
      state.flow + context.epsilon >= flowPerInterval &&
      state.dragonCharges < maximumCharges
    ) {
      state.flow = Math.max(0, state.flow - flowPerInterval);
      state.dragonCharges = Math.min(
        maximumCharges,
        state.dragonCharges + state.dragonChargesPerInterval,
      );
    }
    state.nextDragonChargeAt += DRAGON_CHARGE_INTERVAL_SECONDS;
  }
  gainPassiveFlow(context, state.flowUpdatedAt, target);
  state.flowUpdatedAt = target;
}

function restoreAmmo(
  context: WarriorCastContext,
  skill: WarriorSkill,
  count: number,
  at: number,
): number {
  const ammo = context.cooldownController.refreshAmmo(skill, at);
  if (!ammo) return 0;
  const restored = Math.min(
    Math.max(0, count),
    Math.max(0, ammo.maximum - ammo.charges),
  );
  if (!restored) return 0;

  const mirroredRecharge = ammo.nextRechargeAt;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  const lastAction = [...context.events]
    .reverse()
    .find((event) => event.type === "action" && event.skillId === skill.id);
  const lastActionEnd = Number(lastAction?.endsAt || 0);
  const lockoutReadyAt =
    lastActionEnd +
    context.rechargeDurationFor(skill, lastActionEnd, {
      ammoCastLockout: true,
    });
  if (
    ammo.charges === 0 &&
    mirroredRecharge != null &&
    readyAt <= mirroredRecharge + context.epsilon
  ) {
    context.state.cooldowns.delete(skill.id);
  }
  ammo.charges += restored;
  if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
  context.cooldownController.refreshAmmo(skill, at);
  if (lockoutReadyAt > at + context.epsilon) {
    context.state.cooldowns.set(skill.id, lockoutReadyAt);
  }
  return restored;
}

function reloadBladeswornAmmo(context: WarriorCastContext, at: number): void {
  for (const skillId of context.state.ammo.keys()) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill?.specialization === "Bladesworn") {
      restoreAmmo(context, skill, 1, at);
    }
  }
}

function activateOverchargedCartridges(
  context: WarriorCastContext,
  at: number,
): void {
  const state = bladeswornState.from(context);
  const active = activeCartridgeWindow(state, at);
  if (active) active.expiresAt = at;
  const supercharged = Boolean(active);
  state.overchargedCartridgeWindows.push({
    startedAt: at,
    expiresAt: at + 8,
    damageBonus: supercharged ? 0.2 : 0.15,
    burningDuration: supercharged ? 5 : 3,
    supercharged,
  });
  context.emit({
    type: "buff",
    at,
    source: "Warrior",
    sourceId: ID.OVERCHARGED_CARTRIDGES,
    actorType: "player",
    skillId: ID.OVERCHARGED_CARTRIDGES,
    skillName: "Overcharged Cartridges",
    name: supercharged ? "Supercharged Cartridges" : "Overcharged Cartridges",
    kind: supercharged ? "supercharged-cartridges" : "overcharged-cartridges",
    stacks: 1,
    duration: 8,
  });
}

export function trackBladeswornAmmoCast(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  if (!(Number(skill.ammo || 0) > 0)) return;
  const state = bladeswornState.from(context);
  if (state.ammoRoundsSpentByActivation[context.reservationId] == null) {
    state.ammoRoundsSpentByActivation[context.reservationId] = 1;
  }
  if (state.ammoStartedFullByActivation[context.reservationId] == null) {
    state.ammoStartedFullByActivation[context.reservationId] = Boolean(
      context.ammo && context.ammo.charges >= context.ammo.maximum,
    );
  }
}

const LUSH_FOREST_EXCLUDED_SKILL_IDS = new Set<number>([
  ID.UNSHEATHE_GUNSABER,
  ID.SHEATHE_GUNSABER,
  ID.DRAGON_TRIGGER,
  // Current live-game bug supplied with the benchmark specification.
  ID.ARTILLERY_SLASH,
]);

function selectedSkillNames(context: WarriorCastContext): Set<string> {
  const source = context.config.selectedSkills || [];
  return new Set(
    (Array.isArray(source) ? source : Object.values(source)).map(String),
  );
}

function activeWeaponNames(context: WarriorCastContext): Set<string> {
  const secondSet = context.state.activeWeaponSet === 2;
  return new Set(
    [
      secondSet
        ? context.config.weaponSet2Primary
        : context.config.primaryWeapon,
      secondSet
        ? context.config.weaponSet2Secondary
        : context.config.secondaryWeapon,
    ]
      .map((weapon) => String(weapon || ""))
      .filter(Boolean),
  );
}

function skillIsOnActiveBar(
  context: WarriorCastContext,
  skill: WarriorSkill,
): boolean {
  const state = bladeswornState.from(context);
  if (skill.gunsaberSkill) {
    return state.gunsaberActive || state.dragonTriggerActive;
  }
  if (skill.type === "Weapon" || skill.weapon) {
    if (state.gunsaberActive || state.dragonTriggerActive) return false;
    const weapons = activeWeaponNames(context);
    return weapons.size === 0 || weapons.has(String(skill.weapon || ""));
  }
  if (["Heal", "Utility", "Elite"].includes(String(skill.type || ""))) {
    const selected = selectedSkillNames(context);
    return selected.size === 0 || selected.has(skill.name);
  }
  return true;
}

function reduceSkillRecharge(
  context: WarriorCastContext,
  skill: WarriorSkill,
  at: number,
): number {
  if (context.state.ammo.has(skill.id)) {
    return context.cooldownController.reduceAmmoRecharge(skill, 0.75, at)
      .reducedBy;
  }
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  if (readyAt <= at + context.epsilon) return 0;
  const reducedBy = Math.min(0.75, readyAt - at);
  context.state.cooldowns.set(skill.id, readyAt - reducedBy);
  return reducedBy;
}

function activateLushForest(
  context: WarriorCastContext,
  sourceSkill: WarriorSkill,
  at: number,
): void {
  let cooldownReduction = 0;
  const skillIds = new Set([
    ...context.state.cooldowns.keys(),
    ...context.state.ammo.keys(),
  ]);
  for (const skillId of skillIds) {
    const skill = context.catalog.skillsById.get(skillId);
    if (
      !skill ||
      LUSH_FOREST_EXCLUDED_SKILL_IDS.has(Number(skill.id)) ||
      !skillIsOnActiveBar(context, skill)
    ) {
      continue;
    }
    cooldownReduction += reduceSkillRecharge(context, skill, at);
  }
  context.emit({
    type: "proc",
    at,
    source: "Trait",
    sourceId: TRAIT.LUSH_FOREST,
    actorType: "effect",
    skillId: sourceSkill.id,
    skillName: sourceSkill.name,
    name: "Lush Forest",
    procType: "trait",
    cooldownReduction,
  });
}

export function completeBladeswornSkill(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = bladeswornState.from(context);
  const at = context.effectiveEnd;
  const roundsSpent = Math.max(
    0,
    Number(state.ammoRoundsSpentByActivation[context.reservationId] || 0),
  );
  const startedFull = Boolean(
    state.ammoStartedFullByActivation[context.reservationId],
  );
  if (Number(skill.flowGain || 0) > 0) {
    state.flow = Math.min(
      state.maximumFlow,
      state.flow + Number(skill.flowGain),
    );
  }
  if (skill.id === ID.FLOW_STABILIZER) state.flowStabilizerUntil = at + 8;
  if (skill.id === ID.TACTICAL_RELOAD) {
    reloadBladeswornAmmo(context, at);
    state.tacticalReloadUntil = at + 10;
    context.emit({
      type: "buff",
      at,
      source: "Warrior",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Tactical Reload",
      kind: "tactical-reload",
      stacks: 1,
      duration: 10,
    });
  }
  if (skill.id === ID.OVERCHARGED_CARTRIDGES) {
    activateOverchargedCartridges(context, at);
  }
  if (skill.id === ID.DRAGONSPIKE_MINE) {
    context.state.cooldowns.delete(ID.DRAGON_TRIGGER);
  }
  if (roundsSpent > 0 && hasTrait(context, TRAIT.FIERCE_AS_FIRE)) {
    state.fierceAsFireExpiries = state.fierceAsFireExpiries.filter(
      (expiresAt) => expiresAt > at,
    );
    state.fierceAsFireExpiries.push(...Array(roundsSpent).fill(at + 15));
    state.fierceAsFireExpiries = state.fierceAsFireExpiries.slice(-10);
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.FIERCE_AS_FIRE,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Fierce as Fire",
      kind: "fierce-as-fire",
      stacks: roundsSpent,
      duration: 15,
    });
  }
  if (
    roundsSpent > 0 &&
    startedFull &&
    skill.id !== ID.ARTILLERY_SLASH &&
    hasTrait(context, TRAIT.LUSH_FOREST)
  ) {
    activateLushForest(context, skill, at);
  }
  delete state.ammoRoundsSpentByActivation[context.reservationId];
  delete state.ammoStartedFullByActivation[context.reservationId];
}

function activeCartridgeWindow(
  state: ReturnType<typeof bladeswornState.from>,
  at: number,
) {
  for (
    let index = state.overchargedCartridgeWindows.length - 1;
    index >= 0;
    index -= 1
  ) {
    const window = state.overchargedCartridgeWindows[index];
    if (window.startedAt <= at && window.expiresAt > at) return window;
  }
  return undefined;
}

export function observeBladeswornEvent(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    event.damageKind !== "explosion" ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  const state = bladeswornState.from(context);
  if (hasTrait(context, TRAIT.GUNS_AND_GLORY)) {
    const remaining = Math.max(0, state.gunsAndGloryUntil - event.at);
    const duration = Math.min(12, remaining + 3);
    state.gunsAndGloryUntil = event.at + duration;
    context.emitDerived(event, {
      type: "buff",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.GUNS_AND_GLORY,
      actorType: "effect",
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Guns and Glory",
      kind: "guns-and-glory",
      stacks: 1,
      duration,
    });
  }
  const cartridges = activeCartridgeWindow(state, event.at);
  if (cartridges) {
    context.emitDerived(event, {
      type: "condition",
      at: event.at,
      source: "Warrior",
      sourceId: ID.OVERCHARGED_CARTRIDGES,
      actorType: "effect",
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Overcharged Cartridges — Burning",
      condition: "Burning",
      stacks: 1,
      duration: cartridges.burningDuration,
    });
  }
}

export const bladeswornSchedulerHooks = Object.freeze({
  advance: { id: "warrior.flow", order: 20, handler: advanceBladesworn },
  afterCast: {
    id: "warrior.bladesworn-ammo-cast",
    order: 20,
    handler: trackBladeswornAmmoCast,
  },
  onCastComplete: {
    id: "warrior.bladesworn-state",
    order: 20,
    handler: completeBladeswornSkill,
  },
  onEventScheduled: {
    id: "warrior.bladesworn-explosions",
    order: 20,
    handler: observeBladeswornEvent,
  },
});
