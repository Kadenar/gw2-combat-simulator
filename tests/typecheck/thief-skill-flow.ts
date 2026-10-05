import type { Skill } from '#gw2/platform/skills/types.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefCoreHooks } from '#gw2/professions/thief/core/hooks.js';
import { thiefCoreModule } from '#gw2/professions/thief/core/module.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { antiquaryHooks } from '#gw2/professions/thief/specializations/antiquary/hooks.js';
import { specterHooks } from '#gw2/professions/thief/specializations/specter/hooks.js';
import type { ThiefArtifactKind, ThiefSkill } from '#gw2/professions/thief/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const antiquary = thiefProfession.runtimeFor({ specialization: 'Antiquary' });
const specter = thiefProfession.resolveProfession({ specialization: 'Specter' });
type CoreAvailability = NonNullable<typeof thiefCoreHooks.availability>;
type AntiquaryCastStart = NonNullable<typeof antiquaryHooks.onCastStart>;
type SpecterCastStart = NonNullable<typeof specterHooks.onCastStart>;

// Thief's real module, selected catalogs, and hook signatures must preserve its skill fields end to end.
export type ThiefSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof thiefCoreModule.data.generatedSkills>[number], ThiefSkill>>,
  Assert<Equal<(typeof thiefCatalog.skills)[number], ThiefSkill>>,
  Assert<Equal<(typeof thiefProfession.catalog.skills)[number], ThiefSkill>>,
  Assert<Equal<(typeof antiquary.catalog.skills)[number], ThiefSkill>>,
  Assert<Equal<(typeof specter.catalog.skills)[number], ThiefSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], ThiefSkill>>,
  Assert<Equal<Parameters<AntiquaryCastStart>[1]['skill'], ThiefSkill>>,
  Assert<Equal<Parameters<SpecterCastStart>[1]['skill'], ThiefSkill>>,
  Assert<Equal<Skill['initiativeCost'], unknown>>,
  Assert<Equal<ThiefSkill['dragonSlash'], unknown>>
];

// The shared Thief runtime alias and accepted casts expose numeric costs and profession flags without assertions.
export function thiefHookSkillReads(runtime: ThiefRuntime, cast: Parameters<AntiquaryCastStart>[1]): void {
  const cost: number | undefined = cast.skill.initiativeCost;
  const artifact: ThiefArtifactKind | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.artifactKind;
  const shroud: boolean | undefined = runtime.helpers.skillsByName.get(cast.skill.name)?.shadowShroudSkill;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.stealthAttack;
  // @ts-expect-error Initiative costs retain their numeric type.
  const invalid: string = cast.skill.initiativeCost;
  void [cost, artifact, shroud, listed, invalid];
}

createThiefModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Known Thief fields reject the wrong authored value type.
      initiativeCost: 'six'
    }
  }
});
