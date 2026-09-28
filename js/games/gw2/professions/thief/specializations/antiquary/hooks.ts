import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
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
import { emitThiefBuff, emitThiefCondition, emitThiefDamage } from '#gw2/professions/thief/core/events.js';
import { grantThiefInitiative } from '#gw2/professions/thief/core/mechanics/resources.js';
import { emitThiefStealTraits } from '#gw2/professions/thief/core/mechanics/steal.js';
import { antiquaryResolverEventReactions } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifact-effects.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { ThiefDoubleEdgeOutcome, ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import type { ThiefArtifactSlot } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

const FORGED_SURFER = 'thief.forged-surfer';
const SKRITT_SCUFFLE = 'thief.skritt-scuffle';
// One owner for every Forged Surfer occurrence: a new dash cancels the whole prior sequence.
const FORGED_SURFER_OWNER = Object.freeze({ id: FORGED_SURFER, generation: 0 });

/** Accepted Canach coin initiative, held by cast identity until commitment or cancellation. */
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
    !runtime.procs.claim(PROFILE.scoundrelsLuck, 'thief.antiquary.scoundrelsLuck', runtime.time)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.scoundrelsLuck);
  state.scoundrelsLuck = balanceProfileNumber(profile, 'maximumStacks');
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
  // An eligible pilfer claims the interval even when no selected utility is recharging.
  if (!runtime.procs.claim(CORE_PROFILE.improvisation, 'thief.antiquary.improvisation', runtime.time)) return;
  const profile = requireBalanceProfileFromContext(runtime, CORE_PROFILE.improvisation);
  const multiplier = balanceProfileNumber(profile, 'rechargeMultiplier');
  for (const name of selectedSkillNameSet(runtime.config.selectedSkills)) {
    const skill = runtime.helpers.skillsByName.get(name);
    if (skill?.type === 'Utility')
      runtime.cooldownController.reduceSkillRecharge(skill, gw2BaseRecharge(skill) * (1 - multiplier), runtime.time);
  }
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

/** Identity lifetimes use the live Meticulous profile at commitment. */
function artifactWindow(runtime: ThiefRuntime): {
  windows: ReturnType<typeof requireBalanceProfileFromContext>;
  duration: number;
} {
  const windows = requireBalanceProfileFromContext(runtime, PROFILE.artifactWindows);
  const duration = balanceProfileNumber(
    windows,
    hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? 'maximumStacks' : 'durationMultiplier'
  );
  return { windows, duration };
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
    emitThiefBuff(runtime, cast.skill, {
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

/** Notify family traits before the skill grants its identity window and invokes Repeat Ransacker. */
function notifyArtifactTraits(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const slot = artifactSlotsUsed.get(cast);
  const state = antiquaryState.from(runtime);
  const skill = cast.skill as ThiefSkill;
  if (hasTrait(runtime, TRAIT.ENTERPRISING_ARISTOCRAT))
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.enterprisingAristocrat), 'resourceGain')
    );
  if (hasTrait(runtime, TRAIT.EXHILARATING_EPHEMERA)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.exhilaratingEphemera);
    const remaining = Math.max(0, (state.antiquaryDamageUntil || 0) - runtime.time);
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
}

/** Repeat Ransacker follows the artifact identity grant. */
function repeatRansacker(runtime: ThiefRuntime): void {
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
  // The public value is a retry and display projection; the queued pulse owns scheduling.
  state.nextSkrittScufflePilferAt = next <= expiresAt ? next : 0;
  pilferArtifacts(runtime, 'scuffle');
  if (next <= expiresAt) runtime.schedule(SKRITT_SCUFFLE, next, { expiresAt });
}

/** The scheduled pilfer carries its assistant's lifetime, including the final pulse. */
function completeSkrittScuffle(runtime: ThiefRuntime): void {
  const state = antiquaryState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.scuffle);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const expiresAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'durationMultiplier'));
  state.nextSkrittScufflePilferAt = runtime.time + interval;
  pilferArtifacts(runtime, 'scuffle');
  if (interval > 0) runtime.schedule(SKRITT_SCUFFLE, canonicalTime(runtime.time + interval), { expiresAt });
}

/** Double Edge is risky only while its recharge is running; Scoundrel's Luck turns one risky use into a success. */
function acceptDoubleEdge(runtime: ThiefRuntime, cast: RuntimeCast): ThiefDoubleEdgeOutcome {
  if ((runtime.cooldowns.get(cast.skill.id) || 0) <= runtime.time + EPSILON) return 'success';
  const state = antiquaryState.from(runtime);
  if (state.scoundrelsLuck > 0) {
    state.scoundrelsLuck -= 1;
    return 'success';
  }

  return cast.command.doubleEdgeOutcome === 'backfire' ? 'backfire' : 'success';
}

/** Canach coins alternate heads and tails across uses; a backfire pays only for heads. */
function tossCanachCoins(runtime: ThiefRuntime, backfire: boolean): number {
  const state = antiquaryState.from(runtime);
  let initiative = 0;
  for (let coin = 0; coin < 3; coin += 1) {
    const heads = (state.canachCoinIndex || 0) % 2 === 0;
    state.canachCoinIndex = (state.canachCoinIndex || 0) + 1;
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
  if (outcome === 'backfire')
    // The backfire variant stays visible until the running recharge ends.
    state.backfireState[skill.id] = true;
  else delete state.backfireState[skill.id];
}

/** Initiative spending feeds Prodigious Pincher, and Chak Shield refunds it while its window is open. */
function spendAntiquaryInitiative(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const cost = (cast.skill as ThiefSkill).initiativeCost || 0;
  if (!(cost > 0)) return;
  const state = antiquaryState.from(runtime);
  state.initiativeSpentSincePilfer += cost;
  if ((state.chakInitiativeRefundUntil || 0) > runtime.time) grantThiefInitiative(runtime, cost);
  // Initiative spent before combat begins does not count toward the threshold.
  if (
    runtime.combatStartedAt() &&
    hasTrait(runtime, TRAIT.PRODIGIOUS_PINCHER) &&
    state.initiativeSpentSincePilfer >=
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.prodigiousPincher), 'threshold')
  )
    pilferArtifacts(runtime, 'initiative');
}

/** Swipe alone grants its steal package and swipe-only pilfer policies. */
function completeSkrittSwipe(runtime: ThiefRuntime, cast: RuntimeCast): void {
  emitThiefStealTraits(runtime, cast);
  pilferArtifacts(runtime, 'swipe');
  if (hasTrait(runtime, TRAIT.KLEPTOMANIAC))
    grantThiefInitiative(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, CORE_PROFILE.kleptomaniac), 'resourceGain')
    );
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
      (state.nextSkrittScufflePilferAt || 0) > runtime.time ? state.nextSkrittScufflePilferAt : null
    );
  if (skill.backfire)
    return denySkillCast(skill, 'thief.backfire-variant', 'backfire variants are resolved by their Double Edge skill.');
  if (skill.id === ID.RESHUFFLE && (state.artifactUsesRemaining <= 0 || state.artifactSlots.length === 0))
    return denySkillCast(skill, 'thief.artifact', 'pilfer artifacts first.');
  return { ready: true };
}

/** Antiquary hooks: artifact pilfering and use, Double Edge outcomes, Skritt summons, and artifact-driven traits. */
export const antiquaryHooks: Partial<RuntimeProfession<ThiefRuntimeState>> = {
  sideEffectHandlers: {
    'thief.artifact-spend'(runtime, context) {
      if (context.kind === 'cast') spendArtifact(runtime, context.cast);
    },
    'thief.artifact-traits'(runtime, context) {
      if (context.kind === 'cast') notifyArtifactTraits(runtime, context.cast);
    },
    'thief.repeat-ransacker': repeatRansacker,
    'thief.skritt-swipe'(runtime, context) {
      if (context.kind === 'cast') completeSkrittSwipe(runtime, context.cast);
    },
    'thief.reshuffle'(runtime) {
      antiquaryState.from(runtime).artifactSlots = allArtifactChoices();
    },
    'thief.double-edge'(runtime, context) {
      if (context.kind === 'cast') startDoubleEdge(runtime, context.cast);
    },
    'thief.roll-coins'(runtime, context) {
      if (context.kind === 'cast')
        coinInitiative.set(
          context.cast,
          tossCanachCoins(runtime, Boolean(antiquaryState.from(runtime).backfireState[context.skill.id]))
        );
    },
    'thief.pay-coins'(runtime, context) {
      if (context.kind === 'cast') grantThiefInitiative(runtime, coinInitiative.get(context.cast) ?? 0);
    },
    'thief.forged-surfer'(runtime, context) {
      startForgedSurfer(runtime, context.skill);
    },
    'thief.skritt-scuffle'(runtime) {
      completeSkrittScuffle(runtime);
    },
    'thief.guitar'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { windows, duration } = artifactWindow(runtime);
      state.stealthAttackCharges = balanceProfileNumber(windows, 'resourceGain');
      state.stealthAttackExpiresAt = at + duration;
    },
    'thief.mortar'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { windows, duration } = artifactWindow(runtime);
      if (!requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.mistburnProc), 'condition', 'Burning'))
        return;
      state.mistburn = grantCharges(balanceProfileNumber(windows, 'playerStacks'), at + duration);
    },
    'thief.kryptis'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { windows } = artifactWindow(runtime);
      state.kryptisDamageUntil =
        at +
        balanceProfileNumber(windows, hasTrait(runtime, TRAIT.METICULOUS_CUSTODIAN) ? 'threshold' : 'minimumStacks');
    },
    'thief.chak'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { duration } = artifactWindow(runtime);
      state.chakInitiativeRefundUntil = at + duration;
    },
    'thief.holo'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { duration } = artifactWindow(runtime);
      state.holoUtilityCooldownReductionExpirations = [...state.holoUtilityCooldownReductionExpirations, at + duration];
    },
    'thief.surfer-window'(runtime) {
      const state = antiquaryState.from(runtime);
      const at = runtime.time;
      const { duration } = artifactWindow(runtime);
      state.forgedSurferBombDropUntil = at + duration;
    }
  },

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
  },
  onCastCommit(_runtime, cast) {
    artifactSlotsUsed.delete(cast);
    coinInitiative.delete(cast);
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      antiquaryResolverEventReactions.damage(runtime, event);
    }
  },
  tasks: {
    [FORGED_SURFER]: forgedSurfer,
    [SKRITT_SCUFFLE]: skrittScufflePilfer
  }
};
