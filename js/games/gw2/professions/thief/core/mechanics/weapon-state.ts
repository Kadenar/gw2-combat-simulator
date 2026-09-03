import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefEndurance, gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { spearChainStageForSkill, updateSpearChainState } from '#gw2/professions/thief/core/mechanics/spear-chain.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import type {
  ThiefCastContext,
  ThiefSkill,
  ThiefState,
  ThiefWeaponMatcherContext
} from '#gw2/professions/thief/types.js';

// Match weapon skills against hand requirements while projecting live rifle
// stance and spear-chain state outside the full weapon-bar preview.
export function thiefWeaponSkillMatchesSet(
  skill: ThiefSkill,
  pair: readonly (string | undefined)[] = [],
  context: ThiefWeaponMatcherContext = {}
): boolean {
  const professionState = flattenProfessionState(
    context.professionState || context.state?.profession || {}
  ) as unknown as Partial<ThiefState>;
  if (
    skill.weapon === 'Rifle' &&
    !skill.stealthAttack &&
    Boolean(skill.kneelSkill) !== Boolean(professionState.kneeling)
  )
    return false;
  const spearChainStage = spearChainStageForSkill(skill.id);
  if (
    spearChainStage != null &&
    !context.weaponBarPreview &&
    Number(professionState.spearChainStage || 0) !== spearChainStage
  )
    return false;
  if (skill.requiredMainHand != null || skill.requiredOffHand != null || skill.requiresEmptyOffhand) {
    const [mainHand = '', offHand = ''] = pair;
    return (
      (skill.requiredMainHand == null || skill.requiredMainHand === mainHand) &&
      (skill.requiredOffHand == null ||
        (skill.requiredOffHand === false ? !offHand : skill.requiredOffHand === offHand))
    );
  }

  const primary = pair[0] || '';
  const wielding = context.weaponData?.[primary]?.wielding || context.catalog?.weaponHands?.get(primary);
  if (wielding === '2h') return skill.weapon === pair[0];
  const slot = Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
  return slot <= 3 ? skill.weapon === pair[0] : skill.weapon === pair[1];
}

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
  // Track the interval start so an earlier delayed strike cannot see a future stealth grant as already active.
  const entering = state.stealthStartedAt > at || state.stealthUntil <= at;
  if (entering) state.stealthStartedAt = at;
  state.stealthUntil = Math.min(at + 15, Math.max(at, state.stealthUntil) + duration);
  if (entering && hasTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
    gainThiefInitiative(context, 2, at, 'enter-stealth');
  }

  if (entering && hasTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    state.spiderVenomCharges = Math.min(6, Number(state.spiderVenomCharges || 0) + 3);
    state.spiderVenomExpiresAt = at + 24;
    state.spiderVenomGeneration += 1;
  }

  if (entering && hasTrait(context.config, TRAIT.CLOAKED_IN_SHADOW)) {
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

  emitThiefStateSnapshot(context, at, 'stealth');
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
      emitThiefStateSnapshot(context, at, 'weapon-flip');
    }
  }

  if (completed && skill.type === 'Weapon' && skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
    emitThiefStateSnapshot(context, at, 'weapon-flip-used');
  }
}
