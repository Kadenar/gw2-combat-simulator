import { gw2Time } from '#gw2/platform/combat/clock.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { effectNumber, requireEffect, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { antiquaryStruck } from '#gw2/professions/thief/specializations/antiquary/mechanics/trigger-points.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';
import { consumeBatchFromList } from '#kernel/resources/batch-list.js';
import { activeBatchCount } from '#kernel/resources/batch.js';

// Player strikes and new condition applications share charge consumption and its ICD.
// Existing condition damage ticks do not consume charges; Mortar cannot trigger itself.
function applyMistburnCharge(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== ACTOR.PLAYER ||
    (event.type !== 'condition' && event.coefficient == null) ||
    event.skillId === ID.MISTBURN_MORTAR // the mortar itself grants the charge; it must not also consume one
  )
    return;

  const state = antiquaryState.from(context.profession);
  const mistburnProcProfile = requireSkill(context.helpers, ID.MISTBURN_MORTAR);

  // Rejected hits preserve both the remaining charges and the current proc deadline.
  if (!isInternalCooldownReady(event.at, state.mistburn.readyAt)) return;

  // Spend the newest live grant first; older charges retain their original expiry.
  const newest = [...state.mistburn.grants].reverse().find((grant) => activeBatchCount(grant, event.at) > 0);

  if (!consumeBatchFromList(state.mistburn.grants, event.at, { eligible: (grant) => grant === newest })) return;

  state.mistburn.readyAt = gw2Time(event.at + skillNumber(mistburnProcProfile, 'internalCooldown'));

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
      name: 'Mistburn Mortar - Charged Strike',
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
  damage: applyAntiquaryDamageReactions,
  condition: applyMistburnCharge
});
