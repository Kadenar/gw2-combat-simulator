import type { BalanceProfile, CanonicalCatalog } from '#gw2/platform/engine/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { RANGER_PETS } from '#gw2/content/professions/ranger/data/ranger-pet-data.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import type { RangerPetDefinition } from '#gw2/content/professions/ranger/types.js';
import type { ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import {
  EVTC_BLEEDING_SKILL_ID,
  EVTC_CRITICAL_RESULT,
  expectedConditionDurationsMs,
  hasSelectedTrait,
  isOutgoingStrike,
  matchingConditionApplications,
  primaryStrikeTargetForSources,
  traitBalanceProfile
} from '#gw2/integrations/logs/evtc/rotation/professions/condition-proc-observation.js';

export interface RangerSharpenedEdgesPetObservation {
  readonly address: bigint;
  readonly name: string;
  readonly criticalHits: number;
  readonly matchedApplications: number;
  readonly matchedDurationMs: number;
}

export interface RangerSharpenedEdgesObservation {
  readonly targetAddress: bigint;
  readonly criticalHits: number;
  readonly playerCriticalHits: number;
  readonly petCriticalHits: number;
  readonly matchedApplications: number;
  readonly playerMatchedApplications: number;
  readonly petMatchedApplications: number;
  readonly observedProcRate: number;
  readonly expectedProcChance: number;
  readonly expectedApplications: number;
  readonly playerMatchedDurationsMs: readonly number[];
  readonly pets: readonly RangerSharpenedEdgesPetObservation[];
}

function bleedingDuration(profile: BalanceProfile): number {
  return Number(
    profile.effects?.find((effect) => effect.type === 'condition' && effect.condition?.toLowerCase() === 'bleeding')
      ?.duration || 0
  );
}

function rangerPet(character: string): RangerPetDefinition | null {
  const name = character
    .trim()
    .replace(/^juvenile\s+/i, '')
    .toLowerCase();
  return RANGER_PETS.find((pet) => pet.name.toLowerCase() === name) || null;
}

function ownedPets(log: ParsedEvtc, playerAddress: bigint): readonly { address: bigint; pet: RangerPetDefinition }[] {
  const ownerInstance = log.events.find(
    (event) => event.source === playerAddress && event.sourceInstance > 0
  )?.sourceInstance;
  if (!ownerInstance) return [];
  const ownedAddresses = new Set(
    log.events
      .filter((event) => event.source !== playerAddress && event.sourceMasterInstance === ownerInstance)
      .map((event) => event.source)
  );
  return log.agents.flatMap((agent) => {
    const pet = ownedAddresses.has(agent.address) ? rangerPet(agent.character) : null;
    return pet ? [{ address: agent.address, pet }] : [];
  });
}

function petExpertise(catalog: Readonly<CanonicalCatalog>, config: Gw2Config, pet: RangerPetDefinition): number {
  if (!hasSelectedTrait(config, TRAIT.ARACHNOPHOBIA)) return 0;
  const profile = traitBalanceProfile(catalog, TRAIT.ARACHNOPHOBIA, 'Arachnophobia');
  const expertise = Number(profile?.attributeBonus ?? 150);
  return expertise + (['spider', 'devourer'].includes(pet.family) ? Number(profile?.weaponAttributeBonus ?? 225) : 0);
}

/** Separates player and owned-pet Sharpened Edges evidence so each Bleeding duration uses its applying actor's stats. */
export function analyzeRangerSharpenedEdgesObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): RangerSharpenedEdgesObservation | null {
  if (!hasSelectedTrait(config, TRAIT.SHARPENED_EDGES)) return null;
  const profile = traitBalanceProfile(catalog, TRAIT.SHARPENED_EDGES, 'Sharpened Edges');
  if (!profile) return null;
  const baseDuration = bleedingDuration(profile);
  const expectedProcChance = Number(profile.criticalChance || profile.procChance || 0);
  if (!(baseDuration > 0) || !(expectedProcChance > 0)) return null;

  const owned = ownedPets(log, playerAddress);
  const sources = new Set([playerAddress, ...owned.map(({ address }) => address)]);
  const targetAddress = primaryStrikeTargetForSources(log, sources);
  if (targetAddress == null) return null;
  const criticalHitsFor = (address: bigint) =>
    log.events.filter(
      (event) =>
        event.target === targetAddress && isOutgoingStrike(event, address) && event.result === EVTC_CRITICAL_RESULT
    ).length;

  const playerCriticalHits = criticalHitsFor(playerAddress);
  const staticPlayerDurationsMs = expectedConditionDurationsMs(baseDuration, 'Bleeding', config);
  // Light on Your Feet adds ten percentage points while active, so EVTC can
  // contain both static and buffed Sharpened Edges durations in one encounter.
  const playerMatchedDurationsMs = [
    ...new Set(
      staticPlayerDurationsMs.flatMap((duration) =>
        hasSelectedTrait(config, TRAIT.LIGHT_ON_YOUR_FEET)
          ? [duration, Math.min(baseDuration * 2_000, duration + baseDuration * 100)]
          : [duration]
      )
    )
  ].sort((left, right) => left - right);
  const playerMatchedApplications = playerCriticalHits
    ? matchingConditionApplications(log, playerAddress, targetAddress, EVTC_BLEEDING_SKILL_ID, playerMatchedDurationsMs)
        .length
    : 0;
  const pets = owned.flatMap(({ address, pet }) => {
    const criticalHits = criticalHitsFor(address);
    if (!criticalHits) return [];
    const matchedDurationMs = expectedConditionDurationsMs(baseDuration, 'Bleeding', {
      stats: { expertise: petExpertise(catalog, config, pet) }
    })[0];
    return [
      {
        address,
        name: pet.name,
        criticalHits,
        matchedApplications: matchingConditionApplications(log, address, targetAddress, EVTC_BLEEDING_SKILL_ID, [
          matchedDurationMs
        ]).length,
        matchedDurationMs
      }
    ];
  });
  const petCriticalHits = pets.reduce((total, pet) => total + pet.criticalHits, 0);
  const petMatchedApplications = pets.reduce((total, pet) => total + pet.matchedApplications, 0);
  const criticalHits = playerCriticalHits + petCriticalHits;
  if (!criticalHits) return null;
  const matchedApplications = playerMatchedApplications + petMatchedApplications;

  return {
    targetAddress,
    criticalHits,
    playerCriticalHits,
    petCriticalHits,
    matchedApplications,
    playerMatchedApplications,
    petMatchedApplications,
    observedProcRate: matchedApplications / criticalHits,
    expectedProcChance,
    expectedApplications: criticalHits * expectedProcChance,
    playerMatchedDurationsMs,
    pets
  };
}
