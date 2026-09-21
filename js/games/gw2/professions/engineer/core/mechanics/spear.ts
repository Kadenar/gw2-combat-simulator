import { consumeSkillFlip, armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
/**
 * Owns Engineer spear state transitions, task handlers, and cross-skill delayed behavior.
 * Skill fragments live in `skills/weapons/spear.ts`; handler registration lives in `execution/index.ts`.
 */
import {
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { activeStackCount, addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { EngineerCastContext, EngineerSchedulerContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

const LIGHTNING_ROD_FIRST_PULSE_DELAY_SECONDS = 0.16;
const LIGHTNING_ROD_PULSE_INTERVAL_SECONDS = 0.5;
const LIGHTNING_ROD_PULSE_COUNT = 8;
// measured from EVTC across eleven activations — EA becomes available 4.196-4.203s after LR starts
const ELECTRIC_ARTILLERY_ARMING_TIME_SECONDS = 4.2;
const LIGHTNING_ROD_CHARGE_DURATION_SECONDS = 12;
const LIGHTNING_ROD_MAXIMUM_CHARGES = 12;

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
  const firstAt = context.effectiveEnd + LIGHTNING_ROD_FIRST_PULSE_DELAY_SECONDS;
  // arming time measured from cast START, not effectiveEnd
  const readyAt = context.start + ELECTRIC_ARTILLERY_ARMING_TIME_SECONDS;
  state.lightningRodChargeExpiries = [];
  // Artillery stays hidden while charging and expires eight seconds after becoming ready.
  const window = armSkillFlip(state.availableFlips, ID.ELECTRIC_ARTILLERY, readyAt, readyAt + 8);
  emitEngineerStateSnapshot(context, context.effectiveEnd, 'lightning-rod-active');

  // Replacing the keyed lifetime invalidates its pulses, arming, and expiry together.
  lightningRod.start(context, {
    key: 'rod',
    times: [
      ...Array.from(
        { length: LIGHTNING_ROD_PULSE_COUNT },
        (_, index) => firstAt + index * LIGHTNING_ROD_PULSE_INTERVAL_SECONDS
      ),
      readyAt,
      window.expiresAt!
    ],
    captured: { skillId: skill.id, skillName: skill.name }
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

/** Consumes charges at release and schedules one impact so damage, conditions, and Focused share its arrival time. */
export function scheduleElectricArtillery(context: EngineerCastContext, skill: EngineerSkill): void {
  // A cancelled cast never releases a projectile or consumes the armed sequence.
  if (context.action.cancelled) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  // Snapshot unexpired charges at release; expiry during flight must not weaken an already-fired projectile.
  const charges = activeStackCount(state.lightningRodChargeExpiries, at);
  context.emit({
    type: 'engineer.electric-artillery',
    // Resolve the projectile 600 ms after release, using the measured close-range impact delay.
    at: at + 0.6,
    source: 'engineer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    charges,
    persistsAfterInterrupt: true
  });
  // Retire the remaining pulses and flip transitions without touching the released projectile.
  lightningRod.cancelKey(context, 'rod');
  state.lightningRodChargeExpiries = [];
  consumeSkillFlip(state.availableFlips, ID.ELECTRIC_ARTILLERY);
  emitEngineerStateSnapshot(context, at, 'electric-artillery-consumed');
}

/** Shared lifetime execution grants charges at each pulse, then arms and expires the separate flip window. */
export const lightningRod = timedEffect({
  id: 'engineer.lightning-rod',
  effectsAt(
    context: EngineerSchedulerContext,
    at: number,
    captured: { readonly skillId: EngineerSkill['id']; readonly skillName: string },
    occurrence: number
  ) {
    const state = professionCoreState(context);
    if (occurrence < LIGHTNING_ROD_PULSE_COUNT) {
      context.emit({
        type: 'engineer.lightning-rod-pulse',
        at,
        source: 'engineer',
        sourceId: captured.skillId,
        actorType: 'player',
        skillId: captured.skillId,
        skillName: captured.skillName,
        name: captured.skillName,
        hitIndex: occurrence + 1,
        totalHits: LIGHTNING_ROD_PULSE_COUNT
      });
      state.lightningRodChargeExpiries = addTimedStacks(
        state.lightningRodChargeExpiries,
        1,
        at,
        LIGHTNING_ROD_CHARGE_DURATION_SECONDS,
        LIGHTNING_ROD_MAXIMUM_CHARGES
      ).expiries;
    } else if (occurrence === LIGHTNING_ROD_PULSE_COUNT) {
      emitEngineerStateSnapshot(context, at, 'electric-artillery-ready');
    } else {
      state.lightningRodChargeExpiries = [];
      consumeSkillFlip(state.availableFlips, ID.ELECTRIC_ARTILLERY);
      emitEngineerStateSnapshot(context, at, 'electric-artillery-expired');
    }
  }
});

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
      activationId,
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
