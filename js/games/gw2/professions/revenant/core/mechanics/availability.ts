import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { weaponFlipBlock } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantLegendAvailability } from '#gw2/professions/revenant/core/mechanics/legends.js';
import { revenantEnergyAvailability } from '#gw2/professions/revenant/core/mechanics/resources.js';
import { revenantUpkeepAvailability } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { demonAvailability } from '#gw2/professions/revenant/core/skills/legends/demon.js';
import { imperialGuardAvailability } from '#gw2/professions/revenant/core/skills/weapons/greatsword.js';

/** Weapon-specific reasons take precedence over generic closed or open flip windows. */
function revenantWeaponAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill
): AvailabilityResult | null {
  const flips = runtime.profession.core.availableFlips;
  const now = runtime.time;
  const imperialGuardBlock = imperialGuardAvailability(runtime, skill);
  if (imperialGuardBlock) return imperialGuardBlock;
  const flipBlock = weaponFlipBlock(flips, runtime.helpers.skillsById, skill, now);
  if (flipBlock?.kind === 'closed')
    return denySkillCast(skill, 'revenant.weapon-flip-inactive', `use ${flipBlock.parent.name} first.`);
  if (flipBlock?.kind === 'open')
    return denySkillCast(skill, 'revenant.weapon-flip-active', 'use or wait out the active follow-up skill.');
  return null;
}

/** Preserve denial precedence and let a legal legend swap bypass upkeep and Energy gates. */
export function revenantAvailability(runtime: MechanicQueriesOf<RevenantRuntime>, skill: Skill): AvailabilityResult {
  return (
    demonAvailability(runtime, skill) ??
    revenantWeaponAvailability(runtime, skill) ??
    revenantLegendAvailability(runtime, skill) ??
    revenantUpkeepAvailability(runtime, skill) ??
    revenantEnergyAvailability(runtime, skill)
  );
}
