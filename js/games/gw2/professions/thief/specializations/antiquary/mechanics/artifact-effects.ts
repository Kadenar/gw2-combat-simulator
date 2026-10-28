import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { effectNumber, requireEffect, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { antiquaryStruck } from '#gw2/professions/thief/specializations/antiquary/mechanics/trigger-points.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

// Spend one unexpired Mistburn charge on a qualifying player strike and attach
// its Burning without allowing the mortar's granting strike to self-consume.
function applyMistburnCharge(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== ACTOR.PLAYER ||
    event.coefficient == null ||
    event.skillId === ID.MISTBURN_MORTAR // the mortar itself grants the charge; it must not also consume one
  )
    return;

  const state = antiquaryState.from(context);

  if (!consumeCharge(state.mistburn, event.at)) return;

  const mistburnProcProfile = requireSkillFromContext(context, ID.MISTBURN_MORTAR);
  const burning = requireEffect(
    mistburnProcProfile,
    'condition',
    CONDITION.BURNING,
    requireSkillAction(mistburnProcProfile, 'charged')
  );

  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!burning) return;

  context.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildResolverCondition({
      at: event.at,
      source: 'thief',
      sourceId: ID.MISTBURN_MORTAR,
      actorType: ACTOR.PLAYER,
      skillId: ID.MISTBURN_MORTAR,
      skillName: 'Mistburn Mortar',
      name: 'Mistburn Mortar — Charged Strike',
      condition: String(burning.condition),
      stacks: effectNumber(mistburnProcProfile, burning, 'stacks'),
      duration: effectNumber(mistburnProcProfile, burning, 'duration'),
      triggeredBy: event.skillName
    })
  });
}

function applyAntiquaryDamageReactions(context: ThiefRuntime, event: ThiefResolverEvent): void {
  // Both Antiquary strike follow-ups apply immediately at the landed strike so
  // charge consumption and condition reactions share one causal timestamp.
  context.fireTrigger(antiquaryStruck, { cause: event });
  applyMistburnCharge(context, event);
}

export const antiquaryResolverEventReactions = Object.freeze({
  damage: applyAntiquaryDamageReactions
});
