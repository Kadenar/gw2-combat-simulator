import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { necromancerCoreHooks } from '#gw2/professions/necromancer/core/hooks.js';
import { necromancerCoreModule } from '#gw2/professions/necromancer/core/module.js';
import { TRAIT_LINES } from '#gw2/professions/necromancer/data/trait-lines.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { harbingerHooks } from '#gw2/professions/necromancer/specializations/harbinger/hooks.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type NotKey<T, K extends PropertyKey> = K extends keyof T ? false : true;

const first = necromancerProfession.runtimeFor({ specialization: 'Harbinger' });
const second = necromancerProfession.resolveProfession({ specialization: 'Ritualist' });
type CoreAvailability = NonNullable<typeof necromancerCoreHooks.availability>;
type EliteCast = NonNullable<typeof harbingerHooks.onCastStart>;

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type NecromancerSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof necromancerCoreModule.data.skills>[number], NecromancerSkill>>,
  Assert<Equal<(typeof necromancerCatalog.skills)[number], NecromancerSkill>>,
  Assert<Equal<(typeof necromancerProfession.catalog.skills)[number], NecromancerSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], NecromancerSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], NecromancerSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], NecromancerSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], NecromancerSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], NecromancerRuntime['profession']>>,
  Assert<NotKey<Skill, 'lifeForceGain'>>,
  // Staggered minion creation is a Necromancer declaration, not a shared recipient field.
  Assert<NotKey<Skill, 'summonCount'>>,
  Assert<NotKey<NecromancerSkill, 'summons'>>,
  Assert<Equal<NecromancerSkill['summonCount'], number | undefined>>,
  Assert<NotKey<NecromancerSkill, 'dragonSlash'>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function necromancerHookSkillReads(runtime: NecromancerRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: number | undefined = cast.skill.lifeForceGain;
  const flag: string | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.shroud;
  const indexed: number | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.lifeForceGain;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.usableInShroud;
  // @ts-expect-error Numeric mechanics must not lose their type at runtime.
  const invalid: string = cast.skill.lifeForceGain;
  void [cost, flag, indexed, listed, invalid];
}

const invalidDefinitions: Record<string, SkillDefinition<NecromancerSkill>> = {
  1: {
    name: 'Fixture',
    icon: 'fixture.png',
    // @ts-expect-error Known profession fields reject invalid authored values.
    lifeForceGain: 'invalid'
  }
};
createNativeModuleData<NecromancerSkill>({
  id: 'Core',
  traitLines: TRAIT_LINES,
  skills: materializeSkillDefinitions(invalidDefinitions)
});
