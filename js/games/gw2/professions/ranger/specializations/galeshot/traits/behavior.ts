import type { Gw2TraitLookupContext } from '#gw2/platform/builds/selected-traits.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as deny } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Restricts the replacement pair consistently for live cast validation. */
export function perilousSkiesAvailability(
  context: MechanicQueriesOf<RangerRuntime>,
  skill: RangerSkill
): AvailabilityResult | null {
  if (skill.id === ID.QUARRYS_PERIL && perilousSkiesSelected(context)) {
    return deny(skill, 'ranger.perilous-skies', 'Pelt replaces this skill.');
  }

  if (skill.id === ID.PELT && !perilousSkiesSelected(context)) {
    return deny(skill, 'ranger.perilous-skies', "select Perilous Skies to replace Quarry's Peril.");
  }

  return null;
}

/** Cloudburst resets Bluster at the committing skill's side-effect phase. */
export const cloudburstBlusterReset: SkillSideEffect = {
  on: 'castCommit',
  when: (runtime, cast) => Boolean(cast.skill.cycloneBowSkill) && hasTrait(runtime, TRAIT.CLOUDBURST),
  do: { type: 'rechargeReset', skillIds: [ID.BLUSTER] }
};

/** Runtime and palette share the selected replacement pair. */
export function perilousSkiesSelected(context: Gw2TraitLookupContext): boolean {
  return hasTrait(context, TRAIT.PERILOUS_SKIES);
}
