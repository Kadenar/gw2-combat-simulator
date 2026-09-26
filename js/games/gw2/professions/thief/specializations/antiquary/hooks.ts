import { canonicalTime, EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { consumeOldestStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT
} from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/thief/core/profiles.js';
import {
  deferThiefCompletion,
  emitThiefBuff,
  emitThiefCondition,
  emitThiefDamage,
  takeThiefCompletion
} from '#gw2/professions/thief/core/events.js';
import { grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import { emitThiefStealTraits } from '#gw2/professions/thief/core/mechanics/steal.js';
import { antiquaryResolverEventReactions } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifact-effects.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type {
  ThiefDoubleEdgeOutcome,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefRuntimeState,
  ThiefSkill
} from '#gw2/professions/thief/types.js';
import type { ThiefArtifactSlot } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

const ANTIQUARY_COMPLETE = 'thief.antiquary-complete';
const FORGED_SURFER = 'thief.forged-surfer';
const SKRITT_SCUFFLE = 'thief.skritt-scuffle';
// One owner for every Forged Surfer occurrence: a new dash cancels the whole prior sequence.
const FORGED_SURFER_OWNER = Object.freeze({ id: FORGED_SURFER, generation: 0 });

/** Accepted Double Edge outcomes and Canach coin initiative, held by cast identity until completion. */
const doubleEdgeOutcomes = new WeakMap<RuntimeCast, ThiefDoubleEdgeOutcome>();
const coinInitiative = new WeakMap<RuntimeCast, number>();
/** The slot each accepted artifact cast spent, which selects its Possessive Hoarder family boon. */
const artifactSlotsUsed = new WeakMap<RuntimeCast, ThiefArtifactSlot | undefined>();

function allArtifactChoices(): ThiefArtifactSlot[] {
  return [
    ...THIEF_ARTIFACT_IDS.OFFENSIVE.map((skillId) => ({ kind: 'offensive' as const, skillId })),
    ...THIEF_ARTIFACT_IDS.DEFENSIVE.map((skillId) => ({ kind: 'defensive' as const, skillId }))
  ];
}

/** Scoundrel's Luck refreshes to its cap only when its internal cooldown is ready, so charges never bank. */
function grantScoundrelsLuck(runtime: ThiefRuntime): void {
  const state = antiquaryState.from(runtime);
  if (
    !hasTrait(runtime, TRAIT.SCOUNDRELS_LUCK) ||
    !isInternalCooldownReady(runtime.time, Number(state.scoundrelsLuckReadyAt || 0))
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.scoundrelsLuck);
  state.scoundrelsLuck = balanceProfileNumber(profile, 'maximumStacks');
  state.scoundrelsLuckReadyAt = runtime.time + balanceProfileNumber(profile, 'internalCooldown');
}

/** Combat High replaces its stacks with staggered expiries, losing one stack per interval. */
function grantCombatHigh(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.COMBAT_HIGH)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.combatHigh);
  const maximum = Math.max(0, Math.trunc(balanceProfileNumber(profile, 'maximumStacks')));
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const expiresAt = runtime.time + balanceProfileNumber(profile, 'durationMultiplier');
  antiquaryState.from(runtime).combatHighExpirations =
    interval > 0
      ? purgeExpiredStacks(
          Array.from({ length: maximum }, (_, index) => expiresAt - index * interval),
          runtime.time
        )
      : [];
}

/** Improvisation shortens every selected, still-recharging utility once per internal cooldown. */
function reduceUtilityRecharges(runtime: ThiefRuntime): void {
  if (!hasTrait(runtime, TRAIT.IMPROVISATION)) return;
  const state = antiquaryState.from(runtime);
  if (!isInternalCooldownReady(runtime.time, Number(state.improvisationReadyAt || 0))) return;
  const profile = requireBalanceProfileFromContext(runtime, CORE_PROFILE.improvisation);
  const multiplier = balanceProfileNumber(profile, 'rechargeMultiplier');
  for (const name of selectedSkillNameSet(runtime.config.selectedSkills)) {
    const skill = runtime.helpers.skillsByName.get(name);
    if (skill?.type === 'Utility')
      runtime.cooldownController.reduceSkillRecharge(skill, gw2BaseRecharge(skill) * (1 - multiplier), runtime.time);
  }

  state.improvisationReadyAt = runtime.time + balanceProfileNumber(profile, 'internalCooldown');
}

/**
 * Replaces the held artifacts. Prolific Plunderer and Improvisation add a use only for a Skritt Swipe pilfer, which
 * also refreshes Scoundrel's Luck and Combat High and applies Improvisation's utility reduction.
 */
function pilferArtifacts(runtime: ThiefRuntime, source: 'swipe' | 'initiative' | 'scuffle'): void {
  const state = antiquaryState.from(runtime);
  state.artifactSlots = allArtifactChoices();
  state.artifactUsesRemaining =
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks') +
    (source === 'swipe' && hasTrait(runtime, TRAIT.PROLIFIC_PLUNDERER)
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.prolificPlunderer), 'resourceGain')
      : 0) +
    (source === 'swipe' && hasTrait(runtime, TRAIT.IMPROVISATION)
      ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, CORE_PROFILE.improvisation), 'resourceGain')
      : 0);
  state.initiativeSpentSincePilfer = 0;
  if (source !== 'swipe') return;
  grantScoundrelsLuck(runtime);
  grantCombatHigh(runtime);
  reduceUtilityRecharges(runtime);
}

/** Each artifact opens its own identity window, measured from its use. */
function applyArtifactIdentity(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const state = antiquaryState.from(runtime);
  const at = runtime.time;
  const windows = requireBalanceProfileFromContext(runtime, PROFILE.artifactWindows);
  const duration = balanceProfileNumber(
    windows,
    hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? 'maximumStacks' : 'durationMultiplier'
  );
  if (skill.id === ID.METAL_LEGION_GUITAR) {
    state.stealthAttackCharges = balanceProfileNumber(windows, 'resourceGain');
    state.stealthAttackExpiresAt = at + duration;
  } else if (skill.id === ID.MISTBURN_MORTAR) {
    // No charge grant survives removal of its only proc packet; a new Mortar replaces the grant.
    if (!requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.mistburnProc), 'condition', 'Burning')) return;
    state.mistburn = grantCharges(balanceProfileNumber(windows, 'playerStacks'), at + duration);
  } else if (skill.id === ID.SUMMON_KRYPTIS_TURRET)
    state.kryptisDamageUntil =
      at + balanceProfileNumber(windows, hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? 'threshold' : 'minimumStacks');
  else if (skill.id === ID.CHAK_SHIELD) state.chakInitiativeRefundUntil = at + duration;
  // Each Decoy adds one utility-recharge entry; accepted utility casts spend them in grant order.
  else if (skill.id === ID.HOLO_DANCER_DECOY)
    state.holoUtilityCooldownReductionExpirations = [...state.holoUtilityCooldownReductionExpirations, at + duration];
  // The bomb-drop buff has its own duration, independent of how many bombs hit.
  else if (skill.id === ID.FORGED_SURFER_DASH) state.forgedSurferBombDropUntil = at + duration;
}

/** Possessive Hoarder grants the artifact family's boon plus Alacrity. */
function possessiveHoarder(runtime: ThiefRuntime, cast: RuntimeCast, slot: ThiefArtifactSlot | undefined): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.possessiveHoarder);
  const boons = [
    ...(slot?.kind === 'offensive' ? [requireEffect(profile, 'boon', 'might')] : []),
    ...(slot?.kind === 'defensive' ? [requireEffect(profile, 'boon', 'protection')] : []),
    requireEffect(profile, 'boon', 'alacrity')
  ];
  for (const effect of boons) {
    if (!effect) continue;
    const boon = String(effect.boon);
    emitThiefBuff(runtime, cast.skill as ThiefSkill, {
      at: runtime.time,
      sourceId: 'Possessive Hoarder',
      activationId: cast.id,
      name: 'Possessive Hoarder',
      kind: boon,
      boon,
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks')
    });
  }
}

/**
 * Activating an artifact spends its slot and one use immediately, so a pilfer during a long artifact cast supplies
 * the next pool instead of being consumed by the cast that was already underway.
 */
function spendArtifact(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const state = antiquaryState.from(runtime);
  artifactSlotsUsed.set(
    cast,
    state.artifactSlots.find((value) => value.skillId === cast.skill.id)
  );
  state.artifactUsesRemaining = Math.max(0, state.artifactUsesRemaining - 1);
  state.artifactSlots = state.artifactSlots.filter((value) => value.skillId !== cast.skill.id);
}

/** The used artifact's family traits and identity window apply at completion, followed by Repeat Ransacker. */
function completeArtifact(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const state = antiquaryState.from(runtime);
  const skill = cast.skill as ThiefSkill;
  const slot = artifactSlotsUsed.get(cast);
  if (hasTrait(runtime, TRAIT.ENTERPRISING_ARISTOCRAT))
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.enterprisingAristocrat), 'resourceGain')
    );
  if (hasTrait(runtime, TRAIT.EXHILARATING_EPHEMERA)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.exhilaratingEphemera);
    const remaining = Math.max(0, Number(state.antiquaryDamageUntil || 0) - runtime.time);
    state.antiquaryDamageUntil =
      runtime.time +
      Math.min(
        balanceProfileNumber(profile, 'maximumStacks'),
        remaining + balanceProfileNumber(profile, 'durationMultiplier')
      );
  }

  if (hasTrait(runtime, TRAIT.POSSESSIVE_HOARDER)) possessiveHoarder(runtime, cast, slot);
  if (skill.id === ID.CHAK_SHIELD && hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.meticulousCustodian);
    const strike = requireEffect(profile, 'strike', 'Meticulous Custodian');
    if (strike)
      emitThiefDamage(runtime, null, {
        at: runtime.time,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        activationId: cast.id,
        name: 'Chak Shield',
        coefficient: effectNumber(profile, strike, 'coefficient'),
        hits: effectNumber(profile, strike, 'hits')
      });
  }

  applyArtifactIdentity(runtime, skill);
  const swipe = runtime.helpers.skillsById.get(ID.SKRITT_SWIPE);
  if (swipe && hasTrait(runtime, TRAIT.REPEAT_RANSACKER))
    runtime.cooldownController.reduceSkillRecharge(
      swipe,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.repeatRansacker), 'rechargeReduction'),
      runtime.time
    );
}

/** The first Forged Surfer occurrence is the dash; later occurrences drop bombs until the assumed hit count. */
function forgedSurfer(runtime: ThiefRuntime, data: unknown): void {
  const { skillId, occurrence, count } = data as { skillId: SkillId; occurrence: number; count: number };
  const profile = requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? PROFILE.forgedSurferMeticulous : PROFILE.forgedSurfer
  );
  // Dash and bomb identities survive deletion of either strike or condition.
  const packet = occurrence === 0 ? 'Dash' : 'Bomb';
  const strike = requireEffect(profile, 'strike', packet);
  const burning = requireEffect(profile, 'condition', packet);
  const name = occurrence === 0 ? 'Forged Surfer Dash' : 'Forged Surfer Dash — Bomb';
  if (strike)
    emitThiefDamage(runtime, null, {
      at: runtime.time,
      sourceId: skillId,
      skillId,
      skillName: 'Forged Surfer Dash',
      name,
      coefficient: effectNumber(profile, strike, 'coefficient'),
      hits: effectNumber(profile, strike, 'hits')
    });
  if (burning)
    emitThiefCondition(runtime, null, {
      at: runtime.time,
      skillId,
      skillName: 'Forged Surfer Dash',
      name: `${name} — Burning`,
      condition: String(burning.condition),
      stacks: effectNumber(profile, burning, 'stacks'),
      duration: effectNumber(profile, burning, 'duration')
    });
  if (occurrence + 1 < count)
    runtime.schedule(
      FORGED_SURFER,
      runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.forgedSurfer), 'pulseInterval'),
      { skillId, occurrence: occurrence + 1, count },
      FORGED_SURFER_OWNER
    );
}

/** A new dash replaces any running sequence and starts after the authored delay. */
function startForgedSurfer(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.forgedSurfer);
  runtime.cancelOwner(FORGED_SURFER_OWNER);
  runtime.schedule(
    FORGED_SURFER,
    runtime.time + balanceProfileNumber(profile, 'initialDelay'),
    {
      skillId: skill.id,
      occurrence: 0,
      count:
        1 +
        Math.ceil(
          Math.min(
            balanceProfileNumber(profile, 'maximumStacks'),
            antiquaryState.from(runtime).forgedSurferMaximumBombHits
          )
        )
    },
    FORGED_SURFER_OWNER
  );
}

/** Each Skritt assistant keeps an independent lifetime, including a final pilfer at its expiry. */
function skrittScufflePilfer(runtime: ThiefRuntime, data: unknown): void {
  const { expiresAt } = data as { expiresAt: number };
  const interval = balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.scuffle), 'pulseInterval');
  if (!(interval > 0) || runtime.time > expiresAt) return;
  const state = antiquaryState.from(runtime);
  const next = canonicalTime(runtime.time + interval);
  state.activeAntiquarySummons = state.activeAntiquarySummons.filter((summon) => summon.expiresAt > runtime.time);
  // The public value is a retry and display projection; the queued pulse owns scheduling.
  state.nextSkrittScufflePilferAt = next <= expiresAt ? next : 0;
  pilferArtifacts(runtime, 'scuffle');
  if (next <= expiresAt) runtime.schedule(SKRITT_SCUFFLE, next, { expiresAt });
}

function completeSkrittScuffle(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const state = antiquaryState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.scuffle);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const expiresAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'durationMultiplier'));
  state.activeAntiquarySummons = [
    ...state.activeAntiquarySummons.filter((summon) => summon.expiresAt > runtime.time),
    { skillId: skill.id, name: 'Skritt Assistant', expiresAt }
  ];
  state.nextSkrittScufflePilferAt = runtime.time + interval;
  pilferArtifacts(runtime, 'scuffle');
  if (interval > 0) runtime.schedule(SKRITT_SCUFFLE, canonicalTime(runtime.time + interval), { expiresAt });
}

/** Double Edge is risky only while its recharge is running; Scoundrel's Luck turns one risky use into a success. */
function acceptDoubleEdge(runtime: ThiefRuntime, cast: RuntimeCast): ThiefDoubleEdgeOutcome {
  if (Number(runtime.cooldowns.get(cast.skill.id) || 0) <= runtime.time + EPSILON) return 'success';
  const state = antiquaryState.from(runtime);
  if (state.scoundrelsLuck > 0) {
    state.scoundrelsLuck -= 1;
    return 'success';
  }

  return cast.command.doubleEdgeOutcome === 'backfire' ? 'backfire' : 'success';
}

/** The cannon backfire hits nearby foes after its delay; the self-hit is outside the outgoing-only model. */
function emitCannonBackfire(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.cannonBackfire);
  const strike = requireEffect(profile, 'strike', 'Stone Summit Cannon - Backfire');
  const burning = requireEffect(profile, 'condition', 'Burning');
  const at = cast.effectiveEnd + balanceProfileNumber(profile, 'initialDelay');
  const common = {
    sourceId: ID.STONE_SUMMIT_CANNON,
    skillId: ID.STONE_SUMMIT_CANNON,
    skillName: 'Stone Summit Cannon'
  };
  if (strike)
    emitThiefDamage(runtime, null, {
      ...common,
      at,
      name: 'Stone Summit Cannon — Backfire',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      hits: effectNumber(profile, strike, 'hits')
    });
  if (!burning) return;
  // Separate Burning applications preserve the total, including any fractional final stack.
  const stacks = effectNumber(profile, burning, 'stacks');
  for (let index = 0; index < Math.ceil(stacks); index += 1)
    emitThiefCondition(runtime, null, {
      ...common,
      at,
      name: 'Stone Summit Cannon — Backfire',
      condition: String(burning.condition),
      stacks: Math.min(1, stacks - index),
      duration: effectNumber(profile, burning, 'duration')
    });
}

/** The successful cannon shot's strike and Burning keep independent authored timing from the cast's end. */
function emitCannonSuccess(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.cannonSuccess);
  const strike = requireEffect(profile, 'strike', 'Stone Summit Cannon - Success');
  const burning = requireEffect(profile, 'condition', 'Burning');
  const common = {
    sourceId: ID.STONE_SUMMIT_CANNON,
    skillId: ID.STONE_SUMMIT_CANNON,
    skillName: 'Stone Summit Cannon'
  };
  if (strike) {
    if (!strike.ticks?.length)
      throw new TypeError(
        `Invalid balance data: profile=${PROFILE.cannonSuccess} effect=strike/${strike.name} field=ticks patch=${runtime.config.patchId} requires strike ticks`
      );
    for (const [index, tick] of strike.ticks.entries())
      emitThiefDamage(runtime, null, {
        ...common,
        at: cast.effectiveEnd + Number(tick.atMs) / 1000,
        name: 'Stone Summit Cannon',
        coefficient: Number(tick.coefficient),
        hitIndex: index + 1,
        totalHits: strike.ticks.length
      });
  }

  if (!burning) return;
  const initial = effectNumber(profile, burning, 'atMs');
  const interval = effectNumber(profile, burning, 'intervalMs');
  for (let index = 0; index < effectNumber(profile, burning, 'applications'); index += 1)
    emitThiefCondition(runtime, null, {
      ...common,
      at: cast.effectiveEnd + (initial + index * interval) / 1000,
      name: 'Stone Summit Cannon — Burning',
      condition: String(burning.condition),
      stacks: effectNumber(profile, burning, 'stacks'),
      duration: effectNumber(profile, burning, 'duration')
    });
}

/** Canach coins alternate heads and tails across uses; a backfire pays only for heads. */
function tossCanachCoins(runtime: ThiefRuntime, backfire: boolean): number {
  const state = antiquaryState.from(runtime);
  let initiative = 0;
  for (let coin = 0; coin < 3; coin += 1) {
    const heads = Number(state.canachCoinIndex || 0) % 2 === 0;
    state.canachCoinIndex = Number(state.canachCoinIndex || 0) + 1;
    initiative += backfire ? Number(heads) : heads ? 2 : 1;
  }

  return initiative;
}

/**
 * The accepted Double Edge outcome is fixed at cast start, including uses the rotation cancels immediately, and its
 * packets are timed from the reserved end of the cast.
 */
function startDoubleEdge(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const state = antiquaryState.from(runtime);
  const skill = cast.skill as ThiefSkill;
  const outcome = acceptDoubleEdge(runtime, cast);
  doubleEdgeOutcomes.set(cast, outcome);
  if (outcome === 'backfire')
    // The backfire variant stays visible until the running recharge ends.
    state.backfireState[skill.id] = {
      activeUntil: Number(runtime.cooldowns.get(skill.id) || cast.effectiveEnd),
      skillName: skill.name
    };
  else delete state.backfireState[skill.id];
  if (skill.id === ID.STONE_SUMMIT_CANNON)
    (outcome === 'backfire' ? emitCannonBackfire : emitCannonSuccess)(runtime, cast);
  if (skill.id === ID.CANACH_COIN_TOSS) coinInitiative.set(cast, tossCanachCoins(runtime, outcome === 'backfire'));
}

/** Initiative spending feeds Prodigious Pincher, and Chak Shield refunds it while its window is open. */
function spendAntiquaryInitiative(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const cost = Number((cast.skill as ThiefSkill).initiativeCost || 0);
  if (!(cost > 0)) return;
  const state = antiquaryState.from(runtime);
  state.initiativeSpentSincePilfer += cost;
  if (Number(state.chakInitiativeRefundUntil || 0) > runtime.time) grantThiefInitiative(runtime, cost);
  // Initiative spent before combat begins does not count toward the threshold.
  if (
    runtime.combatStartedAt() &&
    hasTrait(runtime, TRAIT.PRODIGIOUS_PINCHER) &&
    state.initiativeSpentSincePilfer >=
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.prodigiousPincher), 'threshold')
  )
    pilferArtifacts(runtime, 'initiative');
}

function completeAntiquaryCast(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as ThiefSkill;
  const committed = !cast.cancelled;
  if (skill.id === ID.SKRITT_SWIPE && committed) {
    emitThiefStealTraits(runtime, cast);
    pilferArtifacts(runtime, 'swipe');
    if (hasTrait(runtime, TRAIT.KLEPTOMANIAC))
      grantThiefInitiative(
        runtime,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, CORE_PROFILE.kleptomaniac), 'resourceGain')
      );
  }

  // Artifact, Reshuffle, and Double Edge completions keep the accepted use even when the cast is cut short.
  if (skill.artifactKind) {
    completeArtifact(runtime, cast);
    if (skill.id === ID.FORGED_SURFER_DASH) startForgedSurfer(runtime, skill);
  }

  if (skill.id === ID.RESHUFFLE) antiquaryState.from(runtime).artifactSlots = allArtifactChoices();
  const coins = coinInitiative.get(cast);
  if (coins != null) grantThiefInitiative(runtime, coins);
  if (skill.id === ID.SKRITT_SCUFFLE && committed) completeSkrittScuffle(runtime, skill);
}

/** Artifacts require a held slot; backfire variants are internal; Reshuffle rerolls only an existing pool. */
function antiquaryAvailability(runtime: ThiefRuntime, rawSkill: Skill): AvailabilityResult {
  const skill = rawSkill as ThiefSkill;
  const state = antiquaryState.from(runtime);
  if (
    skill.artifactKind &&
    (state.artifactUsesRemaining <= 0 || !state.artifactSlots.some((slot) => slot.skillId === skill.id))
  )
    // A running Skritt Scuffle supplies the next pool at its next pilfer.
    return denySkillCast(
      skill,
      'thief.artifact',
      'this artifact is not in an available artifact slot.',
      Number(state.nextSkrittScufflePilferAt || 0) > runtime.time ? Number(state.nextSkrittScufflePilferAt) : null
    );
  if (skill.backfire)
    return denySkillCast(skill, 'thief.backfire-variant', 'backfire variants are resolved by their Double Edge skill.');
  if (skill.id === ID.RESHUFFLE && (state.artifactUsesRemaining <= 0 || state.artifactSlots.length === 0))
    return denySkillCast(skill, 'thief.artifact', 'pilfer artifacts first.');
  return { ready: true };
}

/** Antiquary hooks: artifact pilfering and use, Double Edge outcomes, Skritt summons, and artifact-driven traits. */
export const antiquaryHooks: Partial<RuntimeProfession<ThiefRuntimeState>> = {
  availability: antiquaryAvailability,
  // Only accepted utility casts spend the oldest live Holo-Dancer entry, even when a newer one expires sooner.
  reserveRecharge(runtime, skill, work) {
    if (skill.type !== 'Utility') return work;
    const state = antiquaryState.from(runtime);
    const { expiries, consumed } = consumeOldestStacks(state.holoUtilityCooldownReductionExpirations, 1, runtime.time);
    state.holoUtilityCooldownReductionExpirations = expiries;
    return consumed > 0
      ? work *
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.artifactWindows), 'rechargeMultiplier')
      : work;
  },
  onCastStart(runtime, cast) {
    spendAntiquaryInitiative(runtime, cast);
    if ((cast.skill as ThiefSkill).artifactKind) spendArtifact(runtime, cast);
    // Double Edge skills are the ones usable while recharging; they choose an outcome from cooldown state at acceptance.
    if (cast.skill.usableWhileRecharging === true) startDoubleEdge(runtime, cast);
  },
  modifyEffects(_runtime, cast, effects) {
    // Surfer, Scuffle, Cannon, Coin Toss, and any backfire own their packets (or none) instead of the authored ones.
    const id = cast.skill.id;
    return id === ID.FORGED_SURFER_DASH ||
      id === ID.SKRITT_SCUFFLE ||
      id === ID.STONE_SUMMIT_CANNON ||
      id === ID.CANACH_COIN_TOSS ||
      doubleEdgeOutcomes.get(cast) === 'backfire'
      ? []
      : effects;
  },
  onCastComplete(runtime, cast) {
    deferThiefCompletion(runtime, ANTIQUARY_COMPLETE, cast);
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      antiquaryResolverEventReactions.damage(runtime as unknown as ThiefResolverContext, event as ThiefResolverEvent);
    }
  },
  tasks: {
    [ANTIQUARY_COMPLETE](runtime, data) {
      const cast = takeThiefCompletion(runtime, ANTIQUARY_COMPLETE, data);
      if (cast) completeAntiquaryCast(runtime, cast);
    },
    [FORGED_SURFER]: forgedSurfer,
    [SKRITT_SCUFFLE]: skrittScufflePilfer
  }
};
