import type { Skill } from '#gw2/platform/skills/types.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { mesmerCoreHooks } from '#gw2/professions/mesmer/core/hooks.js';
import { mesmerCoreModule } from '#gw2/professions/mesmer/core/module.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { chronomancerHooks } from '#gw2/professions/mesmer/specializations/chronomancer/hooks.js';
import { harmonize, mayhem } from '#gw2/professions/mesmer/specializations/troubadour/traits/index.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const first = mesmerProfession.runtimeFor({ specialization: 'Chronomancer' });
const second = mesmerProfession.resolveProfession({ specialization: 'Troubadour' });
type CoreAvailability = NonNullable<typeof mesmerCoreHooks.availability>;
type EliteCast = NonNullable<typeof chronomancerHooks.onCastStart>;
type TraitCast = NonNullable<NonNullable<typeof harmonize.hooks>['onCastCommit']>;
type TraitTask = NonNullable<NonNullable<typeof mayhem.hooks>['tasks']>[string];

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type MesmerSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof mesmerCoreModule.data.generatedSkills>[number], MesmerSkill>>,
  Assert<Equal<(typeof mesmerCatalog.skills)[number], MesmerSkill>>,
  Assert<Equal<(typeof mesmerProfession.catalog.skills)[number], MesmerSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], MesmerSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], MesmerSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], MesmerSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], MesmerSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], MesmerRuntime['profession']>>,
  Assert<Equal<Parameters<TraitCast>[1]['skill'], MesmerSkill>>,
  Assert<Equal<Parameters<TraitTask>[0]['helpers']['skills'][number], MesmerSkill>>,
  Assert<Equal<(typeof mesmerCatalog.skills)[number]['id'], number>>,
  Assert<Equal<Skill['parentCooldownIncrease'], unknown>>,
  Assert<Equal<MesmerSkill['dragonSlash'], unknown>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function mesmerHookSkillReads(runtime: MesmerRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: number | undefined = cast.skill.parentCooldownIncrease;
  const flag: string | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.crescendoProfileId;
  const named: number | undefined = runtime.helpers.skillsByName.get(cast.skill.name)?.parentCooldownIncrease;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.phantasm;
  // @ts-expect-error Numeric mechanics must not lose their type at runtime.
  const invalid: string = cast.skill.parentCooldownIncrease;
  void [cost, flag, named, listed, invalid];
}

createMesmerModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Known profession fields reject invalid authored values.
      parentCooldownIncrease: 'invalid'
    }
  }
});
