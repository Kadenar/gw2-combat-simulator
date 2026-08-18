import { GW2_ALACRITY_RECHARGE_RATE, gw2BuffActiveForAudience } from '../../../platform/gw2/scheduler/policy.js';
import type {
  AvailabilityResult,
  ScheduledTask,
  SchedulerRecord,
  SimulationEvent,
  Skill,
  SkillEffect
} from '../../../platform/engine/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext,
  ElementalistSchedulerContext
} from '../types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../data/ids.js';
import { EARTH_ELEMENTAL_EVTC_PROFILE, FIRE_ELEMENTAL_EVTC_PROFILE } from './elemental-profile.js';
import { elementalistCoreState } from './state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE, elementalistBalanceValue } from './profiles.js';

export { EARTH_ELEMENTAL_EVTC_PROFILE, FIRE_ELEMENTAL_EVTC_PROFILE } from './elemental-profile.js';

type ElementalKind = 'Fire' | 'Earth';
type ElementalImpact =
  | 'fireball'
  | 'flame-burst'
  | 'flame-barrage-projectile'
  | 'flame-barrage-explosion'
  | 'punch'
  | 'enervating-punch'
  | 'stomp';

interface ElementalTaskPayload extends SchedulerRecord {
  readonly summonGeneration: number;
  readonly actionGeneration?: number;
  readonly activationId?: string;
  readonly impact?: ElementalImpact;
  readonly hitIndex?: number;
}

const ELEMENTAL_AI_TASK = 'elementalist.elemental-ai';
const ELEMENTAL_IMPACT_TASK = 'elementalist.elemental-impact';
const ELEMENTAL_EXPIRE_TASK = 'elementalist.elemental-expire';
const ELEMENTAL_TASK_OWNER = 'elementalist.summoned-elemental';

export const FLAME_BARRAGE_ID = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage.skillId;
export const STOMP_ID = EARTH_ELEMENTAL_EVTC_PROFILE.stomp.skillId;

function ready(): AvailabilityResult {
  return { ready: true };
}

function unavailable(reason: string, retryAt?: number): AvailabilityResult {
  return {
    ready: false,
    code: 'elementalist.summoned-elemental',
    reason,
    ...(retryAt == null ? {} : { retryAt })
  };
}

function selectedSkillNames(context: ElementalistSchedulerContext): ReadonlySet<string> {
  const selected = context.config.selectedSkills;
  const values = Array.isArray(selected)
    ? selected
    : selected && typeof selected === 'object'
      ? Object.values(selected as Readonly<Record<string, string>>)
      : [];
  return new Set(values.map(String));
}

function selectedElemental(context: ElementalistSchedulerContext): ElementalKind | null {
  const selected = selectedSkillNames(context);
  if (selected.has('Glyph of Elementals (Earth)')) return 'Earth';
  if (selected.has('Glyph of Elementals') || selected.has('Glyph of Elementals (Fire)')) {
    return 'Fire';
  }
  return null;
}

function automaticSummoningEnabled(context: ElementalistSchedulerContext): boolean {
  return context.config.autoSummonElemental !== false && context.config.autoSummonFireElemental !== false;
}

function elementalForGlyph(skill: Skill): ElementalKind | null {
  if (skill.id === ID.GLYPH_OF_ELEMENTALS_EARTH || skill.name === 'Glyph of Elementals (Earth)') {
    return 'Earth';
  }
  if (skill.id === ID.GLYPH_OF_ELEMENTALS || skill.name === 'Glyph of Elementals') {
    return 'Fire';
  }
  return null;
}

function glyphSkillForElement(context: ElementalistSchedulerContext, element: ElementalKind): Skill | null {
  return (
    context.catalog.skillsByName.get(element === 'Earth' ? 'Glyph of Elementals (Earth)' : 'Glyph of Elementals') ||
    null
  );
}

function commandName(element: ElementalKind): 'Flame Barrage' | 'Stomp' {
  return element === 'Earth' ? 'Stomp' : 'Flame Barrage';
}

function companionId(summonGeneration: number): string {
  return `elementalist-elemental:${summonGeneration}`;
}

function activeElemental(context: ElementalistSchedulerContext, summonGeneration: number, at: number): boolean {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  return (
    (elemental.element === 'Fire' || elemental.element === 'Earth') &&
    elemental.summonGeneration === summonGeneration &&
    elemental.activeUntil > at - context.epsilon
  );
}

function actionRate(context: ElementalistSchedulerContext, at: number): number {
  return gw2BuffActiveForAudience(context, 'quickness', at, 'summon') ? 1.5 : 1;
}

function summonRechargeRate(context: ElementalistSchedulerContext, at: number): number {
  return gw2BuffActiveForAudience(context, 'alacrity', at, 'summon')
    ? Number(context.config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE)
    : 1;
}

function scheduleTask(
  context: ElementalistSchedulerContext,
  type: string,
  at: number,
  payload: ElementalTaskPayload,
  priority = 0
): string {
  return context.tasks.schedule({
    type,
    at,
    priority,
    ownerId: ELEMENTAL_TASK_OWNER,
    payload
  });
}

function interruptCurrentAction(context: ElementalistSchedulerContext, at: number): void {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  if (!elemental.currentActivationId) return;
  const action = context.events.find(
    (event) => event.type === 'action' && event.activationId === elemental.currentActivationId
  );
  if (action && Number(action.fullEndsAt || action.endsAt || 0) > at) {
    context.replaceEvent(action, {
      endsAt: at,
      interrupted: true,
      interruptedAt: at
    });
  }
}

function beginSummonAction(
  context: ElementalistSchedulerContext,
  at: number,
  skillId: number,
  skillName: string,
  animationEnd: number
): Readonly<{ actionGeneration: number; activationId: string }> {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  const element = elemental.element as ElementalKind;
  const playerCommanded = skillName === commandName(element);
  interruptCurrentAction(context, at);
  elemental.actionGeneration += 1;
  const activationId = context.createActivationId('summon-attack');
  elemental.currentActivationId = activationId;
  context.emit({
    type: 'action',
    activationId,
    at,
    source: `${element} Elemental`,
    sourceId: skillId,
    actorType: 'summon',
    skillId,
    skillName,
    name: skillName,
    endsAt: at + animationEnd,
    fullEndsAt: at + animationEnd,
    summonOwner: companionId(elemental.summonGeneration),
    autonomousElementalSkill: !playerCommanded,
    playerCommandedElementalSkill: playerCommanded
  });
  return {
    actionGeneration: elemental.actionGeneration,
    activationId
  };
}

function scheduleImpact(
  context: ElementalistSchedulerContext,
  at: number,
  impact: ElementalImpact,
  action: Readonly<{ actionGeneration: number; activationId: string }>,
  hitIndex = 1,
  priority = -20
): void {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  scheduleTask(
    context,
    ELEMENTAL_IMPACT_TASK,
    at,
    {
      summonGeneration: elemental.summonGeneration,
      actionGeneration: action.actionGeneration,
      activationId: action.activationId,
      impact,
      hitIndex
    },
    priority
  );
}

function scheduleNextAi(context: ElementalistSchedulerContext, at: number, actionGeneration: number): void {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  elemental.nextActionAt = at;
  scheduleTask(context, ELEMENTAL_AI_TASK, at, {
    summonGeneration: elemental.summonGeneration,
    actionGeneration
  });
}

function startFireball(context: ElementalistSchedulerContext, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.fireball;
  const rate = actionRate(context, at);
  const action = beginSummonAction(context, at, profile.skillId, 'Fireball', profile.animationEnd / rate);
  scheduleImpact(context, at + profile.impact / rate, 'fireball', action);
  const nextAt = at + profile.recovery / rate;
  elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function startFlameBurst(context: ElementalistSchedulerContext, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  const rate = actionRate(context, at);
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  const action = beginSummonAction(context, at, profile.skillId, 'Flame Burst', profile.animationEnd / rate);
  elemental.secondaryAttackReadyAt =
    at + profile.animationEnd / rate + profile.cooldown / summonRechargeRate(context, at);
  scheduleImpact(context, at + profile.impact / rate, 'flame-burst', action);
  const nextAt = at + profile.recovery / rate;
  elemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function startFlameBarrage(context: ElementalistSchedulerContext, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
  const rate = actionRate(context, at);
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  const postCommandRecovery =
    elemental.actionGeneration === 0
      ? FIRE_ELEMENTAL_EVTC_PROFILE.postCommandRecovery
      : FIRE_ELEMENTAL_EVTC_PROFILE.subsequentCommandRecovery;
  const action = beginSummonAction(context, at, profile.skillId, 'Flame Barrage', profile.animationEnd / rate);
  profile.projectileImpacts.forEach((offset, index) => {
    scheduleImpact(context, at + offset / rate, 'flame-barrage-projectile', action, index + 1);
  });
  scheduleImpact(context, at + profile.explosionImpact / rate, 'flame-barrage-explosion', action, 4, -19);
  const nextAt = at + profile.animationEnd / rate + postCommandRecovery;
  elemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function startPunch(context: ElementalistSchedulerContext, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.punch;
  const rate = actionRate(context, at);
  const action = beginSummonAction(context, at, profile.skillId, 'Punch', profile.animationEnd / rate);
  scheduleImpact(context, at + profile.impact / rate, 'punch', action);
  const nextAt = at + profile.recovery / rate;
  elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function startEnervatingPunch(context: ElementalistSchedulerContext, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch;
  const rate = actionRate(context, at);
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  const action = beginSummonAction(context, at, profile.skillId, 'Enervating Punch', profile.animationEnd / rate);
  elemental.secondaryAttackReadyAt =
    at + profile.animationEnd / rate + profile.cooldown / summonRechargeRate(context, at);
  scheduleImpact(context, at + profile.impact / rate, 'enervating-punch', action);
  const nextAt = at + profile.recovery / rate;
  elemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function startStomp(context: ElementalistSchedulerContext, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  const rate = actionRate(context, at);
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  const postCommandRecovery =
    elemental.actionGeneration === 0
      ? EARTH_ELEMENTAL_EVTC_PROFILE.postCommandRecovery
      : EARTH_ELEMENTAL_EVTC_PROFILE.subsequentCommandRecovery;
  const action = beginSummonAction(context, at, profile.skillId, 'Stomp', profile.animationEnd / rate);
  scheduleImpact(context, at + profile.impact / rate, 'stomp', action);
  const nextAt = at + profile.animationEnd / rate + postCommandRecovery;
  elemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

function summonStrikeMetadata(element: ElementalKind, summonGeneration: number, baseDamage: number): SchedulerRecord {
  const profile = element === 'Earth' ? EARTH_ELEMENTAL_EVTC_PROFILE : FIRE_ELEMENTAL_EVTC_PROFILE;
  return {
    independentSummonStrike: true,
    summonInheritsAttributes: false,
    summonUsesProfessionModifiers: false,
    summonBasePower: profile.basePower,
    summonBasePrecision: profile.basePrecision,
    summonBaseFerocity: profile.baseFerocity,
    summonCriticalChance: 0.05,
    summonCriticalDamage: 1.5,
    summonDamagePerCoefficient: baseDamage,
    summonOwner: companionId(summonGeneration),
    skillWeapon: 'Unequipped'
  };
}

function emitStrike(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
  skillId: number,
  skillName: string,
  baseDamage: number,
  hitIndex: number,
  totalHits: number
): void {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  const element = elemental.element as ElementalKind;
  context.emit({
    type: 'damage',
    activationId: task.payload?.activationId,
    at: task.at,
    source: `${element} Elemental`,
    sourceId: skillId,
    actorType: 'summon',
    skillId,
    skillName,
    name: skillName,
    coefficient: 1,
    hits: 1,
    hitIndex,
    totalHits,
    autonomousElementalSkill: skillName !== commandName(element),
    playerCommandedElementalSkill: skillName === commandName(element),
    ...summonStrikeMetadata(element, Number(task.payload?.summonGeneration || 0), baseDamage)
  });
}

function emitPlayerOwnedCondition(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
  skillId: number,
  skillName: string,
  condition: string,
  duration: number
): void {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  context.emit({
    type: 'condition',
    activationId: task.payload?.activationId,
    at: task.at,
    source: `${elemental.element} Elemental`,
    sourceId: skillId,
    actorType: 'player',
    skillId,
    skillName,
    name: `${skillName} — ${condition}`,
    condition,
    stacks: 1,
    duration,
    elementalOwnedCondition: true
  });
}

function boonDuration(context: ElementalistSchedulerContext, boon: string, duration: number): number {
  const element = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental.element;
  const sourceSkill =
    element === 'Earth'
      ? context.catalog.skillsByName.get('Glyph of Elementals (Earth)')
      : context.catalog.skillsByName.get('Glyph of Elementals');
  if (!sourceSkill) return duration;
  const effect: SkillEffect = {
    type: 'boon',
    boon,
    duration
  };
  return context.schedulerPolicy.effectDuration?.(context, sourceSkill, effect, duration) ?? duration;
}

function emitFlameBurstMight(context: ElementalistSchedulerContext, task: ScheduledTask<ElementalTaskPayload>): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  context.emit({
    type: 'buff',
    activationId: task.payload?.activationId,
    at: task.at,
    source: 'Fire Elemental',
    sourceId: profile.skillId,
    actorType: 'player',
    skillId: profile.skillId,
    skillName: 'Flame Burst',
    name: 'Flame Burst — Might',
    kind: 'might',
    stacks: profile.mightStacks,
    duration: boonDuration(context, 'might', profile.mightDuration),
    recipients: 'party',
    maximumRecipients: 5
  });
}

function emitStompProtection(context: ElementalistSchedulerContext, task: ScheduledTask<ElementalTaskPayload>): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  context.emit({
    type: 'buff',
    activationId: task.payload?.activationId,
    at: task.at,
    source: 'Earth Elemental',
    sourceId: profile.skillId,
    actorType: 'player',
    skillId: profile.skillId,
    skillName: 'Stomp',
    name: 'Stomp — Protection',
    kind: 'protection',
    stacks: 1,
    duration: boonDuration(context, 'protection', profile.protectionDuration),
    recipients: 'party',
    maximumRecipients: 5
  });
}

function handleElementalImpactTask(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>
): void {
  const payload = task.payload;
  if (!payload) return;
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  if (
    !activeElemental(context, payload.summonGeneration, task.at) ||
    payload.actionGeneration !== elemental.actionGeneration
  ) {
    return;
  }

  if (payload.impact === 'fireball') {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.fireball;
    emitStrike(context, task, profile.skillId, 'Fireball', profile.baseDamage, 1, 1);
    return;
  }
  if (payload.impact === 'flame-burst') {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
    emitStrike(context, task, profile.skillId, 'Flame Burst', profile.baseDamage, 1, 1);
    emitPlayerOwnedCondition(context, task, profile.skillId, 'Flame Burst', 'Burning', profile.burningDuration);
    emitFlameBurstMight(context, task);
    return;
  }
  if (payload.impact === 'flame-barrage-projectile') {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
    emitStrike(
      context,
      task,
      profile.skillId,
      'Flame Barrage',
      profile.projectileBaseDamage,
      Number(payload.hitIndex || 1),
      4
    );
    emitPlayerOwnedCondition(context, task, profile.skillId, 'Flame Barrage', 'Burning', profile.burningDuration);
    return;
  }
  if (payload.impact === 'flame-barrage-explosion') {
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
    emitStrike(context, task, profile.skillId, 'Flame Barrage', profile.explosionBaseDamage, 4, 4);
    return;
  }
  if (payload.impact === 'punch') {
    const profile = EARTH_ELEMENTAL_EVTC_PROFILE.punch;
    emitStrike(context, task, profile.skillId, 'Punch', profile.baseDamage, 1, 1);
    return;
  }
  if (payload.impact === 'enervating-punch') {
    const profile = EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch;
    emitStrike(context, task, profile.skillId, 'Enervating Punch', profile.baseDamage, 1, 1);
    emitPlayerOwnedCondition(context, task, profile.skillId, 'Enervating Punch', 'Weakness', profile.weaknessDuration);
    return;
  }
  if (payload.impact === 'stomp') {
    const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
    emitStrike(context, task, profile.skillId, 'Stomp', profile.baseDamage, 1, 1);
    emitPlayerOwnedCondition(context, task, profile.skillId, 'Stomp', 'Crippled', profile.crippleDuration);
    emitPlayerOwnedCondition(context, task, profile.skillId, 'Stomp', 'Immobilized', profile.immobilizeDuration);
    emitStompProtection(context, task);
  }
}

function handleElementalAiTask(context: ElementalistSchedulerContext, task: ScheduledTask<ElementalTaskPayload>): void {
  const payload = task.payload;
  if (!payload) return;
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  if (
    !activeElemental(context, payload.summonGeneration, task.at) ||
    payload.actionGeneration !== elemental.actionGeneration
  ) {
    return;
  }
  elemental.nextActionAt = 0;
  if (elemental.element === 'Earth') {
    if (elemental.secondaryAttackReadyAt <= task.at + context.epsilon) {
      startEnervatingPunch(context, task.at);
    } else {
      startPunch(context, task.at);
    }
  } else if (elemental.secondaryAttackReadyAt <= task.at + context.epsilon) {
    startFlameBurst(context, task.at);
  } else {
    startFireball(context, task.at);
  }
}

function handleElementalExpireTask(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>
): void {
  const payload = task.payload;
  if (!payload) return;
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const elemental = state.summonedElemental;
  if (payload.summonGeneration !== elemental.summonGeneration) return;
  const element = elemental.element;
  if (element !== 'Fire' && element !== 'Earth') return;
  interruptCurrentAction(context, task.at);
  elemental.actionGeneration += 1;
  elemental.element = null;
  elemental.activeUntil = 0;
  elemental.busyUntil = 0;
  elemental.nextActionAt = 0;
  elemental.secondaryAttackReadyAt = 0;
  elemental.currentActivationId = null;
  elemental.started = false;
  delete state.availableFlips[commandName(element)];
  const glyph = glyphSkillForElement(context, element);
  if (glyph) {
    context.state.cooldowns.set(
      glyph.id,
      task.at +
        elementalistBalanceValue(
          context,
          PROFILE.summonedElemental,
          'recharge',
          element === 'Earth'
            ? EARTH_ELEMENTAL_EVTC_PROFILE.rechargeAfterExpiry
            : FIRE_ELEMENTAL_EVTC_PROFILE.rechargeAfterExpiry
        )
    );
  }
}

function startElemental(context: ElementalistSchedulerContext, at: number): void {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  if (
    (elemental.element !== 'Fire' && elemental.element !== 'Earth') ||
    elemental.started ||
    elemental.activeUntil <= at + context.epsilon
  ) {
    return;
  }
  elemental.started = true;
  if (elemental.element === 'Earth' && elemental.nextActionAt > at + context.epsilon) {
    return;
  }
  const delay = elementalistBalanceValue(
    context,
    PROFILE.summonedElemental,
    'initialDelay',
    elemental.element === 'Earth'
      ? EARTH_ELEMENTAL_EVTC_PROFILE.targetAcquisitionDelay
      : FIRE_ELEMENTAL_EVTC_PROFILE.targetAcquisitionDelay
  );
  scheduleNextAi(context, at + delay, elemental.actionGeneration);
}

export function beginElementalistGlyphCast(context: ElementalistLifecycleContext, skill: Skill): void {
  const element = elementalForGlyph(skill);
  if (!element) return;
  context.replaceEvent(context.action, { summonedElement: element });
}

function summonElemental(
  context: ElementalistSchedulerContext,
  skill: Skill,
  at: number,
  startImmediately: boolean,
  element: ElementalKind
): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const profile = element === 'Earth' ? EARTH_ELEMENTAL_EVTC_PROFILE : FIRE_ELEMENTAL_EVTC_PROFILE;
  context.tasks.cancelOwner(ELEMENTAL_TASK_OWNER);
  const summonGeneration = state.summonedElemental.summonGeneration + 1;
  state.summonedElemental = {
    element,
    summonGeneration,
    actionGeneration: 0,
    activeUntil:
      at + elementalistBalanceValue(context, PROFILE.summonedElemental, 'durationMultiplier', profile.lifetime),
    busyUntil: at,
    nextActionAt: 0,
    secondaryAttackReadyAt: at,
    currentActivationId: null,
    started: false
  };
  const expiresAt = state.summonedElemental.activeUntil;
  context.emit({
    type: 'marker',
    at: expiresAt,
    source: `${element} Elemental`,
    sourceId: skill.id,
    actorType: 'summon',
    skillName: skill.name,
    name: `${element} Elemental expires`
  });
  scheduleTask(context, ELEMENTAL_EXPIRE_TASK, expiresAt, { summonGeneration }, 50);
  state.availableFlips[commandName(element)] = Number.POSITIVE_INFINITY;
  if (startImmediately) startElemental(context, at);
}

export function completeElementalistGlyphCast(context: ElementalistLifecycleContext, skill: Skill): void {
  const element = elementalForGlyph(skill);
  if (!element) return;
  summonElemental(
    context,
    skill,
    context.effectiveEnd,
    !context.hasExplicitCombatStart || context.combatStartTime != null,
    element
  );
}

export function completeElementalistElementalCommand(context: ElementalistLifecycleContext, skill: Skill): void {
  if (skill.id === FLAME_BARRAGE_ID || skill.name === 'Flame Barrage') {
    startFlameBarrage(context, context.effectiveEnd);
  } else if (skill.id === STOMP_ID || skill.name === 'Stomp') {
    startStomp(context, context.effectiveEnd);
  }
}

export function observeElementalistElementalEvent(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const state = elementalistCoreState(context as unknown as SchedulerRecord);
  const selected = selectedElemental(context);
  const autoSummon = automaticSummoningEnabled(context) && selected != null;
  if (
    autoSummon &&
    state.summonedElemental.activeUntil <= event.at + context.epsilon &&
    event.type === 'action' &&
    event.actorType === 'player' &&
    elementalForGlyph({
      id: Number(event.skillId || event.sourceId || 0),
      name: String(event.skillName || event.name || '')
    } as Skill) == null
  ) {
    const glyph = glyphSkillForElement(context, selected);
    if (glyph) summonElemental(context, glyph, event.at, false, selected);
  }
  const combatStarted =
    event.type === 'combat_start' ||
    (!context.hasExplicitCombatStart &&
      ['damage', 'condition', 'control', 'blind'].includes(event.type) &&
      ['player', 'summon', 'phantasm'].includes(String(event.actorType)));
  if (!combatStarted) return;
  if (state.summonedElemental.activeUntil <= event.at + context.epsilon && autoSummon) {
    const glyph = glyphSkillForElement(context, selected);
    if (glyph) summonElemental(context, glyph, event.at, true, selected);
    return;
  }
  startElemental(context, event.at);
}

export function elementalistElementalAvailability(
  context: ElementalistCastContext,
  skill: Skill
): AvailabilityResult | null {
  const elemental = elementalistCoreState(context as unknown as SchedulerRecord).summonedElemental;
  if (skill.id === FLAME_BARRAGE_ID || skill.name === 'Flame Barrage') {
    const active = elemental.element === 'Fire' && elemental.activeUntil > context.start + context.epsilon;
    return active ||
      (elemental.activeUntil <= context.start + context.epsilon &&
        automaticSummoningEnabled(context as unknown as ElementalistSchedulerContext) &&
        selectedElemental(context as unknown as ElementalistSchedulerContext) === 'Fire')
      ? ready()
      : unavailable('an active Fire Elemental is required.');
  }
  if (skill.id === STOMP_ID || skill.name === 'Stomp') {
    const active = elemental.element === 'Earth' && elemental.activeUntil > context.start + context.epsilon;
    return active ||
      (elemental.activeUntil <= context.start + context.epsilon &&
        automaticSummoningEnabled(context as unknown as ElementalistSchedulerContext) &&
        selectedElemental(context as unknown as ElementalistSchedulerContext) === 'Earth')
      ? ready()
      : unavailable('an active Earth Elemental is required.');
  }
  if (!elementalForGlyph(skill)) return null;
  return elemental.activeUntil > context.start + context.epsilon
    ? unavailable(`the ${elemental.element || 'summoned'} elemental is still active.`, elemental.activeUntil)
    : ready();
}

export const elementalistElementalTaskHandlers = Object.freeze({
  [ELEMENTAL_AI_TASK]: handleElementalAiTask,
  [ELEMENTAL_IMPACT_TASK]: handleElementalImpactTask,
  [ELEMENTAL_EXPIRE_TASK]: handleElementalExpireTask
});
