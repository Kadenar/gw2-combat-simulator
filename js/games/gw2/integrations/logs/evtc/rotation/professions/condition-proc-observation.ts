import type { BalanceProfile, CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import { gw2ConditionDurationMultiplier } from '#gw2/platform/combat/query/runtime-rules.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2SigilSet, Gw2Stats } from '#gw2/platform/equipment/types.js';
import {
  EVTC_ACTIVATION,
  EVTC_STATE_CHANGE,
  type ParsedEvtc,
  type ParsedEvtcEvent
} from '#gw2/integrations/logs/evtc/types.js';

export const EVTC_BLEEDING_SKILL_ID = 736;
export const EVTC_CRIPPLED_SKILL_ID = 721;
export const EVTC_CRITICAL_RESULT = 1;
export const EVTC_DURATION_TOLERANCE_MS = 50;

export interface CriticalBleedingProcObservation {
  readonly targetAddress: bigint;
  readonly criticalHits: number;
  readonly matchedApplications: number;
  readonly observedProcRate: number;
  readonly expectedProcChance: number;
  readonly expectedApplications: number;
  readonly matchedDurationsMs: readonly number[];
}

/** Shares target selection, duration scaling, and condition matching across inferred EVTC trait-proc diagnostics. */
export function hasSelectedTrait(config: Gw2Config, traitId: string | number): boolean {
  return Boolean(config.selectedTraitIds?.some((id) => String(id) === String(traitId)));
}

export function traitBalanceProfile(
  catalog: Readonly<CanonicalCatalog>,
  traitId: string | number,
  traitName: string
): BalanceProfile | null {
  return catalog.balanceProfilesById?.get(traitId) || catalog.balanceProfilesByName?.get(traitName) || null;
}

export function isOutgoingStrike(event: ParsedEvtcEvent, sourceAddress: bigint): boolean {
  return (
    event.source === sourceAddress &&
    event.target !== 0n &&
    event.stateChange === EVTC_STATE_CHANGE.NONE &&
    event.activation === EVTC_ACTIVATION.NONE &&
    event.buff === 0 &&
    event.value > 0
  );
}

/** Chooses the foe receiving the most direct strike damage from the supplied actors. */
export function primaryStrikeTargetForSources(log: ParsedEvtc, sourceAddresses: ReadonlySet<bigint>): bigint | null {
  const damageByTarget = new Map<bigint, number>();
  for (const event of log.events) {
    if (!sourceAddresses.has(event.source) || !isOutgoingStrike(event, event.source)) continue;
    damageByTarget.set(event.target, (damageByTarget.get(event.target) || 0) + event.value);
  }

  return (
    [...damageByTarget].sort(
      ([leftTarget, leftDamage], [rightTarget, rightDamage]) =>
        rightDamage - leftDamage || (leftTarget < rightTarget ? -1 : leftTarget > rightTarget ? 1 : 0)
    )[0]?.[0] ?? null
  );
}

/** Keeps existing player-only proc analyzers on the shared target-selection path. */
export function primaryStrikeTarget(log: ParsedEvtc, playerAddress: bigint): bigint | null {
  return primaryStrikeTargetForSources(log, new Set([playerAddress]));
}

function namedDurationBonus(bonuses: Readonly<Record<string, number>> | undefined, condition: string): number {
  const entry = Object.entries(bonuses || {}).find(([name]) => name.toLowerCase() === condition.toLowerCase());
  return Number(entry?.[1] || 0);
}

function conditionDurationMs(
  baseDurationSeconds: number,
  condition: string,
  stats: Gw2Stats,
  sigils: Gw2SigilSet
): number {
  const sigilBonus =
    (Number(sigils.conditionDurationBonus || 0) + namedDurationBonus(sigils.conditionDurationBonuses, condition)) / 100;
  return Math.round(baseDurationSeconds * 1_000 * gw2ConditionDurationMultiplier(condition, stats, sigilBonus));
}

/** Returns every duration that can be emitted as a rotation moves between configured weapon sets. */
export function expectedConditionDurationsMs(
  baseDurationSeconds: number,
  condition: string,
  config: Gw2Config
): readonly number[] {
  if (!(baseDurationSeconds > 0)) return [];
  const setCount = Math.max(config.weaponSetStats?.length || 0, config.sigilSets?.length || 0, 1);
  return [
    ...new Set(
      Array.from({ length: setCount }, (_, index) =>
        conditionDurationMs(
          baseDurationSeconds,
          condition,
          {
            ...(config.attributes || {}),
            ...(config.stats || {}),
            ...(config.weaponSetStats?.[index] || {})
          },
          config.sigilSets?.[index] || config.sigilSets?.[0] || {}
        )
      )
    )
  ].sort((left, right) => left - right);
}

/** Accepts both legacy duration-valued buff packets and modern explicit BuffApply condition applications. */
export function isConditionApplication(event: ParsedEvtcEvent): boolean {
  return (
    event.buff !== 0 &&
    event.buffRemove === 0 &&
    (event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY ||
      (event.stateChange === EVTC_STATE_CHANGE.NONE && event.value > 0 && event.buffDamage === 0))
  );
}

/** Finds source-to-target condition applications whose ArcDPS duration matches the supplied actor stats. */
export function matchingConditionApplications(
  log: ParsedEvtc,
  sourceAddress: bigint,
  targetAddress: bigint,
  conditionSkillId: number,
  durationsMs: readonly number[]
): readonly ParsedEvtcEvent[] {
  return log.events.filter(
    (event) =>
      event.source === sourceAddress &&
      event.target === targetAddress &&
      event.skillId === conditionSkillId &&
      isConditionApplication(event) &&
      durationsMs.some((duration) => Math.abs(event.value - duration) <= EVTC_DURATION_TOLERANCE_MS)
  );
}

/** Analyzes player critical-hit traits that emit one Bleeding application using profile-owned chance and duration. */
export function analyzeCriticalBleedingProcObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config,
  traitId: string | number,
  traitName: string
): CriticalBleedingProcObservation | null {
  if (!hasSelectedTrait(config, traitId)) return null;
  const profile = traitBalanceProfile(catalog, traitId, traitName);
  if (!profile) return null;

  const expectedProcChance = Number(profile.criticalChance || profile.procChance || 0);
  const baseDurationSeconds = Number(
    profile.effects?.find((effect) => effect.type === 'condition' && effect.condition?.toLowerCase() === 'bleeding')
      ?.duration || 0
  );
  const matchedDurationsMs = expectedConditionDurationsMs(baseDurationSeconds, 'Bleeding', config);
  if (!(expectedProcChance > 0) || !matchedDurationsMs.length) return null;

  const targetAddress = primaryStrikeTarget(log, playerAddress);
  if (targetAddress == null) return null;
  const criticalHits = log.events.filter(
    (event) =>
      event.target === targetAddress && isOutgoingStrike(event, playerAddress) && event.result === EVTC_CRITICAL_RESULT
  ).length;
  if (!criticalHits) return null;

  const matchedApplications = matchingConditionApplications(
    log,
    playerAddress,
    targetAddress,
    EVTC_BLEEDING_SKILL_ID,
    matchedDurationsMs
  ).length;
  return {
    targetAddress,
    criticalHits,
    matchedApplications,
    observedProcRate: matchedApplications / criticalHits,
    expectedProcChance,
    expectedApplications: criticalHits * expectedProcChance,
    matchedDurationsMs
  };
}

/** Pairs two condition streams one-to-one so a lone duration collision cannot be counted as a compound proc. */
export function countPairedApplications(
  first: readonly ParsedEvtcEvent[],
  second: readonly ParsedEvtcEvent[],
  toleranceMs = EVTC_DURATION_TOLERANCE_MS
): number {
  const left = [...first].sort((a, b) => a.time - b.time);
  const right = [...second].sort((a, b) => a.time - b.time);
  let rightIndex = 0;
  let matches = 0;
  for (const event of left) {
    while (rightIndex < right.length && right[rightIndex].time < event.time - toleranceMs) rightIndex += 1;
    if (rightIndex >= right.length || Math.abs(right[rightIndex].time - event.time) > toleranceMs) continue;
    matches += 1;
    rightIndex += 1;
  }

  return matches;
}
