import type { BalanceProfile, CanonicalCatalog } from '../../../../../platform/engine/types.js';
import type { Gw2Config } from '../../../../../platform/gw2/simulation/config.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '../../../../../professions/warrior/data/ids.js';
import type { ParsedEvtc } from '../../../types.js';
import {
  EVTC_BLEEDING_SKILL_ID,
  EVTC_CRITICAL_RESULT,
  expectedConditionDurationsMs,
  hasSelectedTrait,
  isOutgoingStrike,
  matchingConditionApplications,
  primaryStrikeTarget,
  traitBalanceProfile
} from '../condition-proc-observation.js';

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
  return hasSelectedTrait(config, TRAIT.BLOODLUST);
}

function bloodlustProfile(catalog: Readonly<CanonicalCatalog>): BalanceProfile | null {
  return traitBalanceProfile(catalog, TRAIT.BLOODLUST, 'Bloodlust');
}

function expectedBloodlustDurations(profile: BalanceProfile, config: Gw2Config): readonly number[] {
  const effect = profile.effects?.find(
    (candidate) => candidate.type === 'condition' && candidate.condition?.toLowerCase() === 'bleeding'
  );
  const baseDurationSeconds = Number(effect?.duration || 0);
  return expectedConditionDurationsMs(baseDurationSeconds, 'Bleeding', config);
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

  const matchedApplications = matchingConditionApplications(
    log,
    playerAddress,
    targetAddress,
    EVTC_BLEEDING_SKILL_ID,
    matchedDurationsMs
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
