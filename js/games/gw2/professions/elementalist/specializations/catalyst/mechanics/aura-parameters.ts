import {
  requireEffectFromContext,
  balanceProfileNumberFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';

/** Shares aura-stack parameters while each phase retains its grant and refresh rules. */
export function empoweringAurasParameters(context: unknown) {
  return {
    maximumStacks: balanceProfileNumberFromContext(context, PROFILE.empoweringAuras, 'maximumStacks'),
    duration: balanceProfileNumberFromContext(context, PROFILE.empoweringAuras, 'durationMultiplier')
  };
}

/** Selects Epitome's empowerment payload without changing combat gating or stack tracking. */
export function elementalEpitomeEmpowerment(context: unknown) {
  const effect = requireEffectFromContext(context, 'balance-profile', PROFILE.elementalEpitome, 'buff', 'Empowerment');
  if (!effect) return undefined;
  return { stacks: Number(effect.stacks), duration: Number(effect.duration) };
}

/** Resolves the shared aura defaults; the resolver retains its canonical attunement identity. */
export function elementalEpitomeAura(context: unknown, attunement: ElementalistAttunement) {
  const effect = requireEffectFromContext(context, 'balance-profile', PROFILE.elementalEpitome, 'buff', attunement);
  if (!effect) return undefined;
  return { aura: String(effect.kind), duration: Number(effect.duration) };
}

/** Fire and Earth combos share boon selection; Air's endurance remains phase-owned. */
export function elementalSynergyBoon(context: unknown, attunement: 'Fire' | 'Earth') {
  const effect = requireEffectFromContext(context, 'balance-profile', PROFILE.elementalSynergy, 'boon', attunement);
  if (!effect) return undefined;
  return {
    kind: String(effect.boon).toLowerCase(),
    stacks: Number(effect.stacks),
    duration: Number(effect.duration)
  };
}
