import { professionCoreState } from '../../../platform/engine/profession.js';
import { THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { hasThiefTrait } from './state.js';
import { emitThiefState, gainThiefEndurance, gainThiefInitiative } from './shared.js';
import { updateSpearChainState } from './conditions.js';
import type { ThiefCastContext, ThiefSkill } from '../types.js';

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
    context.emit({
      type: 'condition',
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
  emitThiefState(context, at, 'stealth');
}

export function updateThiefWeaponState(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const completed = context.effectiveEnd >= context.fullEnd - context.epsilon;
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (chain) {
    if (chain.next == null) delete state.autoattackChains[chain.root];
    else state.autoattackChains[chain.root] = chain.next;
  } else if (skill.type === 'Weapon') {
    state.autoattackChains = {};
  }
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
      emitThiefState(context, at, 'weapon-flip');
    }
  }
  if (completed && skill.type === 'Weapon' && skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
    emitThiefState(context, at, 'weapon-flip-used');
  }
}
