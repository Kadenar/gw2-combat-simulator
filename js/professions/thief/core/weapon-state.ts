import { emitSkillCondition } from '../../../platform/gw2/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { snapshotThiefState } from './state.js';
import { hasThiefTrait } from './state.js';
import { gainThiefEndurance, gainThiefInitiative } from './shared.js';
import { updateSpearChainState } from './conditions.js';
import type { ThiefCastContext, ThiefSkill } from '../types.js';

// Extend stealth up to its cap unless Revealed blocks entry, firing enter-stealth
// traits only when transitioning from an unstealthed state.
export function grantThiefStealth(
  context: ThiefCastContext,
  skill: ThiefSkill,
  at: number,
  explicitDuration?: number
): void {
  const duration =
    explicitDuration ??
    (skill.effects || [])
      .filter((effect) => effect.type === 'buff' && effect.kind === 'stealth')
      .reduce((sum, effect) => sum + Number(effect.duration || 0), 0);
  if (!(duration > 0)) return;
  const state = professionCoreState(context);
  if (state.revealedUntil > at) return;
  const entering = state.stealthUntil <= at;
  state.stealthUntil = Math.min(at + 15, Math.max(at, state.stealthUntil) + duration);
  if (entering && hasThiefTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
    gainThiefInitiative(context, 2, at, 'enter-stealth');
  }

  if (entering && hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    state.spiderVenomCharges = Math.min(6, Number(state.spiderVenomCharges || 0) + 3);
    state.spiderVenomExpiresAt = at + 24;
    state.spiderVenomGeneration += 1;
  }

  if (entering && hasThiefTrait(context.config, TRAIT.CLOAKED_IN_SHADOW)) {
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.CLOAKED_IN_SHADOW,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Cloaked in Shadow — Blindness',
      condition: 'Blindness',
      stacks: 1,
      duration: 5
    });
  }

  emitStateSnapshot(context, 'thief', at, 'stealth', snapshotThiefState(context.state.profession));
}

export function updateThiefWeaponState(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const completed = context.effectiveEnd >= context.fullEnd - context.epsilon;
  if (completed && !(skill.categories || []).includes('stolen skill')) {
    grantThiefStealth(context, skill, at);
  }

  if (completed && Number(skill.resourceGain || 0) > 0) {
    gainThiefEndurance(context, Number(skill.resourceGain), at, skill.name);
  }

  if (skill.shadowstepSkill && context.config.relic === 'Peitha' && completed) {
    context.emit({
      type: 'peitha',
      at,
      source: 'thief',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Relic of Peitha'
    });
  }

  updateSpearChainState(context, skill, at);
  // Weapon sequence skills share one state contract: completing the opener
  // arms its replacement for the declared window, and using the child restores
  // the opener. This covers dual attacks plus sword, shortbow, staff, and rifle.
  if (completed && skill.type === 'Weapon' && skill.flipSkillId != null && skill.flipSkillId !== skill.nextChainId) {
    const flip = context.catalog.skillsById.get(Number(skill.flipSkillId));
    if (flip?.flipParentId === skill.id) {
      state.availableFlips[flip.id] = at + Number(skill.flipDuration || (skill.dualWieldOpener ? 4 : 5));
      emitStateSnapshot(context, 'thief', at, 'weapon-flip', snapshotThiefState(context.state.profession));
    }
  }

  if (completed && skill.type === 'Weapon' && skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
    emitStateSnapshot(context, 'thief', at, 'weapon-flip-used', snapshotThiefState(context.state.profession));
  }
}
