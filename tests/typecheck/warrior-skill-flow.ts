import type { Skill } from '#gw2/platform/engine/skills/types.js';
import {
  assembleNativeRuntimeCatalog,
  getNativeCatalogAssembly
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { warriorCatalog, warriorNativeModules } from '#gw2/professions/warrior/catalog.js';
import { warriorCoreModule } from '#gw2/professions/warrior/core/module.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const assembly = getNativeCatalogAssembly(warriorNativeModules, undefined);
const runtimeCatalog = assembleNativeRuntimeCatalog([...assembly.fragments.values()]);
const runtime = warriorProfession.runtimeFor({ specialization: 'Bladesworn' });
const resolved = warriorProfession.resolveProfession({ specialization: 'Bladesworn' });

// Supplying Warrior module data also types inline callbacks without parameter annotations or assertions.
defineNativeModule({
  id: 'Core',
  data: createWarriorModuleData('Core', { skillMechanics: {} }),
  state: { create: () => ({}) },
  hooks: {
    onCastStart(context, cast) {
      const slash: boolean | undefined = cast.skill.dragonSlash;
      const cost: number | undefined = context.helpers.skillsById.get(cast.skill.id)?.adrenalineCost;
      void [slash, cost];
    }
  },
  presentation(catalog) {
    const cost: number | undefined = catalog.skills[0]?.adrenalineCost;
    return { cost };
  }
});

// Each composition boundary must preserve the concrete skill type, not merely accept a cast back to it.
export type WarriorSkillFlowAssertions = [
  Assert<Equal<NonNullable<typeof warriorCoreModule.data.generatedSkills>[number], WarriorSkill>>,
  Assert<Equal<(typeof warriorCatalog.skills)[number], WarriorSkill>>,
  Assert<Equal<(typeof warriorProfession.catalog.skills)[number], WarriorSkill>>,
  Assert<Equal<(typeof runtimeCatalog.skills)[number], WarriorSkill>>,
  Assert<Equal<(typeof resolved.catalog.skills)[number], WarriorSkill>>,
  Assert<Equal<(typeof runtime.catalog.skills)[number], WarriorSkill>>,
  Assert<Equal<Skill['dragonSlash'], unknown>>
];

const hooks: Partial<RuntimeProfession<WarriorRuntimeState, WarriorSkill>> = {
  onCastStart(context, cast) {
    const slash: boolean | undefined = cast.skill.dragonSlash;
    const cost: number | undefined = context.helpers.skillsById.get(cast.skill.id)?.adrenalineCost;
    const named: boolean | undefined = context.helpers.skillsByName.get(cast.skill.name)?.burst;
    const listed: boolean | undefined = context.helpers.skills[0]?.gunsaberSkill;
    // @ts-expect-error Warrior flags retain their declared boolean type.
    const invalid: number = cast.skill.dragonSlash;
    void [slash, cost, named, listed, invalid];
  },
  sideEffectHandlers: {
    'warrior.typed-skill'(_context, action) {
      const cost: number | undefined = action.skill.adrenalineCost;
      if (action.kind === 'cast') {
        const slash: boolean | undefined = action.cast.skill.dragonSlash;
        void slash;
      }

      void cost;
    }
  }
};

const composed = composeRuntimeHooks([compileProfessionRules(hooks)]);
export type WarriorHookSkillAssertion = Assert<
  Equal<Parameters<NonNullable<typeof composed.onCastStart>>[1]['skill'], WarriorSkill>
>;

createWarriorModuleData('Core', {
  skillMechanics: {
    1: {
      // @ts-expect-error Warrior authoring must reject the wrong type for a known field.
      adrenalineCost: 'thirty'
    }
  }
});
