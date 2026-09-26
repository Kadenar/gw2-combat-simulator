import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { SPECIALIZATIONS } from '#gw2/professions/guardian/data/guardian-api-metadata.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { GuardianResolverContext, GuardianSkill } from '#gw2/professions/guardian/types.js';
import type { GuardianCoreState } from '#gw2/professions/guardian/core/state.js';

const TRAIT_BY_ID = new Map(
  SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat()
  ]).map((trait) => [Number(trait.id), trait])
);

/** Provides shared Guardian trait metadata and resolver emissions without making trait lines import the dispatcher. */
export function guardianTraitIcon(traitId: SkillId): string {
  return TRAIT_BY_ID.get(Number(traitId))?.icon || '';
}

export function isGuardianSymbolSkill(skill: GuardianSkill | undefined, fallbackName = ''): boolean {
  const name = skill?.name || fallbackName;
  const description = String(skill?.description || '');
  return (
    /^Symbol of /.test(name) ||
    /^Lesser Symbol of /.test(name) ||
    /^Symbol\./.test(description) ||
    /\bcreat(?:e|ing) a symbol\b/i.test(description)
  );
}

export function guardianResolverState(context: GuardianResolverContext): GuardianCoreState {
  return professionCoreState(context);
}

export function recordGuardianTraitProc(
  context: GuardianResolverContext,
  traitId: SkillId,
  name: string,
  at: number,
  sourceSkill: string | undefined,
  detail: string
): void {
  context.recordProc('trait', name, at, sourceSkill, detail, guardianTraitIcon(traitId));
}
