import type { BalanceProfile, CanonicalCatalog } from '../../../../../platform/engine/types.js';
import { gw2ConditionDurationMultiplier } from '../../../../../platform/gw2/combat/query/runtime-rules.js';
import type { Gw2Config } from '../../../../../platform/gw2/simulation/config.js';
import type { Gw2SigilSet, Gw2Stats } from '../../../../../platform/gw2/equipment/types.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '../../../../../professions/warrior/data/ids.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtc, type ParsedEvtcEvent } from '../../../types.js';

const BLEEDING_SKILL_ID = 736;
const EVTC_CRITICAL_RESULT = 1;
const DURATION_TOLERANCE_MS = 50;

export interface WarriorBloodlustObservation {
  readonly targetAddress: bigint;
  readonly criticalHits: number;
  readonly matchedApplications: number;
  readonly observedProcRate: number;
  readonly expectedProcChance: number;
  readonly expectedApplications: number;
  readonly matchedDurationsMs: readonly number[];
}

function hasBloodlust(config: Gw2Config): boolean {
  return Boolean(config.selectedTraitIds?.some((id) => String(id) === String(TRAIT.BLOODLUST)));
}

function bloodlustProfile(catalog: Readonly<CanonicalCatalog>): BalanceProfile | null {
  return catalog.balanceProfilesById?.get(TRAIT.BLOODLUST) || catalog.balanceProfilesByName?.get('Bloodlust') || null;
}

function isOutgoingStrike(event: ParsedEvtcEvent, playerAddress: bigint): boolean {
  return (
    event.source === playerAddress &&
    event.target !== 0n &&
    event.stateChange === EVTC_STATE_CHANGE.NONE &&
    event.activation === EVTC_ACTIVATION.NONE &&
    event.buff === 0 &&
    event.value > 0
  );
}

/** Chooses the foe receiving the most direct strike damage so multi-agent metadata cannot pollute the proc ratio. */
function primaryStrikeTarget(log: ParsedEvtc, playerAddress: bigint): bigint | null {
  const damageByTarget = new Map<bigint, number>();
  for (const event of log.events) {
    if (!isOutgoingStrike(event, playerAddress)) continue;
    damageByTarget.set(event.target, (damageByTarget.get(event.target) || 0) + event.value);
  }

  return (
    [...damageByTarget].sort(
      ([leftTarget, leftDamage], [rightTarget, rightDamage]) =>
        rightDamage - leftDamage || (leftTarget < rightTarget ? -1 : leftTarget > rightTarget ? 1 : 0)
    )[0]?.[0] ?? null
  );
}

function bleedingDurationMs(baseDurationSeconds: number, stats: Gw2Stats, sigils: Gw2SigilSet): number {
  const sigilBonus =
    (Number(sigils.conditionDurationBonus || 0) + Number(sigils.conditionDurationBonuses?.Bleeding || 0)) / 100;
  return Math.round(baseDurationSeconds * 1_000 * gw2ConditionDurationMultiplier('Bleeding', stats, sigilBonus));
}

function expectedBloodlustDurations(profile: BalanceProfile, config: Gw2Config): readonly number[] {
  const effect = profile.effects?.find(
    (candidate) => candidate.type === 'condition' && candidate.condition?.toLowerCase() === 'bleeding'
  );
  const baseDurationSeconds = Number(effect?.duration || 0);
  if (!(baseDurationSeconds > 0)) return [];

  const fallbackStats = config.stats || config.attributes;
  const statsBySet = config.weaponSetStats?.length ? config.weaponSetStats : fallbackStats ? [fallbackStats] : [];
  return [
    ...new Set(
      statsBySet.map((stats, index) =>
        bleedingDurationMs(baseDurationSeconds, stats, config.sigilSets?.[index] || config.sigilSets?.[0] || {})
      )
    )
  ].sort((left, right) => left - right);
}

/**
 * Compares ArcDPS critical-result packets with duration-matched Bleeding applications.
 * EVTC does not name the originating trait, so this remains explicit diagnostic evidence rather than rotation input.
 */
export function analyzeWarriorBloodlustObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): WarriorBloodlustObservation | null {
  if (!hasBloodlust(config)) return null;
  const profile = bloodlustProfile(catalog);
  if (!profile) return null;
  const matchedDurationsMs = expectedBloodlustDurations(profile, config);
  if (!matchedDurationsMs.length) return null;

  const targetAddress = primaryStrikeTarget(log, playerAddress);
  if (targetAddress == null) return null;
  const criticalHits = log.events.filter(
    (event) =>
      event.target === targetAddress && isOutgoingStrike(event, playerAddress) && event.result === EVTC_CRITICAL_RESULT
  ).length;
  if (!criticalHits) return null;

  const matchedApplications = log.events.filter(
    (event) =>
      event.source === playerAddress &&
      event.target === targetAddress &&
      event.skillId === BLEEDING_SKILL_ID &&
      event.buff !== 0 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY &&
      matchedDurationsMs.some((duration) => Math.abs(event.value - duration) <= DURATION_TOLERANCE_MS)
  ).length;
  const expectedProcChance = Number(profile.procChance || 0);
  if (!(expectedProcChance > 0)) return null;

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
