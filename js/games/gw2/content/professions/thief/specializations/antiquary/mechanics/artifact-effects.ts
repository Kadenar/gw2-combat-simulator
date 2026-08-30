import { antiquaryState } from '../state.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../../../data/ids.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '../../../types.js';
import { thiefBalanceProfile, thiefBalanceProfileEffect } from '../../../core/profiles.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

// Spend one unexpired Mistburn charge on a qualifying player strike and attach
// its Burning without allowing the mortar's granting strike to self-consume.
function applyMistburnCharge(context: ThiefResolverContext, event: ThiefResolverEvent): void {
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
  context.applyCondition({
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

// Add Meticulous Custodian's Burning only to the Sun Crystal strike packet,
// excluding its declarative condition-only packets.
function applyMeticulousSunCrystal(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    event.skillId !== ID.ZEPHYRITE_SUN_CRYSTAL ||
    event.coefficient == null || // condition-only packets have no coefficient; burning fires on the strike hit
    !hasTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)
  )
    return;
  const burning = thiefBalanceProfileEffect(thiefBalanceProfile(context, PROFILE.sunCrystalMeticulous), 'condition');
  context.applyCondition({
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

function applyAntiquaryDamageReactions(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  // Both Antiquary strike follow-ups use immediate resolver application so
  // charge consumption and condition reactions share one causal timestamp.
  applyMeticulousSunCrystal(context, event);
  applyMistburnCharge(context, event);
}

export const antiquaryResolverEventReactions = Object.freeze({
  damage: applyAntiquaryDamageReactions
});
