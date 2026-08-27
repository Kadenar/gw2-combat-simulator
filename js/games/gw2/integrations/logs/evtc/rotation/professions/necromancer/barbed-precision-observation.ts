import type { BalanceProfile, CanonicalCatalog } from '../../../../../../platform/engine/types.js';
import type { Gw2Config } from '../../../../../../platform/simulation/config.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../../../../../../content/professions/necromancer/data/ids.js';
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

const BARBED_PRECISION_BLEEDING_BASE_SECONDS = 3;

export interface NecromancerBarbedPrecisionObservation {
  readonly targetAddress: bigint;
  readonly criticalHits: number;
  readonly matchedApplications: number;
  readonly observedProcRate: number;
  readonly expectedProcChance: number;
  readonly expectedApplications: number;
  readonly matchedDurationsMs: readonly number[];
}

function expectedChance(profile: BalanceProfile): number | null {
  const chance = Number(profile.criticalChance || profile.procChance || 0);
  return chance > 0 ? chance : null;
}

/** Compares Necromancer critical packets with expertise-scaled 3-second Barbed Precision Bleeding applications. */
export function analyzeNecromancerBarbedPrecisionObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): NecromancerBarbedPrecisionObservation | null {
  if (!hasSelectedTrait(config, TRAIT.BARBED_PRECISION)) return null;
  const profile = traitBalanceProfile(catalog, TRAIT.BARBED_PRECISION, 'Barbed Precision');
  if (!profile) return null;
  const expectedProcChance = expectedChance(profile);
  if (expectedProcChance == null) return null;

  const targetAddress = primaryStrikeTarget(log, playerAddress);
  if (targetAddress == null) return null;
  const criticalHits = log.events.filter(
    (event) =>
      event.target === targetAddress && isOutgoingStrike(event, playerAddress) && event.result === EVTC_CRITICAL_RESULT
  ).length;
  if (!criticalHits) return null;

  const matchedDurationsMs = expectedConditionDurationsMs(BARBED_PRECISION_BLEEDING_BASE_SECONDS, 'Bleeding', config);
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
