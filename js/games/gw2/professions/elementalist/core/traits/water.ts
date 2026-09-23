/** Imperative Water trait behavior; post-cast ordering stays in the trait dispatcher. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
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
  if (!hasTrait(context, 'Soothing Ice')) {
    return;
  }

  const soothingIceProfile = requireBalanceProfileFromContext(context, PROFILE.soothingIce);
  // Claim the existing owner-local timer before any derived effect.
  if (
    !tryConsumeProcCooldown(
      state.procReadyAt,
      'soothingIce',
      at,
      balanceProfileNumber(soothingIceProfile, 'internalCooldown')
    )
  )
    return;
  const soothingIceFrostAura = requireEffect(soothingIceProfile, 'buff', 'Frost Aura');
  if (soothingIceFrostAura) {
    applyAura(context, {
      at,
      aura: String(soothingIceFrostAura.kind),
      duration: Number(soothingIceFrostAura.duration),
      skillName: 'Soothing Ice',
      sourceId: skill.id
    });
  }

  emitProfiledBuff(context, at, PROFILE.soothingIce, 'Regeneration', 'Soothing Ice', skill.id);
}
