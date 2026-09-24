import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import {
  requireEffect,
  requireBalanceProfileFromContext,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { canonicalTime, EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT
} from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  ThiefCastContext,
  ThiefDoubleEdgeOutcome,
  ThiefSchedulerContext,
  ThiefSkill
} from '#gw2/professions/thief/types.js';
import type { AntiquaryState, ThiefArtifactSlot } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';

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

function reduceSkrittSwipeRecharge(context: ThiefSchedulerContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.REPEAT_RANSACKER)) return;
  const swipe = context.catalog.skillsById.get(ID.SKRITT_SWIPE);
  if (swipe) {
    const repeatRansackerProfile = requireBalanceProfileFromContext(context, PROFILE.repeatRansacker);
    context.cooldownController.reduceSkillRecharge(
      swipe,
      balanceProfileNumber(repeatRansackerProfile, 'rechargeReduction'),
      at
    );
  }
}

// Refresh Antiquary's single Scoundrel's Luck charge only when its pilfer ICD is
// ready, preventing charges from being banked.
function grantScoundrelsLuck(context: ThiefSchedulerContext, at: number): void {
  const state = antiquaryState.from(context);
  if (
    !hasTrait(context.config, TRAIT.SCOUNDRELS_LUCK) ||
    !isInternalCooldownReady(at, Number(state.scoundrelsLuckReadyAt || 0)) // ICD prevents banking more than one charge per 20s window
  )
    return;

  // Refresh to the profile cap without banking charges from earlier Swipes.
  const scoundrelsLuckProfile = requireBalanceProfileFromContext(context, PROFILE.scoundrelsLuck);
  state.scoundrelsLuck = balanceProfileNumber(scoundrelsLuckProfile, 'maximumStacks');
  state.scoundrelsLuckReadyAt = at + balanceProfileNumber(scoundrelsLuckProfile, 'internalCooldown');
}

function grantCombatHigh(context: ThiefSchedulerContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.COMBAT_HIGH)) return;
  const state = antiquaryState.from(context);

  const combatHighProfile = requireBalanceProfileFromContext(context, PROFILE.combatHigh);
  const maximum = Math.max(0, Math.trunc(balanceProfileNumber(combatHighProfile, 'maximumStacks')));
  const interval = balanceProfileNumber(combatHighProfile, 'pulseInterval');
  const expiresAt = at + balanceProfileNumber(combatHighProfile, 'durationMultiplier');
  // Replace the buff with staggered expiries, losing one stack per interval before the final deadline.
  state.combatHighExpirations =
    interval > 0
      ? purgeExpiredStacks(
          Array.from({ length: maximum }, (_, index) => expiresAt - index * interval),
          at
        )
      : [];
}

// On an eligible Swipe, shorten only selected utility cooldowns that are still
// active, then reserve Improvisation's shared internal cooldown.
function reduceUtilityRecharges(context: ThiefSchedulerContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.IMPROVISATION)) return;
  const state = antiquaryState.from(context);
  if (!isInternalCooldownReady(at, Number(state.improvisationReadyAt || 0))) return;
  const improvisationProfile = requireBalanceProfileFromContext(context, CORE_PROFILE.improvisation);
  const multiplier = balanceProfileNumber(improvisationProfile, 'rechargeMultiplier');
  const selectedNames = selectedSkillNameSet(context.config.selectedSkills);
  for (const name of selectedNames) {
    const skill = context.catalog.skillsByName.get(name);
    if (skill?.type !== 'Utility') continue;
    context.cooldownController.reduceSkillRecharge(skill, gw2BaseRecharge(skill) * (1 - multiplier), at);
  }

  state.improvisationReadyAt = at + balanceProfileNumber(improvisationProfile, 'internalCooldown');
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
  const prolific = hasTrait(context.config, TRAIT.PROLIFIC_PLUNDERER);

  state.artifactSlots = allArtifactChoices();
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  // Prolific Plunderer and Improvisation each add one use, but only when pilfer originates from a Skritt Swipe (not from initiative or scuffle)
  state.artifactUsesRemaining =
    balanceProfileNumber(resourcesProfile, 'maximumStacks') +
    (source === 'swipe' && prolific
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.prolificPlunderer), 'resourceGain')
      : 0) +
    (source === 'swipe' && hasTrait(context.config, TRAIT.IMPROVISATION)
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, CORE_PROFILE.improvisation), 'resourceGain')
      : 0);
  state.initiativeSpentSincePilfer = 0;
  if (source === 'swipe') {
    grantScoundrelsLuck(context, at);
    grantCombatHigh(context, at);
    reduceUtilityRecharges(context, at);
  }

  emitThiefStateSnapshot(context, at, reason);
}

export function reshuffleArtifacts(context: ThiefCastContext): void {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  state.artifactSlots = allArtifactChoices();
  emitThiefStateSnapshot(context, at, 'artifacts-reshuffled');
}

function extendExhilaratingEphemera(context: ThiefCastContext, state: AntiquaryState, at: number): void {
  const remaining = Math.max(0, Number(state.antiquaryDamageUntil || 0) - at);
  const exhilaratingEphemeraProfile = requireBalanceProfileFromContext(context, PROFILE.exhilaratingEphemera);
  state.antiquaryDamageUntil =
    at +
    Math.min(
      balanceProfileNumber(exhilaratingEphemeraProfile, 'maximumStacks'),
      remaining + balanceProfileNumber(exhilaratingEphemeraProfile, 'durationMultiplier')
    );
}

function applyArtifactIdentity(context: ThiefCastContext, skill: ThiefSkill, at: number): void {
  const state = antiquaryState.from(context);
  const meticulous = hasTrait(context.config, TRAIT.METICULOUS_CUSTODIAN);

  const artifactWindowsProfile = requireBalanceProfileFromContext(context, PROFILE.artifactWindows);
  const standardDuration = balanceProfileNumber(artifactWindowsProfile, 'durationMultiplier');
  const enhancedDuration = balanceProfileNumber(artifactWindowsProfile, 'maximumStacks');
  if (skill.id === ID.METAL_LEGION_GUITAR) {
    state.stealthAttackCharges = balanceProfileNumber(artifactWindowsProfile, 'resourceGain');
    state.stealthAttackExpiresAt = at + (meticulous ? enhancedDuration : standardDuration);
  } else if (skill.id === ID.MISTBURN_MORTAR) {
    const mistburnProfile = requireBalanceProfileFromContext(context, PROFILE.mistburnProc);
    if (!requireEffect(mistburnProfile, 'condition', 'Burning')) return;
    // No charge grant survives removal of its only proc packet.
    // A new Mortar replaces the grant; generation still distinguishes it from replayed snapshots.
    state.mistburn = grantCharges(
      balanceProfileNumber(artifactWindowsProfile, 'playerStacks'),
      at + (meticulous ? enhancedDuration : standardDuration)
    );
    state.mistburnGeneration += 1;
  } else if (skill.id === ID.SUMMON_KRYPTIS_TURRET) {
    state.kryptisDamageUntil =
      at +
      (meticulous
        ? balanceProfileNumber(artifactWindowsProfile, 'threshold')
        : balanceProfileNumber(artifactWindowsProfile, 'minimumStacks'));
  } else if (skill.id === ID.CHAK_SHIELD) {
    state.chakInitiativeRefundUntil = at + (meticulous ? enhancedDuration : standardDuration);
  } else if (skill.id === ID.HOLO_DANCER_DECOY) {
    const expiresAt = at + (meticulous ? enhancedDuration : standardDuration);
    // Accumulate one entry per Decoy use; accepted utility casts consume entries in grant order.
    state.holoUtilityCooldownReductionExpirations = [
      ...(state.holoUtilityCooldownReductionExpirations || []),
      expiresAt
    ];
  } else if (skill.id === ID.FORGED_SURFER_DASH) {
    // The bomb-drop buff has its own duration, independent of how many bombs hit the target.
    state.forgedSurferBombDropUntil = at + (meticulous ? enhancedDuration : standardDuration);
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
  if (hasTrait(context.config, TRAIT.ENTERPRISING_ARISTOCRAT)) {
    const enterprisingAristocratProfile = requireBalanceProfileFromContext(context, PROFILE.enterprisingAristocrat);
    gainThiefInitiative(
      context,
      balanceProfileNumber(enterprisingAristocratProfile, 'resourceGain'),
      at,
      'enterprising-aristocrat'
    );
  }

  if (hasTrait(context.config, TRAIT.EXHILARATING_EPHEMERA)) {
    extendExhilaratingEphemera(context, state, at);
  }

  if (hasTrait(context.config, TRAIT.POSSESSIVE_HOARDER)) {
    const possessiveHoarderProfile = requireBalanceProfileFromContext(context, PROFILE.possessiveHoarder);
    const might = requireEffect(possessiveHoarderProfile, 'boon', 'might');
    const protection = requireEffect(possessiveHoarderProfile, 'boon', 'protection');
    const alacrity = requireEffect(possessiveHoarderProfile, 'boon', 'alacrity');
    // Keep each artifact-family boon bound to its own trigger after removals.
    const boons = [
      ...(slot?.kind === 'offensive' ? [might] : []),
      ...(slot?.kind === 'defensive' ? [protection] : []),
      alacrity
    ];
    for (const effect of boons) {
      if (!effect) continue;
      const boon = String(effect.boon);
      emitSkillBuff(context, {
        at,
        source: 'thief',
        sourceId: 'Possessive Hoarder',
        actorType: 'player',
        skillId: context.skill?.id ?? null,
        skillName: context.skill?.name ?? null,
        name: 'Possessive Hoarder',
        kind: boon,
        boon,
        duration: gw2SchedulerBoonDuration(
          context,
          context.skill || ({ id: 'Possessive Hoarder', name: 'Possessive Hoarder' } as ThiefSkill),
          boon,
          effectNumber(possessiveHoarderProfile, effect, 'duration')
        ),
        stacks: effectNumber(possessiveHoarderProfile, effect, 'stacks')
      });
    }
  }

  if (skill.id === ID.CHAK_SHIELD && hasTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)) {
    const meticulousCustodianProfile = requireBalanceProfileFromContext(context, PROFILE.meticulousCustodian);
    const strike = requireEffect(meticulousCustodianProfile, 'strike', 'Meticulous Custodian');
    if (strike)
      emitSkillDamage(context, {
        at,
        source: 'thief',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: 'Chak Shield',
        coefficient: effectNumber(meticulousCustodianProfile, strike, 'coefficient'),
        hits: effectNumber(meticulousCustodianProfile, strike, 'hits'),
        activationId: context.reservationId
      });
  }

  applyArtifactIdentity(context, skill, at);
  reduceSkrittSwipeRecharge(context, at);
  emitThiefStateSnapshot(context, at, 'artifact-used');
}

export function completeForgedSurfer(context: ThiefCastContext, skill: ThiefSkill): void {
  consumeArtifact(context, skill);

  const forgedSurferProfile = requireBalanceProfileFromContext(context, PROFILE.forgedSurfer);
  forgedSurfer.start(context, {
    key: 'forged-surfer',
    at: context.effectiveEnd + balanceProfileNumber(forgedSurferProfile, 'initialDelay'),
    count:
      1 +
      Math.ceil(
        Math.min(
          balanceProfileNumber(forgedSurferProfile, 'maximumStacks'),
          antiquaryState.from(context).forgedSurferMaximumBombHits
        )
      ),
    captured: { skillId: skill.id }
  });
}

// A replacement cancels the whole sequence; occurrence zero is the dash and later occurrences are bombs.
export const forgedSurfer = timedEffect<ThiefSchedulerContext, { skillId: SkillId }>({
  id: 'thief.forged-surfer',
  interval: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.forgedSurfer), 'pulseInterval'),
  effectsAt(context, at, { skillId }, bomb) {
    const profileId = hasTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)
      ? PROFILE.forgedSurferMeticulous
      : PROFILE.forgedSurfer;
    // Dash and bomb identities survive deletion of either strike or condition.
    const packetName = bomb === 0 ? 'Dash' : 'Bomb';
    const selectedProfile = requireBalanceProfileFromContext(context, profileId);
    const strike = requireEffect(selectedProfile, 'strike', packetName);
    const burning = requireEffect(selectedProfile, 'condition', packetName);
    const name = bomb === 0 ? 'Forged Surfer Dash' : 'Forged Surfer Dash ? Bomb';
    if (strike)
      emitSkillDamage(context, {
        at,
        source: 'thief',
        sourceId: skillId,
        actorType: 'player',
        skillId,
        skillName: 'Forged Surfer Dash',
        name,
        coefficient: effectNumber(selectedProfile, strike, 'coefficient'),
        hits: effectNumber(selectedProfile, strike, 'hits')
      });
    if (burning)
      emitSkillCondition(context, {
        at,
        skillId,
        skillName: 'Forged Surfer Dash',
        name: `${name} ? Burning`,
        condition: String(burning.condition),
        stacks: effectNumber(selectedProfile, burning, 'stacks'),
        duration: effectNumber(selectedProfile, burning, 'duration')
      });
  }
});

// Double Edge is only risky when the skill is on cooldown; casting off-cooldown always succeeds
function riskyDoubleEdge(context: ThiefCastContext, skill: ThiefSkill): boolean {
  return Number(context.state.cooldowns.get(skill.id) || 0) > context.start + EPSILON;
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

// Emit the cannon backfire's damage and conditions against nearby enemies;
// the self-hit is omitted by the outgoing-only combat model.
function emitCannonBackfire(context: ThiefCastContext, at: number): void {
  const cannonBackfireProfile = requireBalanceProfileFromContext(context, PROFILE.cannonBackfire);
  const strike = requireEffect(cannonBackfireProfile, 'strike', 'Stone Summit Cannon - Backfire');
  const burning = requireEffect(cannonBackfireProfile, 'condition', 'Burning');
  const impactAt = at + balanceProfileNumber(cannonBackfireProfile, 'initialDelay');
  if (strike)
    emitSkillDamage(context, {
      at: impactAt,
      source: 'thief',
      sourceId: ID.STONE_SUMMIT_CANNON,
      actorType: 'player',
      skillId: ID.STONE_SUMMIT_CANNON,
      skillName: 'Stone Summit Cannon',
      name: 'Stone Summit Cannon — Backfire',
      coefficient: effectNumber(cannonBackfireProfile, strike, 'coefficient'),
      hits: effectNumber(cannonBackfireProfile, strike, 'hits')
    });
  // Separate Burning applications preserve the total, including any fractional final stack.
  if (!burning) return;
  const stacks = effectNumber(cannonBackfireProfile, burning, 'stacks');
  const duration = effectNumber(cannonBackfireProfile, burning, 'duration');
  for (let index = 0; index < Math.ceil(stacks); index += 1) {
    emitSkillCondition(context, {
      at: impactAt,
      skillId: ID.STONE_SUMMIT_CANNON,
      skillName: 'Stone Summit Cannon',
      name: 'Stone Summit Cannon — Backfire',
      condition: String(burning.condition),
      stacks: Math.min(1, stacks - index),
      duration
    });
  }
}

// Materialize the successful Canach cannon shot and its target effects from one
// outcome branch.
function emitCannonSuccess(context: ThiefCastContext): void {
  const cannonSuccessProfile = requireBalanceProfileFromContext(context, PROFILE.cannonSuccess);
  const strike = requireEffect(cannonSuccessProfile, 'strike', 'Stone Summit Cannon - Success');
  const burning = requireEffect(cannonSuccessProfile, 'condition', 'Burning');
  // Strike and Burning retain independent authored timing after either packet is removed.
  if (strike) {
    if (!strike.ticks?.length)
      throw new TypeError(
        `Invalid balance data: profile=${PROFILE.cannonSuccess} effect=strike/${strike.name} field=ticks patch=${context.config.patchId} requires strike ticks`
      );
    for (const [index, tick] of strike.ticks.entries()) {
      emitSkillDamage(context, {
        at: context.effectiveEnd + tick.atMs / 1000,
        source: 'thief',
        sourceId: ID.STONE_SUMMIT_CANNON,
        actorType: 'player',
        skillId: ID.STONE_SUMMIT_CANNON,
        skillName: 'Stone Summit Cannon',
        name: 'Stone Summit Cannon',
        coefficient: tick.coefficient,
        hits: 1,
        hitIndex: index + 1,
        totalHits: strike.ticks.length
      });
    }
  }

  if (burning) {
    const applications = effectNumber(cannonSuccessProfile, burning, 'applications');
    const initial = effectNumber(cannonSuccessProfile, burning, 'atMs');
    const interval = effectNumber(cannonSuccessProfile, burning, 'intervalMs');
    const stacks = effectNumber(cannonSuccessProfile, burning, 'stacks');
    const duration = effectNumber(cannonSuccessProfile, burning, 'duration');
    for (let index = 0; index < applications; index += 1) {
      emitSkillCondition(context, {
        at: context.effectiveEnd + (initial + index * interval) / 1000,
        skillId: ID.STONE_SUMMIT_CANNON,
        skillName: 'Stone Summit Cannon',
        name: 'Stone Summit Cannon � Burning',
        condition: String(burning.condition),
        stacks,
        duration
      });
    }
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

  if (skill.id === ID.CANACH_COIN_TOSS) {
    tossCanachCoins(context, at, outcome === 'backfire');
  }

  emitThiefStateSnapshot(context, at, `double-edge-${outcome}`);
  return outcome;
}

export function completeSkrittScuffle(context: ThiefCastContext, skill: ThiefSkill): void {
  // Cancelled summons grant neither the initial artifact nor recurring pilfers.
  if (context.action?.cancelled === true) return;
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;

  const scuffleProfile = requireBalanceProfileFromContext(context, PROFILE.scuffle);
  const interval = balanceProfileNumber(scuffleProfile, 'pulseInterval');
  const summon = {
    skillId: skill.id,
    name: 'Skritt Assistant',
    expiresAt: canonicalTime(at + balanceProfileNumber(scuffleProfile, 'durationMultiplier'))
  };
  state.activeAntiquarySummons.push(summon);
  state.nextSkrittScufflePilferAt = at + interval;
  pilferArtifacts(context, at, 'skritt-scuffle-artifact', 'scuffle');
  // Each assistant retains an independent lifetime, including the final pilfer at expiry.
  if (interval > 0)
    skrittScuffle.start(context, {
      at: at + interval,
      captured: { expiresAt: summon.expiresAt }
    });
  emitThiefStateSnapshot(context, at, 'skritt-scuffle');
}

export const skrittScuffle = timedEffect<ThiefSchedulerContext, { expiresAt: number }>({
  id: 'thief.skritt-scuffle',
  nextAt(context, at, { expiresAt }) {
    const scuffleProfile = requireBalanceProfileFromContext(context, PROFILE.scuffle);
    const interval = balanceProfileNumber(scuffleProfile, 'pulseInterval');
    const next = canonicalTime(at + interval);
    return interval > 0 && next <= expiresAt ? next : null;
  },
  effectsAt(context, at, { expiresAt }) {
    const scuffleProfile = requireBalanceProfileFromContext(context, PROFILE.scuffle);
    const interval = balanceProfileNumber(scuffleProfile, 'pulseInterval');
    if (!(interval > 0) || at > expiresAt) return false;
    const next = canonicalTime(at + interval);
    // This public value is a retry/display projection; the timed instance owns scheduling.
    antiquaryState.from(context).nextSkrittScufflePilferAt = next <= expiresAt ? next : 0;
    pilferArtifacts(context, at, 'skritt-scuffle-artifact', 'scuffle');
  }
});
