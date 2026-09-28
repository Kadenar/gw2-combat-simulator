import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import type { EngineerResolverContext } from '#gw2/professions/engineer/types.js';
import type { HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
/** Replaces Lens charges only when the Forge transition's grant reaches the resolver. */
function handleSolarFocusingLens(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const state = holosmithState.from(context);
  // Lens keeps its inclusive final-hit policy on the temporary-effect expiry tick.
  state.solarFocusingLens = {
    ...grantCharges(Number(event.stacks), gw2EffectExpiresAt(event.at, Number(event.duration))),
    readyAt: event.at
  };
}

/** Spends Lens charges in impact order, including strikes materialized by resolver handlers. */
export function consumeSolarFocusingLens(
  context: EngineerResolverContext,
  event: HolosmithResolverEvent
): { solarFocusingLens: true } | void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.config, TRAIT.SOLAR_FOCUSING_LENS)
  )
    return;
  const state = holosmithState.from(context);
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, PROFILE.solarFocusingLens);
  const condition = requireEffect(solarFocusingLensProfile, 'condition', 'Burning');
  if (!condition) return;
  // Lens cannot activate before its grant; zero-ICD consumption does not enforce readyAt.
  if (event.at < (state.solarFocusingLens.readyAt ?? 0) || !consumeCharge(state.solarFocusingLens, event.at, 0, true))
    return;

  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.SOLAR_FOCUSING_LENS,
      actorType: 'player',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Solar Focusing Lens — Burning',
      condition: String(condition.condition),
      stacks: Number(condition.stacks),
      duration: Number(condition.duration)
    })
  );

  return { solarFocusingLens: true };
}

/** Lens grants remain a shared trait observer across all player strikes. */
export const holosmithResolverEventHandlers = Object.freeze({
  'engineer.solar-focusing-lens': handleSolarFocusingLens
});
