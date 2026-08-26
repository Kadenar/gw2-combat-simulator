import { antiquaryState } from './state.js';
import { THIEF_ARTIFACT_IDS, THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasThiefTrait } from '../../core/state.js';
import { emitThiefState, gainThiefInitiative } from '../../core/shared.js';
import type { SkillId } from '../../../../platform/engine/types.js';
import type {
  AntiquaryState,
  ThiefArtifactSlot,
  ThiefCastContext,
  ThiefDoubleEdgeOutcome,
  ThiefEmissionContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSkill
} from '../../types.js';
import {
  thiefBalanceProfile,
  thiefBalanceProfileEffect,
  THIEF_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE
} from '../../core/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

interface ForgedSurferTaskPayload extends Record<string, unknown> {
  readonly generation: number;
  readonly bomb: number;
  readonly skillId: SkillId;
}

interface SkrittScuffleTaskPayload extends Record<string, unknown> {
  readonly expiresAt: number;
}

function allArtifactChoices(): ThiefArtifactSlot[] {
  return [
    ...THIEF_ARTIFACT_IDS.OFFENSIVE.map((skillId) => ({
      kind: 'offensive' as const,
      skillId
    })),
    ...THIEF_ARTIFACT_IDS.DEFENSIVE.map((skillId) => ({
      kind: 'defensive' as const,
      skillId
    }))
  ];
}

function emitBoon(
  context: ThiefEmissionContext,
  at: number,
  boon: string,
  duration: number,
  stacks: number,
  name: string
): void {
  context.emit({
    type: 'buff',
    at,
    source: 'thief',
    sourceId: name,
    actorType: 'player',
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name,
    kind: boon,
    boon,
    duration,
    stacks
  });
}

function reduceSkrittSwipeRecharge(context: ThiefSchedulerContext, at: number): void {
  if (!hasThiefTrait(context.config, TRAIT.REPEAT_RANSACKER)) return;
  const readyAt = Number(context.state.cooldowns.get(ID.SKRITT_SWIPE) || 0);
  if (readyAt > at) {
    // clamp to `at` so the cooldown never goes negative; happens when multiple artifacts are used close together
    context.state.cooldowns.set(
      ID.SKRITT_SWIPE,
      Math.max(at, readyAt - Number(thiefBalanceProfile(context, PROFILE.repeatRansacker)?.rechargeReduction || 2))
    );
  }
}

// Refresh Antiquary's single Scoundrel's Luck charge only when its pilfer ICD is
// ready, preventing charges from being banked.
function grantScoundrelsLuck(context: ThiefSchedulerContext, at: number): void {
  const state = antiquaryState.from(context);
  if (
    !hasThiefTrait(context.config, TRAIT.SCOUNDRELS_LUCK) ||
    at + Number(context.epsilon || 0.0001) < Number(state.scoundrelsLuckReadyAt || 0) // ICD prevents banking more than one charge per 20s window
  )
    return;
  state.scoundrelsLuck = 1; // capped at 1: a second Swipe within the ICD does not stack another charge
  const profile = thiefBalanceProfile(context, PROFILE.scoundrelsLuck);
  state.scoundrelsLuck = Number(profile?.maximumStacks || 1);
  state.scoundrelsLuckReadyAt = at + Number(profile?.internalCooldown || 20);
}

function grantCombatHigh(context: ThiefSchedulerContext, at: number): void {
  if (!hasThiefTrait(context.config, TRAIT.COMBAT_HIGH)) return;
  const state = antiquaryState.from(context);
  const profile = thiefBalanceProfile(context, PROFILE.combatHigh);
  state.combatHighStacks = Number(profile?.maximumStacks || 10);
  state.combatHighExpiresAt = at + Number(profile?.durationMultiplier || 20);
}

// On an eligible Swipe, shorten only selected utility cooldowns that are still
// active, then reserve Improvisation's shared internal cooldown.
function reduceUtilityRecharges(context: ThiefSchedulerContext, at: number): void {
  if (!hasThiefTrait(context.config, TRAIT.IMPROVISATION)) return;
  const state = antiquaryState.from(context);
  if (at + Number(context.epsilon || 0.0001) < Number(state.improvisationReadyAt || 0)) return;
  const selected = context.config.selectedSkills || [];
  const selectedNames = new Set(
    (Array.isArray(selected) ? selected : Object.values(selected))
      .map((value) => (typeof value === 'string' ? value : value?.name))
      .filter(Boolean)
  );
  for (const name of selectedNames) {
    const skill = context.catalog.skillsByName.get(name);
    if (skill?.type !== 'Utility') continue;
    const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
    if (readyAt > at) {
      context.state.cooldowns.set(
        skill.id,
        at +
          (readyAt - at) * Number(thiefBalanceProfile(context, CORE_PROFILE.improvisation)?.rechargeMultiplier || 0.75)
      );
    }
  }

  state.improvisationReadyAt =
    at + Number(thiefBalanceProfile(context, CORE_PROFILE.improvisation)?.internalCooldown || 15);
}

/**
 * Replaces the currently held artifacts.
 *
 * Prolific Plunderer adds a third slot to every pilfer, but its extra artifact
 * use only applies to Skritt Swipe. Improvisation adds one further Swipe use.
 */
export function pilferArtifacts(
  context: ThiefSchedulerContext,
  at: number,
  reason = 'pilfer',
  source = 'initiative'
): void {
  const state = antiquaryState.from(context);
  const prolific = hasThiefTrait(context.config, TRAIT.PROLIFIC_PLUNDERER);
  const resources = thiefBalanceProfile(context, PROFILE.resources);
  state.artifactSlots = allArtifactChoices();
  // Prolific Plunderer and Improvisation each add one use, but only when pilfer originates from a Skritt Swipe (not from initiative or scuffle)
  state.artifactUsesRemaining =
    Number(resources?.maximumStacks || 1) +
    (source === 'swipe' && prolific
      ? Number(thiefBalanceProfile(context, PROFILE.prolificPlunderer)?.resourceGain || 1)
      : 0) +
    (source === 'swipe' && hasThiefTrait(context.config, TRAIT.IMPROVISATION)
      ? Number(thiefBalanceProfile(context, CORE_PROFILE.improvisation)?.resourceGain || 1)
      : 0);
  state.initiativeSpentSincePilfer = 0;
  if (source === 'swipe') {
    grantScoundrelsLuck(context, at);
    grantCombatHigh(context, at);
    reduceUtilityRecharges(context, at);
  }

  emitThiefState(context, at, reason);
}

export function reshuffleArtifacts(context: ThiefCastContext): void {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  state.artifactSlots = allArtifactChoices();
  emitThiefState(context, at, 'artifacts-reshuffled');
}

function extendExhilaratingEphemera(context: ThiefCastContext, state: AntiquaryState, at: number): void {
  const profile = thiefBalanceProfile(context, PROFILE.exhilaratingEphemera);
  const remaining = Math.max(0, Number(state.antiquaryDamageUntil || 0) - at);
  state.antiquaryDamageUntil =
    at + Math.min(Number(profile?.maximumStacks || 20), remaining + Number(profile?.durationMultiplier || 10));
}

function applyArtifactIdentity(context: ThiefCastContext, skill: ThiefSkill, at: number): void {
  const state = antiquaryState.from(context);
  const meticulous = hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN);
  const profile = thiefBalanceProfile(context, PROFILE.artifactWindows);
  const standardDuration = Number(profile?.durationMultiplier || 10);
  const enhancedDuration = Number(profile?.maximumStacks || 12);
  if (skill.id === ID.METAL_LEGION_GUITAR) {
    state.stealthAttackCharges = Number(profile?.resourceGain || 3);
    state.stealthAttackExpiresAt = at + (meticulous ? enhancedDuration : standardDuration);
  } else if (skill.id === ID.MISTBURN_MORTAR) {
    state.mistburnCharges = Number(profile?.playerStacks || 5);
    state.mistburnExpiresAt = at + (meticulous ? enhancedDuration : standardDuration);
    state.mistburnGeneration += 1;
  } else if (skill.id === ID.SUMMON_KRYPTIS_TURRET_ID_77192) {
    state.kryptisDamageUntil =
      at + (meticulous ? Number(profile?.threshold || 10) : Number(profile?.minimumStacks || 8));
  } else if (skill.id === ID.CHAK_SHIELD) {
    state.chakInitiativeRefundUntil = at + (meticulous ? enhancedDuration : standardDuration);
  } else if (skill.id === ID.HOLO_DANCER_DECOY) {
    const expiresAt = at + (meticulous ? enhancedDuration : standardDuration);
    // accumulate one entry per Decoy use; each entry will be consumed by the next utility cast (FIFO in modifyAntiquaryRechargeDuration)
    state.holoUtilityCooldownReductionExpirations = [
      ...(state.holoUtilityCooldownReductionExpirations || []),
      expiresAt
    ];
    state.holoUtilityCooldownReduction = 1 - Number(profile?.rechargeMultiplier ?? 0.2);
    state.holoUtilityCooldownReductionExpiresAt = Math.max(...state.holoUtilityCooldownReductionExpirations);
  } else if (skill.id === ID.FORGED_SURFER_DASH_ID_76633) {
    state.forgedSurferGeneration += 1; // bumped here (before task scheduling) so the task payload and state always agree on which run is current
  }
}

// Spend the chosen artifact slot and use, apply artifact-family traits and its
// identity window, then reconcile Skritt Swipe recharge and visible state.
export function consumeArtifact(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  const slot = state.artifactSlots.find((value) => value.skillId === skill.id);
  state.artifactUsesRemaining = Math.max(0, state.artifactUsesRemaining - 1);
  state.artifactSlots = state.artifactSlots.filter((value) => value.skillId !== skill.id);
  if (hasThiefTrait(context.config, TRAIT.ENTERPRISING_ARISTOCRAT)) {
    gainThiefInitiative(
      context,
      Number(thiefBalanceProfile(context, PROFILE.enterprisingAristocrat)?.resourceGain || 2),
      at,
      'enterprising-aristocrat'
    );
  }

  if (hasThiefTrait(context.config, TRAIT.EXHILARATING_EPHEMERA)) {
    extendExhilaratingEphemera(context, state, at);
  }

  if (hasThiefTrait(context.config, TRAIT.POSSESSIVE_HOARDER)) {
    const profile = thiefBalanceProfile(context, PROFILE.possessiveHoarder);
    const might = thiefBalanceProfileEffect(profile, 'boon', 0);
    const protection = thiefBalanceProfileEffect(profile, 'boon', 1);
    const alacrity = thiefBalanceProfileEffect(profile, 'boon', 2);
    if (slot?.kind === 'offensive') {
      emitBoon(
        context,
        at,
        String(might?.boon || 'might'),
        Number(might?.duration || 12),
        Number(might?.stacks || 10),
        'Possessive Hoarder'
      );
    }

    if (slot?.kind === 'defensive') {
      emitBoon(
        context,
        at,
        String(protection?.boon || 'protection'),
        Number(protection?.duration || 5),
        Number(protection?.stacks || 1),
        'Possessive Hoarder'
      );
    }

    emitBoon(
      context,
      at,
      String(alacrity?.boon || 'alacrity'),
      Number(alacrity?.duration || 5),
      Number(alacrity?.stacks || 1),
      'Possessive Hoarder'
    );
  }

  if (skill.id === ID.CHAK_SHIELD && hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)) {
    const strike = thiefBalanceProfileEffect(thiefBalanceProfile(context, PROFILE.meticulousCustodian), 'strike');
    context.emit({
      type: 'damage',
      at,
      source: 'thief',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Chak Shield',
      coefficient: Number(strike?.coefficient || 0.3),
      hits: Number(strike?.hits || 1),
      activationId: context.reservationId
    });
  }

  applyArtifactIdentity(context, skill, at);
  reduceSkrittSwipeRecharge(context, at);
  emitThiefState(context, at, 'artifact-used');
}

export function completeForgedSurfer(context: ThiefCastContext, skill: ThiefSkill): void {
  consumeArtifact(context, skill);
  const state = antiquaryState.from(context);
  const profile = thiefBalanceProfile(context, PROFILE.forgedSurfer);
  context.tasks.schedule({
    type: 'thief.forged-surfer',
    at: context.effectiveEnd + Number(profile?.initialDelay || 1),
    ownerId: `thief.forged-surfer:${state.forgedSurferGeneration}`,
    payload: {
      generation: state.forgedSurferGeneration,
      bomb: 0,
      skillId: skill.id
    }
  });
}

// Emit one generation-bound Forged Surfer bomb or terminal packet so a newer run
// can invalidate stale scheduled effects.
function emitForgedSurferPacket(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<ForgedSurferTaskPayload>,
  coefficient: number,
  burnDuration: number,
  burnStacks = 1
): void {
  const bomb = Number(task.payload.bomb || 0);
  const name = bomb === 0 ? 'Forged Surfer Dash' : 'Forged Surfer Dash — Bomb';
  context.emit({
    type: 'damage',
    at: task.at,
    source: 'thief',
    sourceId: task.payload.skillId,
    actorType: 'player',
    skillId: task.payload.skillId,
    skillName: 'Forged Surfer Dash',
    name,
    coefficient,
    hits: 1
  });
  context.emit({
    type: 'condition',
    at: task.at,
    source: 'thief',
    sourceId: task.payload.skillId,
    actorType: 'player',
    skillId: task.payload.skillId,
    skillName: 'Forged Surfer Dash',
    name: `${name} — Burning`,
    condition: 'Burning',
    stacks: burnStacks,
    duration: burnDuration
  });
}

export function handleForgedSurfer(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<ForgedSurferTaskPayload>
): void {
  // stale task from a previous activation; discard it so a fresh Forged Surfer cast can run independently
  if (Number(task.payload.generation || 0) !== Number(antiquaryState.from(context).forgedSurferGeneration || 0)) return;
  const bomb = Number(task.payload.bomb || 0);
  const meticulous = hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN);
  const profile = thiefBalanceProfile(context, meticulous ? PROFILE.forgedSurferMeticulous : PROFILE.forgedSurfer);
  const strikes = (profile?.effects || []).filter((effect) => effect.type === 'strike');
  const burns = (profile?.effects || []).filter((effect) => effect.type === 'condition');
  const packetIndex = bomb === 0 ? 0 : 1;
  emitForgedSurferPacket(
    context,
    task,
    Number(strikes[packetIndex]?.coefficient || (bomb === 0 ? 2.4 : 1.2)),
    Number(burns[packetIndex]?.duration || (bomb === 0 ? 6 : 3.5)),
    Number(burns[packetIndex]?.stacks || 1)
  );
  // user-configurable assumption: allows simulating fewer bombs when the target dies before the full chain lands
  if (
    bomb >=
    Math.min(Number(profile?.maximumStacks || 5), Number(antiquaryState.from(context).forgedSurferMaximumBombHits || 5))
  )
    return;
  context.tasks.schedule({
    ...task,
    at: task.at + Number(thiefBalanceProfile(context, PROFILE.forgedSurfer)?.pulseInterval || 3),
    payload: {
      ...task.payload,
      bomb: bomb + 1
    }
  });
}

// Double Edge is only risky when the skill is on cooldown; casting off-cooldown always succeeds
function riskyDoubleEdge(context: ThiefCastContext, skill: ThiefSkill): boolean {
  return Number(context.state.cooldowns.get(skill.id) || 0) > context.start + Number(context.epsilon || 0.0001);
}

function peekRiskyOutcome(context: ThiefCastContext): ThiefDoubleEdgeOutcome {
  const state = antiquaryState.from(context);
  if (state.scoundrelsLuck > 0) return 'success';
  return context.command.doubleEdgeOutcome === 'backfire' ? 'backfire' : 'success';
}

export function peekDoubleEdgeOutcome(context: ThiefCastContext, skill: ThiefSkill): ThiefDoubleEdgeOutcome {
  return riskyDoubleEdge(context, skill) ? peekRiskyOutcome(context) : 'success';
}

function consumeDoubleEdgeOutcome(context: ThiefCastContext, skill: ThiefSkill): ThiefDoubleEdgeOutcome {
  if (!riskyDoubleEdge(context, skill)) return 'success';
  const state = antiquaryState.from(context);
  if (state.scoundrelsLuck > 0) {
    state.scoundrelsLuck -= 1;
    return 'success';
  }

  return peekRiskyOutcome(context);
}

// Materialize Canach's backfire damage and conditions against the player at the
// resolved cannon outcome timestamp.
function emitCannonBackfire(context: ThiefCastContext, at: number): void {
  const profile = thiefBalanceProfile(context, PROFILE.cannonBackfire);
  const strike = thiefBalanceProfileEffect(profile, 'strike');
  const burning = thiefBalanceProfileEffect(profile, 'condition');
  const impactAt = at + Number(profile?.initialDelay || 2);
  context.emit({
    type: 'damage',
    at: impactAt,
    source: 'thief',
    sourceId: ID.STONE_SUMMIT_CANNON,
    actorType: 'player',
    skillId: ID.STONE_SUMMIT_CANNON,
    skillName: 'Stone Summit Cannon',
    name: 'Stone Summit Cannon — Backfire',
    coefficient: Number(strike?.coefficient || 3),
    hits: Number(strike?.hits || 1)
  });
  context.emit({
    type: 'condition',
    at: impactAt,
    source: 'thief',
    sourceId: ID.STONE_SUMMIT_CANNON,
    actorType: 'player',
    skillId: ID.STONE_SUMMIT_CANNON,
    skillName: 'Stone Summit Cannon',
    name: 'Stone Summit Cannon — Backfire',
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks || 3),
    duration: Number(burning?.duration || 4)
  });
}

// Materialize the successful Canach cannon shot and its target effects from one
// outcome branch.
function emitCannonSuccess(context: ThiefCastContext): void {
  const profile = thiefBalanceProfile(context, PROFILE.cannonSuccess);
  const strike = thiefBalanceProfileEffect(profile, 'strike');
  const burning = thiefBalanceProfileEffect(profile, 'condition');
  const hits = Math.max(1, Number(strike?.hits || 3));
  for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
    const at =
      context.effectiveEnd +
      Number(profile?.initialDelay || 0.44) +
      (hitIndex - 1) * Number(profile?.pulseInterval || 0.283);
    context.emit({
      type: 'damage',
      at,
      source: 'thief',
      sourceId: ID.STONE_SUMMIT_CANNON,
      actorType: 'player',
      skillId: ID.STONE_SUMMIT_CANNON,
      skillName: 'Stone Summit Cannon',
      name: 'Stone Summit Cannon',
      coefficient: Number(strike?.coefficient || 1),
      hits: 1,
      hitIndex,
      totalHits: hits
    });
    context.emit({
      type: 'condition',
      at,
      source: 'thief',
      sourceId: ID.STONE_SUMMIT_CANNON,
      actorType: 'player',
      skillId: ID.STONE_SUMMIT_CANNON,
      skillName: 'Stone Summit Cannon',
      name: 'Stone Summit Cannon — Burning',
      condition: String(burning?.condition || 'Burning'),
      stacks: Number(burning?.stacks || 1),
      duration: Number(burning?.duration || 3)
    });
  }
}

// Emit the coin outcomes associated with Canach's success or backfire while
// preserving their individual timing and ownership.
function tossCanachCoins(context: ThiefCastContext, at: number, backfire: boolean): void {
  const state = antiquaryState.from(context);
  let initiative = 0;
  for (let coin = 0; coin < 3; coin += 1) {
    const heads = Number(state.canachCoinIndex || 0) % 2 === 0; // coins alternate H/T in a deterministic pattern (index 0, 2, 4 … = heads)
    state.canachCoinIndex = Number(state.canachCoinIndex || 0) + 1;
    if (backfire) {
      if (heads) initiative += 1;
    } else {
      initiative += heads ? 2 : 1;
    }
  }

  gainThiefInitiative(context, initiative, at, backfire ? 'canach-coin-backfire' : 'canach-coin-toss');
}

export function resolveDoubleEdge(context: ThiefCastContext, skill: ThiefSkill): ThiefDoubleEdgeOutcome {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  const outcome = consumeDoubleEdgeOutcome(context, skill);
  if (outcome === 'backfire') {
    // record backfire until the cooldown expires; the backfire variant skill blocks itself via availability.ts while this entry is present
    state.backfireState[skill.id] = {
      activeUntil: Number(context.state.cooldowns.get(skill.id) || at),
      skillName: skill.name
    };
    if (skill.id === ID.STONE_SUMMIT_CANNON) {
      emitCannonBackfire(context, at);
    }
  } else {
    delete state.backfireState[skill.id];
    if (skill.id === ID.STONE_SUMMIT_CANNON) {
      emitCannonSuccess(context);
    }
  }

  if (skill.id === ID.CANACH_COIN_TOSS_ID_77230) {
    tossCanachCoins(context, at, outcome === 'backfire');
  }

  emitThiefState(context, at, `double-edge-${outcome}`);
  return outcome;
}

export function completeSkrittScuffle(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  const profile = thiefBalanceProfile(context, PROFILE.scuffle);
  const interval = Number(profile?.pulseInterval || 3);
  const summon = {
    skillId: skill.id,
    name: 'Skritt Assistant',
    expiresAt: at + Number(profile?.durationMultiplier || 15)
  };
  state.activeAntiquarySummons.push(summon);
  state.nextSkrittScufflePilferAt = at + interval;
  pilferArtifacts(context, at, 'skritt-scuffle-artifact', 'scuffle');
  // ownerId encodes both skill id and cast time so a re-summoned scuffle doesn't cancel the previous one's tasks
  context.tasks.schedule({
    type: 'thief.skritt-scuffle',
    at: at + interval,
    ownerId: `thief.skritt-scuffle:${skill.id}:${at}`,
    payload: { expiresAt: summon.expiresAt }
  });
  emitThiefState(context, at, 'skritt-scuffle');
}

export function handleSkrittScuffle(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<SkrittScuffleTaskPayload>
): void {
  const interval = Number(thiefBalanceProfile(context, PROFILE.scuffle)?.pulseInterval || 3);
  // epsilon tolerance: a task scheduled exactly at expiresAt is still valid; floating-point overshoot is not a missed tick
  if (task.at > Number(task.payload.expiresAt || 0) + Number(context.epsilon || 0.0001)) return;
  const nextPilferAt = task.at + interval;
  antiquaryState.from(context).nextSkrittScufflePilferAt =
    nextPilferAt <= Number(task.payload.expiresAt || 0) ? nextPilferAt : 0;
  pilferArtifacts(context, task.at, 'skritt-scuffle-artifact', 'scuffle');
  if (task.at + interval <= Number(task.payload.expiresAt || 0)) {
    context.tasks.schedule({
      ...task,
      at: task.at + interval
    });
  }
}
