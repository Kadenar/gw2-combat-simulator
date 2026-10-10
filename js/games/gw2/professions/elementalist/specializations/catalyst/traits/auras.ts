import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { activeRefreshedStacks, grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { catalystState, type CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Accepted self buffs add to the same refreshed pool, including isolated preview inputs. */
export function applyEmpoweringAurasBuff(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  if (event.kind !== 'empowering auras' || !event.resolvedAudience?.includesSelf) return;
  const state = catalystState.from(context);
  const { maximumStacks } = empoweringAurasParameters(context);
  state.empoweringAuras = grantRefreshedStacks(
    state.empoweringAuras,
    event.stacks || 1,
    event.at,
    gw2EffectExpiresAt(event.at, event.duration || 0),
    maximumStacks,
    'exclusive'
  );
}

/** Strike and condition modifiers read the canonical Catalyst pool without replaying buff receipts. */
export function empoweringAuraStacks(context: Gw2ModifierContext): number {
  const state = readProfessionSpecializationState<CatalystState>(context.runtime?.profession, 'Catalyst');
  return activeRefreshedStacks(state?.empoweringAuras, context.time, 'exclusive');
}

/** Shares aura-stack parameters while each phase retains its grant and refresh rules. */
export function empoweringAurasParameters(context: unknown) {
  const empoweringAurasProfile = requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_AURAS);
  return {
    maximumStacks: balanceProfileNumber(empoweringAurasProfile, 'maximumStacks'),
    duration: balanceProfileNumber(empoweringAurasProfile, 'durationMultiplier')
  };
}
