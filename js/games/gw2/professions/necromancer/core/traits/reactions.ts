import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import {
  applyOverflowingThirstDamage,
  applyVampiric,
  applyVampiricPresence
} from '#gw2/professions/necromancer/core/traits/life-steal.js';
import {
  applyChillingDarkness,
  applyInsidiousDisruption,
  applyTerror,
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
  if (event.condition === 'Chilled') {
    professionCoreState(context).targetChilledUntil = Math.max(
      professionCoreState(context).targetChilledUntil || 0,
      event.at + (event.effectiveDuration ?? event.duration ?? 0)
    );
  }

  applyBitterChill(context, event);
  applyCorruptorsFervor(context, event);
}

/** Converts a qualifying Blind into Chilling Darkness at its established reaction position. */
export function reactToNecromancerBlind(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  applyChillingDarkness(context, event);
}

/** Applies fear and disruption trait reactions without modeling target-control windows. */
export function reactToNecromancerCoreControl(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  applyDreadWindow(context, event);

  applyTerror(context, event);
  applyInsidiousDisruption(context, event);
}
