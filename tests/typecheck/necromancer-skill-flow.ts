import type { Skill } from '#gw2/platform/skills/types.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import type { NecromancerRuntime } from '#gw2/professions/necromancer/types.js';
import { necromancerCoreHooks } from '#gw2/professions/necromancer/core/hooks.js';
import { necromancerCoreModule } from '#gw2/professions/necromancer/core/module.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { harbingerHooks } from '#gw2/professions/necromancer/specializations/harbinger/hooks.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const first = necromancerProfession.runtimeFor({ specialization: 'Harbinger' });
const second = necromancerProfession.resolveProfession({ specialization: 'Ritualist' });
type CoreAvailability = NonNullable<typeof necromancerCoreHooks.availability>;
type EliteCast = NonNullable<typeof harbingerHooks.onCastStart>;

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type NecromancerSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof necromancerCoreModule.data.generatedSkills>[number], NecromancerSkill>>,
  Assert<Equal<(typeof necromancerCatalog.skills)[number], NecromancerSkill>>,
  Assert<Equal<(typeof necromancerProfession.catalog.skills)[number], NecromancerSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], NecromancerSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], NecromancerSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], NecromancerSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], NecromancerSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], NecromancerRuntime['profession']>>,
  Assert<Equal<Skill['lifeForceCost'], unknown>>,
  Assert<Equal<NecromancerSkill['dragonSlash'], unknown>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function necromancerHookSkillReads(runtime: NecromancerRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: number | undefined = cast.skill.lifeForceCost;
  const flag: string | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.shroud;
  const named: number | undefined = runtime.helpers.skillsByName.get(cast.skill.name)?.lifeForceCost;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.usableInShroud;
  // @ts-expect-error Numeric mechanics must not lose their type at runtime.
  const invalid: string = cast.skill.lifeForceCost;
  void [cost, flag, named, listed, invalid];
}

createNecromancerModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Known profession fields reject invalid authored values.
      lifeForceCost: 'invalid'
    }
  }
});
