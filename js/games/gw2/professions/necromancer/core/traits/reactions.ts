import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import {
  applyOverflowingThirstDamage,
  applyVampiric,
  applyVampiricPresence
} from '#gw2/professions/necromancer/core/traits/life-steal.js';
import {
  applyChillingDarkness,
  applyInsidiousDisruption,
  necromancerBarbedPrecisionReaction
} from '#gw2/professions/necromancer/core/traits/conditions.js';
import { applyCorruptorsFervor } from '#gw2/professions/necromancer/core/traits/carapace.js';
import { applyDhuumfire, applyUnyieldingBlast } from '#gw2/professions/necromancer/core/traits/shroud.js';
import {
  applyBitterChill,
  applyChillOfDeath,
  applyChillOfDeathCondition,
  applyDreadWindow,
  applyReapersMight,
  applySiphonedPower
} from '#gw2/professions/necromancer/core/traits/behavior.js';
import type { NecromancerResolverContext, NecromancerResolverEvent } from '#gw2/professions/necromancer/types.js';
/** Applies all Core Necromancer traits triggered by one resolved player or summon strike. */
export function reactToNecromancerCoreDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NativeResolvedDamageDetails = {}
): void {
  applyChillOfDeathCondition(context, event);
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) return;

  const skill = event.skillId == null ? undefined : context.helpers.skillsById.get(event.skillId);
  const firstHit = Number(event.hitIndex || 1) === 1;
  const shroudSkillOne = skill?.shroudSlot === 1 || event.metadata?.necromancerShroudSkillOne === true;
  applyVampiric(context, event);
  applyReapersMight(context, event, firstHit, shroudSkillOne);
  applySiphonedPower(context, event);
  applyChillOfDeath(context, event);
  applyDhuumfire(context, event, skill?.dhuumfireDuration, shroudSkillOne);
  applyUnyieldingBlast(context, event, firstHit, shroudSkillOne);
  necromancerBarbedPrecisionReaction(context, event, details);
  applyVampiricPresence(context, event);
  applyOverflowingThirstDamage(context, event);
}

/** Applies Core trait reactions after a source condition has entered canonical resolver state. */
export function reactToNecromancerCoreCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  applyBitterChill(context, event);
  applyCorruptorsFervor(context, event);
  if (event.condition === 'Blindness') applyChillingDarkness(context, event);
  // Fear's disable rewards follow its accepted condition, without a second resolver dispatch.
  if (event.condition === 'Fear') {
    applyDreadWindow(context, event);
    applyInsidiousDisruption(context, event);
  }
}

/** Hard controls share Insidious Disruption's reward with accepted Fear applications. */
export function reactToNecromancerCoreControl(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  applyInsidiousDisruption(context, event);
}
