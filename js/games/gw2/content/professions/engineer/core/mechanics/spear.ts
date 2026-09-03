/**
 * Owns Engineer spear state transitions, task handlers, and cross-skill delayed behavior.
 * Skill fragments live in `skills/weapons/spear.ts`; handler registration lives in `execution/index.ts`.
 */
import { emitSkillCondition, emitSkillControl, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/content/professions/engineer/state.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

interface LightningRodTaskPayload extends SchedulerRecord {
  readonly activationId: string;
}

const LIGHTNING_ROD_FIRST_PULSE_DELAY_SECONDS = 0.16;
const LIGHTNING_ROD_PULSE_INTERVAL_SECONDS = 0.5;
const LIGHTNING_ROD_PULSE_COUNT = 8;
// measured from EVTC across eleven activations — EA becomes available 4.196–4.203s after LR starts
const ELECTRIC_ARTILLERY_ARMING_TIME_SECONDS = 4.2;

/** Emits the standard player-sourced event envelope used by Engineer spear mechanics. */
function emitSpearEvent(context: EngineerCastContext, skill: EngineerSkill, at: number, eventType: string): void {
  context.emit({
    type: eventType,
    at,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name
  });
}

/** Starts Lightning Rod's pulse sequence and the timed Electric Artillery availability window. */
export function scheduleLightningRod(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = professionCoreState(context);
  // reservationId becomes the activationId so all tasks from this cast share a cancellable ownerId
  const activationId = context.reservationId;
  const firstAt = context.effectiveEnd + LIGHTNING_ROD_FIRST_PULSE_DELAY_SECONDS;
  // arming time measured from cast START, not effectiveEnd
  const readyAt = context.start + ELECTRIC_ARTILLERY_ARMING_TIME_SECONDS;
  const ownerId = `engineer.lightning-rod:${activationId}`;
  // lightningRodActivationId gates charge/ready/expire task handlers — stale tasks from an old cast are ignored
  state.lightningRodActivationId = activationId;
  state.lightningRodChargeExpiries = [];
  state.electricArtilleryAvailable = false;
  state.availableFlips[ID.ELECTRIC_ARTILLERY] = false;
  state.electricArtilleryReadyAt = readyAt;
  // EA expires 14s after it arms; player loses the window if they don't fire it
  state.electricArtilleryExpiresAt = readyAt + 14;
  emitEngineerStateSnapshot(context, context.effectiveEnd, 'lightning-rod-active');

  for (let index = 0; index < LIGHTNING_ROD_PULSE_COUNT; index += 1) {
    const at = firstAt + index * LIGHTNING_ROD_PULSE_INTERVAL_SECONDS;
    context.emit({
      type: 'engineer.lightning-rod-pulse',
      at,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      hitIndex: index + 1,
      totalHits: LIGHTNING_ROD_PULSE_COUNT
    });
    // each pulse task adds a charge; the task payload carries activationId to guard against stale casts
    context.tasks.schedule({
      type: 'engineer.lightning-rod-charge',
      at,
      ownerId,
      payload: { activationId }
    });
  }

  context.tasks.schedule({
    type: 'engineer.electric-artillery-ready',
    at: readyAt,
    ownerId,
    payload: { activationId }
  });
  context.tasks.schedule({
    type: 'engineer.electric-artillery-expire',
    at: state.electricArtilleryExpiresAt,
    ownerId,
    payload: { activationId }
  });
}

/** Applies Conduit Surge's Focused window and emits its synchronized state and skill events. */
export function scheduleConduitSurge(context: EngineerCastContext, skill: EngineerSkill): void {
  const at = context.effectiveEnd;
  // update focusedUntil in scheduler state for subsequent availability/damage checks
  professionCoreState(context).focusedUntil = Math.max(professionCoreState(context).focusedUntil, at + 10);
  // also emit a state event so the resolver's Focused window is synchronized
  emitEngineerStateSnapshot(context, at, 'conduit-surge');
  emitSpearEvent(context, skill, at, 'engineer.conduit-surge');
}

/** Fires Electric Artillery with its live Lightning Rod charges and clears the armed sequence. */
export function scheduleElectricArtillery(context: EngineerCastContext, skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  // only charges that haven't expired yet contribute — charges have a rolling 14s expiry window
  const charges = state.lightningRodChargeExpiries.filter((expiresAt) => Number(expiresAt) > at).length;
  context.emit({
    type: 'engineer.electric-artillery',
    at,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    charges
  });
  // cancel all remaining LR tasks in one call — charge/ready/expire tasks all share the same ownerId
  context.tasks.cancelOwner(`engineer.lightning-rod:${state.lightningRodActivationId}`);
  state.lightningRodActivationId = '';
  state.lightningRodChargeExpiries = [];
  state.electricArtilleryAvailable = false;
  state.availableFlips[ID.ELECTRIC_ARTILLERY] = false;
  state.electricArtilleryReadyAt = 0;
  state.electricArtilleryExpiresAt = 0;
  emitEngineerStateSnapshot(context, at, 'electric-artillery-consumed');
}

/** Records one non-stale Lightning Rod charge while enforcing charge expiry and the twelve-charge cap. */
export function handleLightningRodCharge(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<LightningRodTaskPayload>
): void {
  const state = professionCoreState(context);
  // activationId mismatch means this is a stale task from a previous LR cast — discard it
  if (state.lightningRodActivationId !== task.payload?.activationId) return;
  // prune expired charges before adding the new one
  state.lightningRodChargeExpiries = state.lightningRodChargeExpiries.filter(
    (expiresAt) => Number(expiresAt) > task.at
  );
  // 12-charge cap matches EA's maximum charge input; each charge lasts 14s
  if (state.lightningRodChargeExpiries.length < 12) {
    state.lightningRodChargeExpiries.push(task.at + 14);
  }
}

/** Makes Electric Artillery available when the active Lightning Rod sequence finishes arming. */
export function handleElectricArtilleryReady(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<LightningRodTaskPayload>
): void {
  const state = professionCoreState(context);
  if (state.lightningRodActivationId !== task.payload?.activationId) return;
  state.electricArtilleryAvailable = true;
  state.availableFlips[ID.ELECTRIC_ARTILLERY] = true;
  state.electricArtilleryReadyAt = 0;
  emitEngineerStateSnapshot(context, task.at, 'electric-artillery-ready');
}

/** Clears an unused Electric Artillery window after its active Lightning Rod sequence expires. */
export function handleElectricArtilleryExpire(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<LightningRodTaskPayload>
): void {
  const state = professionCoreState(context);
  if (state.lightningRodActivationId !== task.payload?.activationId) return;
  state.lightningRodActivationId = '';
  state.lightningRodChargeExpiries = [];
  state.electricArtilleryAvailable = false;
  state.availableFlips[ID.ELECTRIC_ARTILLERY] = false;
  state.electricArtilleryReadyAt = 0;
  state.electricArtilleryExpiresAt = 0;
  emitEngineerStateSnapshot(context, task.at, 'electric-artillery-expired');
}

/** Emits Roiling Skies as a stun, or as a launch while Focused is active. */
export function scheduleRoilingSkiesControl(context: EngineerCastContext, skill: EngineerSkill): void {
  // Focused state changes the CC type from Stun to Launch
  const isFocused = professionCoreState(context).focusedUntil > context.effectiveEnd;
  emitSkillControl(context, {
    at: context.effectiveEnd,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    controlKind: isFocused ? 'launch' : 'stun',
    focused: isFocused
  });
}

/** Emits Devastator's delayed six-packet damage and Burning follow-up when Focused survives to impact. */
export function scheduleDevastatorFollowup(context: EngineerCastContext, _skill: EngineerSkill): void {
  // fullEnd (not effectiveEnd) — follow-up fires at animation end, not the interrupt-commit point
  const impactAt = context.fullEnd;
  if (professionCoreState(context).focusedUntil <= impactAt) return;
  const activationId = `${context.reservationId}:focused-devastation`;
  for (let index = 0; index < 6; index += 1) {
    const at = impactAt + 0.16 * (index + 1);
    emitSkillDamage(context, {
      at,
      source: 'engineer',
      sourceId: ID.FOCUSED_DEVASTATION,
      activationId,
      actorType: 'player',
      skillId: ID.FOCUSED_DEVASTATION,
      skillName: 'Focused Devastation',
      name: 'Focused Devastation',
      coefficient: 0.2,
      hits: 1,
      hitIndex: index + 1,
      totalHits: 6,
      skillWeapon: 'Spear',
      weaponStrengthProfileId: 'nonweapon.unequipped',
      // projectile already in flight — events persist even if the cast is interrupted
      persistsAfterInterrupt: true
    });
    emitSkillCondition(context, {
      at,
      source: 'engineer',
      sourceId: ID.FOCUSED_DEVASTATION,
      activationId,
      actorType: 'player',
      skillId: ID.FOCUSED_DEVASTATION,
      skillName: 'Focused Devastation',
      name: 'Focused Devastation — Burning',
      condition: 'Burning',
      stacks: 1,
      duration: 2,
      persistsAfterInterrupt: true
    });
  }
}
