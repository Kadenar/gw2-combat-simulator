import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
/**
 * Summoned-elemental subsystem for Glyph of Elementals (Fire / Earth).
 *
 * An elemental is a scheduler-driven autonomous companion. Once summoned it runs
 * its own attack loop off three scheduler tasks:
 *   - AI task     — decides and starts the next attack, then reschedules itself.
 *   - IMPACT task — lands the damage/conditions/boons for a started attack.
 *   - EXPIRE task — tears the elemental down at end of lifetime.
 *
 * Generation counters guard against stale scheduled tasks:
 *   - summonGeneration bumps every time a new elemental is summoned; tasks from a
 *     previous summon are ignored (and the previous owner's tasks are cancelled).
 *   - actionGeneration bumps every time a new action starts; impacts/AI ticks from
 *     an interrupted or superseded action are ignored.
 *
 * Fire loop:  Fireball (auto) / Flame Burst (secondary, off cooldown) / Flame Barrage (player command).
 * Earth loop: Punch (auto) / Enervating Punch (secondary, off cooldown) / Stomp (player command).
 *
 * Auto-summon: when enabled and a glyph is slotted, the elemental is re-summoned on
 * combat start (or first offensive event) without an explicit cast in the rotation.
 */
import {
  GW2_ALACRITY_RECHARGE_RATE,
  gw2BuffActiveForAudience,
  gw2SchedulerBoonDuration
} from '#gw2/platform/scheduler/policy.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type {
  AvailabilityResult,
  ScheduledTask,
  SchedulerRecord,
  SimulationEvent,
  Skill
} from '#gw2/platform/engine/types.js';
import { denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import type {
  ElementalistCastContext,
  ElementalistPrecastContext,
  ElementalistSchedulerContext
} from '#gw2/content/professions/elementalist/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  ELEMENTAL_LIGHTNING_JOLT_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/content/professions/elementalist/core/skills/elemental-profiles.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';
import {
  elementalCommandName,
  elementalForGlyphId,
  elementalRuntimeProfile,
  FLAME_BARRAGE_ID,
  selectedElementalFromSkills,
  STOMP_ID,
  type ElementalImpact,
  type ElementalKind
} from '#gw2/content/professions/elementalist/core/skills/elemental-runtime-profile.js';

export {
  EARTH_ELEMENTAL_EVTC_PROFILE,
  FIRE_ELEMENTAL_EVTC_PROFILE
} from '#gw2/content/professions/elementalist/core/skills/elemental-profiles.js';

// Payload carried by every elemental scheduler task. The two generation stamps are the
// staleness guard; `impact`/`hitIndex` identify which hit of an action is landing.
interface ElementalTaskPayload extends SchedulerRecord {
  readonly summonGeneration: number;
  readonly actionGeneration?: number;
  readonly activationId?: string;
  readonly impact?: ElementalImpact;
  readonly hitIndex?: number;
}

// Scheduler task types plus the shared owner id used so a re-summon can cancel all
// outstanding tasks from the previous elemental in one call (tasks.cancelOwner).
const ELEMENTAL_AI_TASK = 'elementalist.elemental-ai';
const ELEMENTAL_IMPACT_TASK = 'elementalist.elemental-impact';
const ELEMENTAL_EXPIRE_TASK = 'elementalist.elemental-expire';
const ELEMENTAL_TASK_OWNER = 'elementalist.summoned-elemental';

export {
  FLAME_BARRAGE_ID,
  STOMP_ID
} from '#gw2/content/professions/elementalist/core/skills/elemental-runtime-profile.js';

function ready(): AvailabilityResult {
  return { ready: true };
}

function unavailable(reason: string, retryAt?: number): AvailabilityResult {
  return retryAt == null
    ? denyCast('elementalist.summoned-elemental', reason)
    : retryCast(retryAt, 'elementalist.summoned-elemental', reason);
}

// Which elemental the loadout has slotted (drives auto-summon). Bare "Glyph of
// Elementals" is treated as the Fire variant.
function selectedElemental(context: ElementalistSchedulerContext): ElementalKind | null {
  return selectedElementalFromSkills(selectedSkillNameSet(context.config.selectedSkills));
}

// Auto-summon is opt-out: on unless either config flag is explicitly false.
function automaticSummoningEnabled(context: ElementalistSchedulerContext): boolean {
  return context.config.autoSummonElemental !== false && context.config.autoSummonFireElemental !== false;
}

// Maps a stable glyph skill ID to the elemental it summons; null for unrelated skills.
function elementalForGlyph(skill: Skill): ElementalKind | null {
  return elementalForGlyphId(skill.id);
}

// Resolves the catalog skill that owns an element, so auto-summon and post-expiry recharge
// can act on the glyph even when it was never explicitly cast.
function glyphSkillForElement(context: ElementalistSchedulerContext, element: ElementalKind): Skill | null {
  return (
    context.catalog.skillsById.get(element === 'Earth' ? ID.GLYPH_OF_ELEMENTALS_EARTH : ID.GLYPH_OF_ELEMENTALS) || null
  );
}

// The player-commanded flip skill name for an element (used to tag events as
// player-commanded vs autonomous and to key availableFlips).
function commandName(element: ElementalKind): 'Flame Barrage' | 'Stomp' {
  return elementalCommandName(element);
}

/**
 * Stable per-summon actor identity, so every strike and effect the elemental produces
 * attributes to the right companion instead of bleeding across re-summons.
 */
export function elementalistElementalCompanionId(summonGeneration: number): string {
  return `elementalist-elemental:${summonGeneration}`;
}

// True if the given summon generation is still the live elemental at time `at`.
// Guards scheduled tasks against firing for an expired or replaced summon.
function activeElemental(context: ElementalistSchedulerContext, summonGeneration: number, at: number): boolean {
  const elemental = professionCoreState(context).summonedElemental;
  return (
    (elemental.element === 'Fire' || elemental.element === 'Earth') &&
    elemental.summonGeneration === summonGeneration &&
    elemental.activeUntil > at - context.epsilon
  );
}

// Quickness speeds up the elemental's animations 50% (divides all timing offsets).
function actionRate(context: ElementalistSchedulerContext, at: number): number {
  return gw2BuffActiveForAudience(context, 'quickness', at, 'summon') ? 1.5 : 1;
}

// Alacrity speeds up the secondary-attack cooldown recharge (Flame Burst / Enervating Punch).
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

// Truncates the elemental's in-flight action event when it is pre-empted (a player
// command or expiry mid-swing) so the timeline shows the interruption at `at`.
function interruptCurrentAction(context: ElementalistSchedulerContext, at: number): void {
  const elemental = professionCoreState(context).summonedElemental;
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

// Starts one attack: interrupts any prior action, bumps actionGeneration, emits the
// 'action' event, and returns the generation + activation id the impact tasks carry
// so a superseded action's impacts can be discarded.
function beginSummonAction(
  context: ElementalistSchedulerContext,
  at: number,
  skillId: number,
  skillName: string,
  animationEnd: number
): Readonly<{ actionGeneration: number; activationId: string }> {
  const elemental = professionCoreState(context).summonedElemental;
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
    summonOwner: elementalistElementalCompanionId(elemental.summonGeneration),
    autonomousElementalSkill: !playerCommanded,
    playerCommandedElementalSkill: playerCommanded
  });
  return {
    actionGeneration: elemental.actionGeneration,
    activationId
  };
}

// Queues an IMPACT task (a single hit landing) stamped with the summon/action
// generation so it self-cancels if the elemental or action is gone by then.
function scheduleImpact(
  context: ElementalistSchedulerContext,
  at: number,
  impact: ElementalImpact,
  action: Readonly<{ actionGeneration: number; activationId: string }>,
  hitIndex = 1,
  priority = -20
): void {
  const elemental = professionCoreState(context).summonedElemental;
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

// Queues the next AI decision tick after the current action's recovery window.
function scheduleNextAi(context: ElementalistSchedulerContext, at: number, actionGeneration: number): void {
  const elemental = professionCoreState(context).summonedElemental;
  elemental.nextActionAt = at;
  scheduleTask(context, ELEMENTAL_AI_TASK, at, {
    summonGeneration: elemental.summonGeneration,
    actionGeneration
  });
}

// --- Attack starters -------------------------------------------------------
// Each starter follows the same shape: read the EVTC-derived timing profile, scale
// offsets by the quickness action rate, emit the action, queue its impact(s), mark
// the elemental busy until recovery ends, then queue the next AI tick.

// Fire auto-attack: single projectile hit.
function startFireball(context: ElementalistSchedulerContext, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.fireball;
  const rate = actionRate(context, at);
  const action = beginSummonAction(context, at, profile.skillId, 'Fireball', profile.animationEnd / rate);
  scheduleImpact(context, at + profile.impact / rate, 'fireball', action);
  const nextAt = at + profile.recovery / rate;
  professionCoreState(context).summonedElemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

// Fire secondary: hit + party Might; sets its own cooldown (alacrity-scaled) before
// it can be chosen again over the Fireball auto.
function startFlameBurst(context: ElementalistSchedulerContext, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
  const action = beginSummonAction(context, at, profile.skillId, 'Flame Burst', profile.animationEnd / rate);
  elemental.secondaryAttackReadyAt =
    at + profile.animationEnd / rate + profile.cooldown / summonRechargeRate(context, at);
  scheduleImpact(context, at + profile.impact / rate, 'flame-burst', action);
  const nextAt = at + profile.recovery / rate;
  elemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

// Fire player command (flip skill): three projectiles + a final explosion hit.
// Recovery is longer on the first-ever command vs subsequent ones (EVTC-observed).
function startFlameBarrage(context: ElementalistSchedulerContext, at: number): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
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

// Earth auto-attack: single melee hit.
function startPunch(context: ElementalistSchedulerContext, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.punch;
  const rate = actionRate(context, at);
  const action = beginSummonAction(context, at, profile.skillId, 'Punch', profile.animationEnd / rate);
  scheduleImpact(context, at + profile.impact / rate, 'punch', action);
  const nextAt = at + profile.recovery / rate;
  professionCoreState(context).summonedElemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

// Earth secondary: hit + Weakness; cooldown-gated (alacrity-scaled) like Flame Burst.
function startEnervatingPunch(context: ElementalistSchedulerContext, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.enervatingPunch;
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
  const action = beginSummonAction(context, at, profile.skillId, 'Enervating Punch', profile.animationEnd / rate);
  elemental.secondaryAttackReadyAt =
    at + profile.animationEnd / rate + profile.cooldown / summonRechargeRate(context, at);
  scheduleImpact(context, at + profile.impact / rate, 'enervating-punch', action);
  const nextAt = at + profile.recovery / rate;
  elemental.busyUntil = nextAt;
  scheduleNextAi(context, nextAt, action.actionGeneration);
}

// Earth player command (flip skill): hit + Crippled/Immobilized + party Protection.
// Same first-vs-subsequent recovery split as Flame Barrage.
function startStomp(context: ElementalistSchedulerContext, at: number): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  const rate = actionRate(context, at);
  const elemental = professionCoreState(context).summonedElemental;
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

// Damage metadata marking an elemental strike as independent: it uses the profile's
// own base attributes (not inherited player stats or profession modifiers) and a
// fixed 5% crit / 150% crit damage, so its numbers are self-contained.
function summonStrikeMetadata(element: ElementalKind, summonGeneration: number, baseDamage: number): SchedulerRecord {
  const profile = elementalRuntimeProfile(element);
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
    summonOwner: elementalistElementalCompanionId(summonGeneration),
    skillWeapon: 'Unequipped'
  };
}

// Emits one damage event for a strike. If a Lightning Jolt copy is armed (see
// armElementalistElementalLightningJolt), it fires first as a one-shot bonus hit and
// is consumed. The main strike is tagged autonomous vs player-commanded by name.
function emitStrike(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
  skillId: number,
  skillName: string,
  baseDamage: number,
  hitIndex: number,
  totalHits: number,
  coefficient = 1,
  fields: SchedulerRecord = {}
): void {
  const elemental = professionCoreState(context).summonedElemental;
  const element = elemental.element as ElementalKind;
  const pendingLightningJolt = elemental.pendingLightningJolt;
  if (pendingLightningJolt) {
    // Lightning Jolt is an allied one-shot charge, so the elemental consumes its copy on its next strike.
    elemental.pendingLightningJolt = null;
    emitSkillDamage(context, {
      activationId: context.createActivationId('effect'),
      at: task.at,
      source: `${element} Elemental`,
      sourceId: pendingLightningJolt.skillId,
      actorType: 'summon',
      skillId: pendingLightningJolt.skillId,
      skillName: 'Lightning Jolt',
      name: 'Lightning Jolt',
      coefficient: pendingLightningJolt.coefficient,
      hits: 1,
      noCrit: true,
      skillWeapon: 'Unequipped',
      weaponStrengthProfileId: ELEMENTAL_LIGHTNING_JOLT_PROFILE.weaponStrengthProfileId,
      independentSummonStrike: true,
      summonInheritsAttributes: false,
      summonBasePower: ELEMENTAL_LIGHTNING_JOLT_PROFILE.basePower,
      summonBasePrecision: 1000,
      summonBaseFerocity: 0,
      summonUsesMight: false,
      summonUsesEquipmentModifiers: false,
      summonUsesProfessionModifiers: false,
      summonOwner: elementalistElementalCompanionId(Number(task.payload?.summonGeneration || 0))
    });
  }

  emitSkillDamage(context, {
    activationId: task.payload?.activationId,
    at: task.at,
    source: `${element} Elemental`,
    sourceId: skillId,
    actorType: 'summon',
    skillId,
    skillName,
    name: skillName,
    coefficient,
    hits: 1,
    hitIndex,
    totalHits,
    autonomousElementalSkill: skillName !== commandName(element),
    playerCommandedElementalSkill: skillName === commandName(element),
    ...summonStrikeMetadata(element, Number(task.payload?.summonGeneration || 0), baseDamage),
    ...fields
  });
}

// Elemental-applied conditions are credited to the player (actorType 'player',
// flagged elementalOwnedCondition) so they benefit from player condition attributes.
function emitPlayerOwnedCondition(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>,
  skillId: number,
  skillName: string,
  condition: string,
  duration: number,
  stacks = 1
): void {
  const elemental = professionCoreState(context).summonedElemental;
  emitSkillCondition(context, {
    activationId: task.payload?.activationId,
    at: task.at,
    source: `${elemental.element} Elemental`,
    sourceId: skillId,
    actorType: 'player',
    skillId,
    skillName,
    name: `${skillName} — ${condition}`,
    condition,
    stacks,
    duration,
    elementalOwnedCondition: true
  });
}

// Flame Burst shares Might to the 5-player party.
function emitFlameBurstMight(context: ElementalistSchedulerContext, task: ScheduledTask<ElementalTaskPayload>): void {
  const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBurst;
  const sourceSkill = context.catalog.skillsById.get(ID.GLYPH_OF_ELEMENTALS);
  if (!sourceSkill) return;
  emitSkillBuff(context, {
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
    duration: gw2SchedulerBoonDuration(context, sourceSkill, 'might', profile.mightDuration),
    audience: { recipients: 'party' as const, maximumRecipients: 5 }
  });
}

// Stomp shares Protection to the 5-player party.
function emitStompProtection(context: ElementalistSchedulerContext, task: ScheduledTask<ElementalTaskPayload>): void {
  const profile = EARTH_ELEMENTAL_EVTC_PROFILE.stomp;
  const sourceSkill = context.catalog.skillsById.get(ID.GLYPH_OF_ELEMENTALS_EARTH);
  if (!sourceSkill) return;
  emitSkillBuff(context, {
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
    duration: gw2SchedulerBoonDuration(context, sourceSkill, 'protection', profile.protectionDuration),
    audience: { recipients: 'party' as const, maximumRecipients: 5 }
  });
}

// IMPACT task handler: lands one hit. Bails if the summon expired/was replaced or the
// action was superseded, then dispatches per impact kind to emit strike + effects.
function handleElementalImpactTask(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>
): void {
  const payload = task.payload;
  if (!payload) return;
  const elemental = professionCoreState(context).summonedElemental;
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
    // 3 projectile hits (hitIndex 1..3 of 4); the first also applies stacked Burning.
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
    const fixedStrikeMetadata = {
      // Barrage keeps the elemental's fixed damage profile while Fury remains eligible to affect critical hits.
      summonUsesMight: false,
      summonUsesEquipmentModifiers: false
    };
    emitStrike(
      context,
      task,
      profile.skillId,
      'Flame Barrage',
      profile.damagePerCoefficient,
      Number(payload.hitIndex || 1),
      4,
      profile.projectileCoefficient,
      fixedStrikeMetadata
    );
    if (Number(payload.hitIndex || 1) === 1) {
      emitPlayerOwnedCondition(
        context,
        task,
        profile.skillId,
        'Flame Barrage',
        'Burning',
        profile.burningDuration,
        profile.burningStacks
      );
    }

    return;
  }

  if (payload.impact === 'flame-barrage-explosion') {
    // Final 4th hit of Flame Barrage with its own explosion coefficient.
    const profile = FIRE_ELEMENTAL_EVTC_PROFILE.flameBarrage;
    emitStrike(
      context,
      task,
      profile.skillId,
      'Flame Barrage',
      profile.damagePerCoefficient,
      4,
      4,
      profile.explosionCoefficient,
      {
        summonUsesMight: false,
        summonUsesEquipmentModifiers: false
      }
    );
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

// AI task handler: picks the next autonomous attack. Prefers the secondary attack
// (Flame Burst / Enervating Punch) whenever its cooldown is ready, else the auto.
// Player commands (Flame Barrage / Stomp) are driven by the rotation, not here.
function handleElementalAiTask(context: ElementalistSchedulerContext, task: ScheduledTask<ElementalTaskPayload>): void {
  const payload = task.payload;
  if (!payload) return;
  const elemental = professionCoreState(context).summonedElemental;
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

// EXPIRE task handler: end of lifetime. Interrupts the in-flight action, clears all
// elemental state, removes the command flip, and puts the glyph on its post-expiry
// recharge so it can be re-summoned. Ignored if a newer summon already superseded it.
function handleElementalExpireTask(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<ElementalTaskPayload>
): void {
  const payload = task.payload;
  if (!payload) return;
  const state = professionCoreState(context);
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
  elemental.pendingLightningJolt = null;
  elemental.started = false;
  delete state.availableFlips[commandName(element)];
  const glyph = glyphSkillForElement(context, element);
  if (glyph) {
    context.state.cooldowns.set(
      glyph.id,
      task.at +
        balanceProfileValueFromContext(
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

// Kicks off the attack loop after the initial target-acquisition delay. Idempotent
// via the `started` flag so combat-start and cast paths don't double-start it.
function startElemental(context: ElementalistSchedulerContext, at: number): void {
  const elemental = professionCoreState(context).summonedElemental;
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

  const delay = balanceProfileValueFromContext(
    context,
    PROFILE.summonedElemental,
    'initialDelay',
    elemental.element === 'Earth'
      ? EARTH_ELEMENTAL_EVTC_PROFILE.targetAcquisitionDelay
      : FIRE_ELEMENTAL_EVTC_PROFILE.targetAcquisitionDelay
  );
  scheduleNextAi(context, at + delay, elemental.actionGeneration);
}

/**
 * Cast-start hook: tags the glyph's action event with which element it summons so the
 * timeline and presentation layers can tell the two variants apart. No-op for other skills.
 */
export function beginElementalistGlyphCast(context: ElementalistCastContext, skill: Skill): void {
  const element = elementalForGlyph(skill);
  if (!element) return;
  context.replaceEvent(context.action, { summonedElement: element });
}

// Core spawn: cancels the previous elemental's tasks, resets summonedElemental state
// with a fresh summonGeneration, emits the expiry marker, schedules EXPIRE, and enables
// the command flip. Optionally starts the attack loop immediately.
function summonElemental(
  context: ElementalistSchedulerContext,
  skill: Skill,
  at: number,
  startImmediately: boolean,
  element: ElementalKind
): void {
  const state = professionCoreState(context);
  const profile = elementalRuntimeProfile(element);
  context.tasks.cancelOwner(ELEMENTAL_TASK_OWNER);
  const summonGeneration = state.summonedElemental.summonGeneration + 1;
  state.summonedElemental = {
    element,
    summonGeneration,
    actionGeneration: 0,
    activeUntil:
      at + balanceProfileValueFromContext(context, PROFILE.summonedElemental, 'durationMultiplier', profile.lifetime),
    busyUntil: at,
    nextActionAt: 0,
    secondaryAttackReadyAt: at,
    currentActivationId: null,
    pendingLightningJolt: null,
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

/**
 * Cast-complete hook: spawns the elemental at cast end. Its attack loop starts immediately
 * unless the rotation is still pre-combat and waiting on an explicit combat-start event.
 */
export function completeElementalistGlyphCast(context: ElementalistCastContext, skill: Skill): void {
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

/**
 * Cast-complete hook for the player-commanded flip skills: pre-empts whatever the elemental
 * is doing and drives Flame Barrage / Stomp on the live companion.
 */
export function completeElementalistElementalCommand(context: ElementalistCastContext, skill: Skill): void {
  if (skill.id === FLAME_BARRAGE_ID) {
    startFlameBarrage(context, context.effectiveEnd);
  } else if (skill.id === STOMP_ID) {
    startStomp(context, context.effectiveEnd);
  }
}

/**
 * Arms one Lightning Jolt copy on the live elemental. The charge rides the elemental's next
 * strike as a bonus hit and is consumed there (see emitStrike); ignored with no elemental out.
 */
export function armElementalistElementalLightningJolt(
  context: ElementalistCastContext,
  skillId: number,
  coefficient: number
): void {
  const elemental = professionCoreState(context).summonedElemental;
  if (
    (elemental.element === 'Fire' || elemental.element === 'Earth') &&
    elemental.activeUntil > context.effectiveEnd + context.epsilon
  ) {
    // Only represented allied actors are armed; unmodeled party members cannot contribute synthetic damage.
    elemental.pendingLightningJolt = { coefficient, skillId };
  }
}

/**
 * Event observer driving auto-summon and the delayed attack-loop start. Two triggers:
 *   1) any player action while no elemental is active (and one is slotted) → summon
 *      (without starting), so the companion exists alongside the player's opener;
 *   2) combat start (explicit event, or first offensive event when none is expected)
 *      → summon-and-start if none active, otherwise start the pending elemental.
 */
export function observeElementalistElementalEvent(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  const state = professionCoreState(context);
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
      ['player', 'summon'].includes(String(event.actorType)));
  if (!combatStarted) return;
  if (state.summonedElemental.activeUntil <= event.at + context.epsilon && autoSummon) {
    const glyph = glyphSkillForElement(context, selected);
    if (glyph) summonElemental(context, glyph, event.at, true, selected);
    return;
  }

  startElemental(context, event.at);
}

/**
 * Availability gate for this subsystem. Command flips (Flame Barrage / Stomp) are usable when
 * the matching elemental is active — or would be auto-summoned; the glyphs themselves are
 * blocked (with a retry time) while their elemental lives. Returns null for unrelated skills.
 */
export function elementalistElementalAvailability(
  context: ElementalistPrecastContext,
  skill: Skill
): AvailabilityResult | null {
  const elemental = professionCoreState(context).summonedElemental;
  if (skill.id === FLAME_BARRAGE_ID) {
    const active = elemental.element === 'Fire' && elemental.activeUntil > context.start + context.epsilon;
    return active ||
      (elemental.activeUntil <= context.start + context.epsilon &&
        automaticSummoningEnabled(context as unknown as ElementalistSchedulerContext) &&
        selectedElemental(context as unknown as ElementalistSchedulerContext) === 'Fire')
      ? ready()
      : unavailable('an active Fire Elemental is required.');
  }

  if (skill.id === STOMP_ID) {
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

/**
 * Task-type → handler map registered with the elementalist scheduler; these three handlers are
 * the entire runtime of a summoned elemental (decide, land a hit, expire).
 */
export const elementalistElementalTaskHandlers = Object.freeze({
  [ELEMENTAL_AI_TASK]: handleElementalAiTask,
  [ELEMENTAL_IMPACT_TASK]: handleElementalImpactTask,
  [ELEMENTAL_EXPIRE_TASK]: handleElementalExpireTask
});
