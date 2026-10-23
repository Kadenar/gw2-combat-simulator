import { CONDITION } from '#gw2/platform/constants.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { ASHES_PROFILE } from '#gw2/professions/guardian/specializations/firebrand/ashes-profiles.js';

// Runtime passes helpers + traits; presentation passes catalog + traits.
export type AshesSelection = { readonly traits: ReadonlySet<SkillId> } & (
  { readonly catalog: CanonicalCatalog } | { readonly helpers: CanonicalCatalog }
);

interface AshesBurning {
  readonly stacks: number;
  readonly baseDurationSeconds: number;
}

export interface ResolvedAshes {
  readonly triggerIntervalSeconds: number;
  readonly baseline: AshesBurning;
  readonly burning: AshesBurning;
  readonly payloadProfileId: SkillId;
  readonly overrideTraitId?: SkillId;
}

// Select values before emission so every consumer sees the same effective payload.
export function resolveAshes(selection: AshesSelection): ResolvedAshes | undefined {
  const mechanic = requireBalanceProfileFromContext(selection, ASHES_PROFILE.mechanic);
  const base = requireEffect(mechanic, 'condition', CONDITION.BURNING);

  if (!base) return undefined;

  const baseline = {
    stacks: effectNumber(mechanic, base, 'stacks'),
    baseDurationSeconds: effectNumber(mechanic, base, 'duration')
  };
  const traitId = mechanic.burningOverrideTrait;

  if (
    traitId !== undefined &&
    !(
      (typeof traitId === 'number' && Number.isFinite(traitId)) ||
      (typeof traitId === 'string' && traitId.trim().length > 0)
    )
  ) {
    throw new TypeError('Invalid Ashes burningOverrideTrait reference.');
  }

  let burning = baseline;
  let payloadProfileId: SkillId = mechanic.id;
  let overrideTraitId: SkillId | undefined;

  if (traitId !== undefined && hasTrait(selection, traitId)) {
    const trait = requireBalanceProfileFromContext(selection, traitId);
    const replacement = requireEffect(trait, 'condition', CONDITION.BURNING);

    if (replacement) {
      burning = {
        stacks: effectNumber(trait, replacement, 'stacks'),
        baseDurationSeconds: effectNumber(trait, replacement, 'duration')
      };
      payloadProfileId = trait.id;
      overrideTraitId = traitId;
    }
  }

  return {
    triggerIntervalSeconds: balanceProfileNumber(mechanic, 'internalCooldown'),
    baseline,
    burning,
    payloadProfileId,
    overrideTraitId
  };
}
