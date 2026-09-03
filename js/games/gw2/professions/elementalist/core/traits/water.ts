/** Imperative Water trait behavior; post-cast ordering stays in the trait dispatcher. */
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistCastContext as ElementalistLifecycleContext } from '#gw2/professions/elementalist/types.js';
import type { ElementalistAuraApplier } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { emitProfiledBuff } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/** Applies Soothing Ice's Frost Aura and regeneration from an eligible healing skill. */
export function applySoothingIce(
  context: ElementalistLifecycleContext,
  skill: Skill,
  applyAura: ElementalistAuraApplier
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  if (!hasTrait(context, 'Soothing Ice') || !isInternalCooldownReady(at, Number(state.procReadyAt.soothingIce || 0))) {
    return;
  }

  state.procReadyAt.soothingIce =
    at + balanceProfileValueFromContext(context, PROFILE.soothingIce, 'internalCooldown', 15);
  applyAura(context, {
    at,
    aura: 'Frost Aura',
    duration: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.soothingIce, 'buff', 0, 'Frost Aura'),
      'duration',
      4
    ),
    skillName: 'Soothing Ice',
    sourceId: skill.id
  });
  emitProfiledBuff(context, at, PROFILE.soothingIce, 'Regeneration', 'Regeneration', 1, 4, 'Soothing Ice', skill.id);
}
