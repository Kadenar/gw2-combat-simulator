/**
 * Owns Healing Turret's arm/detonate/overcharge cycle. Casting arms Detonate Healing Turret;
 * an unused 10s window auto-swaps the armed flip to Cleansing Burst, whose manual use re-arms
 * Detonate and restarts the window. Manually detonating ends the cycle and starts the turret's
 * real 20s cooldown, which stays deferred until then so the turret cannot be re-summoned early.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';

interface HealingTurretTaskPayload extends SchedulerRecord {
  readonly activationId: string;
}

const CLEANSING_BURST_SWAP_DELAY_SECONDS = 10;
const INITIAL_DETONATE_LOCKOUT_SECONDS = 0.5;
// Matches the turret's measured overcharge delay: the first pulse lands 240 ms after cast completion.
const FIRST_PULSE_DELAY_SECONDS = 0.24;

function healingTurretOwnerId(activationId: string): string {
  return `engineer.healing-turret:${activationId}`;
}

function scheduleCleansingBurstSwap(context: EngineerCastContext, activationId: string, at: number): void {
  context.tasks.schedule({
    type: 'engineer.healing-turret-swap-to-cleansing-burst',
    at: at + CLEANSING_BURST_SWAP_DELAY_SECONDS,
    ownerId: healingTurretOwnerId(activationId),
    payload: { activationId }
  });
}

/** Emits Cleansing Burst's boon(s) and water field once, attributed to Cleansing Burst rather than the turret cast. */
function emitCleansingBurstPulse(context: EngineerCastContext, at: number): void {
  const cleansingBurst = context.catalog.skillsById.get(ID.CLEANSING_BURST);
  if (!cleansingBurst) throw new TypeError('Cleansing Burst skill fragment is missing from the Engineer catalog.');
  const boonEffects = (cleansingBurst.effects ?? []).filter(
    (effect) => effect.type === 'boon' || effect.type === 'buff'
  );
  boonEffects.forEach((effect, index) => {
    emitSkillBuff(context, cleansingBurst, {
      at,
      kind: String(effect.boon || effect.kind || ''),
      stacks: Number(effect.stacks || 1),
      duration: Number(effect.duration || 0),
      // Attach the field descriptor to only the first pulse so exactly one field is produced.
      ...(index === 0 ? { comboFields: cleansingBurst.comboFields } : {})
    });
  });
}

/** Arms Detonate Healing Turret, fires the initial automatic Cleansing Burst pulse, and starts the 10s window. */
export function scheduleHealingTurretCast(context: EngineerCastContext, _skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const activationId = context.reservationId;
  const at = context.effectiveEnd;
  const pulseAt = at + FIRST_PULSE_DELAY_SECONDS;
  state.healingTurretActivationId = activationId;
  state.availableFlips[ID.CLEANSING_BURST] = false;
  // Detonation is unavailable briefly after placement so the automatic burst resolves first.
  context.state.cooldowns.set(ID.DETONATE_HEALING_TURRET, at + INITIAL_DETONATE_LOCKOUT_SECONDS);
  emitCleansingBurstPulse(context, pulseAt);
  scheduleCleansingBurstSwap(context, activationId, pulseAt);
}

/** Ends the cycle: cancels the pending swap and starts Healing Turret's real cooldown from the detonation time. */
export function scheduleHealingTurretDetonate(context: EngineerCastContext, _skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  context.tasks.cancelOwner(healingTurretOwnerId(state.healingTurretActivationId));
  state.healingTurretActivationId = '';
  state.availableFlips[ID.CLEANSING_BURST] = false;
  const healingTurret = context.catalog.skillsById.get(ID.HEALING_TURRET);
  if (healingTurret) {
    context.state.cooldowns.set(ID.HEALING_TURRET, at + context.rechargeDurationFor(healingTurret, at));
  }

  emitEngineerStateSnapshot(context, at, 'healing-turret-detonated');
}

/** Cleansing Burst's manual use re-arms Detonate and restarts the 10s window; its own pulse fires via the normal cast. */
export function scheduleCleansingBurstUse(context: EngineerCastContext, _skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  context.tasks.cancelOwner(healingTurretOwnerId(state.healingTurretActivationId));
  state.availableFlips[ID.DETONATE_HEALING_TURRET] = true;
  emitEngineerStateSnapshot(context, at, 'cleansing-burst-used');
  scheduleCleansingBurstSwap(context, state.healingTurretActivationId, at);
}

/** Swaps the armed flip from Detonate Healing Turret to Cleansing Burst once the 10s window lapses unused. */
export function handleHealingTurretSwapToCleansingBurst(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<HealingTurretTaskPayload>
): void {
  const state = professionCoreState(context);
  if (state.healingTurretActivationId !== task.payload?.activationId) return;
  state.availableFlips[ID.DETONATE_HEALING_TURRET] = false;
  state.availableFlips[ID.CLEANSING_BURST] = true;
  emitEngineerStateSnapshot(context, task.at, 'healing-turret-swap-to-cleansing-burst');
}
