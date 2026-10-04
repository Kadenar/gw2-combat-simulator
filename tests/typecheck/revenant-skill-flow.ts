import type { Skill } from '#gw2/platform/skills/types.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantCoreHooks } from '#gw2/professions/revenant/core/hooks.js';
import { revenantCoreModule } from '#gw2/professions/revenant/core/module.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { conduitHooks } from '#gw2/professions/revenant/specializations/conduit/hooks.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const first = revenantProfession.runtimeFor({ specialization: 'Conduit' });
const second = revenantProfession.resolveProfession({ specialization: 'Herald' });
type CoreAvailability = NonNullable<typeof revenantCoreHooks.availability>;
type EliteCast = NonNullable<typeof conduitHooks.onCastStart>;

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type RevenantSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof revenantCoreModule.data.generatedSkills>[number], RevenantSkill>>,
  Assert<Equal<(typeof revenantCatalog.skills)[number], RevenantSkill>>,
  Assert<Equal<(typeof revenantProfession.catalog.skills)[number], RevenantSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], RevenantSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], RevenantSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], RevenantSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], RevenantSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], RevenantRuntime['profession']>>,
  Assert<Equal<Skill['energyCost'], unknown>>,
  Assert<Equal<RevenantSkill['dragonSlash'], unknown>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function revenantHookSkillReads(runtime: RevenantRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: number | undefined = cast.skill.energyCost;
  const flag: string | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.legendId;
  const named: number | undefined = runtime.helpers.skillsByName.get(cast.skill.name)?.energyCost;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.facet;
  // @ts-expect-error Numeric mechanics must not lose their type at runtime.
  const invalid: string = cast.skill.energyCost;
  void [cost, flag, named, listed, invalid];
}

createRevenantModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Known profession fields reject invalid authored values.
      energyCost: 'invalid'
    }
  }
});
