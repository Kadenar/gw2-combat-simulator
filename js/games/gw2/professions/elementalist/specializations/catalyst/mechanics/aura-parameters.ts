import {
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { CATALYST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';

/** Shares aura-stack parameters while each phase retains its grant and refresh rules. */
export function empoweringAurasParameters(context: unknown) {
  return {
    maximumStacks: balanceProfileValueFromContext(context, PROFILE.empoweringAuras, 'maximumStacks', 5),
    duration: balanceProfileValueFromContext(context, PROFILE.empoweringAuras, 'durationMultiplier', 10)
  };
}

/** Selects Epitome's empowerment payload without changing combat gating or stack tracking. */
export function elementalEpitomeEmpowerment(context: unknown) {
  const effect = balanceProfileEffectFromContext(context, PROFILE.elementalEpitome, 'buff', 0, 'Empowerment');
  return { stacks: Number(effect?.stacks ?? 1), duration: Number(effect?.duration ?? 15) };
}

/** Resolves the shared aura defaults; the resolver retains its canonical attunement identity. */
export function elementalEpitomeAura(context: unknown, attunement: ElementalistAttunement) {
  const [canonicalAura, duration] =
    attunement === 'Fire'
      ? (['Fire Aura', 4] as const)
      : attunement === 'Water'
        ? (['Frost Aura', 4] as const)
        : attunement === 'Air'
          ? (['Shocking Aura', 3] as const)
          : (['Magnetic Aura', 3] as const);
  const effect = balanceProfileEffectFromContext(context, PROFILE.elementalEpitome, 'buff', 0, attunement);
  return { canonicalAura, aura: String(effect?.kind || canonicalAura), duration: Number(effect?.duration ?? duration) };
}

/** Fire and Earth combos share boon selection; Air's endurance remains phase-owned. */
export function elementalSynergyBoon(context: unknown, attunement: 'Fire' | 'Earth') {
  const effect = balanceProfileEffectFromContext(context, PROFILE.elementalSynergy, 'boon', 0, attunement);
  return {
    kind: String(effect?.boon || (attunement === 'Fire' ? 'Might' : 'Stability')).toLowerCase(),
    stacks: Number(effect?.stacks ?? (attunement === 'Fire' ? 6 : 2)),
    duration: Number(effect?.duration ?? (attunement === 'Fire' ? 10 : 6))
  };
}
