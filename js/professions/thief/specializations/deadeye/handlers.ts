import { deadeyeState } from './state.js';
import { augmentSkillHandler } from '../../../../platform/engine/skill-handlers.js';
import { professionCoreState } from '../../../../platform/engine/profession.js';
import { completeStealWithStoredSkills } from '../../core/steal.js';
import { emitStealTraitEffects } from '../../core/traits.js';
import { emitThiefCondition, emitThiefState, gainThiefInitiative } from '../../core/shared.js';
import { beginStealthAttack, completeStealthAttack } from '../../core/stealth.js';
import { grantThiefStealth } from '../../core/weapon-state.js';
import { consumeStoredStolenSkill } from '../../core/steal.js';
import { deadeyeStolenSkillGrant } from './mechanics.js';
import {
  applyMaleficentSeven,
  applyDeadeyesMarkTraits,
  applyDeadeyeStolenSkillTraits,
  deadeyeStealthAttackMaliceBonus,
  initialDeadeyeMalice
} from './traits.js';
import { THIEF_SKILL_IDS as ID } from '../../data/ids.js';
import type { ThiefCastContext, ThiefSimulationEvent, ThiefSkill } from '../../types.js';
import { thiefBalanceProfile, thiefBalanceProfileEffect } from '../../core/profiles.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

interface DeadeyeHandlerState {
  readonly malice?: number;
  readonly grantsStealth?: boolean;
}

function completeDeadeyesMark(context: ThiefCastContext): void {
  const state = deadeyeState.from(context);
  const at = context.effectiveEnd;
  // Re-marking an already-marked target adds to existing malice rather than resetting it
  const remarkingTarget = state.markedTargetId === 'primary-target' && state.markExpiresAt > at;
  state.markedTargetId = 'primary-target';
  state.markExpiresAt = at + Number(thiefBalanceProfile(context, PROFILE.resources)?.durationMultiplier || 30);
  state.markGeneration += 1;
  state.malice = remarkingTarget
    ? Math.min(state.maximumMalice, state.malice + initialDeadeyeMalice(context))
    : initialDeadeyeMalice(context);
  if (!remarkingTarget) state.maleficentSevenTriggered = false;
  applyMaleficentSeven(context, at);
  const grant = deadeyeStolenSkillGrant(context);
  completeStealWithStoredSkills(context, grant.skillIds, grant.forcedSkillId);
  applyDeadeyesMarkTraits(context, at);
  // Cancel any pending expiry task from the previous mark before scheduling the new one
  context.tasks.cancelOwner('thief.deadeye-mark');
  context.tasks.schedule({
    type: 'thief.deadeye-mark-expire',
    at: state.markExpiresAt,
    ownerId: 'thief.deadeye-mark',
    payload: { generation: state.markGeneration }
  });
  emitThiefState(context, at, 'deadeyes-mark');
}

function prepareDeadeyeStealthAttack(context: ThiefCastContext, skill: ThiefSkill): DeadeyeHandlerState {
  const state = deadeyeState.from(context);
  // Malicious Intent's bonus applies only when the target is already marked; snapshot effective malice before beginStealthAttack clears stealth
  const maliciousIntentMalice =
    state.markedTargetId && state.markExpiresAt > context.start ? deadeyeStealthAttackMaliceBonus(context) : 0;
  const handlerState = {
    malice: Math.min(state.maximumMalice, Math.max(0, Number(state.malice || 0)) + maliciousIntentMalice)
  };
  beginStealthAttack(context, skill);
  return handlerState;
}

function observeDeadeyeStealthEffect(
  context: ThiefCastContext,
  skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (skill.malicious && event.type === 'damage') {
    context.replaceEvent(event, {
      deadeyeMaliceSnapshot: Number(prepared.malice || 0)
    });
  }

  if (skill.id === ID.MALICIOUS_SNEAK_ATTACK && event.type === 'condition' && event.condition === 'Torment') {
    // Malicious Sneak Attack scales Torment duration by malice: base 1s + 2s per stack
    context.replaceEvent(event, {
      duration:
        Number(
          thiefBalanceProfileEffect(thiefBalanceProfile(context, PROFILE.maliciousSneakAttack), 'condition')
            ?.duration || 1
        ) +
        Number(prepared.malice || 0) *
          Number(thiefBalanceProfile(context, PROFILE.maliciousSneakAttack)?.durationMultiplier || 2)
    });
  }
}

function prepareDeadeyeStolenSkill(context: ThiefCastContext): DeadeyeHandlerState {
  // Stolen skills only grant stealth when the player has at least 3 malice; snapshot before events are emitted
  return { grantsStealth: deadeyeState.from(context).malice >= 3 };
}

function observeDeadeyeStolenEffect(
  context: ThiefCastContext,
  _skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (event.type === 'buff' && event.kind === 'stealth' && !prepared.grantsStealth) {
    // Suppress the skill's built-in stealth grant when malice < 3; zeroing duration/stacks is the standard nullification pattern
    context.replaceEvent(event, { duration: 0, stacks: 0 });
  }

  if (event.type === 'buff' && event.boon) {
    // Stolen skill boons are applied to the party (up to 5 allies), not just self
    context.replaceEvent(event, {
      recipients: 'party',
      maximumRecipients: 5
    });
  }
}

function completeDeadeyeStolenSkill(context: ThiefCastContext, skill: ThiefSkill, handlerState: unknown): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (prepared.grantsStealth) {
    grantThiefStealth(context, skill, context.effectiveEnd, 3);
  }

  consumeStoredStolenSkill(context, skill);
  applyDeadeyeStolenSkillTraits(context, context.effectiveEnd);
}

function completeMercy(context: ThiefCastContext): void {
  const state = deadeyeState.from(context);
  const malice = Math.max(0, Number(state.malice || 0));
  state.malice = 0;
  state.maleficentSevenTriggered = false;
  // Mercy resets Deadeye's Mark cooldown so the player can re-mark immediately
  context.state.cooldowns.delete(ID.DEADEYES_MARK);
  // Initiative refund is 3 base + 1 per malice stack consumed
  const profile = thiefBalanceProfile(context, PROFILE.mercy);
  gainThiefInitiative(
    context,
    Number(profile?.resourceGain || 3) + malice * Number(profile?.attributePerStack || 1),
    context.effectiveEnd,
    'mercy'
  );
  emitThiefState(context, context.effectiveEnd, 'mercy');
}

function completeShadowFlare(context: ThiefCastContext): void {
  const core = professionCoreState(context);
  // Register Shadow Swap as an available flip for 4s; availability.ts gates the cast on this timestamp
  core.availableFlips[ID.SHADOW_SWAP] =
    context.effectiveEnd + Number(thiefBalanceProfile(context, PROFILE.shadowFlare)?.durationMultiplier || 4);
  emitThiefState(context, context.effectiveEnd, 'shadow-flare');
}

function completeShadowSwap(context: ThiefCastContext): void {
  delete professionCoreState(context).availableFlips[ID.SHADOW_SWAP];
  emitThiefState(context, context.effectiveEnd, 'shadow-swap');
}

function prepareShadowMeld(context: ThiefCastContext): void {
  const core = professionCoreState(context);
  // Shadow Meld cancels the Revealed debuff at cast start (not cast end) so the player re-enters stealth immediately
  core.revealedUntil = Math.min(core.revealedUntil, context.start);
  emitThiefState(context, context.start, 'shadow-meld');
}

function prepareDeadeyeSpearStealthAttack(context: ThiefCastContext, skill: ThiefSkill): DeadeyeHandlerState {
  const handlerState = {
    malice: Math.max(0, Number(deadeyeState.from(context).malice || 0))
  };
  beginStealthAttack(context, skill);
  return handlerState;
}

function observeDeadeyeSpearStealthEffect(
  context: ThiefCastContext,
  _skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown
): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  if (event.type === 'damage' && event.name === 'Malicious Ashen Assault — Final Strike') {
    // Final Strike damage scales with malice: coefficient × (1 + malice × 2%); only the final hit receives the multiplier
    context.replaceEvent(event, {
      coefficient:
        Number(event.coefficient || 0) *
        (1 +
          Number(prepared.malice || 0) *
            Number(thiefBalanceProfile(context, PROFILE.maliciousAshenAssault)?.coefficientMultiplier || 0.02))
    });
  }
}

function completeDeadeyeSpearStealthAttack(context: ThiefCastContext, skill: ThiefSkill, handlerState: unknown): void {
  const prepared = (handlerState || {}) as DeadeyeHandlerState;
  const at = context.effectiveEnd;
  const profile = thiefBalanceProfile(context, PROFILE.maliciousAshenAssault);
  const torment = thiefBalanceProfileEffect(profile, 'condition');
  gainThiefInitiative(context, Number(profile?.resourceGain || 4), at, 'ashen-assault-refund');
  if (Number(prepared.malice || 0) > 0) {
    // Torment duration from Malicious Ashen Assault: 0.5s base + 0.5s per malice stack, only applied when malice > 0
    emitThiefCondition(context, {
      at,
      condition: String(torment?.condition || 'Torment'),
      duration: Number(torment?.duration || 0.5) + Number(prepared.malice) * Number(profile?.durationMultiplier || 0.5),
      stacks: Number(torment?.stacks || 1),
      sourceId: skill.id,
      name: 'Malicious Ashen Assault — Torment'
    });
  }

  completeStealthAttack(context, skill);
}

export const deadeyeSkillHandlers = Object.freeze({
  'thief.deadeyes-mark': augmentSkillHandler(emitStealTraitEffects, {
    afterEffects: completeDeadeyesMark
  }),
  'thief.deadeye-spear-stealth-attack': augmentSkillHandler(prepareDeadeyeSpearStealthAttack, {
    afterEffect: observeDeadeyeSpearStealthEffect,
    afterEffects: completeDeadeyeSpearStealthAttack
  }),
  'thief.deadeye-stealth-attack': augmentSkillHandler(prepareDeadeyeStealthAttack, {
    afterEffect: observeDeadeyeStealthEffect,
    afterEffects: completeStealthAttack
  }),
  'thief.deadeye-stolen-skill': augmentSkillHandler(prepareDeadeyeStolenSkill, {
    afterEffect: observeDeadeyeStolenEffect,
    afterEffects: completeDeadeyeStolenSkill
  }),
  'thief.deadeye-mercy': augmentSkillHandler(null, {
    afterEffects: completeMercy
  }),
  'thief.deadeye-shadow-flare': augmentSkillHandler(null, {
    afterEffects: completeShadowFlare
  }),
  'thief.deadeye-shadow-swap': augmentSkillHandler(null, {
    afterEffects: completeShadowSwap
  }),
  'thief.deadeye-shadow-meld': augmentSkillHandler(prepareShadowMeld)
});
