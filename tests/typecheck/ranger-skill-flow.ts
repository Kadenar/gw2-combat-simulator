import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { rangerCoreHooks } from '#gw2/professions/ranger/core/hooks.js';
import { rangerCoreModule } from '#gw2/professions/ranger/core/module.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { TRAIT_LINES } from '#gw2/professions/ranger/data/trait-lines.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { galeshotHooks } from '#gw2/professions/ranger/specializations/galeshot/hooks.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type NotKey<T, K extends PropertyKey> = K extends keyof T ? false : true;

const first = rangerProfession.runtimeFor({ specialization: 'Galeshot' });
const second = rangerProfession.resolveProfession({ specialization: 'Untamed' });
type CoreAvailability = NonNullable<typeof rangerCoreHooks.availability>;
type EliteCast = NonNullable<typeof galeshotHooks.onCastStart>;

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type RangerSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof rangerCoreModule.data.skills>[number], RangerSkill>>,
  Assert<Equal<(typeof rangerCatalog.skills)[number], RangerSkill>>,
  Assert<Equal<(typeof rangerProfession.catalog.skills)[number], RangerSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], RangerSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], RangerSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], RangerSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], RangerSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], RangerRuntime['profession']>>,
  Assert<NotKey<Skill, 'arrowCost'>>,
  Assert<NotKey<RangerSkill, 'dragonSlash'>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function rangerHookSkillReads(runtime: RangerRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: number | undefined = cast.skill.arrowCost;
  const flag: readonly string[] | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.petNames;
  const indexed: number | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.arrowCost;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.petSkill;
  // @ts-expect-error Numeric mechanics must not lose their type at runtime.
  const invalid: string = cast.skill.arrowCost;
  void [cost, flag, indexed, listed, invalid];
}

const invalidDefinitions: Record<string, SkillDefinition<RangerSkill>> = {
  1: {
    name: 'Fixture',
    icon: 'fixture.png',
    // @ts-expect-error Known profession fields reject invalid authored values.
    arrowCost: 'invalid'
  }
};
createNativeModuleData<RangerSkill>({
  id: 'Core',
  traitLines: TRAIT_LINES,
  skills: materializeSkillDefinitions(invalidDefinitions)
});

// Pet declarations pass through a helper whose concrete parameter still checks the authored literal.
definePetSkill({
  name: 'Fixture',
  icon: 'fixture.png',
  // @ts-expect-error Misspelled pet fields fail at the declaration.
  petFamilySkil: true
});
