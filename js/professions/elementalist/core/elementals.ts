import {
  GW2_ALACRITY_RECHARGE_RATE,
  gw2BuffActiveForAudience,
} from "../../../platform/gw2/scheduler/policy.js";
import type {
  AvailabilityResult,
  CastContext,
  CastLifecycleContext,
  ScheduledTask,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
  Skill,
  SkillEffect,
} from "../../../platform/engine/types.js";
import { FIRE_ELEMENTAL_EVTC_PROFILE } from "./elemental-profile.js";
import { elementalistCoreState, type ElementalistCoreState } from "./state.js";

export { FIRE_ELEMENTAL_EVTC_PROFILE } from "./elemental-profile.js";

interface ElementalistRuntimeState extends SchedulerRecord {
  core: ElementalistCoreState;
  specialization: {
    kind: string;
    state: SchedulerRecord;
  };
}

type ElementalistLifecycleContext =
  CastLifecycleContext<ElementalistRuntimeState>;
type ElementalistCastContext = CastContext<ElementalistRuntimeState>;
type ElementalistSchedulerContext = SchedulerContext<ElementalistRuntimeState>;

interface ElementalTaskPayload extends SchedulerRecord {
  readonly summonGeneration: number;
  readonly actionGeneration?: number;
  readonly activationId?: string;
  readonly impact?: FireElementalImpact;
  readonly hitIndex?: number;
}

type FireElementalImpact =
  | "fireball"
  | "flame-burst"
  | "flame-barrage-projectile"
  | "flame-barrage-explosion";

const ELEMENTAL_AI_TASK = "elementalist.elemental-ai";
const ELEMENTAL_IMPACT_TASK = "elementalist.elemental-impact";
const ELEMENTAL_EXPIRE_TASK = "elementalist.elemental-expire";
const ELEMENTAL_TASK_OWNER = "elementalist.summoned-elemental";

const FIREBALL_ID = FIRE_ELEMENTAL_EVTC_PROFILE.fireball.skillId;
const FLAME_BURST_ID = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst.skillId;
export const FLAME_BARRAGE_ID =
  FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage.skillId;

export function usesReferenceElementalProfile(
  context: Pick<ElementalistSchedulerContext, "config">,
): boolean {
  return context.config.elementalSimulationProfile === "reference";
}

function ready(): AvailabilityResult {
  return { ready: true };
}

function unavailable(reason: string, retryAt?: number): AvailabilityResult {
  return {
    ready: false,
    code: "elementalist.summoned-elemental",
    reason,
    ...(retryAt == null ? {} : { retryAt }),
  };
}

function selectedSkillNames(
  context: ElementalistSchedulerContext,
): ReadonlySet<string> {
  const selected = context.config.selectedSkills;
  const values = Array.isArray(selected)
    ? selected
    : selected && typeof selected === "object"
      ? Object.values(selected as Readonly<Record<string, string>>)
      : [];
  return new Set(values.map(String));
}

function companionId(summonGeneration: number): string {
  return `elementalist-elemental:${summonGeneration}`;
}

function activeFireElemental(
  context: ElementalistSchedulerContext,
  summonGeneration: number,
  at: number,
): boolean {
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  return (
    elemental.summonGeneration === summonGeneration &&
    elemental.element === "Fire" &&
    elemental.activeUntil > at - context.epsilon
  );
}

function actionRate(context: ElementalistSchedulerContext, at: number): number {
  return gw2BuffActiveForAudience(context, "quickness", at, "summon") ? 1.5 : 1;
}

function summonRechargeRate(
  context: ElementalistSchedulerContext,
  at: number,
): number {
  return gw2BuffActiveForAudience(context, "alacrity", at, "summon")
    ? Number(context.config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE)
    : 1;
}

function scheduleTask(
  context: ElementalistSchedulerContext,
  type: string,
  at: number,
  payload: ElementalTaskPayload,
  priority = 0,
): string {
  return context.tasks.schedule({
    type,
    at,
    priority,
    ownerId: ELEMENTAL_TASK_OWNER,
    payload,
  });
}

function interruptCurrentAction(
  context: ElementalistSchedulerContext,
  at: number,
): void {
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  if (!elemental.currentActivationId) return;
  const action = context.events.find(
    (event) =>
      event.type === "action" &&
      event.activationId === elemental.currentActivationId,
  );
  if (action && Number(action.fullEndsAt || action.endsAt || 0) > at) {
    context.replaceEvent(action, {
      endsAt: at,
      interrupted: true,
      interruptedAt: at,
    });
  }
}

function beginSummonAction(
  context: ElementalistSchedulerContext,
  at: number,
  skillId: number,
  skillName: string,
  animationEnd: number,
): Readonly<{ actionGeneration: number; activationId: string }> {
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  interruptCurrentAction(context, at);
  elemental.actionGeneration += 1;
  const activationId = context.createActivationId("summon-attack");
  elemental.currentActivationId = activationId;
  context.emit({
    type: "action",
    activationId,
    at,
    source: "Fire Elemental",
    sourceId: skillId,
    actorType: "summon",
    skillId,
    skillName,
    name: skillName,
    endsAt: at + animationEnd,
    fullEndsAt: at + animationEnd,
    summonOwner: companionId(elemental.summonGeneration),
    autonomousElementalSkill: skillName !== "Flame Barrage",
    playerCommandedElementalSkill: skillName === "Flame Barrage",
  });
  return {
    actionGeneration: elemental.actionGeneration,
    activationId,
  };
}

function scheduleImpact(
  context: ElementalistSchedulerContext,
  at: number,
  impact: FireElementalImpact,
  action: Readonly<{ actionGeneration: number; activationId: string }>,
  hitIndex = 1,
  priority = -20,
): void {
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  scheduleTask(
    context,
    ELEMENTAL_IMPACT_TASK,
    at,
    {
      summonGeneration: elemental.summonGeneration,
      actionGeneration: action.actionGeneration,
      activationId: action.activationId,
      impact,
      hitIndex,
    },
    priority,
  );
}

function scheduleNextAi(
  context: ElementalistSchedulerContext,
  at: number,
  actionGeneration: number,
): void {
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  elemental.nextActionAt = at;
  scheduleTask(context, ELEMENTAL_AI_TASK, at, {
    summonGeneration: elemental.summonGeneration,
    actionGeneration,
  });
}

function startFireball(
  context: ElementalistSchedulerContext,
  at: number,
): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.fireball;
  const rate = actionRate(context, at);
  const action = beginSummonAction(
    context,
    at,
    profile.skillId,
    "Fireball",
    profile.animationEnd / rate,
  );
  scheduleImpact(context, at + profile.impact / rate, "fireball", action);
  const nextAt = at + profile.recovery / rate;
  elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function startFlameBurst(
  context: ElementalistSchedulerContext,
  at: number,
): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  const rate = actionRate(context, at);
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  const action = beginSummonAction(
    context,
    at,
    profile.skillId,
    "Flame Burst",
    profile.animationEnd / rate,
  );
  elemental.flameBurstReadyAt =
    at +
    profile.animationEnd / rate +
    profile.cooldown / summonRechargeRate(context, at);
  scheduleImpact(context, at + profile.impact / rate, "flame-burst", action);
  const nextAt = at + profile.recovery / rate;
  elemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function startFlameBarrage(
  context: ElementalistSchedulerContext,
  at: number,
): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
  const rate = actionRate(context, at);
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  const postCommandRecovery =
    elemental.actionGeneration === 0
      ? FIRE_ELEMENTAL_EVTC_PROFILE.postCommandRecovery
      : FIRE_ELEMENTAL_EVTC_PROFILE.subsequentCommandRecovery;
  const action = beginSummonAction(
    context,
    at,
    profile.skillId,
    "Flame Barrage",
    profile.animationEnd / rate,
  );
  profile.projectileImpacts.forEach((offset, index) => {
    scheduleImpact(
      context,
      at + offset / rate,
      "flame-barrage-projectile",
      action,
      index + 1,
    );
  });
  scheduleImpact(
    context,
    at + profile.explosionImpact / rate,
    "flame-barrage-explosion",
    action,
    4,
    -19,
  );
  const nextAt = at + profile.animationEnd / rate + postCommandRecovery;
  elemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function summonStrikeMetadata(
  summonGeneration: number,
  baseDamage: number,
  ignoresMight = false,
): SchedulerRecord {
  return {
    independentSummonStrike: true,
    summonInheritsAttributes: false,
    summonUsesProfessionModifiers: false,
    summonBasePower: FIRE_ELEMENTAL_EVTC_PROFILE.basePower,
    summonBasePrecision: FIRE_ELEMENTAL_EVTC_PROFILE.basePrecision,
    summonBaseFerocity: FIRE_ELEMENTAL_EVTC_PROFILE.baseFerocity,
    summonCriticalChance: 0.05,
    summonCriticalDamage: 1.5,
    summonDamagePerCoefficient: baseDamage,
    summonOwner: companionId(summonGeneration),
    summonIgnoresMight: ignoresMight,
    skillWeapon: "Unequipped",
  };
}

function emitStrike(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
  skillId: number,
  skillName: string,
  baseDamage: number,
  hitIndex: number,
  totalHits: number,
  ignoresMight = false,
): void {
  context.emit({
    type: "damage",
    activationId: task.payload?.activationId,
    at: task.at,
    source: "Fire Elemental",
    sourceId: skillId,
    actorType: "summon",
    skillId,
    skillName,
    name: skillName,
    coefficient: 1,
    hits: 1,
    hitIndex,
    totalHits,
    autonomousElementalSkill: true,
    ...summonStrikeMetadata(
      Number(task.payload?.summonGeneration || 0),
      baseDamage,
      ignoresMight,
    ),
  });
}

function emitPlayerOwnedBurning(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
  skillId: number,
  skillName: string,
): void {
  context.emit({
    type: "condition",
    activationId: task.payload?.activationId,
    at: task.at,
    source: "Fire Elemental",
    sourceId: skillId,
    actorType: "player",
    skillId,
    skillName,
    name: `${skillName} — Burning`,
    condition: "Burning",
    stacks: 1,
    duration: 3,
    elementalOwnedCondition: true,
  });
}

function boonDuration(
  context: ElementalistSchedulerContext,
  duration: number,
): number {
  const sourceSkill = context.catalog.skillsByName.get("Glyph of Elementals");
  if (!sourceSkill) return duration;
  const effect: SkillEffect = {
    type: "boon",
    boon: "might",
    duration,
  };
  return (
    context.schedulerPolicy.effectDuration?.(
      context,
      sourceSkill,
      effect,
      duration,
    ) ?? duration
  );
}

function emitFlameBurstMight(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  context.emit({
    type: "buff",
    activationId: task.payload?.activationId,
    at: task.at,
    source: "Fire Elemental",
    sourceId: profile.skillId,
    actorType: "player",
    skillId: profile.skillId,
    skillName: "Flame Burst",
    name: "Flame Burst — Might",
    kind: "might",
    stacks: profile.mightStacks,
    duration: boonDuration(context, profile.mightDuration),
    recipients: "party",
    maximumRecipients: 5,
  });
}

function handleElementalImpactTask(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
): void {
  const payload = task.payload;
  if (!payload) return;
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  if (
    !activeFireElemental(context, payload.summonGeneration, task.at) ||
    payload.actionGeneration !== elemental.actionGeneration
  ) {
    return;
  }
  if (payload.impact === "fireball") {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.fireball;
    emitStrike(
      context,
      task,
      profile.skillId,
      "Fireball",
      profile.baseDamage,
      1,
      1,
    );
    return;
  }
  if (payload.impact === "flame-burst") {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
    emitStrike(
      context,
      task,
      profile.skillId,
      "Flame Burst",
      profile.baseDamage,
      1,
      1,
    );
    emitPlayerOwnedBurning(context, task, profile.skillId, "Flame Burst");
    emitFlameBurstMight(context, task);
    return;
  }
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
  if (payload.impact === "flame-barrage-projectile") {
    emitStrike(
      context,
      task,
      profile.skillId,
      "Flame Barrage",
      profile.projectileBaseDamage,
      Number(payload.hitIndex || 1),
      4,
      true,
    );
    emitPlayerOwnedBurning(context, task, profile.skillId, "Flame Barrage");
  } else if (payload.impact === "flame-barrage-explosion") {
    emitStrike(
      context,
      task,
      profile.skillId,
      "Flame Barrage",
      profile.explosionBaseDamage,
      4,
      4,
      true,
    );
  }
}

function handleElementalAiTask(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
): void {
  const payload = task.payload;
  if (!payload) return;
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  if (
    !activeFireElemental(context, payload.summonGeneration, task.at) ||
    payload.actionGeneration !== elemental.actionGeneration
  ) {
    return;
  }
  elemental.nextActionAt = 0;
  if (elemental.flameBurstReadyAt <= task.at + context.epsilon) {
    startFlameBurst(context, task.at);
  } else {
    startFireball(context, task.at);
  }
}

function handleElementalExpireTask(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
): void {
  const payload = task.payload;
  if (!payload) return;
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  if (payload.summonGeneration !== elemental.summonGeneration) return;
  interruptCurrentAction(context, task.at);
  elemental.actionGeneration += 1;
  elemental.element = null;
  elemental.activeUntil = 0;
  elemental.busyUntil = 0;
  elemental.nextActionAt = 0;
  elemental.flameBurstReadyAt = 0;
  elemental.currentActivationId = null;
  elemental.started = false;
  delete elementalistCoreState(context as unknown as SchedulerRecord)
    .availableFlips["Flame Barrage"];
  const glyph = context.catalog.skillsByName.get("Glyph of Elementals");
  if (glyph) {
    context.state.cooldowns.set(
      glyph.id,
      task.at + FIRE_ELEMENTAL_EVTC_PROFILE.rechargeAfterExpiry,
    );
  }
}

function startFireElemental(
  context: ElementalistSchedulerContext,
  at: number,
): void {
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  if (
    elemental.element !== "Fire" ||
    elemental.started ||
    elemental.activeUntil <= at + context.epsilon
  ) {
    return;
  }
  elemental.started = true;
  scheduleNextAi(
    context,
    at + FIRE_ELEMENTAL_EVTC_PROFILE.targetAcquisitionDelay,
    elemental.actionGeneration,
  );
}

export function beginElementalistGlyphCast(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (
    skill.name !== "Glyph of Elementals" ||
    usesReferenceElementalProfile(context)
  ) {
    return;
  }
  context.replaceEvent(context.action, {
    summonedElement: "Fire",
  });
}

function summonFireElemental(
  context: ElementalistSchedulerContext,
  skill: Skill,
  at: number,
  startImmediately: boolean,
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const element = "Fire";
  context.tasks.cancelOwner(ELEMENTAL_TASK_OWNER);
  const summonGeneration = state.summonedElemental.summonGeneration + 1;
  state.summonedElemental = {
    element,
    summonGeneration,
    actionGeneration: 0,
    activeUntil: at + FIRE_ELEMENTAL_EVTC_PROFILE.lifetime,
    busyUntil: at,
    nextActionAt: 0,
    flameBurstReadyAt: at,
    currentActivationId: null,
    started: false,
  };
  const expiresAt = state.summonedElemental.activeUntil;
  context.emit({
    type: "marker",
    at: expiresAt,
    source: `${element} Elemental`,
    sourceId: skill.id,
    actorType: "summon",
    skillName: skill.name,
    name: `${element} Elemental expires`,
  });
  scheduleTask(
    context,
    ELEMENTAL_EXPIRE_TASK,
    expiresAt,
    { summonGeneration },
    50,
  );
  state.availableFlips["Flame Barrage"] = Number.POSITIVE_INFINITY;
  if (startImmediately) startFireElemental(context, at);
}

export function completeElementalistGlyphCast(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (
    skill.name !== "Glyph of Elementals" ||
    usesReferenceElementalProfile(context)
  ) {
    return;
  }
  const at = context.effectiveEnd;
  summonFireElemental(
    context,
    skill,
    at,
    !context.hasExplicitCombatStart || context.combatStartTime != null,
  );
}

export function completeElementalistFlameBarrageCommand(
  context: ElementalistLifecycleContext,
  skill: Skill,
): void {
  if (skill.id !== FLAME_BARRAGE_ID && skill.name !== "Flame Barrage") return;
  startFlameBarrage(context, context.effectiveEnd);
}

export function observeElementalistElementalEvent(
  context: ElementalistSchedulerContext,
  event: SimulationEvent,
): void {
  if (usesReferenceElementalProfile(context)) return;
  const combatStarted =
    event.type === "combat_start" ||
    (!context.hasExplicitCombatStart &&
      ["damage", "condition", "control", "blind"].includes(event.type) &&
      ["player", "summon", "phantasm"].includes(String(event.actorType)));
  if (!combatStarted) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    state.summonedElemental.activeUntil <= event.at + context.epsilon &&
    context.config.autoSummonFireElemental !== false &&
    selectedSkillNames(context).has("Glyph of Elementals")
  ) {
    const glyph = context.catalog.skillsByName.get("Glyph of Elementals");
    if (glyph) summonFireElemental(context, glyph, event.at, true);
    return;
  }
  startFireElemental(context, event.at);
}

export function elementalistElementalAvailability(
  context: ElementalistCastContext,
  skill: Skill,
): AvailabilityResult | null {
  const elemental = elementalistCoreState(
    context as unknown as SchedulerRecord,
  ).summonedElemental;
  if (skill.id === FLAME_BARRAGE_ID || skill.name === "Flame Barrage") {
    return elemental.element === "Fire" &&
      elemental.activeUntil > context.start + context.epsilon
      ? ready()
      : unavailable("an active Fire Elemental is required.");
  }
  if (skill.name !== "Glyph of Elementals") return null;
  if (usesReferenceElementalProfile(context)) return null;
  return elemental.activeUntil > context.start + context.epsilon
    ? unavailable(
        `the ${elemental.element || "summoned"} elemental is still active.`,
        elemental.activeUntil,
      )
    : ready();
}

export const elementalistElementalTaskHandlers = Object.freeze({
  [ELEMENTAL_AI_TASK]: handleElementalAiTask,
  [ELEMENTAL_IMPACT_TASK]: handleElementalImpactTask,
  [ELEMENTAL_EXPIRE_TASK]: handleElementalExpireTask,
});
