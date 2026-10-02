import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';
import { engineerCoreHooks } from '#gw2/professions/engineer/core/hooks.js';
import { engineerCoreModule } from '#gw2/professions/engineer/core/module.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { mechanistHooks } from '#gw2/professions/engineer/specializations/mechanist/hooks.js';
import { holosmithHooks } from '#gw2/professions/engineer/specializations/holosmith/hooks.js';
import type {
  HolosmithSkill,
  HolosmithSkillFragment
} from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const first = engineerProfession.runtimeFor({ specialization: 'Mechanist' });
const second = engineerProfession.resolveProfession({ specialization: 'Amalgam' });
type CoreAvailability = NonNullable<typeof engineerCoreHooks.availability>;
type EliteCast = NonNullable<typeof mechanistHooks.onCastStart>;
type HolosmithCast = NonNullable<typeof holosmithHooks.onCastCommit>;

// Real modules, selected catalogs, and hooks retain profession fields without widening to Skill or any.
export type EngineerSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof engineerCoreModule.data.generatedSkills>[number], EngineerSkill>>,
  Assert<Equal<(typeof engineerCatalog.skills)[number], EngineerSkill>>,
  Assert<Equal<(typeof engineerProfession.catalog.skills)[number], EngineerSkill>>,
  Assert<Equal<(typeof first.catalog.skills)[number], EngineerSkill>>,
  Assert<Equal<(typeof second.catalog.skills)[number], EngineerSkill>>,
  Assert<Equal<Parameters<CoreAvailability>[1], EngineerSkill>>,
  Assert<Equal<Parameters<EliteCast>[1]['skill'], EngineerSkill>>,
  Assert<Equal<Parameters<EliteCast>[0]['profession'], EngineerRuntime['profession']>>,
  Assert<Equal<Parameters<HolosmithCast>[1]['skill'], HolosmithSkill>>,
  Assert<Equal<Parameters<HolosmithCast>[0]['helpers']['skills'][number], HolosmithSkill>>,
  Assert<Equal<EngineerSkill['heatGain'], unknown>>,
  Assert<Equal<Skill['mechanicSlot'], unknown>>,
  Assert<Equal<EngineerSkill['dragonSlash'], unknown>>
];

// Casts and ID/name/list lookups expose the same typed mechanics to runtime helpers.
export function engineerHookSkillReads(runtime: EngineerRuntime, cast: Parameters<EliteCast>[1]): void {
  const cost: number | undefined = cast.skill.mechanicSlot;
  const flag: string | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.kitTransition;
  const named: number | undefined = runtime.helpers.skillsByName.get(cast.skill.name)?.mechanicSlot;
  const listed: boolean | undefined = runtime.helpers.skills[0]?.countsAsToolbeltSkill;
  // @ts-expect-error Numeric mechanics must not lose their type at runtime.
  const invalid: string = cast.skill.mechanicSlot;
  void [cost, flag, named, listed, invalid];
}

createEngineerModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Known profession fields reject invalid authored values.
      mechanicSlot: 'invalid'
    }
  }
});

// Heat stays local to Holosmith while its helpers still inherit Engineer kit metadata.
export function holosmithSkillReads(
  runtime: EngineerRuntime<HolosmithSkill>,
  cast: Parameters<HolosmithCast>[1]
): void {
  const heat: number | undefined = cast.skill.heatGain;
  const forge: boolean | undefined = runtime.helpers.skillsById.get(cast.skill.id)?.forgeSkill;
  const transition: 'equip' | 'stow' | undefined = cast.skill.kitTransition;
  const invalid: HolosmithSkillFragment = {
    // @ts-expect-error Holosmith heat declarations remain numeric.
    heatGain: 'hot'
  };
  void [heat, forge, transition, invalid];
}
