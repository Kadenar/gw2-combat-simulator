import { professionCoreState } from '../../../../platform/engine/profession.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { setRangerPetActive } from '../../core/pets.js';
import { rangerBalanceValue, RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '../../core/profiles.js';
import { rangerPetByName } from '../../core/state.js';
import { applyRangerBeastSkillTraits } from '../../core/traits.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '../../types.js';
import { soulbeastState } from './state.js';

function initializeSoulbeastPetOwnership(context: RangerSchedulerContext): void {
  // Beastmode starts active, so Soulbeast suspends Core's autonomous pet before combat begins.
  setRangerPetActive(context, !soulbeastState.from(context).beastmodeActive, context.state.time);
}

function emitMergedCommandEffects(context: RangerCastContext, skill: RangerSkill): void {
  if (skill.id === ID.SIC_EM) {
    context.emit({
      type: 'buff',
      at: context.start,
      source: 'ranger',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      kind: 'sic-em',
      duration: rangerBalanceValue(context, CORE_PROFILE.sicEm, 'durationMultiplier', 10),
      stacks: 1
    });
  }

  if (String(skill.description || '').startsWith('Command.') && hasTrait(context, TRAIT.RESOUNDING_TIMBRE)) {
    context.emit({
      type: 'ranger.boon-extension',
      at: context.start,
      source: 'ranger',
      sourceId: TRAIT.RESOUNDING_TIMBRE,
      actorType: 'effect',
      skillId: skill.id,
      skillName: 'Resounding Timbre',
      duration: rangerBalanceValue(context, CORE_PROFILE.resoundingTimbre, 'durationMultiplier', 2)
    });
  }
}

/** Completes Soulbeast-only pet substitution and merged Beast-skill behavior. */
function completeSoulbeastCast(context: RangerCastContext, skill: RangerSkill): void {
  const state = soulbeastState.from(context);
  if (skill.id === ID.PET_SWAP) {
    state.archetype = rangerPetByName(professionCoreState(context).activePet).archetype;
  }

  if (!state.beastmodeActive) return;
  emitMergedCommandEffects(context, skill);
  if (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE) {
    applyRangerBeastSkillTraits(context, skill, false);
  }
}

export const soulbeastSchedulerHooks = Object.freeze({
  initialize: {
    id: 'ranger.soulbeast-pet-ownership',
    order: 20,
    handler: initializeSoulbeastPetOwnership
  },
  onCastComplete: {
    id: 'ranger.soulbeast-complete',
    order: 20,
    handler: completeSoulbeastCast
  }
});
