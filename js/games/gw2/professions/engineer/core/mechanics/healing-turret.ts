import { consumeSkillFlip, armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
/**
 * Owns Healing Turret's arm/detonate/overcharge cycle. Casting arms Detonate Healing Turret;
 * an unused 10s window auto-swaps the armed flip to Cleansing Burst, whose manual use re-arms
 * Detonate and restarts the window. Manually detonating ends the cycle and starts the turret's
 * real 20s cooldown, which stays deferred until then so the turret cannot be re-summoned early.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { produceGw2OwnedComboEvents } from '#gw2/platform/execution/gw2-policy/combo-materializer.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerCastContext, EngineerSchedulerContext, EngineerSkill } from '#gw2/professions/engineer/types.js';

const CLEANSING_BURST_SWAP_DELAY_SECONDS = 10;
const INITIAL_DETONATE_LOCKOUT_SECONDS = 0.5;
// Matches the turret's measured overcharge delay: the first pulse lands 240 ms after cast completion.
const FIRST_PULSE_DELAY_SECONDS = 0.24;

function scheduleCleansingBurstSwap(context: EngineerCastContext, at: number): void {
  healingTurretWindow.start(context, { key: 'turret', times: [at + CLEANSING_BURST_SWAP_DELAY_SECONDS], captured: {} });
}

/** Emits Cleansing Burst's boon(s) and water field once, attributed to Cleansing Burst rather than the turret cast. */
function emitCleansingBurstPulse(context: EngineerCastContext, at: number): void {
  const cleansingBurst = context.catalog.skillsById.get(ID.CLEANSING_BURST);
  if (!cleansingBurst) throw new TypeError('Cleansing Burst skill fragment is missing from the Engineer catalog.');
  const boonEffects = (cleansingBurst.effects ?? []).filter(
    (effect) => effect.type === 'boon' || effect.type === 'buff'
  );
  boonEffects.forEach((effect) => {
    emitSkillBuff(context, cleansingBurst, {
      at,
      kind: String(effect.boon || effect.kind || ''),
      stacks: Number(effect.stacks),
      duration: Number(effect.duration)
    });
  });
  // The water field survives independently when a patch removes Cleansing Burst's boons.
  const activation = context.events.find(
    (event) => event.type === 'action' && event.activationId === context.reservationId
  )!;
  produceGw2OwnedComboEvents(context, {
    ...activation,
    type: 'action',
    at,
    source: cleansingBurst.name,
    sourceId: cleansingBurst.id,
    actorType: 'player',
    skillId: cleansingBurst.id,
    skillName: cleansingBurst.name,
    activationId: `${context.reservationId}:cleansing-burst`,
    comboFields: cleansingBurst.comboFields
  });
}

/** Arms Detonate Healing Turret, fires the initial automatic Cleansing Burst pulse, and starts the 10s window. */
export function scheduleHealingTurretCast(context: EngineerCastContext, _skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const activationId = context.reservationId;
  const at = context.effectiveEnd;
  const pulseAt = at + FIRST_PULSE_DELAY_SECONDS;
  state.healingTurretActivationId = activationId;
  consumeSkillFlip(state.availableFlips, ID.CLEANSING_BURST);
  // Detonation is unavailable briefly after placement so the automatic burst resolves first.
  context.cooldownController.setReadyAt(ID.DETONATE_HEALING_TURRET, at + INITIAL_DETONATE_LOCKOUT_SECONDS);
  emitCleansingBurstPulse(context, pulseAt);
  scheduleCleansingBurstSwap(context, pulseAt);
}

/** Ends the cycle: cancels the pending swap and starts Healing Turret's real cooldown from the detonation time. */
export function scheduleHealingTurretDetonate(context: EngineerCastContext, _skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  healingTurretWindow.cancelKey(context, 'turret');
  state.healingTurretActivationId = '';
  consumeSkillFlip(state.availableFlips, ID.CLEANSING_BURST);
  const healingTurret = context.catalog.skillsById.get(ID.HEALING_TURRET);
  if (healingTurret) {
    context.cooldownController.startRecharge(healingTurret, at);
  }

  emitEngineerStateSnapshot(context, at, 'healing-turret-detonated');
}

/** Cleansing Burst's manual use re-arms Detonate and restarts the 10s window; its own pulse fires via the normal cast. */
export function scheduleCleansingBurstUse(context: EngineerCastContext, _skill: EngineerSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  healingTurretWindow.cancelKey(context, 'turret');
  armSkillFlip(state.availableFlips, ID.DETONATE_HEALING_TURRET, at);
  emitEngineerStateSnapshot(context, at, 'cleansing-burst-used');
  scheduleCleansingBurstSwap(context, at);
}

/** Swaps the armed flip from Detonate Healing Turret to Cleansing Burst once the 10s window lapses unused. */
export const healingTurretWindow = timedEffect({
  id: 'engineer.healing-turret-swap-to-cleansing-burst',
  effectsAt(context: EngineerSchedulerContext, at: number) {
    const state = professionCoreState(context);
    consumeSkillFlip(state.availableFlips, ID.DETONATE_HEALING_TURRET);
    armSkillFlip(state.availableFlips, ID.CLEANSING_BURST, at);
    emitEngineerStateSnapshot(context, at, 'healing-turret-swap-to-cleansing-burst');
  }
});
