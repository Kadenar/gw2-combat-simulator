/** Dispatches Core Necromancer trait lines in their established cross-line reaction order. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';
import {
  applyBitterChill,
  applyChillingDarkness,
  applyInsidiousDisruption,
  applyTerror,
  necromancerBarbedPrecisionReaction
} from '#gw2/professions/necromancer/core/traits/curses.js';
import {
  applyChillOfDeath,
  applyChillOfDeathCondition,
  applyReapersMight,
  applySiphonedPower
} from '#gw2/professions/necromancer/core/traits/spite.js';
import { applyDhuumfire, applyUnyieldingBlast } from '#gw2/professions/necromancer/core/traits/soul-reaping.js';
import {
  applyOverflowingThirstDamage,
  applyVampiric,
  applyVampiricPresence,
  reactToTasteForBloodAlliedHit,
  reactToTasteForBloodGrant,
  reactToVampiricPresenceAlliedHit
} from '#gw2/professions/necromancer/core/traits/blood-magic.js';
import { applyCorruptorsFervor } from '#gw2/professions/necromancer/core/traits/death-magic.js';

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

/** Applies all Core Necromancer traits triggered by one resolved player or summon strike. */
export function reactToNecromancerCoreDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NativeResolvedDamageDetails = {}
): void {
  applyChillOfDeathCondition(context, event);
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;

  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  const firstHit = Number(event.hitIndex || 1) === 1;
  const shroudSkillOne = skill?.shroudSlot === 1 || event.metadata?.necromancerShroudSkillOne === true;
  applyVampiric(context, event);
  applyReapersMight(context, event, firstHit, shroudSkillOne);
  applySiphonedPower(context, event);
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
