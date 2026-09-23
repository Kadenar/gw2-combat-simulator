import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';

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
  if (!consumeCharge(state.mistburn, event.at)) return;
  const mistburnProcProfile = requireBalanceProfileFromContext(context, PROFILE.mistburnProc);
  const burning = requireEffect(mistburnProcProfile, 'condition', 'Burning');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!burning) return;
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      source: 'thief',
      sourceId: ID.MISTBURN_MORTAR,
      actorType: 'player',
      skillId: ID.MISTBURN_MORTAR,
      skillName: 'Mistburn Mortar',
      name: 'Mistburn Mortar — Charged Strike',
      condition: String(burning.condition),
      stacks: effectNumber(mistburnProcProfile, burning, 'stacks'),
      duration: effectNumber(mistburnProcProfile, burning, 'duration'),
      triggeredBy: event.skillName
    })
  );
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
  const sunCrystalMeticulousProfile = requireBalanceProfileFromContext(context, PROFILE.sunCrystalMeticulous);
  const burning = requireEffect(sunCrystalMeticulousProfile, 'condition', 'Burning');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!burning) return;
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      source: 'thief',
      sourceId: ID.ZEPHYRITE_SUN_CRYSTAL,
      actorType: 'player',
      skillId: ID.ZEPHYRITE_SUN_CRYSTAL,
      skillName: 'Zephyrite Sun Crystal',
      name: 'Zephyrite Sun Crystal - Meticulous Burning',
      // Preserve trait provenance so the already-enhanced duration is not multiplied again.
      triggeredBy: event.skillName,
      condition: String(burning.condition),
      stacks: effectNumber(sunCrystalMeticulousProfile, burning, 'stacks'),
      duration: effectNumber(sunCrystalMeticulousProfile, burning, 'duration')
    })
  );
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
