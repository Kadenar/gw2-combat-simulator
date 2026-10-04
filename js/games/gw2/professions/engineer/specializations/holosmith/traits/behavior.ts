import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { triggerVentExhaust } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { preservesPhotonicHeat } from '#gw2/professions/engineer/specializations/holosmith/traits/heat.js';
import {
  type EngineerRuntime,
  type EngineerSkill,
  type EngineerResolverContext
} from '#gw2/professions/engineer/types.js';
import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import { type AvailabilityResult } from '#gw2/platform/execution/types.js';
import { type HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import { grantCharges, consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { type HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';

const HOLOSMITH_STORM_AUTOATTACK_SKILL_IDS = new Set<number>([
  ID.LIGHT_STRIKE_STORM,
  ID.BRIGHT_SLASH_STORM,
  ID.FLASH_CUTTER_STORM
]);

/** Dodge grants Vigor before invoking the skill-owned vent, unless PBM preserves the current heat. */
export function triggerThermalReleaseValve(
  context: EngineerRuntime<HolosmithSkill>,
  skill: EngineerSkill,
  at: number
): void {
  if (!hasTrait(context.config, TRAIT.THERMAL_RELEASE_VALVE)) return;
  const state = holosmithState.from(context);
  const thermalReleaseValveProfile = requireBalanceProfileFromContext(context, TRAIT.THERMAL_RELEASE_VALVE);
  const boon = requireEffect(thermalReleaseValveProfile, 'boon', 'vigor');
  if (boon) {
    buildEngineerPackets('buff', {
      at,
      source: 'Trait',
      sourceId: TRAIT.THERMAL_RELEASE_VALVE,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Thermal Release Valve — vigor',
      kind: String(boon.boon).toLowerCase(),
      duration: boon.duration,
      stacks: Number(boon.stacks)
    }).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
  }

  if (state.heat <= 0 || preservesPhotonicHeat(context)) return;
  triggerVentExhaust(context, skill, at);
}

/** Storm replacement runs before ordinary Forge availability so denial precedence stays stable. */
export function crystalStormAvailability(
  context: EngineerRuntime<HolosmithSkill>,
  skill: HolosmithSkill
): AvailabilityResult {
  if (skill.forgeSkill && skill.slot === 'Weapon_1') {
    const stormSelected = hasTrait(context.config, TRAIT.CRYSTAL_CONFIGURATION_STORM);
    const stormSkill = HOLOSMITH_STORM_AUTOATTACK_SKILL_IDS.has(Number(skill.id));
    if (stormSelected !== stormSkill) {
      return denyEngineerCast(
        skill,
        'engineer.forge-auto-replaced',
        stormSelected ? 'Crystal Configuration: Storm replaces this attack.' : 'requires Crystal Configuration: Storm.'
      );
    }
  }

  return { ready: true };
}

/** Replaces Lens charges only when the Forge transition's grant reaches the resolver. */
export function handleSolarFocusingLens(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const state = holosmithState.from(context);
  // Lens keeps its inclusive final-hit policy on the temporary-effect expiry tick.
  state.solarFocusingLens = {
    ...grantCharges(Number(event.stacks), gw2EffectExpiresAt(event.at, Number(event.duration))),
    readyAt: event.at
  };
}

/** Spends Lens charges in impact order, including strikes materialized by resolver handlers. */
export function consumeSolarFocusingLens(
  context: EngineerResolverContext,
  event: HolosmithResolverEvent
): { solarFocusingLens: true } | void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)
  )
    return;
  const state = holosmithState.from(context);
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, TRAIT.SOLAR_FOCUSING_LENS);
  const condition = requireEffect(solarFocusingLensProfile, 'condition', 'Burning');
  if (!condition) return;
  // Lens cannot activate before its grant; zero-ICD consumption does not enforce readyAt.
  if (event.at < (state.solarFocusingLens.readyAt ?? 0) || !consumeCharge(state.solarFocusingLens, event.at, 0, true))
    return;

  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.SOLAR_FOCUSING_LENS,
      actorType: 'player',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Solar Focusing Lens — Burning',
      condition: String(condition.condition),
      stacks: Number(condition.stacks),
      duration: Number(condition.duration)
    })
  });

  return { solarFocusingLens: true };
}

/** Entry, ordinary exit, and overheat choose their grant size at the original transition boundary. */
export function grantSolarFocusingLens(
  context: EngineerRuntime<HolosmithSkill>,
  at: number,
  grant: 'minimumStacks' | 'maximumStacks'
): void {
  if (!hasTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)) return;
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, TRAIT.SOLAR_FOCUSING_LENS);
  // Grants cross into the resolver at their activation time; only impacts spend charges.
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'engineer.solar-focusing-lens',
      at,
      source: 'Trait',
      sourceId: TRAIT.SOLAR_FOCUSING_LENS,
      actorType: 'player',
      stacks: balanceProfileNumber(solarFocusingLensProfile, grant),
      duration: balanceProfileNumber(solarFocusingLensProfile, 'durationMultiplier')
    }
  });
}
