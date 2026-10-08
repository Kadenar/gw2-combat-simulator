import { addCounterProgress } from '#gw2/platform/combat/resources/counters.js';
import { consumeChargeBatch } from '#gw2/platform/combat/resources/charges.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import {
  improvisationArtifactUses,
  reduceUtilityRecharges
} from '#gw2/professions/thief/core/traits/deadly-arts/steal.js';
import { emitThiefStealTraits } from '#gw2/professions/thief/core/traits/steal.js';
import { applyKleptomaniac } from '#gw2/professions/thief/core/traits/trickery/steal.js';
import { THIEF_SKILL_IDS as ID, THIEF_ARTIFACT_IDS } from '#gw2/professions/thief/data/ids.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import type { ThiefArtifactSlot } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import {
  applyEnterprisingAristocrat,
  applyExhilaratingEphemera,
  applyPossessiveHoarder,
  grantCombatHigh,
  grantScoundrelsLuck,
  prodigiousPincherReady,
  prolificPlundererUses
} from '#gw2/professions/thief/specializations/antiquary/traits/behavior.js';
import { applyMeticulousChakShield } from '#gw2/professions/thief/specializations/antiquary/traits/meticulous-custodian.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

/** The slot each accepted artifact cast spent, which selects its Possessive Hoarder family boon. */
export const artifactSlotsUsed = new WeakMap<RuntimeCast<ThiefSkill>, ThiefArtifactSlot | undefined>();

export function allArtifactChoices(): ThiefArtifactSlot[] {
  return [
    ...THIEF_ARTIFACT_IDS.OFFENSIVE.map((skillId) => ({ kind: 'offensive' as const, skillId })),
    ...THIEF_ARTIFACT_IDS.DEFENSIVE.map((skillId) => ({ kind: 'defensive' as const, skillId }))
  ];
}

/** Replace inventory with trait-derived uses; starting artifacts must not trigger live pilfer effects. */
export function storeAntiquaryArtifacts(runtime: ThiefRuntime, source: 'swipe' | 'initiative' | 'scuffle'): void {
  const state = antiquaryState.from(runtime);
  state.artifactSlots = allArtifactChoices();
  // Offer Scuffle's random bomb outcome as a choice, just like the normal randomized artifact pool.
  if (source === 'scuffle')
    state.artifactSlots.push(
      ...THIEF_ARTIFACT_IDS.SCUFFLE_ONLY.map((skillId) => ({ kind: 'unstable' as const, skillId }))
    );
  state.artifactUsesRemaining =
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.resources), 'maximumStacks') +
    prolificPlundererUses(runtime, source) +
    improvisationArtifactUses(runtime, source);
}

/** Live pilfers reset spending; Swipe also grants its buffs and utility recharge reduction. */
export function pilferArtifacts(runtime: ThiefRuntime, source: 'swipe' | 'initiative' | 'scuffle'): void {
  storeAntiquaryArtifacts(runtime, source);
  const state = antiquaryState.from(runtime);
  // Every pilfer starts fresh, including Swipe and Scuffle; excess spending never carries to a second pilfer.
  state.initiativeSpentSincePilfer = 0;
  if (source !== 'swipe') return;
  grantScoundrelsLuck(runtime);
  grantCombatHigh(runtime);
  reduceUtilityRecharges(runtime);
}

/**
 * Activating an artifact spends its slot and one use immediately, so a pilfer during a long artifact cast supplies
 * the next pool instead of being consumed by the cast that was already underway.
 */
export function spendArtifact(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const state = antiquaryState.from(runtime);
  artifactSlotsUsed.set(
    cast,
    state.artifactSlots.find((value) => value.skillId === cast.skill.id)
  );
  state.artifactUsesRemaining = Math.max(0, state.artifactUsesRemaining - 1);
  state.artifactSlots = state.artifactSlots.filter((value) => value.skillId !== cast.skill.id);
}

/** Notify family traits before the skill grants its identity window and invokes Repeat Ransacker. */
export function notifyArtifactTraits(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const slot = artifactSlotsUsed.get(cast);
  applyEnterprisingAristocrat(runtime);
  applyExhilaratingEphemera(runtime);

  applyPossessiveHoarder(runtime, cast, slot);
  applyMeticulousChakShield(runtime, cast);
}

/** Gross initiative spending feeds Prodigious Pincher; each live Chak Shield charge refunds one paid weapon use. */
export function spendAntiquaryInitiative(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const cost = cast.skill.initiativeCost || 0;
  if (!(cost > 0)) return;
  const state = antiquaryState.from(runtime);
  // Keep gross spending before Chak refunds; reward eligibility is checked separately against the live progress.
  state.initiativeSpentSincePilfer = addCounterProgress(state.initiativeSpentSincePilfer, cost);
  // Only paid weapon inputs consume a refund, so free skills and profession actions preserve the finite grant.
  if (cast.skill.type === 'Weapon' && consumeChargeBatch(state.chakInitiativeRefunds, runtime.time))
    runtime.resourceController.grant('initiative', cost);
  // Spending accrues before combat too, but it cannot trigger a pilfer until combat has begun.
  if (prodigiousPincherReady(runtime)) pilferArtifacts(runtime, 'initiative');
}

/** Swipe alone grants its steal package and swipe-only pilfer policies. */
export function completeSkrittSwipe(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  emitThiefStealTraits(runtime, cast);
  pilferArtifacts(runtime, 'swipe');
  applyKleptomaniac(runtime);
}

/** Artifacts require a held slot; backfire variants are internal; Reshuffle rerolls only an existing pool. */
export function antiquaryAvailability(runtime: MechanicQueriesOf<ThiefRuntime>, skill: ThiefSkill): AvailabilityResult {
  const state = antiquaryState.from(runtime);
  if (
    skill.artifactKind &&
    (state.artifactUsesRemaining <= 0 || !state.artifactSlots.some((slot) => slot.skillId === skill.id))
  )
    // A running Skritt Scuffle supplies the next pool at its next pilfer.
    return denySkillCast(
      skill,
      'thief.artifact',
      skill.id === ID.UNSTABLE_SKRITT_BOMB
        ? 'requires an unused artifact grant from Skritt Scuffle.'
        : 'this artifact is not in an available artifact slot.',
      (state.nextSkrittScufflePilferAt || 0) > runtime.time ? state.nextSkrittScufflePilferAt : null
    );
  if (skill.backfire)
    return denySkillCast(skill, 'thief.backfire-variant', 'backfire variants are resolved by their Double Edge skill.');
  if (skill.id === ID.RESHUFFLE && (state.artifactUsesRemaining <= 0 || state.artifactSlots.length === 0))
    return denySkillCast(skill, 'thief.artifact', 'pilfer artifacts first.');
  return { ready: true };
}
