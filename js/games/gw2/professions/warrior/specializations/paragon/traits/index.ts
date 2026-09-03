import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import type { ScheduledTask } from '#gw2/platform/engine/types.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { applyWarriorSkillResource, gainWarriorAdrenaline } from '#gw2/professions/warrior/resources.js';

import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { PARAGON_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/paragon/profiles.js';

const CHANT_IDS = [ID.CHANT_OF_ACTION, ID.CHANT_OF_RECUPERATION, ID.CHANT_OF_FREEDOM] as const;

// Broadcasts paragon state as a typed event so the resolver can mirror it.
// The resolver does not share mutable scheduler state, so motivation and
// refrain must travel through the event stream.
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
      activeRefrain: state.activeRefrain,
      nextRefrainAt: state.nextRefrainAt
    }
  });
}

function gainMotivation(context: WarriorSchedulerContext, amount: number): void {
  const state = paragonState.from(context);
  state.motivation = Math.min(state.maximumMotivation, state.motivation + Math.max(0, amount));
}

function motivationLevel(context: WarriorSchedulerContext, motivation: number): 1 | 2 | 3 {
  const profile = balanceProfileFromContext(context, PROFILE.resources);
  return motivation >= Number(profile?.threshold ?? 7) ? 3 : motivation >= Number(profile?.minimumStacks ?? 4) ? 2 : 1;
}

// Spend chant resources, replace the active refrain, grant its opening boons and
// Motivation, then apply Feverish Pulse to the other chants and allies.
export function activateChant(context: WarriorCastContext, skill: WarriorSkill): void {
  applyWarriorSkillResource(context, skill);
  const at = context.effectiveEnd;
  const state = paragonState.from(context);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  const chants = balanceProfileFromContext(context, PROFILE.chants);
  state.activeRefrain = skill.name;
  state.nextRefrainAt = at + Number(resources?.pulseInterval ?? 3);
  gainMotivation(
    context,
    Number(chants?.resourceGain ?? 4) +
      (hasTrait(context, TRAIT.ENDURING_REFRAIN)
        ? Number(balanceProfileFromContext(context, PROFILE.enduringRefrain)?.resourceGain ?? 1)
        : 0)
  );

  const openingBoons: Array<{ kind: string; duration: number; stacks: number }> = [];
  if (skill.id === ID.CHANT_OF_ACTION) {
    const might = balanceProfileEffect(chants, 'boon', 0);
    const fury = balanceProfileEffect(chants, 'boon', 1);
    openingBoons.push(
      { kind: 'might', duration: Number(might?.duration ?? 8), stacks: Number(might?.stacks ?? 5) },
      { kind: 'fury', duration: Number(fury?.duration ?? 5), stacks: Number(fury?.stacks ?? 1) }
    );
  } else if (skill.id === ID.CHANT_OF_RECUPERATION) {
    const vigor = balanceProfileEffect(chants, 'boon', 2);
    openingBoons.push({ kind: 'vigor', duration: Number(vigor?.duration ?? 5), stacks: Number(vigor?.stacks ?? 1) });
  } else if (skill.id === ID.CHANT_OF_FREEDOM) {
    const stability = balanceProfileEffect(chants, 'boon', 3);
    openingBoons.push({
      kind: 'stability',
      duration: Number(stability?.duration ?? 3),
      stacks: Number(stability?.stacks ?? 1)
    });
  }

  // Emit every selected opening packet directly so attribution stays visible at the behavior site.
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
      audience: { recipients: 'party' as const, affectsSelf: false }
    });
  }

  if (hasTrait(context, TRAIT.FEVERISH_PULSE)) {
    const profile = balanceProfileFromContext(context, PROFILE.feverishPulse);
    const alacrity = balanceProfileEffect(profile, 'boon');
    for (const chantId of CHANT_IDS) {
      if (chantId === skill.id) continue;
      const readyAt = Number(context.state.cooldowns.get(chantId) || 0);
      if (readyAt > at) {
        context.state.cooldowns.set(chantId, Math.max(at, readyAt - Number(profile?.rechargeReduction ?? 2)));
      }
    }

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
      duration: Number(alacrity?.duration ?? 6),
      stacks: Number(alacrity?.stacks ?? 1),
      audience: { recipients: 'party' as const }
    });
  }

  emitParagonState(context, at + context.epsilon, 'chant');
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
      sourceId: skillId,
      actorType: 'player',
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

function executePendingEcho(context: WarriorSchedulerContext, echoId: number, at: number): void {
  const state = paragonState.from(context);
  const index = state.pendingCommandEchoes.findIndex((echo) => echo.id === echoId);
  if (index < 0) return;
  const [echo] = state.pendingCommandEchoes.splice(index, 1);
  executeCommandEcho(context, Number(echo.skillId), at);
  if (echo.repeats > 1) {
    const next = {
      ...echo,
      dueAt: at + Number(balanceProfileFromContext(context, PROFILE.commands)?.pulseInterval ?? 3),
      repeats: echo.repeats - 1
    };
    state.pendingCommandEchoes.push(next);
    context.tasks.schedule({
      type: 'warrior.paragon-command-echo',
      at: next.dueAt,
      priority: -20,
      payload: { echoId: next.id }
    });
  }
}

export function activateCommand(context: WarriorCastContext, skill: WarriorSkill): void {
  if (skill.id === ID.FIND_THEIR_WEAKNESS) gainWarriorAdrenaline(context, 3);

  const state = paragonState.from(context);
  const commands = balanceProfileFromContext(context, PROFILE.commands);
  const echo = {
    id: ++state.commandEchoSequence,
    skillId: skill.id,
    dueAt: context.effectiveEnd + Number(commands?.pulseInterval ?? 3),
    repeats: hasTrait(context, TRAIT.REVERBERATION)
      ? Number(balanceProfileFromContext(context, PROFILE.reverberation)?.maximumStacks ?? commands?.maximumStacks ?? 2)
      : 1
  };
  state.pendingCommandEchoes.push(echo);
  context.tasks.schedule({
    type: 'warrior.paragon-command-echo',
    at: echo.dueAt,
    priority: -20,
    payload: { echoId: echo.id }
  });
}

// Resolve one refrain pulse from the pre-spend Motivation tier, consume that
// chant's tier-dependent cost, and stop or schedule the next pulse.
function pulseRefrain(context: WarriorSchedulerContext, at: number): void {
  const state = paragonState.from(context);
  const motivation = state.motivation;
  const level = motivationLevel(context, motivation);
  const skill = [...context.catalog.skillsById.values()].find((candidate) => candidate.name === state.activeRefrain);
  if (!skill) return;

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
  if (state.motivation > 0) {
    state.nextRefrainAt = at + Number(balanceProfileFromContext(context, PROFILE.resources)?.pulseInterval ?? 3);
  } else {
    state.activeRefrain = '';
    state.nextRefrainAt = 0;
  }

  emitParagonState(context, at + context.epsilon, 'refrain-pulse');
}

export function advanceParagon(context: WarriorSchedulerContext, target: number): void {
  const state = paragonState.from(context);
  while (state.activeRefrain && state.motivation > 0 && state.nextRefrainAt <= target + context.epsilon) {
    pulseRefrain(context, state.nextRefrainAt);
  }
}

export function observeParagonEvent(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  const state = paragonState.from(context);
  if (event.type !== 'combat_start' || state.callToActionActivated || !hasTrait(context, TRAIT.CALL_TO_ACTION)) {
    return;
  }

  state.callToActionActivated = true;
  gainMotivation(context, Number(balanceProfileFromContext(context, PROFILE.callToAction)?.resourceGain ?? 4));
  if (!state.activeRefrain) {
    state.activeRefrain = 'Chant of Action';
    state.nextRefrainAt = event.at + Number(balanceProfileFromContext(context, PROFILE.resources)?.pulseInterval ?? 3);
  }

  emitParagonState(context, event.at + context.epsilon, 'call-to-action');
}

export function updateParagonCast(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = paragonState.from(context);
  if (skill.burst && state.pendingCommandEchoes.length) {
    for (const echo of [...state.pendingCommandEchoes]) {
      executePendingEcho(context, echo.id, context.effectiveEnd);
    }
  }
}

/** Applies Inspiring Implements after the shared weapon swap is committed. */
export function applyParagonWeaponSwapTraits(context: WarriorCastContext): void {
  const state = paragonState.from(context);
  if (
    hasTrait(context, TRAIT.INSPIRING_IMPLEMENTS) &&
    isInternalCooldownReady(context.effectiveEnd, state.inspiringImplementsReadyAt)
  ) {
    const profile = balanceProfileFromContext(context, PROFILE.inspiringImplements);
    state.inspiringImplementsReadyAt = context.effectiveEnd + Number(profile?.internalCooldown ?? 4);
    gainWarriorAdrenaline(context, Number(profile?.resourceGain ?? 5));
    gainMotivation(context, Number(profile?.minimumStacks ?? 2));
    emitParagonState(context, context.effectiveEnd + context.epsilon, 'implements');
  }
}

// Rally the Valiant motivation is added at cast START so it is visible during
// updateParagonCast (afterCast) when pending command echoes are flushed.
export function beginParagonCast(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = paragonState.from(context);
  if (
    !skill.burst ||
    skill.handlerId === 'warrior.chant' ||
    !hasTrait(context, TRAIT.RALLY_THE_VALIANT) ||
    !state.activeRefrain
  ) {
    return;
  }

  gainMotivation(context, Number(balanceProfileFromContext(context, PROFILE.rallyTheValiant)?.resourceGain ?? 4));
  emitParagonState(context, context.start + context.epsilon, 'rally');
}

export function handleParagonCommandEchoTask(context: WarriorSchedulerContext, task: ScheduledTask): void {
  const payload = task.payload as { readonly echoId?: number } | null;
  executePendingEcho(context, Number(payload?.echoId), task.at);
}
