import type {
  PaletteSkillAvailability,
  ProfessionUiContract,
  SchedulerRecord,
  Skill
} from '../../../../platform/engine/types.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { elementalistBalanceValue } from '../../core/profiles.js';
import { ELEMENTALIST_OVERLOAD_SKILL_IDS } from '../../data/ids.js';
import { TEMPEST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

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

  const enteredAt = Number(state.attunementEnteredAt ?? -1);
  if (enteredAt < 0) return { available: true, message: '' };

  // Mirror scheduler dwell rules so the palette exposes singularity as a
  // visible temporary lockout, including trait and Alacrity adjustments.
  const assumptions = build?.assumptions as SchedulerRecord | undefined;
  const config = context.config as SchedulerRecord | undefined;
  const boons = config?.boons as SchedulerRecord | undefined;
  const dwell =
    (hasTrait(context, 'Transcendent Tempest')
      ? elementalistBalanceValue(context, PROFILE.overloads, 'durationMultiplier', 4)
      : elementalistBalanceValue(context, PROFILE.overloads, 'initialDelay', 6)) /
    (Boolean(boons?.alacrity ?? assumptions?.alacrity) ? 1.25 : 1);
  const retryAt = enteredAt + dwell;
  const available = Number(context.time || 0) + 1e-9 >= retryAt;
  return {
    available,
    message: available ? '' : 'Attunement singularity has not formed.',
    ...(available ? {} : { retryAt })
  };
}

export const tempestUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: () => [
    {
      id: 'elementalist-tempest-overloads',
      label: 'Overloads',
      skillIds: Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS),
      color: '#cf6c42',
      className: 'elementalist-overloads'
    }
  ],
  paletteGroups: () => [
    {
      id: 'elementalist-tempest-overloads',
      label: 'OL',
      skillIds: Object.values(ELEMENTALIST_OVERLOAD_SKILL_IDS),
      color: '#cf6c42',
      resourceAnchor: true
    }
  ],
  paletteSkillAvailability: overloadPaletteAvailability
});
