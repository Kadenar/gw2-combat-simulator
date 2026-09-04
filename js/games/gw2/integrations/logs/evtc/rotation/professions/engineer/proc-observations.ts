import type { BalanceProfile, CanonicalCatalog, Skill } from '#gw2/platform/engine/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { ParsedEvtc } from '#gw2/integrations/logs/evtc/types.js';
import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import {
  EVTC_BLEEDING_SKILL_ID,
  EVTC_CRIPPLED_SKILL_ID,
  analyzeCriticalBleedingProcObservation,
  countPairedApplications,
  type CriticalBleedingProcObservation,
  expectedConditionDurationsMs,
  hasSelectedTrait,
  isOutgoingStrike,
  matchingConditionApplications,
  primaryStrikeTarget,
  traitBalanceProfile
} from '#gw2/integrations/logs/evtc/rotation/professions/condition-proc-observation.js';

const SHRAPNEL_BLEEDING_BASE_SECONDS = 6;
const SHRAPNEL_CRIPPLED_BASE_SECONDS = 1;
const EVENT_FLAGGED_EXPLOSION_NAMES = new Set([
  // Generated rockets receive their explosion flag in the resolver and remain eligible for Shrapnel.
  'aim-assisted rocket',
  'aim-assisted rocket (trait skill)',
  'drop mine',
  'electric artillery',
  'explosive entrance',
  'explosive entrance (trait skill)',
  'lesser grenade barrage',
  'photonic blasting module'
]);

export interface EngineerShrapnelObservation {
  readonly targetAddress: bigint;
  readonly explosionHits: number;
  readonly matchedApplications: number;
  readonly observedProcRate: number;
  readonly expectedProcChance: number;
  readonly expectedApplications: number;
  readonly matchedBleedingDurationsMs: readonly number[];
  readonly matchedCrippledDurationsMs: readonly number[];
}

export type EngineerSerratedSteelObservation = CriticalBleedingProcObservation;

function isExplosionSkill(skill: Skill): boolean {
  return Boolean(
    EVENT_FLAGGED_EXPLOSION_NAMES.has(normalized(skill.name)) ||
    normalized(skill.damageKind) === 'explosion' ||
    skill.explosion === true ||
    normalized(skill.kit) === 'grenade kit' ||
    normalized(skill.name) === 'devastator' ||
    skill.categories?.some((category) => normalized(category) === 'explosion') ||
    skill.effects?.some((effect) => normalized(effect.damageKind) === 'explosion' || effect.explosion === true)
  );
}

/** Maps ArcDPS raw damage IDs to catalog skills that can trigger Shrapnel. */
function explosionSkillIds(log: ParsedEvtc, catalog: Readonly<CanonicalCatalog>): ReadonlySet<number> {
  const ids = new Set<number>();
  const names = new Set<string>();
  for (const skill of catalog.skills) {
    if (!isExplosionSkill(skill)) continue;
    const skillId = Number(skill.id);
    if (Number.isFinite(skillId)) ids.add(skillId);
    names.add(normalized(skill.name));
  }

  for (const skill of log.skills) {
    const name = normalized(skill.name);
    if (names.has(name) || EVENT_FLAGGED_EXPLOSION_NAMES.has(name)) {
      ids.add(skill.id);
    }
  }

  return ids;
}

function expectedChance(profile: BalanceProfile): number | null {
  const chance = Number(profile.procChance || 0);
  return chance > 0 ? chance : null;
}

/** Counts only paired 6-second Bleeding and 1-second Crippled applications against explosion packets. */
export function analyzeEngineerShrapnelObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): EngineerShrapnelObservation | null {
  if (!hasSelectedTrait(config, TRAIT.SHRAPNEL)) return null;
  const profile = traitBalanceProfile(catalog, TRAIT.SHRAPNEL, 'Shrapnel');
  if (!profile) return null;
  const expectedProcChance = expectedChance(profile);
  if (expectedProcChance == null) return null;

  const targetAddress = primaryStrikeTarget(log, playerAddress);
  if (targetAddress == null) return null;
  const eligibleSkillIds = explosionSkillIds(log, catalog);
  const explosionHits = log.events.filter(
    (event) =>
      event.target === targetAddress && isOutgoingStrike(event, playerAddress) && eligibleSkillIds.has(event.skillId)
  ).length;
  if (!explosionHits) return null;

  const matchedBleedingDurationsMs = expectedConditionDurationsMs(SHRAPNEL_BLEEDING_BASE_SECONDS, 'Bleeding', config);
  const matchedCrippledDurationsMs = expectedConditionDurationsMs(SHRAPNEL_CRIPPLED_BASE_SECONDS, 'Crippled', config);
  const bleeding = matchingConditionApplications(
    log,
    playerAddress,
    targetAddress,
    EVTC_BLEEDING_SKILL_ID,
    matchedBleedingDurationsMs
  );
  const crippled = matchingConditionApplications(
    log,
    playerAddress,
    targetAddress,
    EVTC_CRIPPLED_SKILL_ID,
    matchedCrippledDurationsMs
  );
  const matchedApplications = countPairedApplications(bleeding, crippled);

  return {
    targetAddress,
    explosionHits,
    matchedApplications,
    observedProcRate: matchedApplications / explosionHits,
    expectedProcChance,
    expectedApplications: explosionHits * expectedProcChance,
    matchedBleedingDurationsMs,
    matchedCrippledDurationsMs
  };
}

/** Matches critical packets to Serrated Steel's profile-duration Bleeding after active-build bonuses. */
export function analyzeEngineerSerratedSteelObservation(
  log: ParsedEvtc,
  playerAddress: bigint,
  catalog: Readonly<CanonicalCatalog>,
  config: Gw2Config
): EngineerSerratedSteelObservation | null {
  return analyzeCriticalBleedingProcObservation(
    log,
    playerAddress,
    catalog,
    config,
    TRAIT.SERRATED_STEEL,
    'Serrated Steel'
  );
}
