import type { CanonicalCatalog } from '#gw2/platform/engine/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import {
  analyzeCriticalBleedingProcObservation,
  type CriticalBleedingProcObservation
} from '#gw2/integrations/logs/evtc/rotation/professions/condition-proc-observation.js';

export type NecromancerBarbedPrecisionObservation = CriticalBleedingProcObservation;

/** Compares Necromancer critical packets with profile-duration Barbed Precision Bleeding applications. */
export function analyzeNecromancerBarbedPrecisionObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): NecromancerBarbedPrecisionObservation | null {
  return analyzeCriticalBleedingProcObservation(
    log,
    playerAddress,
    catalog,
    config,
    TRAIT.BARBED_PRECISION,
    'Barbed Precision'
  );
}
