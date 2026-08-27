import type { BalanceProfile, CanonicalCatalog } from '../../../../../../platform/engine/types.js';
import type { Gw2Config } from '../../../../../../platform/simulation/config.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../../../../../../content/professions/mesmer/data/ids.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE, type ParsedEvtc, type ParsedEvtcEvent } from '../../../types.js';
import {
  EVTC_BLEEDING_SKILL_ID,
  EVTC_CRITICAL_RESULT,
  EVTC_DURATION_TOLERANCE_MS,
  countPairedApplications,
  expectedConditionDurationsMs,
  hasSelectedTrait,
  primaryStrikeTarget,
  traitBalanceProfile
} from '../condition-proc-observation.js';

export interface MesmerSharperImagesObservation {
  readonly targetAddress: bigint;
  readonly cloneCriticalHits: number;
  readonly matchedApplications: number;
  readonly observedProcRate: number;
  readonly expectedProcChance: number;
  readonly expectedApplications: number;
  readonly matchedDurationsMs: readonly number[];
}

function bleedingDuration(profile: BalanceProfile): number {
  return Number(
    profile.effects?.find((effect) => effect.type === 'condition' && effect.condition?.toLowerCase() === 'bleeding')
      ?.duration || 0
  );
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

function pairedCloneApplications(
  criticalHits: readonly ParsedEvtcEvent[],
  bleeding: readonly ParsedEvtcEvent[],
  cloneAddresses: ReadonlySet<bigint>
): number {
  return [...cloneAddresses].reduce(
    (total, address) =>
      total +
      countPairedApplications(
        criticalHits.filter((event) => event.source === address),
        bleeding.filter((event) => event.source === address)
      ),
    0
  );
}

/**
 * Pairs each owned clone's critical packets with its expertise-scaled Sharper Images Bleeding applications.
 * EVTC exposes the applying clone but not the originating trait, so this is diagnostic evidence only.
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

  const matchedDurationsMs = expectedConditionDurationsMs(bleedingDuration(profile), 'Bleeding', config);
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
      cloneAddresses.has(event.source) &&
      event.target === targetAddress &&
      event.skillId === EVTC_BLEEDING_SKILL_ID &&
      event.buff !== 0 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_APPLY &&
      matchedDurationsMs.some((duration) => Math.abs(event.value - duration) <= EVTC_DURATION_TOLERANCE_MS)
  );
  const matchedApplications = pairedCloneApplications(criticalHits, bleeding, cloneAddresses);
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
