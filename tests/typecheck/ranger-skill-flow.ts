import type { Skill } from '#gw2/platform/skills/types.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';
import { rangerCoreHooks } from '#gw2/professions/ranger/core/hooks.js';
import { rangerCoreModule } from '#gw2/professions/ranger/core/module.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { galeshotHooks } from '#gw2/professions/ranger/specializations/galeshot/hooks.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const first = rangerProfession.runtimeFor({ specialization: 'Galeshot' });
const second = rangerProfession.resolveProfession({ specialization: 'Untamed' });
type CoreAvailability = NonNullable<typeof rangerCoreHooks.availability>;
type EliteCast = NonNullable<typeof galeshotHooks.onCastStart>;

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type RangerSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof rangerCoreModule.data.generatedSkills>[number], RangerSkill>>,
  Assert<Equal<(typeof rangerCatalog.skills)[number], RangerSkill>>,
  Assert<Equal<(typeof rangerProfession.catalog.skills)[number], RangerSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], RangerSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], RangerSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], RangerSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], RangerSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], RangerRuntime['profession']>>,
  Assert<Equal<Skill['arrowCost'], unknown>>,
  Assert<Equal<RangerSkill['dragonSlash'], unknown>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function rangerHookSkillReads(runtime: RangerRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: number | undefined = cast.skill.arrowCost;
  const flag: readonly string[] | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.petNames;
  const named: number | undefined = runtime.helpers.skillsByName.get(cast.skill.name)?.arrowCost;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.petSkill;
  // @ts-expect-error Numeric mechanics must not lose their type at runtime.
  const invalid: string = cast.skill.arrowCost;
  void [cost, flag, named, listed, invalid];
}

createRangerModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Known profession fields reject invalid authored values.
      arrowCost: 'invalid'
    }
  }
});
