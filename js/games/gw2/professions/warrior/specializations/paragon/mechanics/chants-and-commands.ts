import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

/**
 * Owns chant activation, Motivation, refrain pulses, and command echoes.
 * Integrated trait additions stay beside these transitions so their timing and resource effects remain ordered.
 */

import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { applyWarriorSkillResource, gainWarriorAdrenaline } from '#gw2/professions/warrior/family-state.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';

import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';

const CHANT_IDS = [ID.CHANT_OF_ACTION, ID.CHANT_OF_RECUPERATION, ID.CHANT_OF_FREEDOM] as const;

// Broadcast Paragon state at its exact transition timestamp so the resolver mirrors scheduler state without delay.
function emitParagonState(context: WarriorSchedulerContext, at: number, reason: string): void {
  const state = paragonState.from(context);
  context.emit({
    type: 'warrior.paragon-state',
    at,
    source: 'Paragon',
    sourceId: `warrior.paragon-state.${reason}`,
    actorType: 'player',
    state: {
      motivation: state.motivation,
      maximumMotivation: state.maximumMotivation,
      activeRefrainId: state.activeRefrainId,
      // Retain the event's public label while resolver gameplay follows only the ID.
      activeRefrain:
        state.activeRefrainId == null ? '' : context.catalog.skillsById.get(state.activeRefrainId)?.name || ''
    }
  });
}

function gainMotivation(context: WarriorSchedulerContext, amount: number): void {
  const state = paragonState.from(context);
  state.motivation = grantCapped(state.motivation, amount, state.maximumMotivation);
}

function motivationLevel(context: WarriorSchedulerContext, motivation: number): 1 | 2 | 3 {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  return motivation >= balanceProfileNumber(resourcesProfile, 'threshold')
    ? 3
    : motivation >= balanceProfileNumber(resourcesProfile, 'minimumStacks')
      ? 2
      : 1;
}

// Spend chant resources, replace the active refrain, grant its opening boons and
// Motivation, then apply Feverish Pulse to the other chants and allies.
export function activateChant(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  // Cancelled chants retain their spend without opening a refrain or granting Motivation.
  if (context.action.cancelled) return;
  const at = context.effectiveEnd;
  const state = paragonState.from(context);

  state.activeRefrainId = skill.id;
  startRefrain(context, at);
  const chantsProfile = requireBalanceProfileFromContext(context, PROFILE.chants);
  gainMotivation(
    context,
    balanceProfileNumber(chantsProfile, 'resourceGain') +
      (hasTrait(context, TRAIT.ENDURING_REFRAIN)
        ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.enduringRefrain), 'resourceGain')
        : 0)
  );

  // Each chant selects its own named packets; removal preserves Motivation and the refrain.
  const boonNames =
    skill.id === ID.CHANT_OF_ACTION
      ? ['might', 'fury']
      : skill.id === ID.CHANT_OF_RECUPERATION
        ? ['vigor']
        : ['stability'];
  const openingBoons = boonNames.flatMap((kind) => {
    const effect = requireEffect(chantsProfile, 'boon', kind);
    return effect
      ? [
          {
            kind,
            duration: effectNumber(chantsProfile, effect, 'duration'),
            stacks: effectNumber(chantsProfile, effect, 'stacks')
          }
        ]
      : [];
  });

  // Opening boons include the caster and party, matching the chant's initial effects.
  for (const boon of openingBoons) {
    emitSkillBuff(context, {
      skill,
      at,
      source: 'Paragon',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: `${skill.name} — ${boon.kind}`,
      kind: boon.kind,
      boon: boon.kind,
      duration: boon.duration,
      stacks: boon.stacks,
      audience: { recipients: 'party' as const }
    });
  }

  if (hasTrait(context, TRAIT.FEVERISH_PULSE)) {
    const feverishPulseProfile = requireBalanceProfileFromContext(context, PROFILE.feverishPulse);
    const alacrity = requireEffect(feverishPulseProfile, 'boon', 'alacrity');
    // Every other chant receives the same authored recharge reduction.
    const rechargeReduction = balanceProfileNumber(feverishPulseProfile, 'rechargeReduction');
    for (const chantId of CHANT_IDS) {
      if (chantId === skill.id) continue;
      const chant = context.catalog.skillsById.get(chantId);
      if (chant) context.cooldownController.reduceSkillRecharge(chant, rechargeReduction, at);
    }

    if (alacrity)
      emitSkillBuff(context, {
        skill,
        at,
        source: 'Paragon',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: `${skill.name} — alacrity`,
        kind: 'alacrity',
        boon: 'alacrity',
        duration: effectNumber(feverishPulseProfile, alacrity, 'duration'),
        stacks: effectNumber(feverishPulseProfile, alacrity, 'stacks'),
        audience: { recipients: 'party' as const }
      });
  }

  emitParagonState(context, at, 'chant');
}

// Materialize one delayed Paragon command echo using the original command's
// skill-specific boons, resources, damage, or conditions.
function executeCommandEcho(context: WarriorSchedulerContext, skillId: number, at: number): void {
  const skill = context.catalog.skillsById.get(skillId);
  const skillName = skill?.name || 'Paragon Command';
  const sourceSkill = skill || ({ id: skillId, name: skillName } as WarriorSkill);
  if (skillId === ID.FIND_THEIR_WEAKNESS) {
    emitSkillBuff(context, {
      skill: sourceSkill,
      at,
      source: 'Paragon',
      sourceId: skillId,
      actorType: 'player',
      skillId,
      skillName,
      name: `${skillName} — might`,
      kind: 'might',
      boon: 'might',
      duration: 10,
      stacks: 7,
      audience: { recipients: 'party' as const }
    });
    gainWarriorAdrenaline(context, 3);
  } else if (skillId === ID.ON_YOUR_KNEES) {
    emitSkillDamage(context, {
      at,
      source: 'Paragon',
      sourceId: skillId,
      actorType: 'player',
      skillId,
      skillName,
      name: `${skillName} — Echo Damage`,
      coefficient: 1.5,
      hits: 1
    });
    emitSkillCondition(context, {
      at,
      source: 'Paragon',
      skillId,
      skillName,
      name: `${skillName} — Echo Immobilized`,
      condition: 'Immobilized',
      stacks: 1,
      duration: 2
    });
  } else if (skillId === ID.WE_SHALL_RETURN) {
    gainWarriorAdrenaline(context, 10);
  }
}

/** Echoes precede ordinary same-time tasks; burst consumption restarts the next repeat's delay. */
export const commandEchoes = timedEffect({
  id: 'warrior.paragon-command-echo',
  priority: -20,
  interval: (context: WarriorSchedulerContext) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.commands), 'pulseInterval'),
  effectsAt: (context: WarriorSchedulerContext, at: number, captured: { readonly skillId: WarriorSkill['id'] }) =>
    executeCommandEcho(context, Number(captured.skillId), at)
});

export function activateCommand(context: WarriorCastContext, skill: WarriorSkill): void {
  // Only successful commands grant resources and queue echoes.
  if (context.action.cancelled) return;
  if (skill.id === ID.FIND_THEIR_WEAKNESS) gainWarriorAdrenaline(context, 3);

  const commandsProfile = requireBalanceProfileFromContext(context, PROFILE.commands);
  const interval = balanceProfileNumber(commandsProfile, 'pulseInterval');
  if (interval <= 0) return;
  commandEchoes.start(context, {
    captured: { skillId: skill.id },
    at: context.effectiveEnd + interval,
    count: hasTrait(context, TRAIT.REVERBERATION)
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.reverberation), 'maximumStacks')
      : 1
  });
}

// Resolve one refrain pulse from the pre-spend Motivation tier, consume that
// chant's tier-dependent cost, and stop or schedule the next pulse.
function pulseRefrain(context: WarriorSchedulerContext, at: number): void {
  const state = paragonState.from(context);
  const motivation = state.motivation;
  const level = motivationLevel(context, motivation);
  const skill = state.activeRefrainId == null ? undefined : context.catalog.skillsById.get(state.activeRefrainId);
  if (!skill) {
    state.activeRefrainId = null;
    emitParagonState(context, at, 'refrain-missing');
    return;
  }

  let cost = 1;
  const refrainBoons: Array<{ kind: string; duration: number; stacks?: number }> = [];
  if (skill.id === ID.CHANT_OF_ACTION) {
    const extra = hasTrait(context, TRAIT.ENDURING_REFRAIN) ? level : 0;
    refrainBoons.push({ kind: 'might', duration: 8, stacks: level + extra });
    if (level >= 2) refrainBoons.push({ kind: 'fury', duration: 5 });
  } else if (skill.id === ID.CHANT_OF_RECUPERATION) {
    cost = level === 3 ? 3 : 2;
    if (level === 3) {
      refrainBoons.push({ kind: 'regeneration', duration: 3 });
    }
  } else if (skill.id === ID.CHANT_OF_FREEDOM) {
    cost = level;
    refrainBoons.push({ kind: 'swiftness', duration: 3 });
    if (level >= 2) {
      refrainBoons.push({ kind: 'resolution', duration: 3 });
    }

    if (level === 3) {
      refrainBoons.push({ kind: 'protection', duration: 3 });
    }
  }

  for (const boon of refrainBoons) {
    emitSkillBuff(context, {
      skill,
      at,
      source: 'Paragon',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: `${skill.name} — ${boon.kind}`,
      kind: boon.kind,
      boon: boon.kind,
      duration: boon.duration,
      stacks: boon.stacks ?? 1,
      audience: { recipients: 'party' as const }
    });
  }

  state.motivation = Math.max(0, motivation - cost);
  // Invigorating Tempo rewards actual Motivation spent, including a final partial drain.
  if (hasTrait(context, TRAIT.INVIGORATING_TEMPO)) {
    const invigoratingTempoProfile = requireBalanceProfileFromContext(context, PROFILE.invigoratingTempo);
    gainWarriorAdrenaline(
      context,
      (motivation - state.motivation) * balanceProfileNumber(invigoratingTempoProfile, 'resourceGain')
    );
  }

  if (state.motivation <= 0) state.activeRefrainId = null;

  emitParagonState(context, at, 'refrain-pulse');
}

// One keyed refrain reads the pre-spend Motivation tier and stops when the active chant runs dry.
export const refrains = timedEffect<WarriorSchedulerContext, object>({
  id: 'warrior.paragon-refrain',
  priority: -200,
  interval: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'pulseInterval'),
  effectsAt(context, at) {
    const state = paragonState.from(context);
    if (!state.activeRefrainId || state.motivation <= 0) return false;
    pulseRefrain(context, at);
    if (!state.activeRefrainId || state.motivation <= 0) return false;
  }
});

function startRefrain(context: WarriorSchedulerContext, at: number): void {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const interval = balanceProfileNumber(resourcesProfile, 'pulseInterval');
  if (interval <= 0) return;
  refrains.start(context, {
    key: 'refrain',
    at: at + interval,
    captured: {}
  });
}

export function observeParagonEvent(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  const state = paragonState.from(context);
  if (event.type !== 'combat_start' || state.callToActionActivated || !hasTrait(context, TRAIT.CALL_TO_ACTION)) {
    return;
  }

  state.callToActionActivated = true;
  const callToActionProfile = requireBalanceProfileFromContext(context, PROFILE.callToAction);
  gainMotivation(context, balanceProfileNumber(callToActionProfile, 'resourceGain'));
  if (!state.activeRefrainId) {
    state.activeRefrainId = ID.CHANT_OF_ACTION;
    startRefrain(context, event.at);
  }

  emitParagonState(context, event.at, 'call-to-action');
}

export function updateParagonCast(context: WarriorCastContext, skill: WarriorSkill): void {
  // Cancellation leaves pending echoes available for the next committed burst.
  if (context.action.cancelled) return;
  if (skill.burst) commandEchoes.consumeAll(context, context.effectiveEnd);
}

/** Applies Inspiring Implements after the shared weapon swap is committed. */
export function applyParagonWeaponSwapTraits(context: WarriorCastContext): void {
  const state = paragonState.from(context);
  if (
    hasTrait(context, TRAIT.INSPIRING_IMPLEMENTS) &&
    isInternalCooldownReady(context.effectiveEnd, state.inspiringImplementsReadyAt)
  ) {
    const inspiringImplementsProfile = requireBalanceProfileFromContext(context, PROFILE.inspiringImplements);
    state.inspiringImplementsReadyAt =
      context.effectiveEnd + balanceProfileNumber(inspiringImplementsProfile, 'internalCooldown');
    gainWarriorAdrenaline(context, balanceProfileNumber(inspiringImplementsProfile, 'resourceGain'));
    gainMotivation(context, balanceProfileNumber(inspiringImplementsProfile, 'minimumStacks'));
    emitParagonState(context, context.effectiveEnd, 'implements');
  }
}

// Rally the Valiant motivation is added at cast START so it is visible during
// updateParagonCast (afterCast) when pending command echoes are flushed.
export function beginParagonCast(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = paragonState.from(context);
  if (
    context.action.cancelled ||
    !skill.burst ||
    skill.handlerId === 'warrior.chant' ||
    !hasTrait(context, TRAIT.RALLY_THE_VALIANT) ||
    !state.activeRefrainId
  ) {
    return;
  }

  const rallyTheValiantProfile = requireBalanceProfileFromContext(context, PROFILE.rallyTheValiant);
  gainMotivation(context, balanceProfileNumber(rallyTheValiantProfile, 'resourceGain'));
  emitParagonState(context, context.start, 'rally');
}
