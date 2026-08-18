import { antiquaryState } from './state.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasThiefTrait } from '../../core/state.js';
import type { ThiefResolverContext, ThiefResolverEvent, ThiefResolverReactionDetails } from '../../types.js';
import { thiefBalanceProfile, thiefBalanceProfileEffect } from '../../core/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function applyMistburnCharge(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {}
): void {
  if (
    event.actorType !== 'player' ||
    event.coefficient == null ||
    event.skillId === ID.MISTBURN_MORTAR // the mortar itself grants the charge; it must not also consume one
  )
    return;
  const state = antiquaryState.from(context);
  if (
    Number(state.mistburnCharges || 0) <= 0 ||
    Number(state.mistburnExpiresAt || 0) <= event.at // charges expire together; window is independent of charge count
  )
    return;
  state.mistburnCharges -= 1;
  const burning = thiefBalanceProfileEffect(thiefBalanceProfile(context, PROFILE.mistburnProc), 'condition');
  details.applyCondition?.(context, {
    type: 'condition',
    at: event.at,
    source: 'thief',
    sourceId: ID.MISTBURN_MORTAR,
    actorType: 'player',
    skillId: ID.MISTBURN_MORTAR,
    skillName: 'Mistburn Mortar',
    name: 'Mistburn Mortar — Charged Strike',
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks || 1),
    duration: Number(burning?.duration || 1),
    triggeredBy: event.skillName
  });
}

function applyMeticulousSunCrystal(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {}
): void {
  if (
    event.actorType !== 'player' ||
    event.skillId !== ID.ZEPHYRITE_SUN_CRYSTAL ||
    event.coefficient == null || // condition-only packets have no coefficient; burning fires on the strike hit
    !hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)
  )
    return;
  const burning = thiefBalanceProfileEffect(thiefBalanceProfile(context, PROFILE.sunCrystalMeticulous), 'condition');
  details.applyCondition?.(context, {
    type: 'condition',
    at: event.at,
    source: 'thief',
    sourceId: ID.ZEPHYRITE_SUN_CRYSTAL,
    actorType: 'player',
    skillId: ID.ZEPHYRITE_SUN_CRYSTAL,
    skillName: 'Zephyrite Sun Crystal',
    name: 'Zephyrite Sun Crystal - Meticulous Burning',
    condition: String(burning?.condition || 'Burning'),
    stacks: Number(burning?.stacks || 1),
    duration: Number(burning?.duration || 5)
  });
}

function applyAntiquaryDamageReactions(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  details: ThiefResolverReactionDetails = {}
): void {
  applyMeticulousSunCrystal(context, event, details);
  applyMistburnCharge(context, event, details);
}

export const antiquaryResolverEventReactions = Object.freeze({
  damage: applyAntiquaryDamageReactions
});
