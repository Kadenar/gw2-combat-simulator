import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { weaverHooks } from '#gw2/professions/elementalist/specializations/weaver/hooks.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const first = elementalistProfession.runtimeFor({ specialization: 'Weaver' });
const second = elementalistProfession.resolveProfession({ specialization: 'Evoker' });
type CoreAvailability = NonNullable<typeof elementalistCoreHooks.availability>;
type EliteCast = NonNullable<typeof weaverHooks.onCastStart>;

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type ElementalistSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof elementalistCoreModule.data.generatedSkills>[number], ElementalistSkill>>,
  Assert<Equal<(typeof elementalistCatalog.skills)[number], ElementalistSkill>>,
  Assert<Equal<(typeof elementalistProfession.catalog.skills)[number], ElementalistSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], ElementalistSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], ElementalistSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], ElementalistSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], ElementalistSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], ElementalistRuntime['profession']>>,
  Assert<Equal<Skill['attunement'], unknown>>,
  Assert<Equal<ElementalistSkill['dragonSlash'], unknown>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function elementalistHookSkillReads(runtime: ElementalistRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: string | undefined = cast.skill.attunement;
  const flag: string | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.aura;
  const named: string | undefined = runtime.helpers.skillsByName.get(cast.skill.name)?.attunement;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.overload;
  // @ts-expect-error Attunement must retain its string type at runtime.
  const invalid: number = cast.skill.attunement;
  void [cost, flag, named, listed, invalid];
}

createElementalistModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Known profession fields reject invalid authored values.
      attunement: 5
    }
  }
});
