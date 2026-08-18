import { REVENANT_SKILL_IDS as SKILL } from '../../data/ids.js';
import { revenantUiState } from '../../core/ui.js';
import { isBandTogetherReady } from './renegade.js';
import type { ProfessionUiContract, SchedulerRecord } from '../../../../platform/engine/types.js';
import type { RevenantSkill, RevenantUiContext } from '../../types.js';

export const renegadeUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  paletteGroups: () => [
    {
      id: 'revenant-profession-specialization',
      label: 'F',
      skillIds: [SKILL.HEROIC_COMMAND, SKILL.CITADEL_BOMBARDMENT, SKILL.ORDERS_FROM_ABOVE],
      color: '#a84f54',
      // resourceAnchor makes this group the visual attachment point for the energy bar
      resourceAnchor: true
    }
  ],
  isPaletteSkillInstant: (context: RevenantUiContext, skill: RevenantSkill) =>
    // Band Together is instant only when the one-use enhancement window is active; the UI must expose this so the user can see at a glance that the next press is the empowered summon
    skill.handlerId === 'revenant.band-together' &&
    isBandTogetherReady(revenantUiState(context), Number(context.time || 0)),
  resourceViews: () => []
});
