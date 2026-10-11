import {
  EVTC_BLEEDING_SKILL_ID,
  EVTC_CRITICAL_RESULT,
  EVTC_DURATION_TOLERANCE_MS,
  bleedingDuration,
  countPairedApplications,
  expectedConditionDurationsMs,
  hasSelectedTrait,
  isConditionApplication,
  observationAttributeSets,
  primaryStrikeTarget,
  traitBalanceProfile
} from '#gw2/integrations/logs/evtc/rotation/professions/condition-proc-observation.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog } from '#gw2/platform/skills/types.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';

export interface MesmerSharperImagesObservation {
  readonly targetAddress: bigint;
  readonly cloneCriticalHits: number;
  readonly matchedApplications: number;
  readonly observedProcRate: number;
  readonly expectedProcChance: number;
  readonly expectedApplications: number;
  readonly matchedDurationsMs: readonly number[];
}

/** Includes the lower Bleeding duration recorded while Signet of Midnight's passive expertise is disabled. */
function sharperImagesDurations(
  baseDuration: number,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): readonly number[] {
  const attributes = observationAttributeSets(config, catalog, mesmerProfession.attributeContributions);
  const passiveDurations = expectedConditionDurationsMs(baseDuration, 'Bleeding', config, attributes);
  if (!selectedSkillIdSet(config.selectedSkillIds).has(ID.SIGNET_OF_MIDNIGHT)) return passiveDurations;

  // The selected Signet changes the inferred duration, so its active profile must supply the bonus.
  const bonus = balanceProfileNumber(
    requireBalanceProfileFromContext({ catalog }, PROFILE.signetOfMidnight),
    'expertiseBonus'
  );
  const rechargingDurations = expectedConditionDurationsMs(
    baseDuration,
    'Bleeding',
    config,
    attributes.map((stats) => ({ ...stats, expertise: Math.max(0, (stats.expertise ?? 0) - bonus) }))
  );
  return [...new Set([...passiveDurations, ...rechargingDurations])].sort((left, right) => left - right);
}

function ownedCloneAddresses(log: ParsedEvtc, playerAddress: bigint): ReadonlySet<bigint> {
  const playerInstance = log.events.find(
    (event) => event.source === playerAddress && event.sourceInstance > 0
  )?.sourceInstance;
  if (!playerInstance) return new Set();
  const cloneAddresses = new Set(
    log.agents.filter((agent) => agent.character.trim().toLowerCase() === 'clone').map((agent) => agent.address)
  );
  return new Set(
    log.events
      .filter((event) => cloneAddresses.has(event.source) && event.sourceMasterInstance === playerInstance)
      .map((event) => event.source)
  );
}

/**
 * Pairs owned-clone criticals with player-attributed Sharper Images Bleeding applications.
 * EVTC retains clone ownership on strikes but attributes the resulting condition application to the player.
 */
export function analyzeMesmerSharperImagesObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): MesmerSharperImagesObservation | null {
  if (!hasSelectedTrait(config, TRAIT.SHARPER_IMAGES)) return null;
  const profile = traitBalanceProfile(catalog, TRAIT.SHARPER_IMAGES, 'Sharper Images');
  if (!profile) return null;

  const matchedDurationsMs = sharperImagesDurations(bleedingDuration(profile), catalog, config);
  if (!matchedDurationsMs.length) return null;
  const targetAddress = primaryStrikeTarget(log, playerAddress);
  if (targetAddress == null) return null;
  const cloneAddresses = ownedCloneAddresses(log, playerAddress);
  if (!cloneAddresses.size) return null;

  const criticalHits = log.events.filter(
    (event) =>
      cloneAddresses.has(event.source) &&
      event.target === targetAddress &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.activation === EVTC_ACTIVATION.NONE &&
      event.buff === 0 &&
      event.value > 0 &&
      event.result === EVTC_CRITICAL_RESULT
  );
  if (!criticalHits.length) return null;
  const bleeding = log.events.filter(
    (event) =>
      event.source === playerAddress &&
      event.target === targetAddress &&
      event.skillId === EVTC_BLEEDING_SKILL_ID &&
      isConditionApplication(event) &&
      matchedDurationsMs.some((duration) => Math.abs(event.value - duration) <= EVTC_DURATION_TOLERANCE_MS)
  );
  const matchedApplications = countPairedApplications(criticalHits, bleeding);
  const expectedProcChance = 1;

  return {
    targetAddress,
    cloneCriticalHits: criticalHits.length,
    matchedApplications,
    observedProcRate: matchedApplications / criticalHits.length,
    expectedProcChance,
    expectedApplications: criticalHits.length,
    matchedDurationsMs
  };
}
