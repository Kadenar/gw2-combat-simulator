import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { legendInvoked } from '#gw2/professions/revenant/core/mechanics/boundaries.js';
import { clearRevenantLegendFlips, removeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { isLegalRevenantLegendId } from '#gw2/professions/revenant/data/legends.js';
import { revenantUpkeepConsumeId } from '#gw2/professions/revenant/data/upkeep-skills.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** A legal swap is immediately ready; other legend skills require their currently invoked legend. */
export function revenantLegendAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill
): AvailabilityResult | null {
  const core = runtime.profession.core;

  if (skill.id === ID.SWAP_LEGENDS) {
    const specialization = runtime.config.specialization || 'Core';
    return core.selectedLegendIds.length !== 2 ||
      core.selectedLegendIds.some((legendId) => !isLegalRevenantLegendId(legendId, specialization))
      ? denySkillCast(skill, 'revenant.legend-pair', 'select two legal legends.')
      : { ready: true };
  }

  if (skill.legendId && skill.legendId !== core.activeLegendId)
    return denySkillCast(skill, 'revenant.inactive-legend', 'invoke the matching legend first.');

  return null;
}

/** Swapping legends resets Energy, keeps cross-legend upkeeps with a destination consume, and invokes traits. */
export function swapLegend(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const core = runtime.profession.core;
  const previous = runtime.resourceController.value('energy');
  core.activeLegendId = core.selectedLegendIds.find((id) => id !== core.activeLegendId) || core.activeLegendId;
  const energy = chargedMistsEnergy(runtime, cast, previous);
  // Legend invocation replaces the balance after Charged Mists reads pre-swap energy, preserving recovery timing.
  runtime.resourceController.replace('energy', energy);
  clearRevenantLegendFlips(runtime);
  for (const active of [...core.activeUpkeeps]) {
    const upkeep: RevenantSkill | undefined = runtime.helpers.skillsById.get(active.skillId);
    // Only a declared cross-legend relationship retains an upkeep after a swap.
    const consumeId =
      upkeep?.upkeepConsumeByLegendId != null ? revenantUpkeepConsumeId(upkeep, core.activeLegendId) : undefined;

    if (consumeId != null) armSkillFlip(core.availableFlips, consumeId, runtime.time);
    else removeRevenantUpkeep(runtime, active.skillId);
  }

  runtime.resourceController.refresh('energy');
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'sigil_swap',
      at: runtime.time,
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      weaponSet: runtime.activeWeaponSet
    }
  });

  if (runtime.combatStartedAt()) runtime.fireTrigger(legendInvoked, { at: runtime.time });
}

/** Samples pre-swap Energy before the legend reset is applied. */
function chargedMistsEnergy(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, previous: number): number {
  const chargedMists = hasTrait(runtime, TRAIT.CHARGED_MISTS)
    ? requireBalanceProfileFromContext(runtime, TRAIT.CHARGED_MISTS)
    : undefined;
  const energy = Math.min(
    100,
    chargedMists && Math.floor(previous) <= balanceProfileNumber(chargedMists, 'threshold')
      ? balanceProfileNumber(chargedMists, 'resourceGain')
      : cast.skill.resourceGain || 0
  );
  return energy;
}
