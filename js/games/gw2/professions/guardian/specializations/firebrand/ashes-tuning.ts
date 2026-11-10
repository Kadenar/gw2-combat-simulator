import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { CONDITION } from '#gw2/platform/constants.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfile,
  requireEffect,
  requireSkill,
  skillNumber
} from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/skills/types.js';
import { ashesBurningSkill } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

// Runtime and presentation supply the selected catalog and trait membership explicitly.
export type AshesSelection = { readonly traits: ReadonlySet<SkillId>; readonly catalog: CanonicalCatalog };

interface AshesBurning {
  readonly stacks: number;
  readonly baseDurationSeconds: number;
}

export interface ResolvedAshes {
  readonly triggerIntervalSeconds: number;
  readonly baseline: AshesBurning;
  readonly burning: AshesBurning;
  readonly overrideTraitId?: SkillId;
}

// Select values before emission so every consumer sees the same effective payload.
export function resolveAshes(selection: AshesSelection): ResolvedAshes | undefined {
  const mechanic: GuardianSkill = requireSkill(selection.catalog, ashesBurningSkill.id);
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
  let overrideTraitId: SkillId | undefined;

  if (traitId !== undefined && hasTrait(selection, traitId)) {
    const trait = requireBalanceProfile(selection.catalog, traitId);
    // Multiply the selected base duration so skill edits and both recipients use the same increase.
    burning = {
      ...baseline,
      baseDurationSeconds: baseline.baseDurationSeconds * balanceProfileNumber(trait, 'durationMultiplier')
    };
    overrideTraitId = traitId;
  }

  return {
    triggerIntervalSeconds: skillNumber(mechanic, 'internalCooldown'),
    baseline,
    burning,
    overrideTraitId
  };
}
