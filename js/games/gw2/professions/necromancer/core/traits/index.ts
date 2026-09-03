/** Dispatches Core Necromancer trait lines in their established cross-line reaction order. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { finalizeNecromancerCast } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  applyBitterChill,
  applyChillingDarkness,
  applyInsidiousDisruption,
  applyTerror,
  necromancerBarbedPrecisionReaction
} from '#gw2/professions/necromancer/core/traits/curses.js';
import {
  applyChillOfDeath,
  applyMaliciousSwarm,
  applyReapersMight,
  applySignetsOfSuffering,
  applySiphonedPower,
  applySpitefulFortitude
} from '#gw2/professions/necromancer/core/traits/spite.js';
import {
  applyDhuumfire,
  applyFearOfDeath,
  applyUnyieldingBlast,
  gluttonyLifeForceMultiplier
} from '#gw2/professions/necromancer/core/traits/soul-reaping.js';
import {
  applyOverflowingThirst,
  applyOverflowingThirstDamage,
  applyTransfusion,
  applyVampiric,
  applyVampiricPresence,
  reactToTasteForBloodAlliedHit,
  reactToTasteForBloodGrant,
  reactToVampiricPresenceAlliedHit
} from '#gw2/professions/necromancer/core/traits/blood-magic.js';
import { applyCorruptorsFervor, applyDarkDefense } from '#gw2/professions/necromancer/core/traits/death-magic.js';

export {
  applyTraitCondition,
  applyTraitVulnerability,
  queueTraitCoefficientDamage,
  targetIsChilled
} from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
export {
  necromancerBarbedPrecisionReaction,
  reactToTasteForBloodAlliedHit,
  reactToTasteForBloodGrant,
  reactToVampiricPresenceAlliedHit
};

/** Reconciles completed-cast flips and Fear of Death before later trait effects are emitted. */
function updateNecromancerCastState(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = professionCoreState(context);
  const completed = context.effectiveEnd >= context.fullEnd - context.epsilon;
  if (!completed) return;

  const chainNext = context.catalog.autoattackChainPositions.get(Number(skill.id))?.next;
  // Arm explicit timed flips while leaving autoattack chains and minion commands to their dedicated controllers.
  if (
    skill.flipSkillId != null &&
    skill.flipSkillId !== chainNext &&
    skill.flipSkillId !== skill.nextChainId &&
    skill.handlerId !== 'necromancer.minion'
  ) {
    const flip = context.catalog.skillsById.get(skill.flipSkillId);
    if (flip && flip.name !== skill.name && flip.flipParentId === skill.id) {
      state.availableFlips[flip.id] =
        context.rechargeStart + Math.max(1, Number(skill.flipDuration ?? skill.cooldown ?? skill.recharge ?? 5));
    }
  }

  // A completed child cast consumes its own armed flip unless it is a persistent shroud exit.
  if (skill.flipParentId != null && !skill.shroudExit && skill.handlerId !== 'necromancer.minion-command') {
    delete state.availableFlips[skill.id];
  }

  applyFearOfDeath(context, skill);
}

/** Grants cast-start traits before the activating skill can consume their state. */
export function applyNecromancerCastStartTraits(context: NecromancerCastContext, skill: NecromancerSkill): void {
  applyOverflowingThirst(context, skill);
}

/** Applies completion-gated Core trait effects before finalizing shared life-force state. */
export function applyNecromancerAfterCastTraits(context: NecromancerCastContext, skill: NecromancerSkill): void {
  updateNecromancerCastState(context, skill);
  applyDarkDefense(context, skill);
  applySignetsOfSuffering(context, skill);
  applyMaliciousSwarm(context, skill);
  applyTransfusion(context, skill);
  // Shared life-force and skill-specific resource changes run after every completion-gated trait.
  finalizeNecromancerCast(context, skill);
}

/** Applies all Core Necromancer traits triggered by one resolved player or summon strike. */
export function reactToNecromancerCoreDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;

  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  const firstHit = Number(event.hitIndex || 1) === 1;
  const shroudSkillOne = skill?.shroudSlot === 1 || event.metadata?.necromancerShroudSkillOne === true;
  applyVampiric(context, event);
  applyReapersMight(context, event, firstHit, shroudSkillOne);
  applySiphonedPower(context, event);
  applySpitefulFortitude(context, event, gluttonyLifeForceMultiplier(context));
  applyChillOfDeath(context, event);
  applyDhuumfire(context, event, skill?.dhuumfireDuration, shroudSkillOne);
  applyUnyieldingBlast(context, event, firstHit, shroudSkillOne);
  necromancerBarbedPrecisionReaction.handler(context, event, details);
  applyVampiricPresence(context, event);
  applyOverflowingThirstDamage(context, event);
}

/** Applies Core trait reactions after a source condition has entered canonical resolver state. */
export function reactToNecromancerCoreCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (event.condition === 'Chilled') {
    professionCoreState(context).targetChilledUntil = Math.max(
      Number(professionCoreState(context).targetChilledUntil || 0),
      event.at + Number(event.effectiveDuration ?? event.duration ?? 0)
    );
  }

  applyBitterChill(context, event);
  applyCorruptorsFervor(context, event);
}

/** Converts a qualifying Blind into Chilling Darkness at its established reaction position. */
export function reactToNecromancerBlind(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  applyChillingDarkness(context, event);
}

/** Records target-control windows before fear and disruption trait conditions. */
export function reactToNecromancerCoreControl(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  professionCoreState(context).targetControlledUntil = Math.max(
    Number(professionCoreState(context).targetControlledUntil || 0),
    event.at + Math.max(0.001, Number(event.duration || 0))
  );
  if (event.controlKind === 'fear' || event.kind === 'fear') {
    professionCoreState(context).dreadUntil = Math.max(
      Number(professionCoreState(context).dreadUntil || 0),
      event.at + 3
    );
  }

  applyTerror(context, event);
  applyInsidiousDisruption(context, event);
}
