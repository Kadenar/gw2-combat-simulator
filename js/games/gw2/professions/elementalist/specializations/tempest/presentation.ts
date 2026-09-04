/**
 * Tempest UI contract: groups the four overloads on the skill bar and rotation palette, and
 * previews overload availability so the editor can grey out casts the scheduler would reject.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { PaletteSkillAvailability, ProfessionUiContract } from '#gw2/platform/engine/profession/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { ELEMENTALIST_OVERLOAD_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/tempest/profiles.js';

// Editor-side preview of the scheduler's overload gate: non-overload skills always pass, an
// overload requires its own attunement, and an entered attunement must have dwelled long enough.
function overloadPaletteAvailability(context: SchedulerRecord, skill: Skill): PaletteSkillAvailability {
  if (!skill.overload) return { available: true, message: '' };
  const state = (context.professionState as SchedulerRecord | undefined) || {};
  const build = context.build as SchedulerRecord | undefined;
  const primaryAttunement = String(state.primaryAttunement || build?.startAttunement || 'Fire');
  if (skill.attunement !== primaryAttunement) {
    return {
      available: false,
      message: `Requires ${String(skill.attunement)} attunement.`
    };
  }

  // A negative entry stamp marks the configured starting attunement as already dwelled.
  const enteredAt = Number(state.attunementEnteredAt ?? -1);
  if (enteredAt < 0) return { available: true, message: '' };

  // Mirror scheduler dwell rules so the palette exposes singularity as a
  // visible temporary lockout, including trait and Alacrity adjustments.
  const assumptions = build?.assumptions as SchedulerRecord | undefined;
  const config = context.config as SchedulerRecord | undefined;
  const boons = config?.boons as SchedulerRecord | undefined;
  const dwell =
    (hasTrait(context, 'Transcendent Tempest')
      ? balanceProfileValueFromContext(context, PROFILE.overloads, 'durationMultiplier', 4)
      : balanceProfileValueFromContext(context, PROFILE.overloads, 'initialDelay', 6)) /
    (Boolean(boons?.alacrity ?? assumptions?.alacrity) ? 1.25 : 1);
  const retryAt = enteredAt + dwell;
  const available = Number(context.time || 0) + 1e-9 >= retryAt;
  return {
    available,
    message: available ? '' : 'Attunement singularity has not formed.',
    ...(available ? {} : { retryAt })
  };
}

/** Presentation fragment the Tempest module contributes to the elementalist UI contract. */
export const tempestUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: () => [
    {
      id: 'elementalist-tempest-overloads',
      label: 'Overloads',
      skillIds: Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS),
      color: '#cf6c42',
      className: 'elementalist-overloads',
      order: -10
    }
  ],
  paletteGroups: () => [
    {
      id: 'elementalist-tempest-overloads',
      label: 'OL',
      skillIds: Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS),
      color: '#cf6c42',
      resourceAnchor: true,
      order: -10
    }
  ],
  paletteSkillAvailability: overloadPaletteAvailability
});
