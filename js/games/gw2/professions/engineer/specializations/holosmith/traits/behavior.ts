import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { type EngineerRuntime, type EngineerResolverContext } from '#gw2/professions/engineer/types.js';
import { type HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import { grantCharges, consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { type HolosmithResolverEvent } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';

/** Replaces Lens charges only when the Forge transition's grant reaches the resolver. */
export function handleSolarFocusingLens(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
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
    !hasTrait(context.traits, TRAIT.SOLAR_FOCUSING_LENS)
  )
    return;
  const state = holosmithState.from(context);
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, TRAIT.SOLAR_FOCUSING_LENS);
  const condition = requireEffect(solarFocusingLensProfile, 'condition', 'Burning');
  if (!condition) return;
  // Lens cannot activate before its grant; zero-ICD consumption does not enforce readyAt.
  if (event.at < (state.solarFocusingLens.readyAt ?? 0) || !consumeCharge(state.solarFocusingLens, event.at, 0, true))
    return;

  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
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
  });

  return { solarFocusingLens: true };
}

/** Entry, ordinary exit, and overheat choose their grant size at the original transition boundary. */
export function grantSolarFocusingLens(
  context: EngineerRuntime<HolosmithSkill>,
  at: number,
  grant: 'minimumStacks' | 'maximumStacks'
): void {
  if (!hasTrait(context.traits, TRAIT.SOLAR_FOCUSING_LENS)) return;
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, TRAIT.SOLAR_FOCUSING_LENS);
  // Grants cross into the resolver at their activation time; only impacts spend charges.
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'engineer.solar-focusing-lens',
      at,
      source: 'Trait',
      sourceId: TRAIT.SOLAR_FOCUSING_LENS,
      actorType: 'player',
      stacks: balanceProfileNumber(solarFocusingLensProfile, grant),
      duration: balanceProfileNumber(solarFocusingLensProfile, 'durationMultiplier')
    }
  });
}
