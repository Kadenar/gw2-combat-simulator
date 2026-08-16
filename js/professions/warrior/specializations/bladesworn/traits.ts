import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  DRAGON_CHARGE_INTERVAL_SECONDS,
  DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
  DRAGON_TRIGGER_DURATION_SECONDS,
  DRAGON_TRIGGER_TICK_RESOURCE_REASON,
  dragonChargesToAdrenalineSpent,
  dragonSlashCoefficient,
  dragonFlowPerInterval,
  maximumDragonCharges,
  projectDragonCharges,
  projectDragonFlow,
  requestedDragonCharges,
  type DragonFlowRateSegment,
} from "./dragon-trigger.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import { applyWarriorBurstSpendTraits } from "../../core/traits.js";
import { bladeswornState } from "./state.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../../types.js";

const UNSEEN_SWORD_STRIKE_ID = 62847;

function emitGunsaberSwapTrait(context: WarriorCastContext, at: number): void {
  // Skip trait procs that would fire before combat begins when an explicit
  // combat start is configured (pre-cast weapon swaps should not trigger it).
  if (
    context.hasExplicitCombatStart &&
    (context.combatStartTime == null ||
      at + context.epsilon < context.combatStartTime)
  ) {
    return;
  }
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
      skillId: UNSEEN_SWORD_STRIKE_ID,
      skillName: "Unseen Sword",
      parentSkillName: context.skill.name,
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
  if (state.traitPositiveFlowUntil <= at + context.epsilon) {
    state.traitPositiveFlowStartedAt = at;
  }
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

function emitGunsaberWeaponSwap(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  professionCoreState(context).autoattackChains = {};
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) {
    professionCoreState(context).soldierFocusReadyAt = context.effectiveEnd;
  }
  context.emit({
    type: "sigil_swap",
    at: context.effectiveEnd,
    source: "warrior",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
}

function clearDragonTriggerState(
  state: ReturnType<typeof bladeswornState.from>,
): void {
  state.dragonTriggerActive = false;
  state.dragonTriggerStartedAt = 0;
  state.dragonTriggerChargeDeadline = 0;
  state.nextDragonChargeAt = 0;
  state.dragonCharges = 0;
  state.dragonChargesPerInterval = 1;
  state.dragonTriggerRotationIndex = -1;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = "";
}

export function enterGunsaber(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  bladeswornState.from(context).gunsaberActive = true;
  emitGunsaberWeaponSwap(context, skill);
  emitGunsaberSwapTrait(context, context.effectiveEnd);
}

export function exitGunsaber(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  bladeswornState.from(context).gunsaberActive = false;
  emitGunsaberWeaponSwap(context, skill);
}

export function enterDragonTrigger(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = bladeswornState.from(context);
  if (!state.gunsaberActive) enterGunsaber(context, skill);
  gainPassiveFlow(context, state.flowUpdatedAt, context.effectiveEnd);
  state.flowUpdatedAt = context.effectiveEnd;
  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = context.effectiveEnd;
  state.dragonTriggerChargeDeadline =
    context.effectiveEnd + DRAGON_TRIGGER_DURATION_SECONDS;
  state.nextDragonChargeAt =
    context.effectiveEnd + DRAGON_CHARGE_INTERVAL_SECONDS;
  state.dragonCharges = 0;
  // Tactical Reload doubles charge gain per tick. It is consumed immediately
  // so it only applies to the single Dragon Trigger entry it was active for.
  state.dragonChargesPerInterval =
    state.tacticalReloadUntil > 0 &&
    state.tacticalReloadUntil + context.epsilon >= context.effectiveEnd
      ? 2
      : 1;
  if (state.dragonChargesPerInterval > 1) state.tacticalReloadUntil = 0;
  state.dragonTriggerRotationIndex = context.commandIndex;
  state.dragonTriggerFlowSpent = 0;
  state.dragonTriggerEventActivationId = context.reservationId;
  emitDragonTriggerEntry(context, skill);
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

export function useDragonSlash(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = bladeswornState.from(context);
  const maximumCharges = maximumDragonCharges(context);
  const charges = Math.max(1, Math.min(maximumCharges, state.dragonCharges));
  const requestedCharges = requestedDragonCharges(context, maximumCharges);
  const minimum = Number(skill.dragonSlashMinimumCoefficient || 0);
  const maximum = Number(skill.dragonSlashMaximumCoefficient || minimum);
  const coefficient = dragonSlashCoefficient(
    minimum,
    maximum,
    charges,
    maximumCharges,
  );
  // Dragon Slash Force deals damage at the midpoint of its cast; all other
  // Dragon Slash variants hit at cast end.
  const impactAt =
    skill.id === ID.DRAGON_SLASH_FORCE
      ? context.start + (context.effectiveEnd - context.start) / 2
      : context.effectiveEnd;
  const adrenalineSpent = dragonChargesToAdrenalineSpent(charges);
  applyWarriorBurstSpendTraits(
    context,
    skill,
    adrenalineSpent,
    state.dragonTriggerFlowSpent,
  );
  state.dragonChargesSpentByActivation[context.reservationId] = charges;
  context.emit({
    type: "resource",
    at: context.start,
    source: "Warrior",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    sourceSkill: skill.name,
    amount: -charges,
    value: 0,
    resource: "dragon charges",
    reason: "profession mechanic",
    rotationIndex: context.commandIndex,
    requestedCharges,
    maximumCharges,
    chargesReached: charges,
    chargingSeconds: Math.max(0, context.start - state.dragonTriggerStartedAt),
    flowSpent: state.dragonTriggerFlowSpent,
    adrenalineBarsSpent: adrenalineSpent / 10,
  });
  context.emit({
    type: "damage",
    at: impactAt,
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
      at: impactAt,
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
  clearDragonTriggerState(state);
}

export function useArtillerySlash(
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

const BASE_FLOW_PER_SECOND = 2;
const FLOW_STABILIZER_BONUS_PER_SECOND = 4;
const TRAIT_POSITIVE_FLOW_BONUS_PER_SECOND = 2;

function dragonFlowRateSegments(
  context: WarriorSchedulerContext,
  from: number,
  to: number,
): readonly DragonFlowRateSegment[] {
  if (!(to > from)) return [];
  const state = bladeswornState.from(context);
  const combatStart = context.hasExplicitCombatStart
    ? context.combatStartTime
    : from;
  if (combatStart == null || combatStart >= to) return [];
  const activeFrom = Math.max(from, Number(combatStart));
  const boundaries = [
    activeFrom,
    to,
    state.traitPositiveFlowStartedAt,
    state.traitPositiveFlowUntil,
    ...state.flowStabilizerWindows.flatMap((window) => [
      window.startedAt,
      window.expiresAt,
    ]),
  ]
    .filter((at) => at > activeFrom && at < to)
    .concat(activeFrom, to)
    .sort((left, right) => left - right);
  const uniqueBoundaries = [...new Set(boundaries)];
  const segments: DragonFlowRateSegment[] = [];
  for (let index = 0; index < uniqueBoundaries.length - 1; index += 1) {
    const start = Number(uniqueBoundaries[index]);
    const end = Number(uniqueBoundaries[index + 1]);
    const sample = (start + end) / 2;
    const flowPerSecond =
      BASE_FLOW_PER_SECOND +
      state.flowStabilizerWindows.reduce(
        (bonus, window) =>
          sample >= window.startedAt && sample < window.expiresAt
            ? bonus + FLOW_STABILIZER_BONUS_PER_SECOND
            : bonus,
        0,
      ) +
      (sample >= state.traitPositiveFlowStartedAt &&
      sample < state.traitPositiveFlowUntil
        ? TRAIT_POSITIVE_FLOW_BONUS_PER_SECOND
        : 0);
    segments.push({ start, end, flowPerSecond });
  }
  return segments;
}

function dragonTriggerEntryEvent(
  context: WarriorSchedulerContext,
): WarriorSimulationEvent | undefined {
  const activationId =
    bladeswornState.from(context).dragonTriggerEventActivationId;
  return context.events.find(
    (event) =>
      event.type === "resource" &&
      event.reason === DRAGON_TRIGGER_ENTRY_RESOURCE_REASON &&
      event.activationId === activationId,
  ) as WarriorSimulationEvent | undefined;
}

function emitDragonTriggerEntry(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  const state = bladeswornState.from(context);
  context.emit({
    type: "resource",
    at: state.dragonTriggerStartedAt,
    source: "Warrior",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    sourceSkill: skill.name,
    activationId: state.dragonTriggerEventActivationId,
    amount: 0,
    value: state.flow,
    resource: "flow",
    reason: DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
    rotationIndex: context.commandIndex,
    maximumFlow: state.maximumFlow,
    maximumCharges: maximumDragonCharges(context),
    chargesPerInterval: state.dragonChargesPerInterval,
    flowPerInterval: dragonFlowPerInterval(context),
    nextChargeAt: state.nextDragonChargeAt,
    deadline: state.dragonTriggerChargeDeadline,
    flowRateSegments: dragonFlowRateSegments(
      context,
      state.dragonTriggerStartedAt,
      state.dragonTriggerChargeDeadline,
    ),
  });
}

function furyActiveBeforeCurrentCast(context: WarriorCastContext): boolean {
  const configured = context.config.boons?.fury;
  if (configured === true || Number(configured || 0) > 0) return true;
  return context.events.some(
    (event) =>
      event.type === "buff" &&
      event.kind === "fury" &&
      event.affectsSelf !== false &&
      event.activationId !== context.reservationId &&
      event.at <= context.start + context.epsilon &&
      event.at + Number(event.duration || 0) > context.start + context.epsilon,
  );
}

function refreshDragonTriggerEntryProjection(
  context: WarriorSchedulerContext,
): void {
  const state = bladeswornState.from(context);
  if (!state.dragonTriggerActive) return;
  const event = dragonTriggerEntryEvent(context);
  if (!event) return;
  context.replaceEvent(event, {
    flowRateSegments: dragonFlowRateSegments(
      context,
      state.dragonTriggerStartedAt,
      state.dragonTriggerChargeDeadline,
    ),
  });
}

function gainPassiveFlow(
  context: WarriorSchedulerContext,
  from: number,
  to: number,
): void {
  const state = bladeswornState.from(context);
  state.flow = projectDragonFlow(
    state.flow,
    state.maximumFlow,
    from,
    to,
    dragonFlowRateSegments(context, from, to),
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
  refreshDragonTriggerEntryProjection(context);
  const chargeThrough = Math.min(target, state.dragonTriggerChargeDeadline);
  const flowPerInterval = dragonFlowPerInterval(context);
  const ticks = projectDragonCharges({
    startTime: state.flowUpdatedAt,
    firstTickAt: state.nextDragonChargeAt,
    flow: state.flow,
    maximumFlow: state.maximumFlow,
    initialCharges: state.dragonCharges,
    maximumCharges: maximumDragonCharges(context),
    chargesPerInterval: state.dragonChargesPerInterval,
    flowPerInterval,
    flowRateSegments: dragonFlowRateSegments(
      context,
      state.flowUpdatedAt,
      chargeThrough,
    ),
    deadline: chargeThrough,
  });
  for (const tick of ticks) {
    const previousCharges = state.dragonCharges;
    state.flow = tick.flowAfter;
    state.dragonCharges = tick.charges;
    state.flowUpdatedAt = tick.at;
    if (tick.granted) {
      state.dragonTriggerFlowSpent += flowPerInterval;
    }
    context.emit({
      type: "resource",
      at: tick.at,
      source: "Warrior",
      sourceId: ID.DRAGON_TRIGGER,
      actorType: "player",
      skillId: ID.DRAGON_TRIGGER,
      skillName: "Dragon Trigger",
      sourceSkill: "Dragon Trigger",
      amount: tick.charges - previousCharges,
      value: tick.charges,
      resource: "dragon charges",
      reason: DRAGON_TRIGGER_TICK_RESOURCE_REASON,
      rotationIndex: state.dragonTriggerRotationIndex,
      flowAfter: tick.flowAfter,
      granted: tick.granted,
      deadline: state.dragonTriggerChargeDeadline,
    });
    state.nextDragonChargeAt += DRAGON_CHARGE_INTERVAL_SECONDS;
  }
  gainPassiveFlow(context, state.flowUpdatedAt, target);
  state.flowUpdatedAt = target;
  if (target > state.dragonTriggerChargeDeadline + context.epsilon) {
    clearDragonTriggerState(state);
  }
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
  // Tactical Reload restores a charge without resetting count-recharge
  // progress. If the skill is temporarily full, the pending recharge can
  // still refill a charge spent before that timer completes.
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
  // Ammo is reserved before this handler runs. Casting again while the
  // cartridges are already supercharged therefore spends the charge without
  // refreshing or replacing the active window.
  if (active?.supercharged) return;
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

export function useOverchargedCartridges(
  context: WarriorCastContext,
  _skill: WarriorSkill,
): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  activateOverchargedCartridges(
    context,
    context.start + castDuration * (420 / 900),
  );
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
  if (skill.id === ID.FLOW_STABILIZER) {
    if (furyActiveBeforeCurrentCast(context)) {
      state.flow = Math.min(state.maximumFlow, state.flow + 15);
    }
    state.flowStabilizerWindows.push({ startedAt: at, expiresAt: at + 8 });
    refreshDragonTriggerEntryProjection(context);
  }
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
  // Dragonspike Mine resets Dragon Trigger's cooldown on use (no ICD in game).
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
