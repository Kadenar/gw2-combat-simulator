import type { Skill } from '#gw2/platform/skills/types.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { guardianCoreModule } from '#gw2/professions/guardian/core/module.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { firebrandHooks } from '#gw2/professions/guardian/specializations/firebrand/hooks.js';
import { luminaryHooks } from '#gw2/professions/guardian/specializations/luminary/hooks.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const firebrand = guardianProfession.runtimeFor({ specialization: 'Firebrand' });
const luminary = guardianProfession.resolveProfession({ specialization: 'Luminary' });
type FirebrandAvailability = NonNullable<typeof firebrandHooks.availability>;
type LuminaryCastStart = NonNullable<typeof luminaryHooks.onCastStart>;

// Real Guardian exports must retain their skill type through registration, selection, and hook parameters.
export type GuardianSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof guardianCoreModule.data.generatedSkills>[number], GuardianSkill>>,
  Assert<Equal<(typeof guardianCatalog.skills)[number], GuardianSkill>>,
  Assert<Equal<(typeof guardianProfession.catalog.skills)[number], GuardianSkill>>,
  Assert<Equal<(typeof firebrand.catalog.skills)[number], GuardianSkill>>,
  Assert<Equal<(typeof luminary.catalog.skills)[number], GuardianSkill>>,
  Assert<Equal<Parameters<FirebrandAvailability>[1], GuardianSkill>>,
  Assert<Equal<Parameters<LuminaryCastStart>[1]['skill'], GuardianSkill>>,
  Assert<Equal<Skill['tome'], unknown>>,
  Assert<Equal<GuardianSkill['dragonSlash'], unknown>>
];

// ID/name lookups and accepted casts expose Guardian fields directly, without local assertions.
export function guardianHookSkillReads(
  runtime: Parameters<LuminaryCastStart>[0],
  cast: Parameters<LuminaryCastStart>[1]
): void {
  const forge: boolean | undefined = cast.skill.radiantForgeSkill;
  const weapon: string | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.radiantWeapon;
  const tome: string | undefined = runtime.helpers.skillsByName.get(cast.skill.name)?.tome;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.radiantForgeSkill;
  // @ts-expect-error Guardian's tome field is a string, not a number.
  const invalid: number = cast.skill.tome;
  void [forge, weapon, tome, listed, invalid];
}

createGuardianModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Guardian module data preserves the declared type of known profession fields.
      radiantForgeSkill: 'active'
    }
  }
});
