import type { AuraEffect } from '#gw2/platform/effects/types.js';
import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';
import { TRAIT_LINES } from '#gw2/professions/elementalist/data/trait-lines.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { weaverHooks } from '#gw2/professions/elementalist/specializations/weaver/hooks.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type NotKey<T, K extends PropertyKey> = K extends keyof T ? false : true;

const first = elementalistProfession.runtimeFor({ specialization: 'Weaver' });
const second = elementalistProfession.resolveProfession({ specialization: 'Evoker' });
type CoreAvailability = NonNullable<typeof elementalistCoreHooks.availability>;
type EliteCast = NonNullable<typeof weaverHooks.onCastStart>;

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type ElementalistSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof elementalistCoreModule.data.skills>[number], ElementalistSkill>>,
  Assert<Equal<(typeof elementalistCatalog.skills)[number], ElementalistSkill>>,
  Assert<Equal<(typeof elementalistProfession.catalog.skills)[number], ElementalistSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], ElementalistSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], ElementalistSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], ElementalistSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], ElementalistSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], ElementalistRuntime['profession']>>,
  Assert<NotKey<Skill, 'attunement'>>,
  Assert<NotKey<ElementalistSkill, 'dragonSlash'>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function elementalistHookSkillReads(runtime: ElementalistRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: string | undefined = cast.skill.attunement;
  const flag: AuraEffect | undefined = runtime.helpers.skillsById
    .get(cast.skill.id)
    ?.effects?.find((effect) => effect.type === 'aura');
  const indexed: string | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.attunement;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.overload;
  // @ts-expect-error Attunement must retain its string type at runtime.
  const invalid: number = cast.skill.attunement;
  void [cost, flag, indexed, listed, invalid];
}

const invalidDefinitions: Record<string, SkillDefinition<ElementalistSkill>> = {
  1: {
    name: 'Fixture',
    icon: 'fixture.png',
    // @ts-expect-error Known profession fields reject invalid authored values.
    attunement: 5
  },
  2: {
    name: 'Fixture',
    icon: 'fixture.png',
    effects: [
      // @ts-expect-error Aura effects require a canonical aura name.
      { type: 'aura', aura: 'Fire|4', duration: 4 }
    ]
  }
};
createNativeModuleData<ElementalistSkill>({
  id: 'Core',
  traitLines: TRAIT_LINES,
  skills: materializeSkillDefinitions(invalidDefinitions)
});

// Hitbox-capped declarations pass through a helper whose concrete parameter still checks the authored literal.
withSmallHitboxCap(
  {
    name: 'Fixture',
    icon: 'fixture.png',
    // @ts-expect-error Misspelled Elementalist fields fail at the declaration.
    attunment: 'Fire'
  },
  1
);
