import {
  analyzeCriticalBleedingProcObservation,
  hasSelectedTrait,
  observationAttributeSets,
  type CriticalBleedingProcObservation
} from '#gw2/integrations/logs/evtc/rotation/professions/condition-proc-observation.js';
import type { ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';

/** Compares Necromancer critical packets with profile-duration Barbed Precision Bleeding applications. */
export function analyzeNecromancerBarbedPrecisionObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): CriticalBleedingProcObservation | null {
  if (!hasSelectedTrait(config, TRAIT.BARBED_PRECISION)) return null;
  const attributes = [...observationAttributeSets(config, catalog, necromancerProfession.attributeContributions)];
  // Sand Sage adds expertise only while a shade is active; retain both states for log duration inference.
  if (hasSelectedTrait(config, TRAIT.SAND_SAGE)) {
    const bonus = balanceProfileNumber(
      requireBalanceProfileFromContext({ catalog }, TRAIT.SAND_SAGE),
      'attributeBonus'
    );
    attributes.push(...attributes.map((stats) => ({ ...stats, expertise: (stats.expertise ?? 0) + bonus })));
  }

  return analyzeCriticalBleedingProcObservation(
    log,
    playerAddress,
    catalog,
    config,
    TRAIT.BARBED_PRECISION,
    'Barbed Precision',
    attributes
  );
}
