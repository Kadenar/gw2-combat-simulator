import type { CanonicalCatalog } from '#gw2/platform/engine/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import {
  analyzeCriticalBleedingProcObservation,
  type CriticalBleedingProcObservation
} from '#gw2/integrations/logs/evtc/rotation/professions/condition-proc-observation.js';

export type WarriorBloodlustObservation = CriticalBleedingProcObservation;

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
  return analyzeCriticalBleedingProcObservation(log, playerAddress, catalog, config, TRAIT.BLOODLUST, 'Bloodlust');
}
